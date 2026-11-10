"""How an exception becomes a response.

A refusal and a conflict are not exceptions. They are outcomes of a commit, and
the handler that ran the commit maps them to `422` and `409`.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from starlette.responses import Response

from agentic_writing_system.stores.story_store import StoreBusyError, StoryNotFoundError


class ErrorDetail(BaseModel):
    """The body of a `404` and a `503`."""

    detail: str


class SchemaError(BaseModel):
    """One value the request schema rejected."""

    model_config = ConfigDict(extra="allow")

    type: str
    loc: list[str | int]
    msg: str


class SchemaErrors(BaseModel):
    """The body of a `400`."""

    detail: list[SchemaError]


# What a route declares, so the OpenAPI document lists what the handlers send.
type ResponseDocs = dict[int | str, dict[str, Any]]

BAD_REQUEST: ResponseDocs = {
    400: {"model": SchemaErrors, "description": "The request schema rejected the body"}
}
NOT_FOUND: ResponseDocs = {
    404: {"model": ErrorDetail, "description": "No such story for the acting user"}
}
STORE_BUSY: ResponseDocs = {
    503: {"model": ErrorDetail, "description": "The store is busy; retry"}
}

_NOT_FOUND_BODY = ErrorDetail(detail="Story not found").model_dump()
_BUSY_BODY = ErrorDetail(detail="The store is busy. Try again shortly.").model_dump()


async def story_not_found_handler(_request: Request, _exc: Exception) -> Response:
    """A story the acting user does not own is the same `404` as one that is gone."""
    return JSONResponse(status_code=404, content=_NOT_FOUND_BODY)


async def store_busy_handler(_request: Request, _exc: Exception) -> Response:
    return JSONResponse(status_code=503, content=_BUSY_BODY)


async def validation_exception_handler(_request: Request, exc: Exception) -> Response:
    """A body the schema rejects is `400`. `422` is kept for a refusal."""
    assert isinstance(exc, RequestValidationError)
    # A validator's ValueError sits in the error context, and JSON cannot hold it.
    detail = jsonable_encoder(exc.errors(), custom_encoder={Exception: str})
    return JSONResponse(status_code=400, content={"detail": detail})


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StoryNotFoundError, story_not_found_handler)
    app.add_exception_handler(StoreBusyError, store_busy_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
