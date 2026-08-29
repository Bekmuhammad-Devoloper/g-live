# -*- coding: utf-8 -*-
"""Nemischa-o'zbekcha lug'at PDF -> JSON (src/data/dict-de-uz.json uchun xomashyo).

  pip install pdfplumber
  python scripts/parse-dict-pdf.py <lugat.pdf> src/data/dict-de-uz.json
  node scripts/clean-dict.mjs --apply

Maket ikki ustunli; sarlavha so'zlar ustun chekkasidan, izohning davomi
esa ichkariroqdan boshlanadi. OCR xatolari qoidalar bilan tuzatiladi."""
import io, json, re, sys
from collections import defaultdict, Counter
import pdfplumber

SRC = sys.argv[1]   # skanlangan lug'at PDF'i
OUT = sys.argv[2]   # natija JSON

# ── OCR tozalash ──
def clean(s: str) -> str:
    s = s.replace("\xad", "").replace("\u00a0", " ")
    s = re.sub(r"[‘’`´ʻʼ*]", "'", s)
    s = re.sub(r"(?<=[a-zA-Z])4(?=[a-zA-Z])", "'", s)      # bo4lmoq -> bo'lmoq
    s = re.sub(r"(?<=[oOgG])1(?=[a-z])", "'", s)           # jo1nab  -> jo'nab
    s = re.sub(r"(?<=[a-z])M(?=[a-z])", "'l", s)           # boMmoq  -> bo'lmoq
    s = re.sub(r"(?<=[a-z])0(?=[a-z])", "o", s)
    s = re.sub(r"''+", "'", s)
    s = re.sub(r"\s+([,;.])", r"\1", s)
    s = re.sub(r"([,;])(?=[^\s])", r"\1 ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()

# ── 1) Sahifalardan yozuvlarni ajratib olish ──
raw_entries = []
with pdfplumber.open(SRC) as pdf:
    for pno, page in enumerate(pdf.pages, start=1):
        if pno < 3:
            continue
        words = page.extract_words()
        if not words:
            continue
        gut = page.width / 2
        for col in (0, 1):
            sel = [w for w in words if (w["x0"] < gut) == (col == 0)]
            if len(sel) < 5:
                continue
            rows = defaultdict(list)
            for w in sel:
                rows[round(w["top"] / 4.5)].append(w)
            lines = []
            for k in sorted(rows):
                row = sorted(rows[k], key=lambda w: w["x0"])
                lines.append((row[0]["x0"], " ".join(w["text"] for w in row).strip()))
            lines = [(x, t) for x, t in lines
                     if t and not re.fullmatch(r"[-–—\s.]*\d+[-–—\s.]*", t)]
            if not lines:
                continue
            # Sarlavha chekkasi = eng ko'p uchraydigan x0 (min emas — kolontitul aldaydi)
            edge = Counter(round(x) for x, _ in lines).most_common(1)[0][0]
            buf = None
            for x, t in lines:
                head_like = re.match(
                    r"^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß().\-]{1,26}\s*"
                    r"([mfn]\b|pl\b|/|adj|adv|vt\b|vi\b|v/|num|pron|präp|konj|int)", t)
                new = (x - edge) < 2.2 or (x - edge < 4 and head_like)
                if new or buf is None:
                    if buf:
                        raw_entries.append(buf)
                    buf = t
                else:
                    buf = buf[:-1] + t if buf.endswith("-") else buf + " " + t
            if buf:
                raw_entries.append(buf)

# ── 2) Maydonlarga ajratish ──
GEND = {"m": "m", "f": "f", "n": "n", "pl": "pl", "/": "f"}
POSN = {"adj": "adj", "adv": "adv", "vt": "vt", "vi": "vi", "v/": "vt",
        "num": "num", "pron": "pron", "präp": "präp", "prap": "präp",
        "konj": "konj", "int": "int"}
FIELDS = ("zool|bot|tib|tex|mat|geogr|geol|harb|gram|ling|mus|sport|anat|biol|"
          "kim|fiz|el|din|dipl|deng|yur|tar|fals|bosm|shaxm|so'zl|ko'ch")
LABEL = re.compile(r"^(%s)\.\s*" % FIELDS, re.I)
GLUED = re.compile(r"(?<=[-a-zA-Z])(%s)\." % FIELDS)

def take_gram(rest: str):
    """Grammatik shakl ('-(e)s, -e' kabi) — haqiqiy so'z boshlangunicha."""
    toks, i = rest.split(" "), 0
    got = []
    while i < len(toks) and i < 6:
        t = toks[i]
        if re.search(r"[A-Za-zÄÖÜäöüß']{3,}", t):
            break
        if not re.search(r"[-–—/(),.]", t):
            break
        got.append(t); i += 1
    if not got:
        return None, rest
    g = " ".join(got).strip(" ,;.")
    g = g.replace("(c)", "(e)").replace("—", "-").replace("^", "-")
    g = re.sub(r"(?<=-)c", "e", g).strip(" ,;-/.")
    return (g or None), " ".join(toks[i:]).strip()

items, seen = [], {}
for raw in raw_entries:
    t = GLUED.sub(r" .", clean(raw))
    m = re.match(r"^([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]{1,26})\s*(.*)$", t, re.S)
    if not m:
        continue
    de, rest = m.group(1).strip("-"), m.group(2).strip()
    if len(de) < 2 or not rest:
        continue

    gender = pos = gram = field = None
    g = re.match(r"^(/|m|f|n|pl)(?![a-zA-ZÄÖÜäöüß])\.?", rest)
    if g:
        gender = GEND[g.group(1)]; rest = rest[g.end():].strip()
    p = re.match(r"^(adj|adv|vt|vi|v/|num|pron|präp|prap|konj|int)(?![a-zA-Z])\.?", rest)
    if p:
        pos = POSN[p.group(1)]; rest = rest[p.end():].strip()
    if rest[:1] in "-–—/(":
        gram, rest = take_gram(rest)
    if not pos:
        p = re.match(r"^(adj|adv|vt|vi|num|pron|konj|int)(?![a-zA-Z])\.?", rest)
        if p:
            pos = POSN[p.group(1)]; rest = rest[p.end():].strip()
    fm = LABEL.match(rest)
    if fm:
        field = fm.group(1).lower(); rest = rest[fm.end():].strip()

    uz = clean(rest).strip(" .;,:-)")
    if len(uz) < 3 or not re.search(r"[a-z]{3}", uz):
        continue
    key = de.lower()
    if key in seen:
        if len(uz) > len(seen[key]["uz"]):
            seen[key].update(uz=uz, pos=pos, gender=gender, gram=gram, field=field)
        continue
    it = {"de": de, "gender": gender, "pos": pos, "gram": gram, "field": field, "uz": uz}
    seen[key] = it; items.append(it)

items.sort(key=lambda x: (x["de"].lower(), x["de"]))
io.open(OUT, "w", encoding="utf-8").write(json.dumps(items, ensure_ascii=False))
print("yozuvlar:", len(items))
