"""FastAPI application factory."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from agentic_writing_system.api.errors import register_error_handlers
from agentic_writing_system.api.frontend import frontend_route
from agentic_writing_system.api.stories import router as stories_router
from agentic_writing_system.api.users import LocalUserResolver
from agentic_writing_system.settings import Settings
from agentic_writing_system.stores.engine import create_app_engine
from agentic_writing_system.stores.migrate import run_migrations
from agentic_writing_system.stores.sql_story_store import SqlStoryStore
from agentic_writing_system.stores.users import LOCAL_USER_ID, SqlUserStore

_AUTOMATIC_422 = "#/components/schemas/HTTPValidationError"


class _App(FastAPI):
    """FastAPI, with an OpenAPI document that lists what this API sends.

    FastAPI adds a `422` validation response to every route that takes a
    parameter or a body, and has no setting to turn that off. This API answers a
    body the schema rejects with `400`, which the routes declare, so the entry is
    removed. A `422` a route declares itself, for a refusal, is kept.
    """

    def openapi(self) -> dict[str, Any]:
        if self.openapi_schema is not None:
            return self.openapi_schema
        document = super().openapi()
        for operations in document.get("paths", {}).values():
            for operation in operations.values():
                responses = operation.get("responses", {})
                content = responses.get("422", {}).get("content", {})
                schema = content.get("application/json", {}).get("schema", {})
                if schema.get("$ref") == _AUTOMATIC_422:
                    del responses["422"]
        schemas = document.get("components", {}).get("schemas", {})
        schemas.pop("HTTPValidationError", None)
        schemas.pop("ValidationError", None)
        return document


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings.from_env()
    if settings.install != "local":
        msg = (
            "This service is not configured as a local install "
            f"(WRITING_INSTALL={settings.install!r}). "
            "Only the local user resolver is available; refusing to start."
        )
        raise RuntimeError(msg)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app_settings: Settings = app.state.settings
        await asyncio.to_thread(run_migrations, app_settings)
        engine = create_app_engine(app_settings)
        await SqlUserStore(engine).ensure_user(LOCAL_USER_ID)
        app.state.engine = engine
        app.state.story_store = SqlStoryStore(engine)
        app.state.user_resolver = LocalUserResolver()
        try:
            yield
        finally:
            await engine.dispose()

    app = _App(
        title="Agentic Writing System",
        lifespan=lifespan,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
    )
    app.state.settings = settings
    register_error_handlers(app)
    app.include_router(stories_router, prefix="/api")
    app.router.routes.append(frontend_route(settings.frontend_dir))
    return app
