"""The command line beside `serve`."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from agentic_writing_system.__main__ import main
from agentic_writing_system.api.app import create_app
from agentic_writing_system.settings import Settings


def test_openapi_prints_the_document_the_service_serves(
    settings: Settings, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["openapi"])
    printed = json.loads(capsys.readouterr().out)

    with TestClient(create_app(settings)) as client:
        served = client.get("/api/openapi.json").json()
    assert printed == served
