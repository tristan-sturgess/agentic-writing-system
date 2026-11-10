"""Tests for the SQLite story store adapter."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from agentic_writing_system.settings import Settings
from agentic_writing_system.stores.engine import create_app_engine
from agentic_writing_system.stores.migrate import run_migrations
from agentic_writing_system.stores.sql_story_store import SqlStoryStore
from agentic_writing_system.stores.story_store import (
    Change,
    CommitSource,
    Conflict,
    CreateRow,
    DeleteRow,
    GuardRow,
    RowOp,
    Saved,
    StoryNotFoundError,
    UpdateRow,
)
from agentic_writing_system.stores.users import SqlUserStore


@pytest.mark.asyncio
async def test_reload_after_engine_dispose(
    settings: Settings,
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [
            CreateRow(record_id="e1", kind="entity", fields={"name": "A"}, names=[]),
            CreateRow(
                record_id="e2", kind="entity", fields={"name": "B"}, names=["e1"]
            ),
        ],
        CommitSource(source="user"),
    )
    loaded = await story_store.load(user_id, story.story_id)
    assert len(loaded.records) == 2
    assert loaded.records[0].record_id == "e1"
    assert loaded.records[1].revision == 1

    engine = story_store._engine
    await engine.dispose()
    await asyncio.to_thread(run_migrations, settings)
    new_engine = create_app_engine(settings)
    reloaded_store = SqlStoryStore(new_engine)
    again = await reloaded_store.load(user_id, story.story_id)
    await new_engine.dispose()

    assert again.story.story_id == loaded.story.story_id
    assert again.story.revision == loaded.story.revision
    assert [r.record_id for r in again.records] == [r.record_id for r in loaded.records]
    assert [r.revision for r in again.records] == [r.revision for r in loaded.records]


@pytest.mark.asyncio
async def test_ownership(
    engine: AsyncEngine,
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    other = SqlUserStore(engine)
    await other.ensure_user("other")
    other_store = SqlStoryStore(engine)

    with pytest.raises(StoryNotFoundError):
        await other_store.load("other", story.story_id)
    listed = await other_store.list_stories("other")
    assert story.story_id not in {s.story_id for s in listed}


@pytest.mark.asyncio
async def test_create_update_delete_revisions(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    r1 = await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="p1", kind="property", fields={"v": 1}, names=[])],
        CommitSource(source="user"),
    )
    assert isinstance(r1, Saved)
    assert r1.revisions["p1"] == 1

    loaded = await story_store.load(user_id, story.story_id)
    rec = loaded.records[0]
    r2 = await story_store.save(
        user_id,
        story.story_id,
        [
            UpdateRow(
                record_id="p1",
                expected_revision=rec.revision,
                fields={"v": 2},
                names=[],
            )
        ],
        CommitSource(source="user"),
    )
    assert isinstance(r2, Saved)
    assert r2.revisions["p1"] == 2

    loaded = await story_store.load(user_id, story.story_id)
    rec = loaded.records[0]
    r3 = await story_store.save(
        user_id,
        story.story_id,
        [DeleteRow(record_id="p1", expected_revision=rec.revision)],
        CommitSource(source="user"),
    )
    assert isinstance(r3, Saved)
    final = await story_store.load(user_id, story.story_id)
    assert final.records == []


@pytest.mark.asyncio
async def test_concurrent_save_conflict_all_or_nothing(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="a", kind="entity", fields={}, names=[])],
        CommitSource(source="user"),
    )
    snap = await story_store.load(user_id, story.story_id)
    rev = snap.records[0].revision

    cs1 = [
        UpdateRow(record_id="a", expected_revision=rev, fields={"n": 1}, names=[]),
    ]
    cs2: list[RowOp] = [
        UpdateRow(record_id="a", expected_revision=rev, fields={"n": 2}, names=[]),
        CreateRow(record_id="b", kind="entity", fields={}, names=[]),
    ]
    src = CommitSource(source="user")
    first = await story_store.save(user_id, story.story_id, cs1, src)
    second = await story_store.save(user_id, story.story_id, cs2, src)
    assert isinstance(first, Saved)
    assert isinstance(second, Conflict)
    assert second.rows[0].reason == "revision_mismatch"
    assert second.rows[0].current is not None

    after = await story_store.load(user_id, story.story_id)
    assert len(after.records) == 1
    assert after.records[0].fields == {"n": 1}
    assert after.records[0].revision == 2


@pytest.mark.asyncio
async def test_duplicate_create_already_exists(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="x", kind="entity", fields={}, names=[])],
        CommitSource(source="user"),
    )
    again = await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="x", kind="entity", fields={}, names=[])],
        CommitSource(source="user"),
    )
    assert isinstance(again, Conflict)
    assert again.rows[0].reason == "already_exists"


@pytest.mark.asyncio
async def test_dangling_name_both_directions(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    missing = await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="a", kind="entity", fields={}, names=["ghost"])],
        CommitSource(source="user"),
    )
    assert isinstance(missing, Conflict)
    assert missing.rows[0].reason == "dangling_name"
    assert missing.rows[0].missing_names == ["ghost"]

    await story_store.save(
        user_id,
        story.story_id,
        [
            CreateRow(record_id="a", kind="entity", fields={}, names=[]),
            CreateRow(record_id="b", kind="entity", fields={}, names=["a"]),
        ],
        CommitSource(source="user"),
    )
    loaded = await story_store.load(user_id, story.story_id)
    by_id = {r.record_id: r for r in loaded.records}
    blocked = await story_store.save(
        user_id,
        story.story_id,
        [DeleteRow(record_id="a", expected_revision=by_id["a"].revision)],
        CommitSource(source="user"),
    )
    assert isinstance(blocked, Conflict)
    assert blocked.rows[0].reason == "dangling_name"
    assert "a" in blocked.rows[0].missing_names


@pytest.mark.asyncio
async def test_guard_revision_and_conflict(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="u", kind="entity", fields={}, names=[])],
        CommitSource(source="user"),
    )
    loaded = await story_store.load(user_id, story.story_id)
    rev = loaded.records[0].revision
    g1 = await story_store.save(
        user_id,
        story.story_id,
        [GuardRow(record_id="u", expected_revision=rev)],
        CommitSource(source="user"),
    )
    assert isinstance(g1, Saved)
    assert g1.revisions["u"] == 2

    g2 = await story_store.save(
        user_id,
        story.story_id,
        [GuardRow(record_id="u", expected_revision=rev)],
        CommitSource(source="user"),
    )
    assert isinstance(g2, Conflict)
    assert g2.rows[0].reason == "revision_mismatch"


@pytest.mark.asyncio
async def test_commit_record_and_history(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    source = CommitSource(
        source="tool",
        thread_id="t1",
        run_id="r1",
        tool_call_id="tc1",
    )
    s1 = await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="c", kind="entity", fields={"x": 1}, names=[])],
        source,
    )
    assert isinstance(s1, Saved)
    loaded = await story_store.load(user_id, story.story_id)
    rec = loaded.records[0]
    await story_store.save(
        user_id,
        story.story_id,
        [
            UpdateRow(
                record_id="c",
                expected_revision=rec.revision,
                fields={"x": 2},
                names=[],
            )
        ],
        CommitSource(source="user"),
    )
    loaded = await story_store.load(user_id, story.story_id)
    rec = loaded.records[0]
    s3 = await story_store.save(
        user_id,
        story.story_id,
        [DeleteRow(record_id="c", expected_revision=rec.revision)],
        CommitSource(source="user"),
    )
    await story_store.save(
        user_id,
        story.story_id,
        [
            UpdateRow(
                record_id=None,
                expected_revision=1,
                fields={"title": "T"},
                names=[],
            )
        ],
        CommitSource(source="user"),
    )

    hist = await story_store.history(user_id, story.story_id)
    assert len(hist) == 4
    assert hist[0].committed_at >= hist[1].committed_at

    create_commit = next(h for h in hist if any(c.op == "create" for c in h.changes))
    assert create_commit.source == "tool"
    assert create_commit.thread_id == "t1"
    assert create_commit.run_id == "r1"
    assert create_commit.tool_call_id == "tc1"
    ch = create_commit.changes[0]
    assert ch.before is None
    assert ch.after == {"x": 1}

    def is_c_update(c: Change) -> bool:
        return c.op == "update" and c.record_id == "c"

    update_commit = next(h for h in hist if any(is_c_update(c) for c in h.changes))
    uch = update_commit.changes[0]
    assert uch.before == {"x": 1}
    assert uch.after == {"x": 2}

    delete_commit = next(h for h in hist if any(c.op == "delete" for c in h.changes))
    assert delete_commit.changes[0].before == {"x": 2}
    assert delete_commit.changes[0].after is None

    story_commit = next(h for h in hist if any(c.kind == "story" for c in h.changes))
    assert story_commit.changes[0].record_id is None
    assert story_commit.changes[0].after == {"title": "T"}
    assert isinstance(s3, Saved)


@pytest.mark.asyncio
async def test_parallel_save_same_row(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="z", kind="entity", fields={"v": 0}, names=[])],
        CommitSource(source="user"),
    )
    snap = await story_store.load(user_id, story.story_id)
    rev = snap.records[0].revision
    cs_a = [
        UpdateRow(record_id="z", expected_revision=rev, fields={"v": 1}, names=[]),
    ]
    cs_b = [
        UpdateRow(record_id="z", expected_revision=rev, fields={"v": 2}, names=[]),
    ]

    r_a, r_b = await asyncio.gather(
        story_store.save(user_id, story.story_id, cs_a, CommitSource(source="user")),
        story_store.save(user_id, story.story_id, cs_b, CommitSource(source="user")),
    )
    outcomes = {type(r) for r in (r_a, r_b)}
    assert Saved in outcomes
    assert Conflict in outcomes


@pytest.mark.asyncio
async def test_parallel_save_different_rows(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [
            CreateRow(record_id="r1", kind="entity", fields={"v": 1}, names=[]),
            CreateRow(record_id="r2", kind="entity", fields={"v": 1}, names=[]),
        ],
        CommitSource(source="user"),
    )
    snap = await story_store.load(user_id, story.story_id)
    by_id = {r.record_id: r for r in snap.records}

    r_a, r_b = await asyncio.gather(
        story_store.save(
            user_id,
            story.story_id,
            [
                UpdateRow(
                    record_id="r1",
                    expected_revision=by_id["r1"].revision,
                    fields={"v": 10},
                    names=[],
                )
            ],
            CommitSource(source="user"),
        ),
        story_store.save(
            user_id,
            story.story_id,
            [
                UpdateRow(
                    record_id="r2",
                    expected_revision=by_id["r2"].revision,
                    fields={"v": 20},
                    names=[],
                )
            ],
            CommitSource(source="user"),
        ),
    )
    assert isinstance(r_a, Saved)
    assert isinstance(r_b, Saved)
    final = await story_store.load(user_id, story.story_id)
    vals = {r.record_id: r.fields["v"] for r in final.records}
    assert vals == {"r1": 10, "r2": 20}


@pytest.mark.asyncio
async def test_delete_removes_story_and_history(
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    await story_store.save(
        user_id,
        story.story_id,
        [CreateRow(record_id="d", kind="entity", fields={}, names=[])],
        CommitSource(source="user"),
    )
    assert await story_store.history(user_id, story.story_id)
    await story_store.delete(user_id, story.story_id)
    with pytest.raises(StoryNotFoundError):
        await story_store.load(user_id, story.story_id)


async def test_load_does_not_wait_for_a_writer(
    engine: AsyncEngine,
    user_id: str,
    story_store: SqlStoryStore,
) -> None:
    story = await story_store.create(user_id)
    # An open write transaction holds SQLite's write lock.
    async with engine.begin():
        loaded = await asyncio.wait_for(
            story_store.load(user_id, story.story_id), timeout=2
        )
    assert loaded.story.story_id == story.story_id
