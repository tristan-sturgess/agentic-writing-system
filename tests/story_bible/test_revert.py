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
    CreateEntity,
    CreateProperty,
    DeleteWrite,
    SetStoryWrite,
    UpdateEntity,
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
