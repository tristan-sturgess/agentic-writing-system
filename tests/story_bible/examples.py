"""Example documents shared by the Story Bible tests."""

from agentic_writing_system.story_bible.records import (
    Entity,
    NarrativeUnit,
    Property,
    StoryDocument,
)

T1 = "1847-03-02"
T2 = "1847-03-03"
T3 = "1847-03-04"
T4 = "1847-03-05"


def example_story_document() -> StoryDocument:
    """The example in docs/story-bible.md, as a flat document."""
    return StoryDocument.model_validate(
        {
            "entities": [
                Entity(id="entity_mara", name="Mara"),
                Entity(id="entity_john", name="John"),
            ],
            "events": [
                {
                    "id": "event_arrival",
                    "title": "Arrival",
                    "when": [{"kind": "at", "at": {"timestamp": T1}}],
                },
                {
                    "id": "event_the_market",
                    "title": "The market",
                    "when": [{"kind": "at", "at": {"timestamp": T2}}],
                },
                {
                    "id": "event_the_letter",
                    "title": "The letter",
                    "when": [
                        {
                            "kind": "range",
                            "start": {"event_id": "event_arrival"},
                            "end": {"timestamp": T3},
                        }
                    ],
                },
            ],
            "properties": [
                Property.model_validate(
                    {
                        "id": "prop_mara_distrustful",
                        "entity_id": "entity_mara",
                        "statement": "Mara is generally distrustful of strangers.",
                        "when": [
                            {
                                "kind": "range",
                                "start": {"event_id": "event_arrival"},
                                "end": {
                                    "event_id": "event_the_letter",
                                    "edge": "end",
                                },
                            }
                        ],
                    }
                ),
                Property.model_validate(
                    {
                        "id": "prop_mara_cautious",
                        "entity_id": "entity_mara",
                        "statement": "Mara is cautiously willing to trust strangers.",
                        "when": [
                            {
                                "kind": "range",
                                "start": {"event_id": "event_the_letter"},
                            }
                        ],
                        "caused_by": "event_the_letter",
                    }
                ),
            ],
            "arcs": [
                {
                    "id": "arc_mara_leaves",
                    "title": "Mara leaves",
                    "description": (
                        "Mara arrives unwilling to trust strangers. "
                        "The letter is what changes that."
                    ),
                    "event_ids": [
                        "event_arrival",
                        "event_the_market",
                        "event_the_letter",
                    ],
                }
            ],
            "assertions": [
                {
                    "id": "assertion_mara_john",
                    "entity_ids": ["entity_mara", "entity_john"],
                    "statement": "Mara distrusts John.",
                    "when": [
                        {
                            "kind": "at",
                            "at": {
                                "event_id": "event_the_market",
                                "edge": "start",
                            },
                        },
                        {"kind": "at", "at": {"timestamp": T4}},
                    ],
                },
                {
                    "id": "assertion_letter_follows_arrival",
                    "event_ids": ["event_arrival", "event_the_letter"],
                    "statement": (
                        "The letter follows the arrival, and it is what changes "
                        "Mara's mind."
                    ),
                },
                {
                    "id": "assertion_mara_leaves_is_maras",
                    "entity_ids": ["entity_mara"],
                    "arc_ids": ["arc_mara_leaves"],
                    "statement": (
                        "Mara's leaving is her journey from distrust toward trust."
                    ),
                },
            ],
        }
    )


def valid_document() -> StoryDocument:
    """The example plus a two-level unit tree. It breaks no rule."""
    doc = example_story_document()
    doc.units = [
        NarrativeUnit(
            id="unit_act_one", title="Act One", child_ids=["unit_chapter_one"]
        ),
        NarrativeUnit(id="unit_chapter_one", title="Chapter One"),
    ]
    doc.unit_ids = ["unit_act_one"]
    return doc
