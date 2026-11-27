"""Story list, create, read, delete, history, revert, export, and story time."""

from __future__ import annotations

from typing import Annotated, Literal, NoReturn, cast

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from agentic_writing_system.api.errors import (
    BAD_REQUEST,
    NOT_FOUND,
    STORE_BUSY,
    SchemaErrors,
)
from agentic_writing_system.api.schemas import (
    CommitRequest,
    CommitView,
    ConflictResponse,
    RevertRequest,
    StorySummary,
    StoryView,
    commit_view,
    conflict_response,
    story_summary,
    story_view,
)
from agentic_writing_system.api.users import current_user_id
from agentic_writing_system.stores.story_store import CommitSource, Conflict, StoryStore
from agentic_writing_system.story_bible.commit import Committed, commit, import_story
from agentic_writing_system.story_bible.document import document_from_stored
from agentic_writing_system.story_bible.in_force import (
    InForce,
    InForceStretches,
    in_force,
    in_force_stretches,
)
from agentic_writing_system.story_bible.records import (
    EventPoint,
    StoryDocument,
    TimePoint,
    TimestampPoint,
)
from agentic_writing_system.story_bible.revert import revert
from agentic_writing_system.story_bible.rules import Refusal
from agentic_writing_system.story_bible.story_time import (
    EventTimes,
    StatementTimes,
    event_times,
    statement_times,
)

router = APIRouter(prefix="/stories", tags=["stories"], responses=STORE_BUSY)


def get_story_store(request: Request) -> StoryStore:
    return cast(StoryStore, request.app.state.story_store)


@router.get("", response_model=list[StorySummary])
async def list_stories(
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> list[StorySummary]:
    rows = await store.list_stories(user_id)
    return [story_summary(row) for row in rows]


@router.post("", response_model=StoryView, status_code=status.HTTP_201_CREATED)
async def create_story(
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> StoryView:
    created = await store.create(user_id)
    stored = await store.load(user_id, created.story_id)
    return story_view(stored)


@router.get(
    "/{story_id}/history",
    response_model=list[CommitView],
    responses=NOT_FOUND,
)
async def get_history(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> list[CommitView]:
    records = await store.history(user_id, story_id)
    return [commit_view(record) for record in records]


@router.get(
    "/{story_id}/export",
    response_model=StoryDocument,
    responses=NOT_FOUND,
)
async def get_export(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> StoryDocument:
    stored = await store.load(user_id, story_id)
    return document_from_stored(stored)


@router.get("/{story_id}", response_model=StoryView, responses=NOT_FOUND)
async def get_story(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> StoryView:
    stored = await store.load(user_id, story_id)
    return story_view(stored)


@router.get(
    "/{story_id}/event-times",
    response_model=EventTimes,
    responses=NOT_FOUND,
)
async def get_event_times(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> EventTimes:
    stored = await store.load(user_id, story_id)
    return event_times(document_from_stored(stored))


@router.get(
    "/{story_id}/statement-times",
    response_model=StatementTimes,
    responses=NOT_FOUND,
)
async def get_statement_times(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> StatementTimes:
    stored = await store.load(user_id, story_id)
    return statement_times(document_from_stored(stored))


@router.get(
    "/{story_id}/in-force",
    response_model=InForce,
    responses={
        400: {
            "model": SchemaErrors,
            "description": "The query is not one time point",
        },
        **NOT_FOUND,
    },
)
async def get_in_force(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
    timestamp: Annotated[str | None, Query()] = None,
    event_id: Annotated[str | None, Query()] = None,
    edge: Annotated[Literal["start", "end"] | None, Query()] = None,
) -> InForce:
    point = _query_point(timestamp, event_id, edge)
    stored = await store.load(user_id, story_id)
    document = document_from_stored(stored)
    if isinstance(point, EventPoint) and not any(
        event.id == point.event_id for event in document.events
    ):
        _reject(
            "event_id",
            f"No Event with id {point.event_id}.",
            point.event_id,
        )
    return in_force(document, point)


@router.get(
    "/{story_id}/in-force-stretches",
    response_model=InForceStretches,
    responses={
        400: {
            "model": SchemaErrors,
            "description": "The entity_id is missing or not an Entity",
        },
        **NOT_FOUND,
    },
)
async def get_in_force_stretches(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
    entity_id: Annotated[str | None, Query()] = None,
) -> InForceStretches:
    if entity_id is None:
        _reject("entity_id", "Give an entity_id.", None)
    stored = await store.load(user_id, story_id)
    document = document_from_stored(stored)
    try:
        return in_force_stretches(document, entity_id)
    except ValueError as exc:
        _reject("entity_id", str(exc), entity_id)


def _query_point(
    timestamp: str | None,
    event_id: str | None,
    edge: Literal["start", "end"] | None,
) -> TimePoint:
    """One query point, or a schema error. A query has no default edge."""
    if timestamp is not None and event_id is not None:
        _reject("query", "Give a timestamp or an event_id, not both.", None)
    if timestamp is None and event_id is None:
        _reject("query", "Give a timestamp, or an event_id and an edge.", None)
    if timestamp is not None:
        if edge is not None:
            _reject("edge", "A timestamp query has no edge.", edge)
        try:
            return TimestampPoint(timestamp=timestamp)
        except ValidationError as exc:
            raise RequestValidationError(exc.errors()) from exc
    if edge is None or event_id is None:
        _reject("edge", "An event_id query needs an edge of start or end.", event_id)
    return EventPoint(event_id=event_id, edge=edge)


def _reject(loc: str, message: str, value: object) -> NoReturn:
    raise RequestValidationError(
        [
            {
                "type": "value_error",
                "loc": ("query", loc),
                "msg": message,
                "input": value,
            }
        ]
    )


@router.delete(
    "/{story_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
async def delete_story(
    story_id: str,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> Response:
    await store.delete(user_id, story_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{story_id}/commits",
    response_model=Committed,
    responses={
        **BAD_REQUEST,
        **NOT_FOUND,
        status.HTTP_409_CONFLICT: {
            "model": ConflictResponse,
            "description": "Rows moved since the revisions the request carries",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": Refusal,
            "description": "A Story Bible rule refused the writes",
        },
    },
)
async def post_commit(
    story_id: str,
    body: CommitRequest,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> Committed | JSONResponse:
    outcome = await commit(
        store,
        user_id,
        story_id,
        body.writes,
        CommitSource(source="user"),
    )
    if isinstance(outcome, Refusal):
        return JSONResponse(status_code=422, content=outcome.model_dump())
    if isinstance(outcome, Conflict):
        return JSONResponse(
            status_code=409,
            content=conflict_response(outcome).model_dump(),
        )
    return outcome


@router.post(
    "/{story_id}/revert",
    response_model=Committed,
    responses={
        **BAD_REQUEST,
        **NOT_FOUND,
        status.HTTP_409_CONFLICT: {
            "model": ConflictResponse,
            "description": "The story no longer matches the commits being undone",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": Refusal,
            "description": (
                "A rule refused the revert, or a commit id is not in this story"
            ),
        },
    },
)
async def post_revert(
    story_id: str,
    body: RevertRequest,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> Committed | JSONResponse:
    outcome = await revert(store, user_id, story_id, body.commit_ids)
    if isinstance(outcome, Refusal):
        return JSONResponse(status_code=422, content=outcome.model_dump())
    if isinstance(outcome, Conflict):
        return JSONResponse(
            status_code=409,
            content=conflict_response(outcome).model_dump(),
        )
    return outcome


@router.post(
    "/import",
    response_model=StoryView,
    status_code=status.HTTP_201_CREATED,
    responses={
        **BAD_REQUEST,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": Refusal,
            "description": "A Story Bible rule or the schema version refused the file",
        },
    },
)
async def post_import(
    document: StoryDocument,
    user_id: Annotated[str, Depends(current_user_id)],
    store: Annotated[StoryStore, Depends(get_story_store)],
) -> StoryView | JSONResponse:
    outcome = await import_story(store, user_id, document)
    if isinstance(outcome, Refusal):
        return JSONResponse(status_code=422, content=outcome.model_dump())
    stored = await store.load(user_id, outcome)
    return story_view(stored)
