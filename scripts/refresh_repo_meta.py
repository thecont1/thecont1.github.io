#!/usr/bin/env python3
"""Refresh repo-meta.json from the public GitHub repository pages.

Run from the site root whenever a genuinely new repository is added:
    python3 scripts/refresh_repo_meta.py

The gallery itself never runs this script. It only fetches apps.csv and
repo-meta.json in the browser, so editing/reordering apps.csv needs no build.
"""

from __future__ import annotations

import csv
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "apps.csv"
OUTPUT_PATH = ROOT / "repo-meta.json"
USER_AGENT = "apps-portfolio-metadata-refresh/1.0 (+https://thecontrarian.in/apps)"


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
    with urlopen(request, timeout=25) as response:
        return response.read()


def repo_path(repo_url: str) -> str:
    parsed = urlparse(repo_url.strip())
    path = parsed.path.strip("/")
    parts = path.split("/")
    if len(parts) < 2 or parsed.netloc.lower() != "github.com":
        raise ValueError(f"Expected a public GitHub URL, got: {repo_url}")
    return "/".join(parts[:2])


def clean_text(value: str | None) -> str:
    return " ".join((value or "").split())


def scrape_about(repo_url: str) -> tuple[str, list[str]]:
    html = fetch(repo_url).decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")

    description_node = soup.select_one("p[data-component='Text']")
    description = clean_text(description_node.get_text(" ", strip=True) if description_node else "")

    topics: list[str] = []
    topic_heading = None
    for heading in soup.select("h3[data-component='Heading']"):
        if clean_text(heading.get_text(" ", strip=True)).lower() == "topics":
            topic_heading = heading
            break
    if topic_heading:
        topic_group = topic_heading.find_next_sibling("div")
        if topic_group:
            topics = [clean_text(anchor.get_text(" ", strip=True)) for anchor in topic_group.select("a[href^='/topics/']")]

    # GitHub emits the sidebar description/topics in embedded state on some
    # page variants. Use that as a fallback when the rendered selectors move.
    if not description:
        match = re.search(r'"sidebarAbout":\{"description":"((?:\\.|[^"\\])*)"', html)
        if match:
            description = clean_text(json.loads('"' + match.group(1) + '"'))
    if not topics:
        topic_match = re.search(r'"sidebarAbout":\{.*?"topics":(\[.*?\])', html)
        if topic_match:
            try:
                topics = [clean_text(item.get("name", "")) for item in json.loads(topic_match.group(1))]
            except json.JSONDecodeError:
                topics = []

    return description, [topic for topic in topics if topic]


def fetch_languages(repo: str) -> list[str]:
    try:
        payload = json.loads(fetch(f"https://api.github.com/repos/{repo}/languages").decode("utf-8"))
        if isinstance(payload, dict):
            return list(payload.keys())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"  warning: languages unavailable for {repo}: {exc}", file=sys.stderr)
    return []


def fetch_homepage(repo: str) -> str | None:
    try:
        payload = json.loads(fetch(f"https://api.github.com/repos/{repo}").decode("utf-8"))
        if isinstance(payload, dict):
            homepage = clean_text(payload.get("homepage") or "")
            return homepage or None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"  warning: homepage unavailable for {repo}: {exc}", file=sys.stderr)
    return None


def main() -> int:
    if not CSV_PATH.exists():
        print(f"Missing {CSV_PATH}", file=sys.stderr)
        return 1

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    if not rows or "app_name" not in rows[0] or "repo_url" not in rows[0]:
        print("apps.csv must contain app_name and repo_url columns", file=sys.stderr)
        return 1

    refreshed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    metadata: dict[str, dict[str, object]] = {}

    for row in rows:
        name = clean_text(row.get("app_name"))
        url = clean_text(row.get("repo_url"))
        repo = repo_path(url)
        print(f"Refreshing {name} ({repo})")
        try:
            description, topics = scrape_about(url)
            languages = fetch_languages(repo)
            homepage = fetch_homepage(repo)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            print(f"  error: {exc}", file=sys.stderr)
            return 1

        tech_stack: list[str] = []
        for item in languages + topics:
            if item and item not in tech_stack:
                tech_stack.append(item)

        metadata[url] = {
            "description": description or "A small, thoughtful tool by Mahesh Shantaram.",
            "languages": languages,
            "topics": topics,
            "tech_stack": tech_stack[:8],
            "homepage": homepage,
            "refreshed_at": refreshed_at,
        }
        time.sleep(0.15)

    OUTPUT_PATH.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} ({len(metadata)} repositories)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
