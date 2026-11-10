"""Resolve each request to an acting user id."""

from __future__ import annotations

from typing import Protocol

from fastapi import Request

from agentic_writing_system.stores.users import LOCAL_USER_ID


class UserResolver(Protocol):
    async def __call__(self, request: Request) -> str: ...


class LocalUserResolver:
    async def __call__(self, request: Request) -> str:
        _ = request
        return LOCAL_USER_ID


async def current_user_id(request: Request) -> str:
    resolver: UserResolver = request.app.state.user_resolver
    return await resolver(request)
