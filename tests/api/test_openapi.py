"""The OpenAPI document lists what each path returns, and nothing else."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_openapi_lists_the_statuses_each_path_returns(client: TestClient) -> None:
    document = client.get("/api/openapi.json").json()
    listed = {
        (method.upper(), path): sorted(operation["responses"])
        for path, operations in document["paths"].items()
        for method, operation in operations.items()
    }
    assert listed == {
        ("GET", "/api/stories"): ["200", "503"],
        ("POST", "/api/stories"): ["201", "503"],
        ("GET", "/api/stories/{story_id}"): ["200", "404", "503"],
        ("DELETE", "/api/stories/{story_id}"): ["204", "404", "503"],
        ("POST", "/api/stories/{story_id}/commits"): [
            "200",
            "400",
            "404",
            "409",
            "422",
            "503",
        ],
        ("POST", "/api/stories/import"): ["201", "400", "422", "503"],
    }
    # The validation response FastAPI adds by itself is the one this API never sends.
    assert "HTTPValidationError" not in document["components"]["schemas"]


def test_error_bodies_match_the_models_the_document_names(client: TestClient) -> None:
    schemas = client.get("/api/openapi.json").json()["components"]["schemas"]

    not_found = client.get("/api/stories/story_that_is_not_there")
    assert not_found.status_code == 404
    assert set(not_found.json()) == set(schemas["ErrorDetail"]["properties"])

    rejected = client.post("/api/stories/import", json={"schema_version": "one"})
    assert rejected.status_code == 400
    assert set(rejected.json()) == set(schemas["SchemaErrors"]["properties"])
    entry = rejected.json()["detail"][0]
    assert set(schemas["SchemaError"]["required"]) <= set(entry)
