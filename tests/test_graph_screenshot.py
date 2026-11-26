"""The address the graph screenshot command opens."""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

_PATH = Path(__file__).resolve().parents[1] / "scripts" / "graph_screenshot.py"
_spec = importlib.util.spec_from_file_location("graph_screenshot", _PATH)
assert _spec is not None and _spec.loader is not None
graph_screenshot = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = graph_screenshot
_spec.loader.exec_module(graph_screenshot)


def test_graph_page_url_sets_hide_and_record() -> None:
    url = graph_screenshot.graph_page_url(
        "http://127.0.0.1:8017/",
        "story 1",
        hide="property,assertion",
        record="entity_mara",
    )
    parts = urlsplit(url)
    assert parts.scheme == "http"
    assert parts.netloc == "127.0.0.1:8017"
    assert parts.path == "/stories/story%201/graph"
    assert parse_qs(parts.query) == {
        "hide": ["property,assertion"],
        "record": ["entity_mara"],
    }


def test_graph_page_url_omits_an_empty_query() -> None:
    assert (
        graph_screenshot.graph_page_url("http://127.0.0.1:8000", "abc")
        == "http://127.0.0.1:8000/stories/abc/graph"
    )


def test_parse_size_and_hide_reject_a_bad_value() -> None:
    assert graph_screenshot.parse_size("1440x900") == (1440, 900)
    with pytest.raises(argparse.ArgumentTypeError):
        graph_screenshot.parse_size("1440")
    with pytest.raises(argparse.ArgumentTypeError):
        graph_screenshot.parse_hide("property,scene")
