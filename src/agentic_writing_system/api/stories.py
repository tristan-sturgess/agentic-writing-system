"""Story list, create, read, delete, and event-times endpoints."""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse

from agentic_writing_system.api.errors import BAD_REQUEST, NOT_FOUND, STORE_BUSY
from agentic_writing_system.api.schemas import (
    CommitRequest,
    ConflictResponse,
    StorySummary,
    StoryView,
    conflict_response,
    story_summary,
    story_view,
)
from agentic_writing_system.api.users import current_user_id
from agentic_writing_system.stores.story_store import CommitSource, Conflict, StoryStore
from agentic_writing_system.story_bible.commit import Committed, commit, import_story
from agentic_writing_system.story_bible.document import document_from_stored
from agentic_writing_system.story_bible.records import StoryDocument
from agentic_writing_system.story_bible.rules import Refusal
from agentic_writing_system.story_bible.story_time import EventTimes, event_times

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
