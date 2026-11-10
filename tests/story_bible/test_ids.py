import pytest

from agentic_writing_system.story_bible.ids import (
    BlankPrimaryTextError,
    mint_id,
    slugify,
)


def test_slugify_event_the_letter() -> None:
    assert slugify("The Letter") == "the_letter"


def test_slugify_long_property_statement() -> None:
    statement = (
        "Mara is generally distrustful of strangers, especially men from the capital"
    )
    assert (
        slugify(statement)
        == "mara_is_generally_distrustful_of_strangers_especially_men"
    )


def test_mint_id_event_the_letter() -> None:
    assert mint_id("event", "The Letter", ()) == "event_the_letter"


def test_mint_id_long_property_statement() -> None:
    statement = (
        "Mara is generally distrustful of strangers, especially men from the capital"
    )
    assert (
        mint_id("property", statement, ())
        == "prop_mara_is_generally_distrustful_of_strangers_especially_men"
    )


def test_mint_id_collision_suffix() -> None:
    taken = {"event_the_letter"}
    assert mint_id("event", "The Letter", taken) == "event_the_letter_2"
    taken = {"event_the_letter", "event_the_letter_2"}
    assert mint_id("event", "The Letter", taken) == "event_the_letter_3"


def test_mint_id_blank_raises() -> None:
    with pytest.raises(BlankPrimaryTextError):
        mint_id("entity", "", ())
    with pytest.raises(BlankPrimaryTextError):
        mint_id("entity", "   ", ())


def test_slugify_non_latin() -> None:
    assert slugify("東京 123") == "東京_123"
    assert mint_id("entity", "東京", ()) == "entity_東京"


def test_slugify_punctuation_only() -> None:
    assert slugify("...!!!") == ""
    assert mint_id("arc", "!!!", ()) == "arc_untitled"


def test_slugify_apostrophe() -> None:
    assert slugify("Mara's") == "maras"


def test_slugify_keeps_letters_and_digits_in_one_word() -> None:
    assert slugify("Room 12B, 2nd floor") == "room_12b_2nd_floor"
