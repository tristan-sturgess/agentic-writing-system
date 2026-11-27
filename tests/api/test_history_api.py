"""GET /api/stories/{story_id}/history mapping tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

SAMPLE_PATH = Path(__file__).resolve().parents[2] / "samples" / "sample_story.json"
ELIN = "entity_elin_voss"


def test_history_after_import_and_commit_is_newest_first(client: TestClient) -> None:
    sample = cast(dict[str, Any], json.loads(SAMPLE_PATH.read_text(encoding="utf-8")))
    imported = client.post("/api/stories/import", json=sample)
    assert imported.status_code == 201
    story_id = imported.json()["id"]
    story = client.get(f"/api/stories/{story_id}").json()
    revision = next(row["revision"] for row in story["entities"] if row["id"] == ELIN)

    committed = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": ELIN,
                    "revision": revision,
                    "fields": {"name": "Mara"},
                }
            ]
        },
    )
    assert committed.status_code == 200

    response = client.get(f"/api/stories/{story_id}/history")
    assert response.status_code == 200
    records = response.json()
    assert len(records) == 2
    newest, oldest = records
    assert newest["source"] == "user"
    assert oldest["source"] == "import"
    assert newest["committed_at"] >= oldest["committed_at"]
    assert "user_id" not in newest
    assert "story_id" not in newest

    updated = next(
        change for change in newest["changes"] if change["record_id"] == ELIN
    )
    assert updated["op"] == "update"
    assert updated["kind"] == "entity"
    assert updated["before"]["name"] == "Elin Voss"
    assert updated["after"]["name"] == "Mara"
    assert updated["after"]["notes"] == updated["before"]["notes"]

    created = next(
        change for change in oldest["changes"] if change["record_id"] == ELIN
    )
    assert created["op"] == "create"
    assert created["before"] is None
    assert created["after"]["name"] == "Elin Voss"


def test_history_unknown_story_is_404(client: TestClient) -> None:
    response = client.get("/api/stories/missing/history")
    assert response.status_code == 404
    assert response.json() == {"detail": "Story not found"}
