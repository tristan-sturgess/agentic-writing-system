"""API tests use the real SQLite store on a temporary data directory."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from agentic_writing_system.api.app import create_app
from agentic_writing_system.settings import Settings


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
