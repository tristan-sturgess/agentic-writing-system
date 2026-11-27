"""POST /api/stories/{story_id}/revert mapping tests."""

from __future__ import annotations

from typing import Any, cast

from fastapi.testclient import TestClient

from agentic_writing_system.api.app import create_app
from agentic_writing_system.api.stories import get_story_store
from agentic_writing_system.settings import Settings
from agentic_writing_system.stores.story_store import StoreBusyError


def _story_id(client: TestClient) -> str:
    return cast(str, client.post("/api/stories").json()["id"])


def _create_entity(client: TestClient, story_id: str, name: str) -> str:
    created = client.post(
        f"/api/stories/{story_id}/commits",
        json={"writes": [{"op": "create", "kind": "entity", "fields": {"name": name}}]},
    )
    assert created.status_code == 200
    return cast(str, created.json()["created"][0]["id"])


def _history(client: TestClient, story_id: str) -> list[dict[str, Any]]:
    response = client.get(f"/api/stories/{story_id}/history")
    assert response.status_code == 200
    return cast(list[dict[str, Any]], response.json())


def test_revert_returns_the_commit_body(client: TestClient) -> None:
    story_id = _story_id(client)
    entity_id = _create_entity(client, story_id, "Mara")
    create = next(
        record
        for record in _history(client, story_id)
        if any(
            change["record_id"] == entity_id and change["op"] == "create"
            for change in record["changes"]
        )
    )

    response = client.post(
        f"/api/stories/{story_id}/revert",
        json={"commit_ids": [create["commit_id"]]},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["commit_id"], str)
    assert body["created"] == []
    assert entity_id in body["deleted"]
    assert "revisions" in body


def test_revert_conflict_is_409(client: TestClient) -> None:
    story_id = _story_id(client)
    entity_id = _create_entity(client, story_id, "Mara")
    updated = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 1,
                    "fields": {"name": "Lina"},
                }
            ]
        },
    )
    assert updated.status_code == 200
    again = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "update",
                    "kind": "entity",
                    "id": entity_id,
                    "revision": 2,
                    "fields": {"name": "Sera"},
                }
            ]
        },
    )
    assert again.status_code == 200
    first_edit = next(
        record
        for record in _history(client, story_id)
        if any(
            change["after"] is not None and change["after"].get("name") == "Lina"
            for change in record["changes"]
        )
    )

    response = client.post(
        f"/api/stories/{story_id}/revert",
        json={"commit_ids": [first_edit["commit_id"]]},
    )
    assert response.status_code == 409
    row = response.json()["rows"][0]
    assert row["id"] == entity_id
    assert row["fields"]["name"] == "Sera"
    assert row["reason"] == "revision_mismatch"


def test_unknown_commit_is_422(client: TestClient) -> None:
    story_id = _story_id(client)
    response = client.post(
        f"/api/stories/{story_id}/revert",
        json={"commit_ids": ["missing-commit"]},
    )
    assert response.status_code == 422
    problem = response.json()["problems"][0]
    assert problem["code"] == "unknown_commit"
    assert problem["ids"] == ["missing-commit"]


def test_rule_refusal_is_422(client: TestClient) -> None:
    story_id = _story_id(client)
    entity_id = _create_entity(client, story_id, "Mara")
    named = client.post(
        f"/api/stories/{story_id}/commits",
        json={
            "writes": [
                {
                    "op": "create",
                    "kind": "property",
                    "fields": {"entity_id": entity_id, "statement": "Keeps a lantern."},
                }
            ]
        },
    )
    assert named.status_code == 200
    create = next(
        record
        for record in _history(client, story_id)
        if any(
            change["record_id"] == entity_id and change["op"] == "create"
            for change in record["changes"]
        )
    )

    response = client.post(
        f"/api/stories/{story_id}/revert",
        json={"commit_ids": [create["commit_id"]]},
    )
    assert response.status_code == 422
    problem = response.json()["problems"][0]
    assert problem["code"] == "delete_still_named"
    assert problem["referring"]


def test_unknown_story_is_404(client: TestClient) -> None:
    response = client.post(
        "/api/stories/missing-story/revert",
        json={"commit_ids": ["missing-commit"]},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Story not found"}


def test_empty_commit_ids_is_400(client: TestClient) -> None:
    story_id = _story_id(client)
    response = client.post(
        f"/api/stories/{story_id}/revert",
        json={"commit_ids": []},
    )
    assert response.status_code == 400
    assert response.json()["detail"][0]["loc"][-1] == "commit_ids"


class _BusyStore:
    async def load(self, user_id: str, story_id: str) -> Any:
        _ = user_id, story_id
        raise StoreBusyError()


def test_store_busy_is_503(settings: Settings) -> None:
    app = create_app(settings)
    app.dependency_overrides[get_story_store] = lambda: _BusyStore()
    with TestClient(app) as client:
        response = client.post(
            "/api/stories/any-story/revert",
            json={"commit_ids": ["any-commit"]},
        )
    assert response.status_code == 503
    assert "detail" in response.json()
