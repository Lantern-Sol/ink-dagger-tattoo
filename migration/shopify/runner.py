#!/usr/bin/env python3
"""Helper to run GraphQL against the connected store via Shopify CLI and parse JSON."""
import subprocess, json, os, re

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")

STORE = "ink-dagger-tattoo.myshopify.com"
ENV = {
    **os.environ,
    "SHOPIFY_CLI_AGENT_INFO": "n:claude-code|v:none|p:anthropic|m:claude-opus-4-8",
}


def execute(query, variables=None, allow_mutations=False):
    cmd = ["shopify", "store", "execute", "--store", STORE, "--query", query]
    if variables is not None:
        cmd += ["--variables", json.dumps(variables)]
    if allow_mutations:
        cmd += ["--allow-mutations"]
    p = subprocess.run(cmd, capture_output=True, text=True, env=ENV)
    out = ANSI.sub("", p.stdout + p.stderr)
    # The CLI prints a banner box, then a JSON payload (and maybe trailing lines).
    idx = out.find("\n{")
    if idx == -1 and out.lstrip().startswith("{"):
        idx = out.find("{")
    if idx == -1:
        raise RuntimeError("No JSON found in CLI output:\n" + out)
    data, _ = json.JSONDecoder().raw_decode(out[idx:].lstrip())
    return data


if __name__ == "__main__":
    print(json.dumps(execute("query { shop { name } }"), indent=2))
