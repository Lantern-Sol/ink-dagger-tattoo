#!/usr/bin/env python3
"""Download artist profile + working-portrait images and optimize them to WebP.

Reads migration/data/artists.json, downloads each image at high resolution from
the Squarespace CDN, re-encodes to WebP (quality 82), and writes:
  migration/images_webp/<slug>-profile.webp
  migration/images_webp/<slug>-working.webp
Adds local file paths back onto each record in artists.json.
"""
import os, json, io, urllib.request, urllib.error
from PIL import Image

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "data", "artists.json")
SRC = os.path.join(HERE, "images_src")
OUT = os.path.join(HERE, "images_webp")
MAX_EDGE = 2000          # cap longest edge; plenty for profile/portrait use
QUALITY = 82
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def download(url, dest):
    # Request a large render from the Squarespace CDN.
    full = url + ("&" if "?" in url else "?") + "format=2500w"
    req = urllib.request.Request(full, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    with open(dest, "wb") as f:
        f.write(data)
    return data


def to_webp(data, dest):
    im = Image.open(io.BytesIO(data))
    if im.mode in ("P", "RGBA", "LA"):
        im = im.convert("RGB")
    elif im.mode != "RGB":
        im = im.convert("RGB")
    w, h = im.size
    scale = MAX_EDGE / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    im.save(dest, "WEBP", quality=QUALITY, method=6)
    return im.size, os.path.getsize(dest)


def main():
    os.makedirs(SRC, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    artists = json.load(open(DATA))
    total_src = total_out = 0
    for a in artists:
        for kind, key in (("profile", "profile_image"), ("working", "working_portrait")):
            url = a.get(key)
            if not url:
                a[f"{kind}_webp"] = ""
                continue
            ext = url.rsplit(".", 1)[-1].split("?")[0].lower()
            src_path = os.path.join(SRC, f"{a['slug']}-{kind}.{ext}")
            out_path = os.path.join(OUT, f"{a['slug']}-{kind}.webp")
            try:
                data = download(url, src_path)
                (ow, oh), osize = to_webp(data, out_path)
                a[f"{kind}_webp"] = os.path.relpath(out_path, HERE)
                total_src += len(data)
                total_out += osize
                print(f"  {a['slug']:28} {kind:8} {len(data)//1024:5}KB -> {osize//1024:4}KB  {ow}x{oh}")
            except Exception as e:
                a[f"{kind}_webp"] = ""
                print(f"  !! {a['slug']} {kind}: {e}")
    json.dump(artists, open(DATA, "w"), indent=2, ensure_ascii=False)
    print(f"\nTotal: {total_src//1024}KB src -> {total_out//1024}KB webp "
          f"({100 - total_out*100//max(total_src,1)}% smaller)")


if __name__ == "__main__":
    main()
