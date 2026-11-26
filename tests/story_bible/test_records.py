import pytest
from pydantic import TypeAdapter, ValidationError

from agentic_writing_system.story_bible.records import (
    AtSpan,
    Entity,
    EntityPatch,
    EventPoint,
    Property,
    PropertyPatch,
    StoryDocument,
    TimePoint,
    apply_patch,
    timestamp_value,
)
from tests.story_bible.examples import T1, T2, example_story_document


def test_story_document_yaml_example_round_trip() -> None:
    doc = example_story_document()
    payload = doc.model_dump(mode="json")
    restored = StoryDocument.model_validate(payload)
    assert restored == doc


@pytest.mark.parametrize(
    ("timestamp", "valid"),
    [
        ("1847-03-02", True),
        ("1847-03-02T14:30", True),
        ("1847-03-02T14:30:59", True),
        ("0001-01-01", True),
        ("9999-12-31", True),
        ("1847-02-30", False),
        ("1847-13-01", False),
        ("1847-03-02T25:00", False),
        ("1847-03-02T14:30:99", False),
        ("1847-03-02Z", False),
        ("1847-03-02T14:30:00+00:00", False),
        ("not-a-date", False),
        ("0000-01-01", False),
        ("10000-01-01", False),
    ],
)
def test_timestamp_validation(timestamp: str, valid: bool) -> None:
    span = {"kind": "at", "at": {"timestamp": timestamp}}
    if valid:
        StoryDocument.model_validate(
            {
                "events": [
                    {"id": "event_x", "title": "X", "when": [span]},
                ]
            }
        )
    else:
        with pytest.raises(ValidationError):
            StoryDocument.model_validate(
                {
                    "events": [
                        {"id": "event_x", "title": "X", "when": [span]},
                    ]
                }
            )


@pytest.mark.parametrize(
    "bad_span",
    [
        {"kind": "between", "start": {"timestamp": T1}, "end": {"timestamp": T2}},
        {"kind": "at"},
        {"timestamp": T1, "event_id": "event_x"},
        {},
    ],
)
def test_malformed_span_or_time_point_rejected(bad_span: dict[str, object]) -> None:
    time_adapter = TypeAdapter(TimePoint)
    if "kind" in bad_span or bad_span == {}:
        with pytest.raises(ValidationError):
            StoryDocument.model_validate(
                {
                    "events": [
                        {
                            "id": "event_x",
                            "title": "X",
                            "when": [bad_span],
                        }
                    ]
                }
            )
    else:
        with pytest.raises(ValidationError):
            time_adapter.validate_python(bad_span)


@pytest.mark.parametrize(
    "bad_point", [{}, {"timestamp": T1, "event_id": "event_x"}, "1847-03-02"]
)
def test_a_time_point_of_the_wrong_shape_is_one_error(bad_point: object) -> None:
    with pytest.raises(ValidationError) as caught:
        TypeAdapter(TimePoint).validate_python(bad_point)
    errors = caught.value.errors()
    assert [error["type"] for error in errors] == ["time_point_shape"]
    assert "exactly one of timestamp or event_id" in errors[0]["msg"]


def test_a_bad_timestamp_is_one_error() -> None:
    with pytest.raises(ValidationError) as caught:
        AtSpan.model_validate({"at": {"timestamp": "1847-13-40"}})
    errors = caught.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"][-1] == "timestamp"


@pytest.mark.parametrize("edge", ["start", "end"])
def test_an_event_point_accepts_an_edge(edge: str) -> None:
    point = EventPoint.model_validate({"event_id": "event_x", "edge": edge})
    assert point.edge == edge
    assert point.model_dump(mode="json") == {"event_id": "event_x", "edge": edge}


def test_an_event_point_with_no_edge_is_stored_as_null() -> None:
    omitted = EventPoint.model_validate({"event_id": "event_x"})
    explicit = EventPoint.model_validate({"event_id": "event_x", "edge": None})
    assert omitted.edge is None
    assert explicit.edge is None
    assert omitted.model_dump(mode="json") == {"event_id": "event_x", "edge": None}
    assert explicit.model_dump(mode="json") == omitted.model_dump(mode="json")


def test_a_bad_edge_is_one_error() -> None:
    with pytest.raises(ValidationError) as caught:
        AtSpan.model_validate({"at": {"event_id": "event_x", "edge": "middle"}})
    errors = caught.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"][-1] == "edge"


def test_timestamp_value_reads_a_date_as_the_start_of_that_day() -> None:
    assert timestamp_value("1847-03-02") == timestamp_value("1847-03-02T00:00:00")
    assert timestamp_value("1847-03-02") < timestamp_value("1847-03-02T00:01")
    assert timestamp_value("0001-01-01") < timestamp_value("9999-12-31T23:59:59")


def test_unknown_field_on_record_rejected() -> None:
    with pytest.raises(ValidationError):
        Entity.model_validate({"id": "entity_x", "name": "X", "extra": True})


def test_blank_entity_name_accepted() -> None:
    entity = Entity.model_validate({"id": "entity_x", "name": ""})
    assert entity.name == ""


def test_apply_patch_only_supplied_fields() -> None:
    record = Property(
        id="prop_x",
        entity_id="entity_mara",
        statement="Original.",
        caused_by="event_old",
    )
    patch = PropertyPatch(statement="Updated.")
    updated = apply_patch(record, patch)
    assert updated.statement == "Updated."
    assert updated.caused_by == "event_old"
    assert updated.entity_id == "entity_mara"

    patch_none = PropertyPatch.model_validate({"caused_by": None})
    updated_none = apply_patch(updated, patch_none)
    assert updated_none.caused_by is None
    assert updated_none.statement == "Updated."


def test_apply_patch_entity() -> None:
    record = Entity(id="entity_mara", name="Mara", notes="notes")
    patch = EntityPatch(notes="revised")
    updated = apply_patch(record, patch)
    assert updated.name == "Mara"
    assert updated.notes == "revised"
