"""Readable record id minting from primary text."""

from __future__ import annotations

import re
from collections.abc import Collection

from agentic_writing_system.story_bible.records import ID_PREFIXES, RecordKind

_WORD_RE = re.compile(r"[^\W_]+")


class BlankPrimaryTextError(ValueError):
    """Raised when id minting is asked for empty or whitespace-only text."""


def slugify(text: str) -> str:
    """Lowercase words from text, underscore-joined, capped at eight words."""
    lowered = text.lower()
    for apostrophe in ("'", "\u2019"):
        lowered = lowered.replace(apostrophe, "")
    words = _WORD_RE.findall(lowered)
    return "_".join(words[:8])


def mint_id(kind: RecordKind, primary_text: str, taken: Collection[str]) -> str:
    """Mint a stable id from `primary_text`, avoiding ids already in `taken`."""
    if not primary_text or primary_text.isspace():
        raise BlankPrimaryTextError("primary text must be non-empty")

    prefix = ID_PREFIXES[kind]
    slug = slugify(primary_text)
    base = f"{prefix}{slug or 'untitled'}"
    if base not in taken:
        return base

    n = 2
    while True:
        candidate = f"{base}_{n}"
        if candidate not in taken:
            return candidate
        n += 1
