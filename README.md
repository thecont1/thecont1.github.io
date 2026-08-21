# Apps portfolio gallery

This directory is a **zero-build static site** for `thecont1.github.io/apps`. GitHub Pages serves the HTML, CSS, JavaScript, CSV, JSON, fonts, and screenshots as-is. The browser fetches `apps.csv` and `repo-meta.json` on each page load; there is no SSG, bundler, backend, or server-side data injection.

## Add, reorder, or remove an app

Edit `apps.csv` and keep the columns `app_name,repo_url`. Add one row for a new app, reorder rows to change the gallery order, or remove a row to remove its card. The renderer keeps the exact CSV order, filling two columns on desktop and one column on mobile.

For every row, place one screenshot in the repository root with the exact filename `<app_name>.png`, where `<app_name>` is copied literally from the CSV. Spaces, punctuation, and emoji are valid. The browser builds each image URL with `encodeURIComponent()` on the filename portion, so a name such as `ngl v1.0 😜 Not Gonna Lie` is requested as a correctly encoded URL. If a row is removed, its screenshot can also be deleted; if a row is only reordered, no asset change is needed.

If the app name contains a comma, quote the CSV field in the usual way, for example `"A, B Tool",https://github.com/thecont1/example`. Keep the repository URL public and keyed exactly the same way in `repo-meta.json`.

## Refresh repository metadata

The checked-in `repo-meta.json` cache contains the About description, public language breakdown, topics, and combined tech-stack labels for each repository. Run the refresh script only when a genuinely new repository is added or when the About description, languages, or topics should be updated:

```sh
python3 scripts/refresh_repo_meta.py
```

The script reads the current `apps.csv`, scrapes the public GitHub repository pages for About text and topics, reads the public language endpoint, and rewrites `repo-meta.json`. Commit that generated file with the CSV change. Editing or reordering existing CSV rows does not require a metadata refresh.

## Preview locally

From this directory, start any static HTTP server. Python’s standard-library server is sufficient:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/`. Do not open `index.html` with `file://`; browser fetch requests for `apps.csv` and `repo-meta.json` need HTTP.

## Deploy to GitHub Pages

Push the contents of this directory, including `.nojekyll`, to the Pages repository’s `main` branch or to a `gh-pages` branch. In the repository settings, set **Pages → Build and deployment → Deploy from a branch**, select that branch, and choose `/ (root)`. The target URL is `https://thecont1.github.io/apps/`.

The site chrome is ported from the public source repository’s `SiteHeader.astro`, `SiteFooter.astro`, `global.css`, `header.css`, `footer.css`, and `fonts.css`. The profile sidebar follows the supplied GitHub reference screenshot and uses locally checked-in avatar and achievement assets.
