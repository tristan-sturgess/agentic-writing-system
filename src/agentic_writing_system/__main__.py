"""CLI entry: the local server, and the API's OpenAPI document."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from dataclasses import replace

import uvicorn

from agentic_writing_system.api.app import create_app
from agentic_writing_system.settings import Settings


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="agentic_writing_system")
    sub = parser.add_subparsers(dest="command", required=True)
    serve = sub.add_parser("serve", help="Run the API locally")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    sub.add_parser(
        "openapi",
        help="Print the API's OpenAPI document, which the frontend's types come from",
    )
    args = parser.parse_args(argv)
    settings = replace(Settings.from_env(), install="local")
    if args.command == "serve":
        uvicorn.run(create_app(settings), host=args.host, port=args.port)
    elif args.command == "openapi":
        # The app is built and not started, so this opens no database.
        print(json.dumps(create_app(settings).openapi(), indent=2))


if __name__ == "__main__":
    main()
