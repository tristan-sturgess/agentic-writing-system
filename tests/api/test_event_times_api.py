"""GET /api/stories/{story_id}/event-times maps the reading to a response."""

from __future__ import annotations

from fastapi.testclient import TestClient

from agentic_writing_system.story_bible.records import StoryDocument
from agentic_writing_system.story_bible.story_time import event_times


def test_event_times_returns_the_reading(client: TestClient) -> None:
    document = {
        "title": "Times",
        "events": [
            {
                "id": "event_dawn",
                "title": "Dawn",
                "when": [{"kind": "at", "at": {"timestamp": "1847-03-02"}}],
            },
            {"id": "event_untimed", "title": "Untimed", "when": []},
        ],
    }
    created = client.post("/api/stories/import", json=document)
    assert created.status_code == 201
    story_id = created.json()["id"]

    response = client.get(f"/api/stories/{story_id}/event-times")
    assert response.status_code == 200
    expected = event_times(StoryDocument.model_validate(document)).model_dump(
        mode="json"
    )
    assert response.json() == expected


def test_event_times_unknown_story_404(client: TestClient) -> None:
    response = client.get("/api/stories/does-not-exist/event-times")
    assert response.status_code == 404
    assert response.json() == {"detail": "Story not found"}
