#!/usr/bin/env python3
"""Create/update the 14 artist metaobjects (published) from artists.json.

Each entry uses handle = slug, references its uploaded profile/working image GIDs,
and is set ACTIVE so it renders at /artists/<slug>. Empty fields are omitted.
The `collections` field is left empty until product collections exist.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from runner import execute

HERE = os.path.dirname(__file__)
DATA = os.path.abspath(os.path.join(HERE, "..", "data", "artists.json"))

UPSERT = """mutation($handle:MetaobjectHandleInput!,$obj:MetaobjectUpsertInput!){
  metaobjectUpsert(handle:$handle, metaobject:$obj){
    metaobject{ id handle displayName }
    userErrors{ field code message }
  }
}"""


def fields_for(a):
    f = [
        {"key": "name", "value": a["name"]},
        {"key": "specialty", "value": a["specialty"]},
    ]
    if a.get("bio"):
        f.append({"key": "bio", "value": a["bio"]})
    if a.get("focus"):
        f.append({"key": "focus", "value": a["focus"]})
    if a.get("profile_gid"):
        f.append({"key": "profile_image", "value": a["profile_gid"]})
    if a.get("working_gid"):
        f.append({"key": "working_portrait", "value": a["working_gid"]})
    return f


def main():
    artists = json.load(open(DATA))
    for a in artists:
        variables = {
            "handle": {"type": "artist", "handle": a["slug"]},
            "obj": {
                "capabilities": {"publishable": {"status": "ACTIVE"}},
                "fields": fields_for(a),
            },
        }
        r = execute(UPSERT, variables, allow_mutations=True)
        res = r["metaobjectUpsert"]
        if res["userErrors"]:
            print(f"  !! {a['slug']}: {res['userErrors']}")
        else:
            m = res["metaobject"]
            print(f"  ok {m['handle']:30} {m['id']}")


if __name__ == "__main__":
    main()
