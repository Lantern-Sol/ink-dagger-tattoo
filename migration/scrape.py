#!/usr/bin/env python3
"""Scrape Ink & Dagger artist data from downloaded Squarespace pages.

Produces migration/data/artists.json with, per artist:
  slug, name, specialty, description, history, profile_image, working_portrait
Image URLs are normalized to a high-res (?format=2500w) download URL.
"""
import re, html as ihtml, os, json

PAGES_DIR = os.path.join(os.path.dirname(__file__), "pages")
OUT = os.path.join(os.path.dirname(__file__), "data", "artists.json")

SLUGS = [
    "russ-abbott", "robert-beeman", "david-balvino-irizarry-izzy", "lilith-jacobs",
    "michel-parisay", "mel-perlman", "bryn-riihimaki", "amber-grey", "craig-brock",
    "matt-perlman", "david-stani-staniforth", "mark-kalinskiy", "cortney-norton",
    "brian-bennett",
]
CHROME = ("ID-Logo", "favicon", "storefront", "diagonal_line_blank", "white_overlay")


def clean(t):
    t = ihtml.unescape(re.sub(r"<[^>]+>", "", t))
    return re.sub(r"\s+", " ", t).strip()


def body_of(raw):
    body = raw[raw.find("<body"):]
    body = re.sub(r"<script.*?</script>", " ", body, flags=re.S | re.I)
    body = re.sub(r"<style.*?</style>", " ", body, flags=re.S | re.I)
    return body


def get_name(raw, body):
    m = re.search(r"<h2[^>]*>(.*?)</h2>", body, re.S | re.I)
    if m:
        n = clean(m.group(1))
        if n:
            return n
    m = re.search(r"<title>([^<|]+)", raw)
    return clean(m.group(1)) if m else ""


def get_specialty(body):
    # Style tokens are individual <h1> elements like "Large-Scale", "Illustrative".
    tokens = []
    for m in re.finditer(r"<h1[^>]*>(.*?)</h1>", body, re.S | re.I):
        t = clean(m.group(1))
        if not t or t == "/" or "/" in t:
            continue
        if t not in tokens:
            tokens.append(t)
    return ", ".join(tokens)


def get_paragraphs(body):
    paras = []
    for m in re.finditer(r"<p[^>]*>(.*?)</p>", body, re.S | re.I):
        t = clean(m.group(1))
        if len(t) < 120:
            continue
        low = t.lower()
        if "cookies" in low or "skip to content" in low:
            continue
        # Skip blog-feature blurbs and footer
        if "client of the month" in low or "explore other tattoo artists" in low:
            continue
        # Skip the style-token / gallery block (e.g. "Art Deco / Art Nouveau / ... Featured July 17, 2025")
        if t.count(" / ") >= 2:
            continue
        if "featured" in low and re.search(
            r"\b(january|february|march|april|may|june|july|august|"
            r"september|october|november|december)\b.*\b20\d\d\b", low):
            continue
        paras.append(t)
    return paras


def get_images(raw):
    imgs = []
    for m in re.finditer(
        r"images\.squarespace-cdn\.com/content/v1/[^\s\"'?]+\.(?:jpg|jpeg|png|webp)",
        raw, re.I,
    ):
        u = "https://" + m.group(0)
        if any(c in u for c in CHROME):
            continue
        if u not in imgs:
            imgs.append(u)
    return imgs


def main():
    out = []
    for slug in SLUGS:
        raw = open(os.path.join(PAGES_DIR, slug + ".html")).read()
        body = body_of(raw)
        imgs = get_images(raw)
        paras = get_paragraphs(body)
        rec = {
            "slug": slug,
            "name": get_name(raw, body),
            "specialty": get_specialty(body),
            "bio": paras[0] if len(paras) > 0 else "",
            "focus": paras[1] if len(paras) > 1 else "",
            "profile_image": imgs[0] if len(imgs) > 0 else "",
            "working_portrait": imgs[1] if len(imgs) > 1 else "",
        }
        out.append(rec)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), indent=2, ensure_ascii=False)
    # Summary
    for r in out:
        print(f"\n#### {r['name']}  ({r['slug']})")
        print(f"  specialty : {r['specialty']}")
        print(f"  bio       : {len(r['bio'])} chars | {r['bio'][:90]}...")
        print(f"  focus     : {len(r['focus'])} chars | {r['focus'][:90]}...")
        print(f"  profile   : {r['profile_image'].split('/')[-1]}")
        print(f"  working   : {r['working_portrait'].split('/')[-1]}")
    print(f"\nWrote {OUT} ({len(out)} artists)")


if __name__ == "__main__":
    main()
