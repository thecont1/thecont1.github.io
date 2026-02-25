#!/usr/bin/env python3
"""
render_notebook.py — Pre-render Jupyter notebooks for DataStory content.

Usage:
    uv run python scripts/render_notebook.py [--slug SLUG]

Without --slug, renders ALL datastory .md files whose frontmatter contains
a notebook.entry URL.

The script:
  1. Reads each .md file in src/content/datastory/
  2. Extracts the notebook.entry URL from YAML frontmatter
  3. Fetches the raw .ipynb JSON (GitHub, arbitrary HTTP, or local path)
  4. Runs nbconvert (HTMLExporter) to produce an HTML body fragment
  5. Resolves relative image URLs (e.g. ./images/foo.png) to absolute
     URLs based on the notebook's source location
  6. Writes the HTML to a sibling file: <slug>.notebook.html
     Datastory.astro reads this file via fs and injects via set:html,
     bypassing the markdown renderer entirely.
"""

import argparse
import re
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

from nbconvert import HTMLExporter
import nbformat


CONTENT_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "datastory"

# Legacy markers — stripped from .md files during migration
_LEGACY_MARKER_START = "<!-- NOTEBOOK_HTML_START -->"
_LEGACY_MARKER_END = "<!-- NOTEBOOK_HTML_END -->"


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------

def extract_notebook_url(md_text: str) -> str | None:
    """Parse YAML frontmatter and return notebook.entry value."""
    m = re.match(r"^---\s*\n(.*?)\n---", md_text, re.DOTALL)
    if not m:
        return None
    frontmatter = m.group(1)
    in_notebook = False
    for line in frontmatter.splitlines():
        stripped = line.strip()
        if stripped.startswith("notebook:"):
            in_notebook = True
            continue
        if in_notebook:
            if stripped.startswith("entry:"):
                val = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                return val if val else None
            if not line.startswith(" ") and not line.startswith("\t"):
                in_notebook = False
    return None


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def notebook_url_to_raw(url: str) -> str:
    """Convert a github.com blob URL to raw.githubusercontent.com."""
    url = url.strip()
    if "raw.githubusercontent.com" in url:
        return url
    url = url.replace("github.com", "raw.githubusercontent.com")
    url = url.replace("/blob/", "/")
    return url


def derive_base_url(notebook_url: str) -> str:
    """
    Derive the base URL for resolving relative paths in the notebook.

    For GitHub:
      https://github.com/user/repo/blob/branch/path/to/nb.ipynb
      → https://raw.githubusercontent.com/user/repo/branch/path/to/

    For any other HTTP(S) URL:
      https://example.com/notebooks/analysis.ipynb
      → https://example.com/notebooks/

    Returns empty string if no base can be derived (e.g. local file).
    """
    raw = notebook_url_to_raw(notebook_url)
    # Strip the filename to get the directory
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw.rsplit("/", 1)[0] + "/"
    return ""


def resolve_relative_urls(html: str, base_url: str) -> str:
    """
    Replace relative src="./..." and src="images/..." URLs in the HTML
    with absolute URLs rooted at base_url.

    Handles:
      - ./images/foo.png
      - images/foo.png
      - ../other/bar.png
    Does NOT touch:
      - data: URIs (base64 images)
      - http:// or https:// absolute URLs
      - // protocol-relative URLs
    """
    if not base_url:
        return html

    def _replace(match: re.Match) -> str:
        attr = match.group(1)   # src= or href=
        quote = match.group(2)  # " or '
        url = match.group(3)    # the URL value
        # Skip absolute URLs, data URIs, and anchors
        if url.startswith(("http://", "https://", "//", "data:", "#")):
            return match.group(0)
        resolved = urljoin(base_url, url)
        return f'{attr}{quote}{resolved}{quote}'

    # Match src="..." or href="..." with either quote style
    return re.sub(r'(src=|href=)(["\'])(.*?)\2', _replace, html)


# ---------------------------------------------------------------------------
# Fetch & render
# ---------------------------------------------------------------------------

def fetch_notebook(url: str) -> str:
    """Fetch notebook JSON from a URL and return as string."""
    raw_url = notebook_url_to_raw(url)
    print(f"  Fetching: {raw_url}")
    req = urllib.request.Request(
        raw_url, headers={"User-Agent": "thecontrarian-renderer/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def strip_document_shell(html: str) -> str:
    """
    Strip full-document scaffolding from nbconvert output, keeping only
    the notebook cell content.

    Removes: <!DOCTYPE>, <html>, <head>, <body> tags, all <style> blocks,
    all <script> blocks (require.js etc.), and Jupyter CSS variable definitions.
    """
    # Remove <!DOCTYPE ...>
    html = re.sub(r'<!DOCTYPE[^>]*>', '', html, flags=re.IGNORECASE)
    # Remove <html ...> and </html>
    html = re.sub(r'</?html[^>]*>', '', html, flags=re.IGNORECASE)
    # Remove entire <head>...</head> block
    html = re.sub(r'<head>.*?</head>', '', html, flags=re.IGNORECASE | re.DOTALL)
    # Remove <body ...> and </body>
    html = re.sub(r'</?body[^>]*>', '', html, flags=re.IGNORECASE)
    # Remove all <style> blocks (Jupyter CSS, Pygments highlighting, etc.)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.IGNORECASE | re.DOTALL)
    # Remove all <script> blocks (require.js, MathJax config, etc.)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL)
    # Remove <meta> tags that may have leaked
    html = re.sub(r'<meta[^>]*/?>', '', html, flags=re.IGNORECASE)
    # Remove <title> tags
    html = re.sub(r'<title>.*?</title>', '', html, flags=re.IGNORECASE | re.DOTALL)
    # Remove <link> tags (stylesheet refs)
    html = re.sub(r'<link[^>]*/?>', '', html, flags=re.IGNORECASE)
    # Remove nbconvert anchor-link pilcrow (¶) elements
    html = re.sub(r'<a\s+class="anchor-link"[^>]*>.*?</a>', '', html, flags=re.DOTALL)
    # Collapse multiple blank lines
    html = re.sub(r'\n{3,}', '\n\n', html)
    return html.strip()

def render_notebook_html(notebook_json: str) -> str:
    """Convert notebook JSON string to an HTML body fragment via nbconvert."""
    nb = nbformat.reads(notebook_json, as_version=4)
    exporter = HTMLExporter()
    exporter.template_name = "basic"
    exporter.exclude_input_prompt = False
    exporter.exclude_output_prompt = False
    body, _resources = exporter.from_notebook_node(nb)
    # Safety: strip any remaining document-level elements
    body = strip_document_shell(body)
    return body


# ---------------------------------------------------------------------------
# File output
# ---------------------------------------------------------------------------

def strip_legacy_markers(md_text: str) -> str:
    """Remove any legacy NOTEBOOK_HTML_START/END blocks from the .md file."""
    pattern = re.compile(
        re.escape(_LEGACY_MARKER_START) + r".*?" + re.escape(_LEGACY_MARKER_END),
        re.DOTALL,
    )
    cleaned = pattern.sub("", md_text)
    # Collapse trailing whitespace
    return cleaned.rstrip() + "\n"


# ---------------------------------------------------------------------------
# Per-file processing
# ---------------------------------------------------------------------------

def process_file(md_path: Path) -> bool:
    """Process a single .md file. Returns True on success."""
    md_text = md_path.read_text(encoding="utf-8")
    notebook_url = extract_notebook_url(md_text)

    if not notebook_url:
        print(f"  Skipping {md_path.name}: no notebook.entry URL")
        return False

    print(f"Processing: {md_path.name}")

    try:
        notebook_json = fetch_notebook(notebook_url)
        html_body = render_notebook_html(notebook_json)

        base_url = derive_base_url(notebook_url)
        if base_url:
            html_body = resolve_relative_urls(html_body, base_url)
            print(f"  Resolved relative URLs against: {base_url}")

        # Write notebook HTML to sibling .notebook.html file
        html_path = md_path.with_suffix(".notebook.html")
        html_path.write_text(html_body, encoding="utf-8")
        print(f"  Wrote {html_path.name}")

        # Clean legacy markers from the .md file if present
        if _LEGACY_MARKER_START in md_text:
            cleaned = strip_legacy_markers(md_text)
            md_path.write_text(cleaned, encoding="utf-8")
            print(f"  Cleaned legacy markers from {md_path.name}")

        return True

    except Exception as e:
        print(f"  ERROR processing {md_path.name}: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Render Jupyter notebooks for DataStory content"
    )
    parser.add_argument(
        "--slug", type=str,
        help="Process only this slug (filename stem without .md)"
    )
    args = parser.parse_args()

    if not CONTENT_DIR.exists():
        print(f"Content directory not found: {CONTENT_DIR}", file=sys.stderr)
        sys.exit(1)

    success_count = 0
    fail_count = 0

    if args.slug:
        md_path = CONTENT_DIR / f"{args.slug}.md"
        if not md_path.exists():
            # Also try .mdx
            md_path = CONTENT_DIR / f"{args.slug}.mdx"
        if md_path.exists():
            if process_file(md_path):
                success_count += 1
            else:
                fail_count += 1
        else:
            print(f"File not found: {args.slug}.md", file=sys.stderr)
            sys.exit(1)
    else:
        for item in sorted(CONTENT_DIR.iterdir()):
            if item.is_file() and item.suffix in (".md", ".mdx"):
                if process_file(item):
                    success_count += 1
                else:
                    fail_count += 1

    print(f"\nDone: {success_count} rendered, {fail_count} skipped/failed")


if __name__ == "__main__":
    main()
