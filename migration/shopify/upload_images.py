#!/usr/bin/env python3
"""Upload the optimized WebP artist images to Shopify Files.

Flow per Shopify staged-upload contract:
  1. stagedUploadsCreate (batch) -> presigned GCS POST targets
  2. multipart POST each local file to its target (curl)
  3. fileCreate (batch) with originalSource=resourceUrl, contentType IMAGE
  4. poll until every file reaches status READY
Writes profile_gid / working_gid back onto each artist in artists.json.
"""
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
from runner import execute

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(ROOT, "migration", "data", "artists.json")

STAGED = """mutation($input:[StagedUploadInput!]!){
  stagedUploadsCreate(input:$input){
    stagedTargets{ url resourceUrl parameters{ name value } }
    userErrors{ field message }
  }
}"""

FILECREATE = """mutation($files:[FileCreateInput!]!){
  fileCreate(files:$files){
    files{ id alt fileStatus }
    userErrors{ field message }
  }
}"""

POLL = """query($ids:[ID!]!){
  nodes(ids:$ids){ ... on MediaImage { id fileStatus image { url width height } } }
}"""


def build_items(artists):
    items = []
    for a in artists:
        for kind in ("profile", "working"):
            rel = a[f"{kind}_webp"]
            if not rel:
                continue
            path = os.path.join(ROOT, "migration", rel)
            items.append({
                "slug": a["slug"], "kind": kind, "path": path,
                "filename": f"{a['slug']}-{kind}.webp",
                "alt": f"{a['name']} — {'profile' if kind=='profile' else 'working portrait'}",
                "size": os.path.getsize(path),
            })
    return items


def post_upload(target, path):
    fields = []
    for p in target["parameters"]:
        fields += ["-F", f"{p['name']}={p['value']}"]
    fields += ["-F", f"file=@{path}"]
    cmd = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", target["url"]] + fields
    code = subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    if code not in ("201", "204"):
        raise RuntimeError(f"upload failed ({code}) for {path}")


def main():
    artists = json.load(open(DATA))
    items = build_items(artists)
    print(f"Uploading {len(items)} images...")

    # 1. staged targets
    inp = [{"filename": it["filename"], "mimeType": "image/webp",
            "resource": "IMAGE", "httpMethod": "POST", "fileSize": str(it["size"])}
           for it in items]
    r = execute(STAGED, {"input": inp}, allow_mutations=True)
    sc = r["stagedUploadsCreate"]
    assert not sc["userErrors"], sc["userErrors"]
    targets = sc["stagedTargets"]

    # 2. upload each
    for it, t in zip(items, targets):
        post_upload(t, it["path"])
        it["resourceUrl"] = t["resourceUrl"]
        print(f"  posted {it['filename']}")

    # 3. fileCreate
    files_input = [{"originalSource": it["resourceUrl"], "contentType": "IMAGE",
                    "alt": it["alt"], "filename": it["filename"]} for it in items]
    r = execute(FILECREATE, {"files": files_input}, allow_mutations=True)
    fc = r["fileCreate"]
    assert not fc["userErrors"], fc["userErrors"]
    for it, f in zip(items, fc["files"]):
        it["gid"] = f["id"]
    print(f"Created {len(fc['files'])} file records.")

    # 4. poll until READY
    ids = [it["gid"] for it in items]
    for attempt in range(30):
        r = execute(POLL, {"ids": ids})
        nodes = r["nodes"]
        statuses = [n.get("fileStatus") for n in nodes if n]
        ready = sum(1 for s in statuses if s == "READY")
        failed = [n for n in nodes if n and n.get("fileStatus") == "FAILED"]
        print(f"  poll {attempt+1}: {ready}/{len(ids)} READY")
        if failed:
            raise RuntimeError(f"file(s) FAILED: {failed}")
        if ready == len(ids):
            break
        time.sleep(3)

    # write GIDs back
    by_slug = {}
    for it in items:
        by_slug.setdefault(it["slug"], {})[it["kind"]] = it["gid"]
    for a in artists:
        g = by_slug.get(a["slug"], {})
        a["profile_gid"] = g.get("profile", "")
        a["working_gid"] = g.get("working", "")
    json.dump(artists, open(DATA, "w"), indent=2, ensure_ascii=False)
    print("Saved GIDs to artists.json")


if __name__ == "__main__":
    main()
