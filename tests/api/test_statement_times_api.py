"""Statement times and the in-force view map a reading to a response."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentic_writing_system.story_bible.in_force import in_force
from agentic_writing_system.story_bible.records import (
    EventPoint,
    StoryDocument,
    TimestampPoint,
)
from agentic_writing_system.story_bible.story_time import statement_times

_DOCUMENT = {
    "title": "Statements",
    "events": [
        {
            "id": "event_dawn",
            "title": "Dawn",
            "when": [{"kind": "at", "at": {"timestamp": "1847-03-02"}}],
        }
    ],
    "properties": [
        {
            "id": "prop_standing",
            "entity_id": "entity_mara",
            "statement": "Mara is here.",
        }
    ],
    "entities": [{"id": "entity_mara", "name": "Mara"}],
}


def _import(client: TestClient) -> str:
    created = client.post("/api/stories/import", json=_DOCUMENT)
    assert created.status_code == 201
    story_id = created.json()["id"]
    assert isinstance(story_id, str)
    return story_id


def test_statement_times_returns_the_reading(client: TestClient) -> None:
    story_id = _import(client)
    response = client.get(f"/api/stories/{story_id}/statement-times")
    assert response.status_code == 200
    expected = statement_times(StoryDocument.model_validate(_DOCUMENT)).model_dump(
        mode="json"
    )
    assert response.json() == expected


def test_statement_times_unknown_story_404(client: TestClient) -> None:
    response = client.get("/api/stories/does-not-exist/statement-times")
    assert response.status_code == 404
    assert response.json() == {"detail": "Story not found"}


def test_in_force_returns_the_reading_for_a_timestamp(client: TestClient) -> None:
    story_id = _import(client)
    response = client.get(
        f"/api/stories/{story_id}/in-force", params={"timestamp": "1847-03-02"}
    )
    assert response.status_code == 200
    expected = in_force(
        StoryDocument.model_validate(_DOCUMENT),
        TimestampPoint(timestamp="1847-03-02"),
    ).model_dump(mode="json")
    assert response.json() == expected


def test_in_force_returns_the_reading_for_an_event_edge(client: TestClient) -> None:
    story_id = _import(client)
    response = client.get(
        f"/api/stories/{story_id}/in-force",
        params={"event_id": "event_dawn", "edge": "end"},
    )
    assert response.status_code == 200
    expected = in_force(
        StoryDocument.model_validate(_DOCUMENT),
        EventPoint(event_id="event_dawn", edge="end"),
    ).model_dump(mode="json")
    assert response.json() == expected
    assert response.json()["query"]["timestamp"] == "1847-03-02T00:00:00"
    assert response.json()["query"]["edge"] == "end"


def test_in_force_unknown_story_404(client: TestClient) -> None:
    response = client.get(
        "/api/stories/does-not-exist/in-force", params={"timestamp": "1847-03-02"}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Story not found"}


def test_in_force_rejects_a_query_that_is_not_one_point(client: TestClient) -> None:
    story_id = _import(client)
    path = f"/api/stories/{story_id}/in-force"
    missing = client.get(path)
    assert missing.status_code == 400
    assert missing.json()["detail"][0]["loc"] == ["query", "query"]

    both = client.get(
        path, params={"timestamp": "1847-03-02", "event_id": "event_dawn"}
    )
    assert both.status_code == 400

    no_edge = client.get(path, params={"event_id": "event_dawn"})
    assert no_edge.status_code == 400
    assert no_edge.json()["detail"][0]["loc"][-1] == "edge"

    bad_edge = client.get(path, params={"event_id": "event_dawn", "edge": "middle"})
    assert bad_edge.status_code == 400

    bad_time = client.get(path, params={"timestamp": "March"})
    assert bad_time.status_code == 400

    with_edge = client.get(path, params={"timestamp": "1847-03-02", "edge": "start"})
    assert with_edge.status_code == 400

    unknown = client.get(path, params={"event_id": "event_missing", "edge": "start"})
    assert unknown.status_code == 400
    assert unknown.json()["detail"][0]["msg"] == "No Event with id event_missing."
