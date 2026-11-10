"""Tests for row ↔ document conversion."""

from __future__ import annotations

from datetime import UTC, datetime

from agentic_writing_system.stores.story_store import RecordRow, StoredStory, StoryRow
from agentic_writing_system.story_bible.document import (
    document_from_stored,
    record_fields,
    record_from_row,
    record_kind,
    story_fields,
)
from agentic_writing_system.story_bible.records import StoryDocument


def _empty_story() -> StoredStory:
    now = datetime.now(UTC)
    return StoredStory(
        story=StoryRow(
            story_id="story1",
            owner_id="local",
            schema_version=1,
            fields={},
            names=[],
            revision=1,
            created_at=now,
            updated_at=now,
        ),
        records=[],
    )


def test_empty_story_row_gives_empty_framing() -> None:
    doc = document_from_stored(_empty_story())
    assert doc.title == ""
    assert doc.unit_ids == []
    assert doc.entities == []


def test_document_from_stored_lists_and_order() -> None:
    now = datetime.now(UTC)
    rows = [
        RecordRow(
            record_id="entity_a",
            kind="entity",
            fields={"name": "Alice", "notes": ""},
            names=[],
            revision=1,
        ),
        RecordRow(
            record_id="event_b",
            kind="event",
            fields={"title": "Storm", "description": ""},
            names=[],
            revision=2,
        ),
        RecordRow(
            record_id="entity_c",
            kind="entity",
            fields={"name": "Bob", "notes": "note"},
            names=[],
            revision=1,
        ),
    ]
    stored = StoredStory(
        story=StoryRow(
            story_id="s",
            owner_id="local",
            schema_version=1,
            fields={"title": "My Story"},
            names=[],
            revision=3,
            created_at=now,
            updated_at=now,
        ),
        records=rows,
    )
    doc = document_from_stored(stored)
    assert doc.title == "My Story"
    assert [e.id for e in doc.entities] == ["entity_a", "entity_c"]
    assert doc.events[0].title == "Storm"
    assert len(doc.properties) == 0


def test_record_fields_drop_id() -> None:
    entity = record_from_row(
        RecordRow(
            record_id="entity_x",
            kind="entity",
            fields={"name": "X", "notes": ""},
            names=[],
            revision=1,
        )
    )
    assert record_kind(entity) == "entity"
    assert "id" not in record_fields(entity)
    assert record_fields(entity)["name"] == "X"


def test_story_fields_json_mode() -> None:
    doc = StoryDocument(title="T", premise="P")
    fields = story_fields(doc)
    assert fields["title"] == "T"
    assert fields["premise"] == "P"
    assert "schema_version" not in fields
    assert "entities" not in fields
