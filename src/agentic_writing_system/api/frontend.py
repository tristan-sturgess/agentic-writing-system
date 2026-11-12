"""The built frontend, served from the service's own port.

`/api` is the API. Every other path belongs to the frontend: a file in its build,
or `index.html`, because the frontend's routes are URL paths and a reload asks
the service for one.
"""

from __future__ import annotations

from pathlib import Path

from starlette.requests import Request
from starlette.responses import FileResponse, PlainTextResponse, Response
from starlette.routing import Match, Route
from starlette.types import Scope

_NOT_BUILT = (
    "The frontend is not built; run `npm install` and `npm run build` in frontend/."
)


class _FrontendRoute(Route):
    """A catch-all that does not match under `/api`.

    A route that matched there would answer for the API: an unknown API path
    would get the frontend's `405` for a `POST`, and a method an endpoint lacks
    would get a `404`. Not matching leaves those answers as they were.
    """

    def matches(self, scope: Scope) -> tuple[Match, Scope]:
        match, child_scope = super().matches(scope)
        if match is not Match.NONE:
            path: str = child_scope["path_params"]["path"]
            if path == "api" or path.startswith("api/"):
                return Match.NONE, {}
        return match, child_scope


def frontend_route(frontend_dir: Path) -> Route:
    """The route that serves the build in `frontend_dir`, added after the API's."""
    root = frontend_dir.resolve()
    index = root / "index.html"

    # Not `async`, so the file lookups run on a worker thread.
    def serve(request: Request) -> Response:
        if not index.is_file():
            return PlainTextResponse(_NOT_BUILT, status_code=404)
        requested = (root / request.path_params["path"]).resolve()
        if (
            requested != index
            and requested.is_relative_to(root)
            and requested.is_file()
        ):
            return FileResponse(requested)
        # A build names its scripts by their content, so the index is the one
        # file a browser must not reuse without asking.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return _FrontendRoute("/{path:path}", serve, methods=["GET"])
