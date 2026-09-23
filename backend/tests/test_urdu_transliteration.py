"""
Unit tests for Urdu name transliteration and bilingual notification rendering.
"""
import pytest
from app.utils.urdu_transliteration import (
    transliterate_name_to_urdu,
    get_student_urdu_name,
    get_guardian_urdu_name,
)
from app.services.notification_service import render_template


class MockStudent:
    def __init__(self, name, name_ur=None, guardian_name=None, guardian_name_ur=None):
        self.name = name
        self.name_ur = name_ur
        self.guardian_name = guardian_name
        self.guardian_name_ur = guardian_name_ur


def test_transliterate_name_known_dictionary():
    assert transliterate_name_to_urdu("Hamza Safdar") == "حمزہ صفدر"
    assert transliterate_name_to_urdu("Muhammad Ali") == "محمد علی"
    assert transliterate_name_to_urdu("Fatima Noor") == "فاطمہ نور"
    assert transliterate_name_to_urdu("Zainab Bibi") == "زینب بی بی"
    assert transliterate_name_to_urdu("Bilal Khan") == "بلال خان"


def test_transliterate_name_empty_or_none():
    assert transliterate_name_to_urdu("") == ""
    assert transliterate_name_to_urdu(None) == ""


def test_get_student_urdu_name_prefers_explicit():
    # If name_ur is set in DB, use it
    s1 = MockStudent(name="Hamza", name_ur="حمزہ خصوصی")
    assert get_student_urdu_name(s1) == "حمزہ خصوصی"

    # If name_ur is None, fallback to transliteration
    s2 = MockStudent(name="Hamza Safdar", name_ur=None)
    assert get_student_urdu_name(s2) == "حمزہ صفدر"


def test_get_guardian_urdu_name_prefers_explicit():
    s1 = MockStudent(name="Ali", guardian_name="Safdar Hussain", guardian_name_ur="صفدر صاحب")
    assert get_guardian_urdu_name(s1) == "صفدر صاحب"

    s2 = MockStudent(name="Ali", guardian_name="Tariq Khan", guardian_name_ur=None)
    assert get_guardian_urdu_name(s2) == "طارق خان"


def test_bilingual_template_rendering():
    template = (
        "Dear {guardian_name},\n"
        "Your child {student_name} was ABSENT today.\n\n"
        "---\n\n"
        "محترم والدین ({guardian_name_ur})،\n"
        "آپ کا بچہ {student_name_ur} آج غیر حاضر رہا۔"
    )

    ctx = {
        "guardian_name": "Tariq Khan",
        "guardian_name_ur": "طارق خان",
        "student_name": "Bilal Khan",
        "student_name_ur": "بلال خان",
    }

    rendered = render_template(template, ctx)
    lines = rendered.split("---")
    english_part = lines[0]
    urdu_part = lines[1]

    # English part has English names
    assert "Dear Tariq Khan" in english_part
    assert "Bilal Khan was ABSENT" in english_part

    # Urdu part has Urdu names
    assert "طارق خان" in urdu_part
    assert "بلال خان" in urdu_part


def test_bilingual_template_rendering_auto_replaces_even_with_english_placeholders():
    # Even if an older template uses {student_name} and {guardian_name} in the Urdu section:
    template = (
        "Dear {guardian_name},\n"
        "Student {student_name}.\n\n"
        "---\n\n"
        "محترم والدین ({guardian_name})،\n"
        "آپ کا بچہ {student_name} حاضر نہیں ہوا۔"
    )

    ctx = {
        "guardian_name": "Tariq Khan",
        "guardian_name_ur": "طارق خان",
        "student_name": "Bilal Khan",
        "student_name_ur": "بلال خان",
    }

    rendered = render_template(template, ctx)
    lines = rendered.split("---")
    english_part = lines[0]
    urdu_part = lines[1]

    assert "Dear Tariq Khan" in english_part
    assert "Student Bilal Khan" in english_part

    # In Urdu section, it should automatically use Urdu names
    assert "طارق خان" in urdu_part
    assert "بلال خان" in urdu_part
