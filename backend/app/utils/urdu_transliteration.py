"""Urdu Name Transliteration and Helper Utility.

Provides accurate, authentic Urdu transliterations for Pakistani and Islamic names,
supporting both explicit database fields (name_ur, guardian_name_ur) and intelligent
automatic transliteration fallback so Urdu dispatches always feature authentic Urdu names.
"""
import re
from typing import Optional

# Check if text contains Urdu / Arabic characters (Unicode range 0600-06FF, 0750-077F)
URDU_CHAR_PATTERN = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")

# Common Pakistani & Islamic given names and surnames dictionary
NAME_DICTIONARY: dict[str, str] = {
    # Existing database names
    "hamdan": "حمدان",
    "zameer": "ضمیر",
    "shaban": "شعبان",
    "akhar": "اختر",
    "akhtar": "اختر",
    "hamza": "حمزہ",
    "safdar": "صفدر",
    "azhar": "اظہر",
    "asghar": "اصغر",
    "qureshi": "قریشی",
    "zarman": "زرمن",
    "nadeem": "ندیم",
    "qaiser": "قیصر",
    "muslim": "مسلم",
    "ali": "علی",
    "saif": "سیف",
    "ullah": "اللہ",
    "saifullah": "سیف اللہ",
    "sayed": "سید",
    "syed": "سید",
    "kazmi": "کاظمی",
    "ruh": "روح",
    "hasnain": "حسنین",
    "hassnain": "حسنین",
    "ruh-ul-hasnain": "روح الحسنین",
    "sheryar": "شہریار",
    "shehryar": "شہریار",
    "haider": "حیدر",
    "sher": "شیر",
    "abbas": "عباس",
    "zil-e-hassnain": "ظلِ حسنین",
    "zain": "زین",
    "fatima": "فاطمہ",
    "noor": "نور",
    "din": "دین",
    "bilal": "بلال",
    "khan": "خان",
    "tariq": "طارق",
    "ayesha": "عائشہ",
    "malik": "ملک",

    # Common Pakistani names
    "muhammad": "محمد",
    "mohammad": "محمد",
    "ahmad": "احمد",
    "ahmed": "احمد",
    "usman": "عثمان",
    "osman": "عثمان",
    "umar": "عمر",
    "omer": "عمر",
    "abubakar": "ابوبکر",
    "hassan": "حسن",
    "hussain": "حسین",
    "abdullah": "عبداللہ",
    "abdul": "عبدال",
    "rehman": "رحمٰن",
    "rahman": "رحمٰن",
    "raheem": "رحیم",
    "kareem": "کریم",
    "rashid": "راشد",
    "shahid": "شاہد",
    "zahid": "زاہد",
    "sajid": "ساجد",
    "majid": "ماجد",
    "kashif": "کاشف",
    "atif": "عاطف",
    "asif": "آصف",
    "waqas": "وقاص",
    "faisal": "فیصل",
    "adnan": "عدنان",
    "kamran": "کامران",
    "irfan": "عرفان",
    "imran": "عمران",
    "rizwan": "رضوان",
    "salman": "سلمان",
    "farhan": "فرحان",
    "zeeshan": "ذیشان",
    "arslan": "ارسلان",
    "babar": "بابر",
    "sohail": "سہیل",
    "javeed": "جاوید",
    "javed": "جاوید",
    "naved": "نوید",
    "naeem": "نعیم",
    "waseem": "وسیم",
    "saleem": "سلیم",
    "khalid": "خالد",
    "tahir": "طاہر",
    "nasir": "ناصر",
    "munir": "منیر",
    "tanveer": "تنویر",
    "tanvir": "تنویر",
    "iqbal": "اقبال",
    "anwar": "انور",
    "akram": "اکرم",
    "aslam": "اسلم",
    "amjad": "امجد",
    "arshad": "ارشد",
    "rashida": "راشدہ",
    "maryam": "مریم",
    "marium": "مریم",
    "zainab": "زینب",
    "bibi": "بی بی",
    "amna": "آمنہ",
    "khadija": "خدیجہ",
    "ayesha": "عائشہ",
    "sadia": "سعدیہ",
    "saba": "صبا",
    "sana": "ثناء",
    "hina": "حنا",
    "hira": "حرا",
    "sidra": "سدرہ",
    "uzma": "عظمیٰ",
    "bushra": "بشریٰ",
    "rabia": "رابعہ",
    "samina": "ثمینہ",
    "shazia": "شازیہ",
    "farzana": "فرزانہ",
    "shahida": "شاہیدہ",
    "shaheen": "شاہین",
    "iqra": "اقراء",
    "alishba": "الشبہ",
    "aiman": "ایمن",
    "kinza": "کنزہ",
    "laiba": "لائبہ",
    "muqadas": "مقدس",
    "areeba": "اریبہ",
    "zoya": "زویا",
    "anum": "انعم",
    "anmol": "انمول",
    "mehwish": "مہوش",
    "saima": "صائمہ",
    "nida": "ندا",
    "huma": "ہما",
    "mahnoor": "ماہ نور",
    "shahzaib": "شاہ زیب",
    "aurangzeb": "اورنگزیب",
    "jehangir": "جہانگیر",
    "shahid": "شاہد",
    "khurram": "خرم",
    "danish": "دانش",
    "hamid": "حامد",
    "haroon": "ہارون",
    "haris": "حارث",
    "talha": "طلحہ",
    "zubair": "زبیر",
    "usama": "اسامہ",
    "osama": "اسامہ",
    "saad": "سعد",
    "subhan": "سبحان",
    "rehan": "ریحان",
    "farooq": "فاروق",
    "siddique": "صدیق",
    "chaudhary": "چوہدری",
    "choudhry": "چوہدری",
    "rana": "رانا",
    "raja": "راجہ",
    "butt": "بٹ",
    "bhatti": "بھٹی",
    "cheema": "چیمہ",
    "bajwa": "باجوہ",
    "warraich": "وڑائچ",
    "gondal": "گوندل",
    "tarar": "تارڑ",
    "gujjar": "گجر",
    "awan": "اعوان",
    "abbasi": "عباسی",
    "ansari": "انصاری",
    "shaikh": "شیخ",
    "sheikh": "شیخ",
    "mian": "میاں",
    "mirza": "مرزا",
    "baig": "بیگ",
    "mughal": "مغل",
    "shah": "شاہ",
    "sayyid": "سید",
}

# Phonetic character mapping for words not in the dictionary
PHONETIC_PAIRS = [
    ("kh", "خ"),
    ("gh", "غ"),
    ("sh", "ش"),
    ("ch", "چ"),
    ("th", "تھ"),
    ("ph", "ف"),
    ("bh", "بھ"),
    ("dh", "دھ"),
    ("jh", "جھ"),
    ("ee", "ی"),
    ("oo", "و"),
    ("aa", "ا"),
    ("ai", "ائی"),
    ("au", "او"),
]

SINGLE_LETTER_MAP = {
    "a": "ا",
    "b": "ب",
    "p": "پ",
    "t": "ت",
    "j": "ج",
    "c": "س",
    "d": "د",
    "r": "ر",
    "z": "ز",
    "s": "س",
    "f": "ف",
    "q": "ق",
    "k": "ک",
    "g": "گ",
    "l": "ل",
    "m": "م",
    "n": "ن",
    "w": "و",
    "v": "و",
    "h": "ہ",
    "y": "ی",
    "i": "ی",
    "o": "و",
    "u": "و",
    "x": "کس",
}


def is_urdu_text(text: Optional[str]) -> bool:
    """Return True if string contains Urdu / Arabic characters."""
    if not text:
        return False
    return bool(URDU_CHAR_PATTERN.search(text))


def transliterate_word_to_urdu(word: str) -> str:
    """Transliterate a single English name word to Urdu."""
    cleaned = word.strip().lower()
    if not cleaned:
        return ""

    # Direct dictionary lookup
    if cleaned in NAME_DICTIONARY:
        return NAME_DICTIONARY[cleaned]

    # Handle hyphens e.g. zil-e-hassnain, ruh-ul-hasnain
    if "-" in cleaned:
        parts = cleaned.split("-")
        trans_parts = [NAME_DICTIONARY.get(p, transliterate_word_to_urdu(p)) for p in parts]
        return " ".join(trans_parts)

    # Phonetic transliteration fallback
    res = []
    i = 0
    w_len = len(cleaned)
    while i < w_len:
        matched_pair = False
        for pair, urdu_ch in PHONETIC_PAIRS:
            if cleaned[i : i + len(pair)] == pair:
                res.append(urdu_ch)
                i += len(pair)
                matched_pair = True
                break
        if not matched_pair:
            ch = cleaned[i]
            res.append(SINGLE_LETTER_MAP.get(ch, ch))
            i += 1

    return "".join(res)


def transliterate_name_to_urdu(name: Optional[str]) -> str:
    """Convert full name (multiple words) from English to authentic Urdu."""
    if not name or not name.strip():
        return ""

    # If already written in Urdu, preserve as is
    if is_urdu_text(name):
        return name.strip()

    words = re.split(r"(\s+)", name.strip())
    translated = []
    for w in words:
        if w.isspace():
            translated.append(w)
        else:
            translated.append(transliterate_word_to_urdu(w))
    return "".join(translated)


def get_student_urdu_name(student: Optional[object], fallback_name: Optional[str] = None) -> str:
    """Extract or derive the Urdu name for a student."""
    if student is not None:
        name_ur = getattr(student, "name_ur", None)
        if name_ur and name_ur.strip():
            return name_ur.strip()
        eng_name = getattr(student, "name", None) or fallback_name or ""
        return transliterate_name_to_urdu(eng_name)
    return transliterate_name_to_urdu(fallback_name or "")


def get_guardian_urdu_name(student: Optional[object], fallback_guardian: Optional[str] = None) -> str:
    """Extract or derive the Urdu name for a student's guardian."""
    if student is not None:
        guard_ur = getattr(student, "guardian_name_ur", None)
        if guard_ur and guard_ur.strip():
            return guard_ur.strip()
        eng_guard = getattr(student, "guardian_name", None) or fallback_guardian or "والد / سرپرست"
        return transliterate_name_to_urdu(eng_guard)
    return transliterate_name_to_urdu(fallback_guardian or "والد / سرپرست")
