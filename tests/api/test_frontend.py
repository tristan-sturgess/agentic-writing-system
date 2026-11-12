"""The service serves the built frontend from every path outside `/api`."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from agentic_writing_system.api.app import create_app
from agentic_writing_system.settings import Settings

_INDEX = "<!doctype html><title>the built frontend</title>"
_SCRIPT = "console.log('the built script')"


@pytest.fixture
def built(settings: Settings, tmp_path: Path) -> Iterator[TestClient]:
    """A client on a service whose frontend directory holds a build."""
    frontend_dir = tmp_path / "build" / "dist"
    (frontend_dir / "assets").mkdir(parents=True)
    (frontend_dir / "index.html").write_text(_INDEX, encoding="utf-8")
    (frontend_dir / "assets" / "app.js").write_text(_SCRIPT, encoding="utf-8")
    # Beside the build, not in it. No request may reach it.
    (tmp_path / "build" / "secret.txt").write_text("not served", encoding="utf-8")
    app = create_app(replace(settings, frontend_dir=frontend_dir))
    with TestClient(app) as client:
        yield client


def test_a_file_in_the_build_is_served(built: TestClient) -> None:
    response = built.get("/assets/app.js")
    assert response.status_code == 200
    assert response.text == _SCRIPT


@pytest.mark.parametrize("path", ["/", "/stories/story_1", "/assets/missing.js"])
def test_a_path_that_is_not_a_file_gets_the_index(built: TestClient, path: str) -> None:
    response = built.get(path)
    assert response.status_code == 200
    assert response.text == _INDEX
    # A rebuild renames the scripts the index names, so a stale index is a blank page.
    assert response.headers["cache-control"] == "no-cache"


def test_a_path_cannot_leave_the_build(built: TestClient) -> None:
    response = built.get("/..%2Fsecret.txt")
    assert response.status_code == 200
    assert response.text == _INDEX


def test_the_api_keeps_its_own_answers(built: TestClient) -> None:
    assert built.get("/api/stories").json() == []

    for unknown in ("/api", "/api/nothing_here"):
        missing = built.get(unknown)
        assert missing.status_code == 404
        assert missing.json() == {"detail": "Not Found"}

    # The frontend's catch-all does not turn another method on an API path into
    # its own `405`, or a method an endpoint lacks into a `404`.
    assert built.post("/api/nothing_here").status_code == 404
    assert built.put("/api/stories").status_code == 405


def test_without_a_build_the_api_works_and_the_page_says_how_to_build(
    client: TestClient,
) -> None:
    assert client.get("/api/stories").status_code == 200

    for path in ("/", "/stories/story_1"):
        response = client.get(path)
        assert response.status_code == 404
        assert "npm run build" in response.text
