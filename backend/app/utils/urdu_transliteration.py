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
    # Real academy student & guardian names
    "mahad": "ماہد",
    "mubeen": "مبین",
    "hamdan": "حمدان",
    "zameer": "ضمیر",
    "fahad": "فہد",
    "aqeel": "عقیل",
    "zafar": "ظفر",
    "subhan": "سبحان",
    "farooq": "فاروق",
    "umar": "عمر",
    "mudasir": "مدثر",
    "mudassir": "مدثر",
    "muddasir": "مدثر",
    "nasir": "ناصر",
    "aslam": "اسلم",
    "abubaker": "ابوبکر",
    "abubakar": "ابوبکر",
    "naveed": "نوید",
    "ahmad": "احمد",
    "ahmed": "احمد",
    "muslim": "مسلم",
    "ali": "علی",
    "saif": "سیف",
    "zarman": "زرمن",
    "nadeem": "ندیم",
    "qaiser": "قیصر",
    "abdullah": "عبداللہ",
    "sheheryar": "شہریار",
    "sheryar": "شہریار",
    "haider": "حیدر",
    "sher": "شیر",
    "azhar": "اظہر",
    "qureshi": "قریشی",
    "asghar": "اصغر",
    "mustafa": "مصطفیٰ",
    "bhatti": "بھٹی",
    "razi": "رضی",
    "ullah": "اللہ",
    "qaleem": "کلیم",
    "wazir": "وزیر",
    "maaz": "معاذ",
    "ms": "مس",
    "gulfaraz": "گلفراز",
    "raheem": "رحیم",
    "naeem": "نعیم",
    "ayan": "ایان",
    "shahbaz": "شہباز",
    "ibrahim": "ابراہیم",
    "kazmi": "کاظمی",
    "kazmni": "کاظمی",
    "sajid": "ساجد",
    "hamza": "حمزہ",
    "safdar": "صفدر",
    "hanan": "حنان",
    "talib": "طالب",
    "basit": "باسط",
    "hafiz": "حافظ",
    "raza": "رضا",
    "toqueer": "توقیر",
    "tauqeer": "توقیر",
    "shahzab": "شاہ زیب",
    "shahzaib": "شاہ زیب",
    "hafeez": "حفیظ",
    "shahzain": "شاہ زین",
    "aurangzaib": "اورنگزیب",
    "aurangzeb": "اورنگزیب",
    "ijaaz": "اعجاز",
    "ijaz": "اعجاز",
    "ejaz": "اعجاز",
    "hammad": "حماد",
    "aqib": "عاقب",
    "atif": "عاطف",

    # Titles, Prefixes & Hyphenated names
    "m": "محمد",
    "jr": "جونیئر",
    "rooh": "روح",
    "ruh": "روح",
    "rooh-ul-hassnain": "روح الحسنین",
    "ruh-ul-hasnain": "روح الحسنین",
    "zil-e-hassnain": "ظلِ حسنین",
    "saifullah": "سیف اللہ",
    "shaban": "شعبان",
    "akhtar": "اختر",
    "akhar": "اختر",
    "sayed": "سید",
    "syed": "سید",
    "sayyid": "سید",
    "hasnain": "حسنین",
    "hassnain": "حسنین",
    "abbas": "عباس",
    "zain": "زین",
    "fatima": "فاطمہ",
    "noor": "نور",
    "din": "دین",
    "bilal": "بلال",
    "khan": "خان",
    "tariq": "طارق",
    "ayesha": "عائشہ",
    "malik": "ملک",

    # Common Pakistani & Islamic names
    "muhammad": "محمد",
    "mohammad": "محمد",
    "usman": "عثمان",
    "osman": "عثمان",
    "omer": "عمر",
    "hassan": "حسن",
    "hussain": "حسین",
    "abdul": "عبدال",
    "rehman": "رحمٰن",
    "rahman": "رحمٰن",
    "kareem": "کریم",
    "rashid": "راشد",
    "shahid": "شاہد",
    "zahid": "زاہد",
    "majid": "ماجد",
    "kashif": "کاشف",
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
    "waseem": "وسیم",
    "saleem": "سلیم",
    "khalid": "خالد",
    "tahir": "طاہر",
    "munir": "منیر",
    "tanveer": "تنویر",
    "tanvir": "تنویر",
    "iqbal": "اقبال",
    "anwar": "انور",
    "akram": "اکرم",
    "amjad": "امجد",
    "arshad": "ارشد",
    "rashida": "راشدہ",
    "maryam": "مریم",
    "marium": "مریم",
    "zainab": "زینب",
    "bibi": "بی بی",
    "amna": "آمنہ",
    "khadija": "خدیجہ",
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
    "jehangir": "جہانگیر",
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
    "rehan": "ریحان",
    "siddique": "صدیق",
    "chaudhary": "چوہدری",
    "choudhry": "چوہدری",
    "rana": "رانا",
    "raja": "راجہ",
    "butt": "بٹ",
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
}

# Subject English to Urdu map
SUBJECT_URDU_MAP: dict[str, str] = {
    "mathematics": "ریاضی",
    "maths": "ریاضی",
    "math": "ریاضی",
    "physics": "طبیعیات (Physics)",
    "chemistry": "کیمسٹری (Chemistry)",
    "biology": "حیاتیات (Biology)",
    "computer": "کمپیوٹر سائنس",
    "computer science": "کمپیوٹر سائنس",
    "english": "انگریزی (English)",
    "urdu": "اردو",
    "islamiat": "اسلامیات",
    "islamic studies": "اسلامیات",
    "pak studies": "مطالعہ پاکستان",
    "pakistan studies": "مطالعہ پاکستان",
    "general science": "جنرل سائنس",
    "science": "سائنس",
    "economics": "معاشیات",
    "accounting": "اکاؤنٹنگ",
    "commerce": "کامرس",
    "tarjuma-tul-quran": "ترجمۃ القرآن",
    "quran": "قرآن پاک",
}


def get_subject_urdu_name(subject: Optional[str]) -> str:
    """Return authentic Urdu subject name."""
    if not subject:
        return "عمومی ٹیسٹ"
    clean = subject.strip().lower()
    return SUBJECT_URDU_MAP.get(clean, subject)


def get_academy_urdu_name(academy_name: Optional[str] = None) -> str:
    """Return authentic Urdu academy name."""
    return "آنر نالج اکیڈمی"


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
    cleaned = word.strip().lower().rstrip(".,")
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
    eng_guard = None
    if student is not None:
        guard_ur = getattr(student, "guardian_name_ur", None)
        if guard_ur and guard_ur.strip():
            return guard_ur.strip()
        eng_guard = getattr(student, "guardian_name", None)

    eng_guard = (eng_guard or fallback_guardian or "").strip()
    clean = eng_guard.lower()

    # Common placeholders when guardian is not specified
    if not clean or clean in ("nill", "nil", "none", "n/a", "na", "-", "--", "parent", "guardian", "father"):
        return "محترم والدین / سرپرست"

    return transliterate_name_to_urdu(eng_guard)

