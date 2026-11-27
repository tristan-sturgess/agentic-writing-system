"""Revert through the real store."""

from __future__ import annotations

import pytest

from agentic_writing_system.stores.sql_story_store import SqlStoryStore
from agentic_writing_system.stores.story_store import (
    CommitRecord,
    CommitSource,
    Conflict,
)
from agentic_writing_system.story_bible.commit import Committed, commit
from agentic_writing_system.story_bible.document import document_from_stored
from agentic_writing_system.story_bible.revert import revert
from agentic_writing_system.story_bible.rules import Refusal
from agentic_writing_system.story_bible.writes import (
    CreateArc,
    CreateEntity,
    CreateEvent,
    CreateProperty,
    CreateUnit,
    DeleteWrite,
    SetStoryWrite,
    UpdateArc,
    UpdateEntity,
    UpdateUnit,
    Write,
)


async def _story(story_store: SqlStoryStore, user_id: str) -> str:
    row = await story_store.create(user_id)
    return row.story_id


async def _save(
    story_store: SqlStoryStore,
    user_id: str,
    story_id: str,
    writes: list[Write],
) -> Committed:
    result = await commit(
        story_store,
        user_id,
        story_id,
        writes,
        CommitSource(source="user"),
    )
    assert isinstance(result, Committed)
    assert result.commit_id is not None
    return result


async def _revision(
    story_store: SqlStoryStore,
    user_id: str,
    story_id: str,
    record_id: str | None = None,
) -> int:
    stored = await story_store.load(user_id, story_id)
    if record_id is None:
        return stored.story.revision
    for row in stored.records:
        if row.record_id == record_id:
            return row.revision
    raise AssertionError(record_id)


def _touching(history: list[CommitRecord], record_id: str, op: str) -> CommitRecord:
    for record in history:
        for change in record.changes:
            if change.record_id == record_id and change.op == op:
                return record
    raise AssertionError(f"no {op} of {record_id}")


@pytest.mark.asyncio
async def test_update_is_restored(user_id: str, story_store: SqlStoryStore) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Lina"})],
    )
    history = await story_store.history(user_id, story_id)
    update = _touching(history, entity_id, "update")

    result = await revert(story_store, user_id, story_id, [update.commit_id])
    assert isinstance(result, Committed)

    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.entities[0].id == entity_id
    assert document.entities[0].name == "Mara"

    again = await story_store.history(user_id, story_id)
    assert again[0].source == "revert"
    assert again[0].reverts == [update.commit_id]


@pytest.mark.asyncio
async def test_entity_delete_restores_original_ids(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [
            CreateEntity(fields={"name": "Mara"}, ref="mara"),
            CreateProperty(
                fields={"entity_id": "@mara", "statement": "Keeps a lantern."}
            ),
        ],
    )
    entity_id = created.created[0].id
    property_id = created.created[1].id
    await _save(
        story_store,
        user_id,
        story_id,
        [DeleteWrite(id=entity_id, revision=1)],
    )
    history = await story_store.history(user_id, story_id)
    deleted = _touching(history, entity_id, "delete")

    result = await revert(story_store, user_id, story_id, [deleted.commit_id])
    assert isinstance(result, Committed)
    restored = {item.id: item for item in result.created}
    assert restored[entity_id].kind == "entity"
    assert restored[entity_id].ref is None
    assert restored[property_id].kind == "property"
    assert restored[property_id].ref is None

    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.entities[0].id == entity_id
    assert document.entities[0].name == "Mara"
    assert document.properties[0].id == property_id
    assert document.properties[0].entity_id == entity_id
    assert document.properties[0].statement == "Keeps a lantern."


@pytest.mark.asyncio
async def test_reverting_a_create_is_refused_while_a_property_names_it(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    property_commit = await _save(
        story_store,
        user_id,
        story_id,
        [
            CreateProperty(
                fields={"entity_id": entity_id, "statement": "Keeps a lantern."}
            )
        ],
    )
    property_id = property_commit.created[0].id
    history = await story_store.history(user_id, story_id)
    create = _touching(history, entity_id, "create")

    result = await revert(story_store, user_id, story_id, [create.commit_id])
    assert isinstance(result, Refusal)
    problem = result.problems[0]
    assert problem.code == "delete_still_named"
    assert property_id in problem.referring


@pytest.mark.asyncio
async def test_reverting_after_a_later_edit_conflicts(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Lina"})],
    )
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=2, fields={"name": "Sera"})],
    )
    history = await story_store.history(user_id, story_id)
    first_edit = next(
        record
        for record in reversed(history)
        if any(
            change.record_id == entity_id
            and change.after
            and change.after.get("name") == "Lina"
            for change in record.changes
        )
    )

    result = await revert(story_store, user_id, story_id, [first_edit.commit_id])
    assert isinstance(result, Conflict)
    assert result.rows[0].record_id == entity_id
    assert result.rows[0].current is not None
    assert result.rows[0].current.fields["name"] == "Sera"


@pytest.mark.asyncio
async def test_reverting_a_create_twice_marks_it_gone(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    history = await story_store.history(user_id, story_id)
    create = _touching(history, entity_id, "create")

    first = await revert(story_store, user_id, story_id, [create.commit_id])
    assert isinstance(first, Committed)
    second = await revert(story_store, user_id, story_id, [create.commit_id])
    assert isinstance(second, Conflict)
    assert second.rows[0].record_id == entity_id
    assert second.rows[0].reason == "missing"
    assert second.rows[0].current is None


@pytest.mark.asyncio
async def test_reverting_a_revert_reapplies_the_original(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Lina"})],
    )
    history = await story_store.history(user_id, story_id)
    update = _touching(history, entity_id, "update")
    undone = await revert(story_store, user_id, story_id, [update.commit_id])
    assert isinstance(undone, Committed)
    assert undone.commit_id is not None

    reapplied = await revert(story_store, user_id, story_id, [undone.commit_id])
    assert isinstance(reapplied, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.entities[0].name == "Lina"

    again = await story_store.history(user_id, story_id)
    assert again[0].source == "revert"
    assert again[0].reverts == [undone.commit_id]


@pytest.mark.asyncio
async def test_commits_are_undone_newest_first(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Lina"})],
    )
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=2, fields={"name": "Sera"})],
    )
    history = await story_store.history(user_id, story_id)
    older = next(
        record
        for record in history
        if any(
            change.after is not None and change.after.get("name") == "Lina"
            for change in record.changes
        )
    )
    newer = next(
        record
        for record in history
        if any(
            change.after is not None and change.after.get("name") == "Sera"
            for change in record.changes
        )
    )

    result = await revert(
        story_store, user_id, story_id, [older.commit_id, newer.commit_id]
    )
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.entities[0].name == "Mara"
    again = await story_store.history(user_id, story_id)
    assert again[0].reverts == [newer.commit_id, older.commit_id]


@pytest.mark.asyncio
async def test_story_change_is_restored(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    stored = await story_store.load(user_id, story_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [SetStoryWrite(revision=stored.story.revision, fields={"title": "Lantern"})],
    )
    history = await story_store.history(user_id, story_id)
    story_change = next(
        record
        for record in history
        if any(change.kind == "story" for change in record.changes)
    )

    result = await revert(story_store, user_id, story_id, [story_change.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.title == ""


@pytest.mark.asyncio
async def test_unknown_commit_is_refused(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    result = await revert(story_store, user_id, story_id, ["missing-commit"])
    assert isinstance(result, Refusal)
    assert result.problems[0].code == "unknown_commit"
    assert result.problems[0].ids == ["missing-commit"]
    assert await story_store.history(user_id, story_id) == []


@pytest.mark.asyncio
async def test_an_unrelated_edit_does_not_block_a_revert(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Lina"})],
    )
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=2, fields={"notes": "Keeps a lantern."})],
    )
    history = await story_store.history(user_id, story_id)
    renamed = next(
        record
        for record in history
        if any(
            change.record_id == entity_id
            and change.before is not None
            and change.after is not None
            and change.before.get("name") == "Mara"
            and change.after.get("name") == "Lina"
            for change in record.changes
        )
    )

    result = await revert(story_store, user_id, story_id, [renamed.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.entities[0].name == "Mara"
    assert document.entities[0].notes == "Keeps a lantern."


@pytest.mark.asyncio
async def test_reverting_a_create_after_an_edit_conflicts(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    created = await _save(
        story_store,
        user_id,
        story_id,
        [CreateEntity(fields={"name": "Mara"})],
    )
    entity_id = created.created[0].id
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateEntity(id=entity_id, revision=1, fields={"name": "Lina"})],
    )
    history = await story_store.history(user_id, story_id)
    create = _touching(history, entity_id, "create")

    result = await revert(story_store, user_id, story_id, [create.commit_id])
    assert isinstance(result, Conflict)
    assert result.rows[0].record_id == entity_id
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.entities[0].name == "Lina"


@pytest.mark.asyncio
async def test_tone_reverts_after_a_top_level_unit_is_created(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [SetStoryWrite(revision=1, fields={"tone": "grim"})],
    )
    story_revision = await _revision(story_store, user_id, story_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [
            CreateUnit(fields={"title": "Chapter"}, ref="chapter"),
            SetStoryWrite(revision=story_revision, fields={"unit_ids": ["@chapter"]}),
        ],
    )
    history = await story_store.history(user_id, story_id)
    tone = next(
        record
        for record in history
        if any(
            change.kind == "story"
            and change.after is not None
            and change.after.get("tone") == "grim"
            and (change.before or {}).get("tone") != "grim"
            for change in record.changes
        )
    )

    result = await revert(story_store, user_id, story_id, [tone.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.tone == ""
    assert [unit.title for unit in document.units] == ["Chapter"]
    assert document.unit_ids == [document.units[0].id]


@pytest.mark.asyncio
async def test_reverting_unit_creates_keeps_a_later_unit(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    first = await _save(
        story_store,
        user_id,
        story_id,
        [
            CreateUnit(fields={"title": "One"}, ref="one"),
            CreateUnit(fields={"title": "Two"}, ref="two"),
            SetStoryWrite(revision=1, fields={"unit_ids": ["@one", "@two"]}),
        ],
    )
    by_ref = {item.ref: item.id for item in first.created if item.ref is not None}
    story_revision = await _revision(story_store, user_id, story_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [
            CreateUnit(fields={"title": "Three"}, ref="three"),
            SetStoryWrite(
                revision=story_revision,
                fields={"unit_ids": [by_ref["one"], by_ref["two"], "@three"]},
            ),
        ],
    )
    history = await story_store.history(user_id, story_id)
    created = _touching(history, by_ref["one"], "create")

    result = await revert(story_store, user_id, story_id, [created.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert [unit.title for unit in document.units] == ["Three"]
    assert document.unit_ids == [document.units[0].id]


@pytest.mark.asyncio
async def test_reverting_an_arc_addition_keeps_a_later_event(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(
        story_store, user_id, story_id, ["One", "Two", "Five", "Six"]
    )
    one, two, five, six = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two, five])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two, five, six])
    history = await story_store.history(user_id, story_id)
    added = _list_commit(history, arc_id, [one, two, five])

    result = await revert(story_store, user_id, story_id, [added.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, two, six]


@pytest.mark.asyncio
async def test_a_removed_event_returns_beside_its_neighbor(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(
        story_store, user_id, story_id, ["One", "Two", "Three", "Seven"]
    )
    one, two, three, seven = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two, three])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, three])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, three, seven])
    history = await story_store.history(user_id, story_id)
    removed = _list_commit(history, arc_id, [one, three])

    result = await revert(story_store, user_id, story_id, [removed.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, two, three, seven]


@pytest.mark.asyncio
async def test_several_removed_ids_return_in_their_old_order(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(
        story_store, user_id, story_id, ["One", "Two", "Three", "Four", "Five"]
    )
    one, two, three, four, five = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two, three, four])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, four])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, four, five])
    history = await story_store.history(user_id, story_id)
    removed = _list_commit(history, arc_id, [one, four])

    result = await revert(story_store, user_id, story_id, [removed.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, two, three, four, five]


@pytest.mark.asyncio
async def test_a_restored_id_goes_to_the_start_when_no_neighbor_remains(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(story_store, user_id, story_id, ["One", "Two", "Three"])
    one, two, three = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    await _arc_events(story_store, user_id, story_id, arc_id, [two])
    await _arc_events(story_store, user_id, story_id, arc_id, [three])
    history = await story_store.history(user_id, story_id)
    removed = _list_commit(history, arc_id, [two])

    result = await revert(story_store, user_id, story_id, [removed.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, three]


@pytest.mark.asyncio
async def test_an_added_id_removed_since_conflicts(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(story_store, user_id, story_id, ["One", "Two"])
    one, two = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    await _arc_events(story_store, user_id, story_id, arc_id, [one])
    history = await story_store.history(user_id, story_id)
    added = _list_commit(history, arc_id, [one, two])

    result = await revert(story_store, user_id, story_id, [added.commit_id])
    assert isinstance(result, Conflict)
    assert result.rows[0].record_id == arc_id
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one]


@pytest.mark.asyncio
async def test_a_removed_id_added_back_conflicts(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(story_store, user_id, story_id, ["One", "Two"])
    one, two = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    await _arc_events(story_store, user_id, story_id, arc_id, [one])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    history = await story_store.history(user_id, story_id)
    removed = _list_commit(history, arc_id, [one])

    result = await revert(story_store, user_id, story_id, [removed.commit_id])
    assert isinstance(result, Conflict)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, two]


@pytest.mark.asyncio
async def test_a_unit_moved_again_blocks_reverting_the_first_move(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    placed = await _save(
        story_store,
        user_id,
        story_id,
        [
            CreateUnit(fields={"title": "A"}, ref="a"),
            CreateUnit(fields={"title": "B"}, ref="b"),
            CreateUnit(fields={"title": "C"}, ref="c"),
            CreateUnit(fields={"title": "Scene"}, ref="scene"),
            SetStoryWrite(revision=1, fields={"unit_ids": ["@a", "@b", "@c"]}),
            UpdateUnit(id="@a", fields={"child_ids": ["@scene"]}),
        ],
    )
    by_ref = {item.ref: item.id for item in placed.created if item.ref is not None}
    scene = by_ref["scene"]
    await _move_unit(story_store, user_id, story_id, by_ref["a"], by_ref["b"], scene)
    await _move_unit(story_store, user_id, story_id, by_ref["b"], by_ref["c"], scene)
    history = await story_store.history(user_id, story_id)
    first_move = _list_commit(history, by_ref["b"], [scene])

    result = await revert(story_store, user_id, story_id, [first_move.commit_id])
    assert isinstance(result, Conflict)
    assert result.rows[0].record_id == by_ref["b"]
    document = document_from_stored(await story_store.load(user_id, story_id))
    children = {unit.id: unit.child_ids for unit in document.units}
    assert children[by_ref["c"]] == [scene]
    assert children[by_ref["a"]] == []
    assert children[by_ref["b"]] == []


@pytest.mark.asyncio
async def test_a_reorder_conflicts_after_a_later_addition(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(
        story_store, user_id, story_id, ["One", "Two", "Three", "Four"]
    )
    one, two, three, four = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two, three])
    await _arc_events(story_store, user_id, story_id, arc_id, [three, two, one])
    await _arc_events(story_store, user_id, story_id, arc_id, [three, two, one, four])
    history = await story_store.history(user_id, story_id)
    reordered = _list_commit(history, arc_id, [three, two, one])

    result = await revert(story_store, user_id, story_id, [reordered.commit_id])
    assert isinstance(result, Conflict)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [three, two, one, four]


@pytest.mark.asyncio
async def test_a_reorder_keeps_a_later_edit_of_another_field(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(story_store, user_id, story_id, ["One", "Two"])
    one, two = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    await _arc_events(story_store, user_id, story_id, arc_id, [two, one])
    revision = await _revision(story_store, user_id, story_id, arc_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateArc(id=arc_id, revision=revision, fields={"title": "Renamed"})],
    )
    history = await story_store.history(user_id, story_id)
    reordered = _list_commit(history, arc_id, [two, one])

    result = await revert(story_store, user_id, story_id, [reordered.commit_id])
    assert isinstance(result, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, two]
    assert document.arcs[0].title == "Renamed"


@pytest.mark.asyncio
async def test_reverting_a_list_revert_puts_the_event_back(
    user_id: str, story_store: SqlStoryStore
) -> None:
    story_id = await _story(story_store, user_id)
    arc_id, events = await _arc(story_store, user_id, story_id, ["One", "Two", "Three"])
    one, two, three = events
    await _arc_events(story_store, user_id, story_id, arc_id, [one])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two])
    await _arc_events(story_store, user_id, story_id, arc_id, [one, two, three])
    history = await story_store.history(user_id, story_id)
    added = _list_commit(history, arc_id, [one, two])
    undone = await revert(story_store, user_id, story_id, [added.commit_id])
    assert isinstance(undone, Committed)
    assert undone.commit_id is not None

    reapplied = await revert(story_store, user_id, story_id, [undone.commit_id])
    assert isinstance(reapplied, Committed)
    document = document_from_stored(await story_store.load(user_id, story_id))
    assert document.arcs[0].event_ids == [one, two, three]


async def _arc(
    story_store: SqlStoryStore,
    user_id: str,
    story_id: str,
    titles: list[str],
) -> tuple[str, list[str]]:
    """An Arc and one Event per title. The Arc starts with no Events."""
    created = await _save(
        story_store,
        user_id,
        story_id,
        [
            *[
                CreateEvent(fields={"title": title}, ref=f"e{index}")
                for index, title in enumerate(titles)
            ],
            CreateArc(fields={"title": "Arc"}, ref="arc"),
        ],
    )
    by_ref = {item.ref: item.id for item in created.created if item.ref is not None}
    return by_ref["arc"], [by_ref[f"e{index}"] for index in range(len(titles))]


async def _arc_events(
    story_store: SqlStoryStore,
    user_id: str,
    story_id: str,
    arc_id: str,
    event_ids: list[str],
) -> None:
    revision = await _revision(story_store, user_id, story_id, arc_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [UpdateArc(id=arc_id, revision=revision, fields={"event_ids": event_ids})],
    )


def _list_commit(
    history: list[CommitRecord], record_id: str, ids: list[str]
) -> CommitRecord:
    """The commit whose update changed this record's id list to ``ids``.

    A later commit keeps the list in its after-image even when it changed
    another field, so the list has to differ from that commit's before-image.
    """
    return next(
        record
        for record in history
        if any(
            change.record_id == record_id
            and change.before is not None
            and change.after is not None
            and (
                (
                    change.after.get("event_ids") == ids
                    and change.before.get("event_ids") != ids
                )
                or (
                    change.after.get("child_ids") == ids
                    and change.before.get("child_ids") != ids
                )
            )
            for change in record.changes
        )
    )


async def _move_unit(
    story_store: SqlStoryStore,
    user_id: str,
    story_id: str,
    source_id: str,
    target_id: str,
    unit_id: str,
) -> None:
    source = await _revision(story_store, user_id, story_id, source_id)
    target = await _revision(story_store, user_id, story_id, target_id)
    await _save(
        story_store,
        user_id,
        story_id,
        [
            UpdateUnit(id=source_id, revision=source, fields={"child_ids": []}),
            UpdateUnit(id=target_id, revision=target, fields={"child_ids": [unit_id]}),
        ],
    )
