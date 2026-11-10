"""Story HTTP endpoints."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from agentic_writing_system.api.app import create_app
from agentic_writing_system.api.errors import register_error_handlers
from agentic_writing_system.api.schemas import StoryView
from agentic_writing_system.api.stories import get_story_store
from agentic_writing_system.settings import Settings
from agentic_writing_system.stores.story_store import (
    CommitSource,
    CreateRow,
    StoreBusyError,
    StoryRow,
)
from agentic_writing_system.stores.users import LOCAL_USER_ID, SqlUserStore


async def _create_other_user_story(
    client: TestClient, other_user: str = "other-user"
) -> str:
    app = cast(FastAPI, client.app)
    engine = app.state.engine
    await SqlUserStore(engine).ensure_user(other_user)
    store = app.state.story_store
    row = await store.create(other_user)
    return str(row.story_id)


def test_create_list_get_delete(client: TestClient) -> None:
    r = client.post("/api/stories")
    assert r.status_code == 201
    body = r.json()
    assert body["revision"] == 1
    assert body["entities"] == []
    story_id = body["id"]

    listed = client.get("/api/stories")
    assert listed.status_code == 200
    ids = [s["id"] for s in listed.json()]
    assert story_id in ids

    got = client.get(f"/api/stories/{story_id}")
    assert got.status_code == 200
    assert got.json()["id"] == story_id

    deleted = client.delete(f"/api/stories/{story_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/api/stories/{story_id}").status_code == 404


def test_unknown_story_404(client: TestClient) -> None:
    assert client.get("/api/stories/does-not-exist").status_code == 404


@pytest.mark.asyncio
async def test_other_users_story_404(client: TestClient) -> None:
    story_id = await _create_other_user_story(client)
    assert client.get(f"/api/stories/{story_id}").status_code == 404
    assert client.delete(f"/api/stories/{story_id}").status_code == 404


@pytest.mark.asyncio
async def test_get_story_with_records(client: TestClient) -> None:
    created = client.post("/api/stories").json()
    story_id = created["id"]
    store = cast(FastAPI, client.app).state.story_store
    await store.save(
        LOCAL_USER_ID,
        story_id,
        [
            CreateRow(
                record_id="entity_one",
                kind="entity",
                fields={"name": "Hero", "notes": ""},
                names=[],
            ),
            CreateRow(
                record_id="event_one",
                kind="event",
                fields={"title": "Opening", "description": ""},
                names=[],
            ),
        ],
        CommitSource(source="user"),
    )
    view = client.get(f"/api/stories/{story_id}")
    assert view.status_code == 200
    data = view.json()
    assert data["entities"] == [
        {"id": "entity_one", "name": "Hero", "notes": "", "revision": 1}
    ]
    assert data["events"] == [
        {
            "id": "event_one",
            "title": "Opening",
            "description": "",
            "entity_ids": [],
            "when": [],
            "revision": 1,
        }
    ]


class _BusyStore:
    async def list_stories(self, user_id: str) -> list[StoryRow]:
        _ = user_id
        raise StoreBusyError()

    async def create(self, user_id: str) -> StoryRow:
        _ = user_id
        raise StoreBusyError()

    async def load(self, user_id: str, story_id: str) -> Any:
        _ = user_id, story_id
        raise StoreBusyError()

    async def delete(self, user_id: str, story_id: str) -> None:
        _ = user_id, story_id
        raise StoreBusyError()


def test_store_busy_503(settings: Settings) -> None:
    app = create_app(settings)
    app.dependency_overrides[get_story_store] = lambda: _BusyStore()
    with TestClient(app) as client:
        r = client.get("/api/stories")
    assert r.status_code == 503
    assert "detail" in r.json()


def test_create_app_refuses_non_local(settings: Settings) -> None:
    with pytest.raises(RuntimeError, match="local install"):
        create_app(Settings(data_dir=settings.data_dir, install=None))


def test_validation_returns_400() -> None:
    """No story endpoint validates a body in this slice; exercise the handler."""

    class _Body(BaseModel):
        model_config = ConfigDict(extra="forbid")

        count: int

    app = FastAPI()
    register_error_handlers(app)

    @app.post("/probe")
    def probe(body: _Body) -> dict[str, int]:
        return {"count": body.count}

    with TestClient(app) as client:
        r = client.post("/probe", json={"count": "nope"})
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert isinstance(detail, list)
    assert all("loc" in err and "msg" in err for err in detail)


def test_story_view_empty_fields(client: TestClient) -> None:
    r = client.post("/api/stories")
    view = StoryView.model_validate(r.json())
    assert view.title == ""
    assert view.schema_version == 1
