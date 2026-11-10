"""Tests for the Story Bible commit through the real store."""

from __future__ import annotations

import pytest

from agentic_writing_system.stores.sql_story_store import SqlStoryStore
from agentic_writing_system.stores.story_store import CommitSource, Conflict
from agentic_writing_system.story_bible.commit import (
    CommitPlan,
    Committed,
    commit,
    import_story,
    plan_commit,
)
from agentic_writing_system.story_bible.document import document_from_stored
from agentic_writing_system.story_bible.records import Entity, Event
from agentic_writing_system.story_bible.rules import Refusal
from agentic_writing_system.story_bible.writes import (
    CreateEntity,
    CreateEvent,
    CreateProperty,
    CreateUnit,
    DeleteWrite,
    SetStoryWrite,
    UpdateEntity,
    UpdateProperty,
    Write,
)
from tests.story_bible.examples import valid_document


async def _create_story(story_store: SqlStoryStore, user_id: str) -> str:
    row = await story_store.create(user_id)
    return row.story_id


@pytest.mark.asyncio
async def test_create_entity(user_id: str, story_store: SqlStoryStore) -> None:
    story_id = await _create_story(story_store, user_id)
    hist_len = len(await story_store.history(user_id, story_id))

    result = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
        CommitSource(source="user"),
    )
    assert isinstance(result, Committed)
    assert result.commit_id is not None
    assert len(result.created) == 1
    assert result.created[0].kind == "entity"
    entity_id = result.created[0].id
    assert result.revisions[entity_id] == 1

    loaded = await story_store.load(user_id, story_id)
    assert any(r.record_id == entity_id for r in loaded.records)

    history = await story_store.history(user_id, story_id)
    assert len(history) == hist_len + 1
    record = history[0]
    assert record.source == "user"
    assert len(record.changes) == 1
    change = record.changes[0]
    assert change.record_id == entity_id
    assert change.before is None
    assert change.after is not None
    assert change.after.get("name") == "Mara"


@pytest.mark.asyncio
async def test_entity_property_ref_then_update(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    first = await commit(
        story_store,
        user_id,
        story_id,
        [
            CreateEntity(fields={"name": "Mara"}, ref="mara"),
            CreateProperty(
                fields={"entity_id": "@mara", "statement": "Brave."},
            ),
        ],
        CommitSource(source="user"),
    )
    assert isinstance(first, Committed)
    prop_id = first.created[1].id

    loaded = await story_store.load(user_id, story_id)
    prop_row = next(r for r in loaded.records if r.record_id == prop_id)
    second = await commit(
        story_store,
        user_id,
        story_id,
        [
            UpdateProperty(
                id=prop_id,
                revision=prop_row.revision,
                fields={"statement": "Very brave."},
            )
        ],
        CommitSource(source="user"),
    )
    assert isinstance(second, Committed)
    assert second.revisions[prop_id] == 2

    history = await story_store.history(user_id, story_id)
    update_change = next(
        c for c in history[0].changes if c.record_id == prop_id and c.op == "update"
    )
    assert update_change.before is not None
    assert update_change.before.get("statement") == "Brave."
    assert update_change.after is not None
    assert update_change.after.get("statement") == "Very brave."


@pytest.mark.asyncio
async def test_refused_write_leaves_story_unchanged(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    before = await story_store.load(user_id, story_id)
    hist_len = len(await story_store.history(user_id, story_id))

    result = await commit(
        story_store,
        user_id,
        story_id,
        [
            CreateEvent(
                fields={
                    "title": "Lonely",
                    "entity_ids": ["entity_nobody"],
                }
            )
        ],
        CommitSource(source="user"),
    )
    assert isinstance(result, Refusal)

    after = await story_store.load(user_id, story_id)
    assert after == before
    assert len(await story_store.history(user_id, story_id)) == hist_len


@pytest.mark.asyncio
async def test_revision_mismatch_on_second_update(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    created = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
        CommitSource(source="user"),
    )
    assert isinstance(created, Committed)
    entity_id = created.created[0].id

    snap = await story_store.load(user_id, story_id)
    row = next(r for r in snap.records if r.record_id == entity_id)
    stale_rev = row.revision

    first = await commit(
        story_store,
        user_id,
        story_id,
        [
            UpdateEntity(
                id=entity_id,
                revision=stale_rev,
                fields={"name": "Mara A"},
            )
        ],
        CommitSource(source="user"),
    )
    assert isinstance(first, Committed)

    second = await commit(
        story_store,
        user_id,
        story_id,
        [
            UpdateEntity(
                id=entity_id,
                revision=stale_rev,
                fields={"name": "Mara B"},
            )
        ],
        CommitSource(source="user"),
    )
    assert isinstance(second, Conflict)
    bad = second.rows[0]
    assert bad.reason == "revision_mismatch"
    assert bad.current is not None
    assert bad.current.fields.get("name") == "Mara A"


@pytest.mark.asyncio
async def test_store_conflict_on_stale_changeset(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    created = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
        CommitSource(source="user"),
    )
    assert isinstance(created, Committed)
    entity_id = created.created[0].id

    stale = await story_store.load(user_id, story_id)
    writes: list[Write] = [
        UpdateEntity(id=entity_id, fields={"name": "From stale plan"})
    ]
    planned = plan_commit(stale, writes)
    assert isinstance(planned, CommitPlan)

    await commit(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, fields={"name": "Landed first"})],
        CommitSource(source="user"),
    )

    outcome = await story_store.save(
        user_id,
        story_id,
        planned.changeset,
        CommitSource(source="user"),
    )
    assert isinstance(outcome, Conflict)


@pytest.mark.asyncio
async def test_two_commits_different_records_both_land(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)

    r1 = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Alpha"})],
        CommitSource(source="user"),
    )
    assert isinstance(r1, Committed)
    a_id = r1.created[0].id

    r2 = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Beta"})],
        CommitSource(source="user"),
    )
    assert isinstance(r2, Committed)
    b_id = r2.created[0].id

    loaded = await story_store.load(user_id, story_id)
    ids = {r.record_id for r in loaded.records}
    assert {a_id, b_id} <= ids


@pytest.mark.asyncio
async def test_missing_record_conflict(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    created = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
        CommitSource(source="user"),
    )
    assert isinstance(created, Committed)
    entity_id = created.created[0].id

    await commit(
        story_store,
        user_id,
        story_id,
        [DeleteWrite(id=entity_id, revision=1)],
        CommitSource(source="user"),
    )

    result = await commit(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Ghost"})],
        CommitSource(source="user"),
    )
    assert isinstance(result, Conflict)
    assert result.rows[0].reason == "missing"
    assert result.rows[0].current is None


@pytest.mark.asyncio
async def test_delete_entity_cascades_properties(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    created = await commit(
        story_store,
        user_id,
        story_id,
        [
            CreateEntity(fields={"name": "Mara"}, ref="mara"),
            CreateProperty(
                fields={"entity_id": "@mara", "statement": "Brave."},
            ),
            CreateProperty(
                fields={"entity_id": "@mara", "statement": "Kind."},
            ),
        ],
        CommitSource(source="user"),
    )
    assert isinstance(created, Committed)
    entity_id = created.created[0].id
    prop_ids = [c.id for c in created.created if c.kind == "property"]

    loaded = await story_store.load(user_id, story_id)
    ent_row = next(r for r in loaded.records if r.record_id == entity_id)
    deleted = await commit(
        story_store,
        user_id,
        story_id,
        [DeleteWrite(id=entity_id, revision=ent_row.revision)],
        CommitSource(source="user"),
    )
    assert isinstance(deleted, Committed)
    assert entity_id in deleted.deleted
    for pid in prop_ids:
        assert pid in deleted.deleted

    after = await story_store.load(user_id, story_id)
    remaining = {r.record_id for r in after.records}
    assert entity_id not in remaining
    assert not (set(prop_ids) & remaining)

    history = await story_store.history(user_id, story_id)
    del_changes = [c for c in history[0].changes if c.op == "delete"]
    del_ids = {c.record_id for c in del_changes}
    assert del_ids == {entity_id, *prop_ids}


@pytest.mark.asyncio
async def test_unit_and_story_revision_conflict(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    snap = await story_store.load(user_id, story_id)
    story_rev = snap.story.revision

    placed = await commit(
        story_store,
        user_id,
        story_id,
        [
            CreateUnit(fields={"title": "Act One"}, ref="act"),
            SetStoryWrite(revision=story_rev, fields={"unit_ids": ["@act"]}),
        ],
        CommitSource(source="user"),
    )
    assert isinstance(placed, Committed)
    assert placed.story_revision == 2

    conflict = await commit(
        story_store,
        user_id,
        story_id,
        [SetStoryWrite(revision=story_rev, fields={"title": "T"})],
        CommitSource(source="user"),
    )
    assert isinstance(conflict, Conflict)
    assert conflict.rows[0].record_id is None
    assert conflict.rows[0].reason == "revision_mismatch"


@pytest.mark.asyncio
async def test_no_op_commit_writes_no_history(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _create_story(story_store, user_id)
    created = await commit(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
        CommitSource(source="user"),
    )
    assert isinstance(created, Committed)
    entity_id = created.created[0].id

    loaded = await story_store.load(user_id, story_id)
    row = next(r for r in loaded.records if r.record_id == entity_id)
    hist_len = len(await story_store.history(user_id, story_id))

    noop = await commit(
        story_store,
        user_id,
        story_id,
        [
            UpdateEntity(
                id=entity_id,
                revision=row.revision,
                fields={"name": "Mara"},
            )
        ],
        CommitSource(source="user"),
    )
    assert isinstance(noop, Committed)
    assert noop.commit_id is None
    assert noop.revisions == {}
    assert len(await story_store.history(user_id, story_id)) == hist_len


@pytest.mark.asyncio
async def test_import_valid_document(user_id: str, story_store: SqlStoryStore) -> None:
    doc = valid_document()
    story_id = await import_story(story_store, user_id, doc)
    assert isinstance(story_id, str)

    loaded = await story_store.load(user_id, story_id)
    round_trip = document_from_stored(loaded)
    assert round_trip == doc

    for row in loaded.records:
        assert row.revision == 1
    assert loaded.story.revision == 2

    history = await story_store.history(user_id, story_id)
    assert len(history) == 1
    assert history[0].source == "import"

    id2 = await import_story(story_store, user_id, doc)
    assert isinstance(id2, str)
    assert id2 != story_id
    loaded2 = await story_store.load(user_id, id2)
    ids1 = {r.record_id for r in loaded.records}
    ids2 = {r.record_id for r in loaded2.records}
    assert ids2 == ids1


@pytest.mark.asyncio
async def test_refused_import_creates_nothing(
    user_id: str, story_store: SqlStoryStore
) -> None:
    base = valid_document()

    dangling = base.model_copy(deep=True)
    dangling.events.append(
        Event(id="event_bad", title="Bad", entity_ids=["entity_missing"])
    )
    assert isinstance(await import_story(story_store, user_id, dangling), Refusal)

    dup = base.model_copy(deep=True)
    dup.entities.append(Entity(id="entity_mara", name="Duplicate"))
    assert isinstance(await import_story(story_store, user_id, dup), Refusal)

    wrong_ver = base.model_copy(deep=True)
    wrong_ver.schema_version = 99
    refused = await import_story(story_store, user_id, wrong_ver)
    assert isinstance(refused, Refusal)
    assert refused.problems[0].code == "schema_version"

    assert await story_store.list_stories(user_id) == []
