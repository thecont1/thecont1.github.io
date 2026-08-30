#!/usr/bin/env python3
"""Generate README.md from apps.csv and repo-meta.json.

Run from the site root whenever the gallery content changes:
    python3 scripts/generate_readme.py

The README is a markdown mirror of the live portfolio at
https://thecont1.github.io/ (also served at https://apps.thecontrarian.in/).
It is regenerated from the same data files the browser renders, so the
profile README never drifts from the curated portfolio.

The generated README is also pushed to the thecont1/thecont1 profile repo
by .github/workflows/sync-profile-readme.yml so GitHub's special profile
README stays in sync with this portfolio automatically.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "apps.csv"
META_PATH = ROOT / "repo-meta.json"
OUTPUT_PATH = ROOT / "README.md"

SITE_URL = "apps.thecontrarian.in"
GITHUB_URL = "github.com/thecont1"
RAW_BASE = "https://raw.githubusercontent.com/thecont1/thecont1.github.io/main/assets/icons"


def themed_icon(name: str, alt: str) -> str:
    """Two markdown images — light variant for dark theme, dark variant for light theme.

    GitHub swaps them via the #gh-dark-mode-only / #gh-light-mode-only URL
    fragments. These fragments only work with markdown ![]() syntax, not raw
    HTML <img> tags (which render both regardless of theme).
    """
    light = f"![{alt}]({RAW_BASE}/{name}-light.svg#gh-dark-mode-only)"
    dark = f"![{alt}]({RAW_BASE}/{name}-dark.svg#gh-light-mode-only)"
    return light + dark


GITHUB_ICON = themed_icon("github", "github")
LINK_ICON = themed_icon("box-arrow-up-right", "live")


def clean(value: str | None) -> str:
    return " ".join((value or "").split())


def load_apps() -> list[dict[str, str]]:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Missing {CSV_PATH}")
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    if not rows or "app_name" not in rows[0] or "repo_url" not in rows[0]:
        raise ValueError("apps.csv must contain app_name and repo_url columns")
    return rows


def load_meta() -> dict[str, dict[str, object]]:
    if not META_PATH.exists():
        raise FileNotFoundError(f"Missing {META_PATH}")
    return json.loads(META_PATH.read_text(encoding="utf-8"))


def badge(label: str) -> str:
    """Render a static markdown badge for a tech label."""
    return f"`{label}`"


def render_app(row: dict[str, str], meta: dict[str, object]) -> list[str]:
    name = clean(row.get("app_name"))
    repo_url = clean(row.get("repo_url"))
    entry = meta.get(repo_url, {})
    description = clean(entry.get("description")) or "A small, thoughtful tool by Mahesh Shantaram."
    homepage_url = clean(entry.get("homepage")) or None
    tech_stack = entry.get("tech_stack") or entry.get("languages") or []
    if not isinstance(tech_stack, list):
        tech_stack = []

    lines: list[str] = []
    lines.append(f"## {name}")

    links: list[str] = []
    if repo_url:
        repo_label = repo_url[len("https://github.com/"):] if repo_url.startswith("https://github.com/") else repo_url
        links.append(f"[{GITHUB_ICON} {repo_label}]({repo_url})\n")
    if homepage_url:
        homepage_label = homepage_url[len("https://"):] if homepage_url.startswith("https://") else homepage_url
        homepage_label = homepage_label[:-1] if homepage_label.endswith("/") else homepage_label
        links.append(f"[{LINK_ICON} {homepage_label}]({homepage_url})")
    if links:
        lines.append(f"{'   '.join(links)}")

    lines.append("")
    lines.append(description)
    lines.append("")
    if tech_stack:
        lines.append(" ".join(badge(str(item)) for item in tech_stack))
        lines.append("")
    return lines


def render_readme(apps: list[dict[str, str]], meta: dict[str, dict[str, object]]) -> str:
    out: list[str] = []
    out.append("# Apps by Mahesh Shantaram")
    out.append("")
    out.append(
        f"A working shelf of small experiments, civic tools and data "
        f"visualisations for the public good. See the live site at [{SITE_URL}](https://{SITE_URL})"
    )
    out.append("")
    out.append("---")
    out.append("")

    for row in apps:
        out.extend(render_app(row, meta))
        out.append("---")
        out.append("")

    return "\n".join(out)


def main() -> int:
    try:
        apps = load_apps()
        meta = load_meta()
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    readme = render_readme(apps, meta)
    OUTPUT_PATH.write_text(readme, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} ({len(apps)} apps)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
