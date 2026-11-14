#!/usr/bin/env python3
"""Command-line client for the story API."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_PREFIX = "/api"


def _read_json_file(path: str) -> Any:
    if path == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _http(
    method: str,
    base_url: str,
    path: str,
    body: object | None = None,
) -> tuple[int, bytes]:
    url = base_url.rstrip("/") + path
    payload: bytes | None = None
    headers: dict[str, str] = {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=payload, headers=headers, method=method)
    try:
        with urlopen(request) as response:
            return response.status, response.read()
    except HTTPError as exc:
        return exc.code, exc.read()
    except URLError:
        print(f"The server is not reachable at {base_url}", file=sys.stderr)
        raise SystemExit(2) from None


def _emit(status: int, raw: bytes) -> int:
    print(status)
    if raw:
        try:
            parsed = json.loads(raw)
            print(json.dumps(parsed, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            print(raw.decode("utf-8", errors="replace"))
    return 0 if 200 <= status < 300 else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Drive the story HTTP API.")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="API origin (default: http://127.0.0.1:8000)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List stories")
    sub.add_parser("create", help="Create an empty story")

    get_p = sub.add_parser("get", help="Get one story")
    get_p.add_argument("story_id")

    times_p = sub.add_parser(
        "event-times",
        help="Print a story's Events resolved to story time",
    )
    times_p.add_argument("story_id")

    statements_p = sub.add_parser(
        "statement-times",
        help="Print each Property and Assertion span resolved to story time",
    )
    statements_p.add_argument("story_id")

    in_force_p = sub.add_parser(
        "in-force",
        help="Print the statements in force at a story time",
    )
    in_force_p.add_argument("story_id")
    in_force_p.add_argument("--timestamp", default=None, help="A story-time timestamp")
    in_force_p.add_argument(
        "--event-id", default=None, help="An Event to read as the time"
    )
    in_force_p.add_argument(
        "--edge",
        choices=("start", "end"),
        default=None,
        help="Which end of --event-id. Required with --event-id",
    )

    stretches_p = sub.add_parser(
        "in-force-stretches",
        help="Print the stretches where one Entity's in-force set stays the same",
    )
    stretches_p.add_argument("story_id")
    stretches_p.add_argument("entity_id")

    delete_p = sub.add_parser("delete", help="Delete a story")
    delete_p.add_argument("story_id")

    commit_p = sub.add_parser("commit", help="Post a commit body")
    commit_p.add_argument("story_id")
    commit_p.add_argument(
        "file",
        help='JSON file with {"writes": [...]}; use - for stdin',
    )

    import_p = sub.add_parser("import", help="Import a story document")
    import_p.add_argument("file", help="JSON story document; use - for stdin")

    args = parser.parse_args(argv)
    base: str = args.base_url

    if args.command == "list":
        status, raw = _http("GET", base, f"{API_PREFIX}/stories")
    elif args.command == "create":
        status, raw = _http("POST", base, f"{API_PREFIX}/stories")
    elif args.command == "get":
        status, raw = _http("GET", base, f"{API_PREFIX}/stories/{args.story_id}")
    elif args.command == "event-times":
        status, raw = _http(
            "GET", base, f"{API_PREFIX}/stories/{args.story_id}/event-times"
        )
    elif args.command == "statement-times":
        status, raw = _http(
            "GET", base, f"{API_PREFIX}/stories/{args.story_id}/statement-times"
        )
    elif args.command == "in-force":
        query = urlencode(
            [
                (key, value)
                for key, value in (
                    ("timestamp", args.timestamp),
                    ("event_id", args.event_id),
                    ("edge", args.edge),
                )
                if value is not None
            ]
        )
        path = f"{API_PREFIX}/stories/{args.story_id}/in-force"
        if query:
            path = f"{path}?{query}"
        status, raw = _http("GET", base, path)
    elif args.command == "in-force-stretches":
        query = urlencode([("entity_id", args.entity_id)])
        status, raw = _http(
            "GET",
            base,
            f"{API_PREFIX}/stories/{args.story_id}/in-force-stretches?{query}",
        )
    elif args.command == "delete":
        status, raw = _http("DELETE", base, f"{API_PREFIX}/stories/{args.story_id}")
    elif args.command == "commit":
        body = _read_json_file(args.file)
        status, raw = _http(
            "POST",
            base,
            f"{API_PREFIX}/stories/{args.story_id}/commits",
            body,
        )
    elif args.command == "import":
        document = _read_json_file(args.file)
        status, raw = _http("POST", base, f"{API_PREFIX}/stories/import", document)
    else:
        parser.error(f"unknown command {args.command!r}")
        return 1

    return _emit(status, raw)


if __name__ == "__main__":
    raise SystemExit(main())
