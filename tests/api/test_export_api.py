"""GET /api/stories/{story_id}/export mapping tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

SAMPLE_PATH = Path(__file__).resolve().parents[2] / "samples" / "sample_story.json"
RECORD_LISTS = (
    "entities",
    "properties",
    "assertions",
    "events",
    "units",
    "arcs",
)


def test_export_then_import_matches_without_revisions(client: TestClient) -> None:
    """The export is the document: record ids, and no story id, revision, or times.

    Importing that document again yields the same document.
    """
    sample = cast(dict[str, Any], json.loads(SAMPLE_PATH.read_text(encoding="utf-8")))
    imported = client.post("/api/stories/import", json=sample)
    assert imported.status_code == 201
    story_id = imported.json()["id"]

    exported = client.get(f"/api/stories/{story_id}/export")
    assert exported.status_code == 200
    document = exported.json()
    assert "id" not in document
    assert "revision" not in document
    assert "created_at" not in document
    assert "updated_at" not in document
    for key in RECORD_LISTS:
        assert [row["id"] for row in document[key]] == [
            row["id"] for row in sample[key]
        ]
        for row in document[key]:
            assert "revision" not in row

    again = client.post("/api/stories/import", json=document)
    assert again.status_code == 201
    assert again.json()["id"] != story_id
    second = client.get(f"/api/stories/{again.json()['id']}/export")
    assert second.status_code == 200
    assert second.json() == document


def test_export_unknown_story_is_404(client: TestClient) -> None:
    response = client.get("/api/stories/missing/export")
    assert response.status_code == 404
    assert response.json() == {"detail": "Story not found"}
