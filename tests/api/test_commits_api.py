"""POST /api/stories/{story_id}/commits mapping tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi.testclient import TestClient


def _story_id(client: TestClient) -> str:
    return cast(str, client.post("/api/stories").json()["id"])


def test_commit_create_entity_and_property_with_ref(client: TestClient) -> None:
    story_id = _story_id(client)
    body = {
        "writes": [
            {
                "op": "create",
                "kind": "entity",
                "fields": {"name": "Alpha"},
                "ref": "hero",
            },
            {
                "op": "create",
                "kind": "property",
                "fields": {"entity_id": "@hero", "statement": "Tall."},
            },
        ]
    }
    r = client.post(f"/api/stories/{story_id}/commits", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["commit_id"] is not None
    assert len(data["created"]) == 2
    assert data["created"][0]["ref"] == "hero"
    entity_id = data["created"][0]["id"]
    prop_id = data["created"][1]["id"]
    assert data["revisions"][entity_id] == 1
    assert data["revisions"][prop_id] == 1

    got = client.get(f"/api/stories/{story_id}").json()
    assert any(e["id"] == entity_id for e in got["entities"])
    assert any(p["id"] == prop_id for p in got["properties"])


def test_commit_update_increments_revision(client: TestClient) -> None:
    story_id = _story_id(client)
    created = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [{"op": "create", "kind": "entity", "fields": {"name": "Beta"}}]
        },
    ).json()
    entity_id = created["created"][0]["id"]

    r = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 1,
                    "fields": {"notes": "Changed."},
                }
            ]
        },
    )
    assert r.status_code == 200
    assert r.json()["revisions"][entity_id] == 2


def test_commit_noop_null_commit_id(client: TestClient) -> None:
    story_id = _story_id(client)
    created = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [{"op": "create", "kind": "entity", "fields": {"name": "Gamma"}}]
        },
    ).json()
    entity_id = created["created"][0]["id"]

    r = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 1,
                    "fields": {"name": "Gamma"},
                }
            ]
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["commit_id"] is None
    assert data["revisions"] == {}


def test_commit_unknown_id_422(client: TestClient) -> None:
    story_id = _story_id(client)
    before = client.get(f"/api/stories/{story_id}").json()

    r = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "create",
                    "kind": "event",
                    "fields": {
                        "title": "Lonely",
                        "entity_ids": ["entity_nobody"],
                    },
                }
            ]
        },
    )
    assert r.status_code == 422
    problems = r.json()["problems"]
    assert problems[0]["code"] == "unknown_id"
    assert "legal_ids" in problems[0]
    assert client.get(f"/api/stories/{story_id}").json() == before


def test_commit_stale_revision_409(client: TestClient) -> None:
    story_id = _story_id(client)
    created = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [{"op": "create", "kind": "entity", "fields": {"name": "Delta"}}]
        },
    ).json()
    entity_id = created["created"][0]["id"]

    client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 1,
                    "fields": {"name": "Delta Prime"},
                }
            ]
        },
    )
    after_first = client.get(f"/api/stories/{story_id}").json()

    conflict = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 1,
                    "fields": {"name": "Delta Stale"},
                }
            ]
        },
    )
    assert conflict.status_code == 409
    row = conflict.json()["rows"][0]
    assert row["id"] == entity_id
    assert row["kind"] == "entity"
    assert row["revision"] == 2
    assert row["fields"]["name"] == "Delta Prime"
    assert client.get(f"/api/stories/{story_id}").json() == after_first


def test_commit_missing_row_409_null_fields(client: TestClient) -> None:
    story_id = _story_id(client)
    created = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [{"op": "create", "kind": "entity", "fields": {"name": "Echo"}}]
        },
    ).json()
    entity_id = created["created"][0]["id"]

    client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {"op": "delete", "id": entity_id, "revision": 1},
            ]
        },
    )

    r = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 1,
                    "fields": {"name": "Ghost"},
                }
            ]
        },
    )
    assert r.status_code == 409
    row = r.json()["rows"][0]
    assert row["reason"] == "missing"
    assert row["revision"] is None
    assert row["fields"] is None


@pytest.mark.parametrize(
    ("payload", "needle"),
    [
        ({"writes": [{"op": "nope", "kind": "entity", "fields": {}}]}, "op"),
        (
            {
                "writes": [
                    {
                        "op": "update",
                        "kind": "entity",
                        "id": "entity_x",
                        "fields": {"name": "X"},
                    }
                ]
            },
            "revision",
        ),
        ({"writes": []}, "writes"),
    ],
)
def test_commit_malformed_400(
    client: TestClient, payload: dict[str, Any], needle: str
) -> None:
    story_id = _story_id(client)
    r = client.post(f"/api/stories/{story_id}/commits", json=payload)
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert any(needle in str(err).lower() for err in detail)


def test_commit_unknown_story_404(client: TestClient) -> None:
    r = client.post(
        "/api/stories/does-not-exist/commits",
        json={"writes": [{"op": "create", "kind": "entity", "fields": {"name": "Z"}}]},
    )
    assert r.status_code == 404


def test_bad_timestamp_is_400_naming_the_field(client: TestClient) -> None:
    story_id = client.post("/api/stories").json()["id"]
    response = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "create",
                    "kind": "event",
                    "fields": {
                        "title": "Arrival",
                        "when": [{"kind": "at", "at": {"timestamp": "1847-13-40"}}],
                    },
                }
            ]
        },
    )
    assert response.status_code == 400
    errors = response.json()["detail"]
    assert len(errors) == 1
    assert errors[0]["loc"][-1] == "timestamp"
    assert "month" in errors[0]["msg"]
