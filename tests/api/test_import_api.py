"""POST /api/stories/import mapping tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

SAMPLE_PATH = Path(__file__).resolve().parents[2] / "samples" / "sample_story.json"


def _load_sample() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(SAMPLE_PATH.read_text(encoding="utf-8")))


def test_import_sample_story_201(client: TestClient) -> None:
    sample = _load_sample()
    r = client.post("/api/stories/import", json=sample)
    assert r.status_code == 201
    body = r.json()

    for key in (
        "entities",
        "properties",
        "assertions",
        "events",
        "units",
        "arcs",
    ):
        file_ids = [row["id"] for row in sample[key]]
        got_ids = [row["id"] for row in body[key]]
        assert got_ids == file_ids

    sample_entity = sample["entities"][0]
    got_entity = next(e for e in body["entities"] if e["id"] == sample_entity["id"])
    assert got_entity["name"] == sample_entity["name"]
    assert got_entity["notes"] == sample_entity["notes"]
    assert got_entity["revision"] == 1

    for row in body["entities"]:
        assert row["revision"] == 1

    listed = client.get("/api/stories").json()
    assert any(s["title"] == sample["title"] for s in listed)


def test_import_twice_different_story_ids_same_record_ids(client: TestClient) -> None:
    sample = _load_sample()
    first = client.post("/api/stories/import", json=sample).json()
    second = client.post("/api/stories/import", json=sample).json()
    assert first["id"] != second["id"]
    assert [e["id"] for e in first["entities"]] == [e["id"] for e in second["entities"]]


def test_import_dangling_reference_422(client: TestClient) -> None:
    doc = _load_sample()
    events = list(doc["events"])
    events.append(
        {
            "id": "event_dangling",
            "title": "Dangling",
            "entity_ids": ["entity_not_in_file"],
        }
    )
    doc["events"] = events
    r = client.post("/api/stories/import", json=doc)
    assert r.status_code == 422
    assert r.json()["problems"]
    assert client.get("/api/stories").json() == []


def test_import_wrong_schema_version_422(client: TestClient) -> None:
    doc = _load_sample()
    doc["schema_version"] = 2
    r = client.post("/api/stories/import", json=doc)
    assert r.status_code == 422
    assert r.json()["problems"][0]["code"] == "schema_version"
    assert client.get("/api/stories").json() == []


def test_commit_after_import(client: TestClient) -> None:
    imported = client.post("/api/stories/import", json=_load_sample()).json()
    story_id = imported["id"]
    entity = imported["entities"][0]
    r = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity["id"],
                    "revision": entity["revision"],
                    "fields": {"notes": "Edited after import."},
                }
            ]
        },
    )
    assert r.status_code == 200
    got = client.get(f"/api/stories/{story_id}").json()
    edited = next(e for e in got["entities"] if e["id"] == entity["id"])
    assert edited["notes"] == "Edited after import."
    assert edited["revision"] == 2
