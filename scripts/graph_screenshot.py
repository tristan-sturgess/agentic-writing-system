#!/usr/bin/env python3
"""Save a PNG of one story's graph from a running service.

Point ``--url`` at a service started with ``WRITING_DATA_DIR`` set to a scratch
directory, or at the frontend dev server that proxies to one. Do not point it
at the service that uses the real ``data/`` directory. The command only opens
the page and writes a PNG. It does not change the story.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import quote, urlencode

from playwright.sync_api import Error, sync_playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeout

RECORD_KINDS = ("entity", "property", "assertion", "event", "unit", "arc")

# Empty string is falsy, so Playwright keeps waiting. A finished layout is the
# only success. The other words are the page's own failure text.
_WAIT_JS = """
() => {
  const graph = document.querySelector('[aria-label="Record graph"]');
  if (graph && graph.getAttribute('data-layout') === 'done') return 'done';
  const text = document.body ? document.body.innerText : '';
  if (text.includes('The frontend is not built')) return 'not-built';
  if (text.includes('There is no story at this address')) return 'missing-story';
  if (text.includes('The story could not be loaded')) return 'load-failed';
  if (text.includes('There is no page at this address')) return 'no-page';
  return '';
}
"""

_FAILURES = {
    "not-built": (
        "The frontend is not built. Run `npm --prefix frontend run build`, "
        "or pass --url for the dev server."
    ),
    "missing-story": "There is no story at this address.",
    "load-failed": "The story could not be loaded.",
    "no-page": "There is no page at this address.",
}


def parse_size(value: str) -> tuple[int, int]:
    """``1440x900`` as a width and a height."""
    width_text, separator, height_text = value.partition("x")
    if separator != "x" or not width_text.isdigit() or not height_text.isdigit():
        raise argparse.ArgumentTypeError("size must look like 1440x900")
    width, height = int(width_text), int(height_text)
    if width < 1 or height < 1:
        raise argparse.ArgumentTypeError("size must be at least 1x1")
    return width, height


def parse_hide(value: str) -> str:
    """Comma-separated record kinds, in the order given."""
    kinds = [part.strip() for part in value.split(",") if part.strip()]
    unknown = [kind for kind in kinds if kind not in RECORD_KINDS]
    if not kinds or unknown:
        names = ", ".join(RECORD_KINDS)
        raise argparse.ArgumentTypeError(
            f"hide must be a comma-separated list of: {names}"
        )
    return ",".join(kinds)


def graph_page_url(
    origin: str,
    story_id: str,
    *,
    hide: str | None = None,
    record: str | None = None,
) -> str:
    """The graph address on ``origin``, including ``?hide=`` and ``?record=``."""
    query = {key: value for key, value in (("hide", hide), ("record", record)) if value}
    path = f"/stories/{quote(story_id, safe='')}/graph"
    url = origin.rstrip("/") + path
    if query:
        return f"{url}?{urlencode(query)}"
    return url


def save_graph(
    url: str,
    output: Path,
    *,
    width: int,
    height: int,
    timeout_ms: int,
) -> None:
    """Open ``url`` and write a PNG of the graph area once the layout is done."""
    output.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page(
                viewport={"width": width, "height": height},
                color_scheme="light",
            )
            page.set_default_timeout(timeout_ms)
            try:
                page.goto(url, wait_until="domcontentloaded")
            except Error as exc:
                if "ERR_CONNECTION_REFUSED" in str(exc) or "NS_ERROR" in str(exc):
                    print(f"The server is not reachable at {url}", file=sys.stderr)
                    raise SystemExit(2) from None
                raise
            try:
                handle = page.wait_for_function(_WAIT_JS)
            except PlaywrightTimeout:
                print(
                    "The graph layout did not finish. "
                    'The page never set data-layout="done".',
                    file=sys.stderr,
                )
                raise SystemExit(1) from None
            result = handle.json_value()
            if result != "done":
                print(_FAILURES.get(str(result), str(result)), file=sys.stderr)
                raise SystemExit(1)
            page.locator('[aria-label="Record graph"]').screenshot(path=str(output))
        finally:
            browser.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Save a PNG of one story's graph from a running service. "
            "The service must use a scratch data directory, not data/."
        )
    )
    parser.add_argument("story_id", help="The story to open")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000",
        help=(
            "Origin of the page. The service that serves the built frontend "
            "(default: http://127.0.0.1:8000), or the dev server, "
            "such as http://127.0.0.1:5173"
        ),
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Where to write the PNG",
    )
    parser.add_argument(
        "--size",
        type=parse_size,
        default=(1440, 900),
        help="Window size as WIDTHxHEIGHT (default: 1440x900)",
    )
    parser.add_argument(
        "--hide",
        type=parse_hide,
        default=None,
        help="Record kinds to hide, comma-separated, as ?hide=",
    )
    parser.add_argument(
        "--record",
        default=None,
        help="Record to select, as ?record=",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=60,
        help="Seconds to wait for the layout (default: 60)",
    )
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("--timeout must be greater than 0")
    width, height = args.size
    url = graph_page_url(
        args.url,
        args.story_id,
        hide=args.hide,
        record=args.record,
    )
    try:
        save_graph(
            url,
            args.output,
            width=width,
            height=height,
            timeout_ms=int(args.timeout * 1000),
        )
    except Error as exc:
        if "Executable doesn't exist" in str(exc) or "playwright install" in str(exc):
            print(
                "Chromium is not installed for Playwright. "
                "Run: poetry run playwright install chromium",
                file=sys.stderr,
            )
            return 2
        raise
    print(url)
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
