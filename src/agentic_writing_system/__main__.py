"""CLI entry: local dev server."""

from __future__ import annotations

import argparse
from dataclasses import replace

import uvicorn

from agentic_writing_system.api.app import create_app
from agentic_writing_system.settings import Settings


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentic_writing_system")
    sub = parser.add_subparsers(dest="command", required=True)
    serve = sub.add_parser("serve", help="Run the API locally")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if args.command == "serve":
        settings = replace(Settings.from_env(), install="local")
        uvicorn.run(create_app(settings), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
