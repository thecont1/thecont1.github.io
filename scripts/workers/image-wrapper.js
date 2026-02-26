/**
 * Cloudflare Worker: Image Wrapper
 *
 * Routes /library/originals/** requests:
 *   - Same-origin (thecontrarian.in referer) → proxy raw image from CDN
 *   - External / direct browser visit       → lightbox HTML with C2PA metadata sidebar
 *
 * Deploy: wrangler deploy
 */

// ── Constants ──────────────────────────────────────────────────
const CDN_ORIGIN = "https://library.thecontrarian.in";

const ALLOWED_REFERER_PATTERNS = [
  /(?:^|\.)thecontrarian\.in$/i,
  /(?:^|\.)apps\.thecontrarian\.in$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
];

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

// ── Helpers ─────────────────────────────────────────────────────
function refererHost(request) {
  const referer = request.headers.get("Referer") || "";
  if (!referer) return "";
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedReferer(request) {
  const host = refererHost(request);
  if (!host) return false;
  return ALLOWED_REFERER_PATTERNS.some((p) => p.test(host));
}

function sanitizePath(raw) {
  if (!raw) return null;
  let path = raw.split("?")[0].split("#")[0];
  path = decodeURIComponent(path).replace(/^\/+/, "");
  if (/(?:^|\/)\.\.(?:\/|$)/.test(path)) return null;
  if (path.includes("\0")) return null;
  if (/[\x00-\x1F\x7F]/.test(path)) return null;
  // ← now allows forward slashes for subdirectory paths
  if (!/^[0-9A-Za-z._\/\-]+$/.test(path)) return null;
  const extMatch = path.match(/\.([A-Za-z0-9]+)$/);
  if (!extMatch) return null;
  const ext = extMatch[1].toLowerCase();
  if (!MIME_BY_EXT[ext]) return null;
  return path;
}

function mimeForPath(path) {
  const m = path.match(/\.([A-Za-z0-9]+)$/);
  if (m) {
    const ext = m[1].toLowerCase();
    if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  }
  return "application/octet-stream";
}

function publicUrl(path) {
  return CDN_ORIGIN.replace(/\/$/, "") +
    "/" +
    path.split("/").map(encodeURIComponent).join("/");
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Serve raw image directly from R2.
// R2 is the source of truth — if the key doesn't exist, it's a genuine 404.
// IMPORTANT: We cannot fetch() to library.thecontrarian.in/originals/* as fallback
// because that URL matches this Worker's route and would cause an infinite loop.
async function proxyRawImage(path, env) {
  const obj = await env.BUCKET.get(path);
  if (!obj) {
    return new Response("Image not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || mimeForPath(path));
  headers.set("Cache-Control", "public, max-age=604800");
  headers.set("Vary", "Sec-Fetch-Dest");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("ETag", obj.httpEtag || "");
  return new Response(obj.body, { status: 200, headers });
}

/* ── Server-side OG metadata ── */
const C2PA_API = "https://apps.thecontrarian.in/c2pa";

// Fetch with a hard timeout — returns null on timeout instead of blocking
function fetchWithTimeout(url, timeoutMs = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchOGMetadata(imageUrl) {
  const og = {
    title: "",
    description: "",
    width: 0,
    height: 0,
    creator: "",
    source: "",
    date: "",
  };

  const encoded = encodeURIComponent(imageUrl);

  // Fetch c2pa_mini and exif in parallel with 2s timeout
  // If APIs are slow, we gracefully return defaults rather than blocking
  const [miniRes, exifRes] = await Promise.allSettled([
    fetchWithTimeout(C2PA_API + "/api/c2pa_mini?uri=" + encoded),
    fetchWithTimeout(C2PA_API + "/api/exif_metadata?uri=" + encoded),
  ]);

  // Parse c2pa_mini
  if (miniRes.status === "fulfilled" && miniRes.value.ok) {
    try {
      const mini = await miniRes.value.json();
      if (mini) {
        og.creator = mini.creator || "";
        og.source = mini.source || mini.digital_source_type || "";
        og.date = mini.date || "";
      }
    } catch { /* ignore parse errors */ }
  }

  // Parse exif_metadata
  if (exifRes.status === "fulfilled" && exifRes.value.ok) {
    try {
      const data = await exifRes.value.json();
      const key = Object.keys(data)[0];
      if (key && data[key]) {
        const meta = data[key];
        og.width = meta.width || 0;
        og.height = meta.height || 0;

        // IPTC title/description for richer OG
        const iptc = meta.iptc || {};
        const photo = meta.photography || {};
        if (iptc.title) og.title = iptc.title;
        if (iptc.description || photo.description) {
          og.description = iptc.description || photo.description;
        }

        // Fallback creator from EXIF
        if (!og.creator && photo.artist) og.creator = photo.artist;
      }
    } catch { /* ignore parse errors */ }
  }

  return og;
}

/* ── Lightbox HTML ── */
function lightboxHtml(imgPublicUrl, altText, og = {}) {
  const pu = escHtml(imgPublicUrl);
  const al = escHtml(altText);

  // Build dynamic OG fields
  const filename = altText.split("/").pop() || "Image";
  const ogTitle = escHtml(og.title || (og.creator ? og.creator + " — " + filename : "thecontrarian.in — " + filename));
  const descParts = [];
  if (og.description) descParts.push(og.description);
  else descParts.push("From thecontrarian.in archive.");
  if (og.creator && !og.title) descParts.push("By " + og.creator);
  if (og.source) descParts.push(og.source);
  if (og.date) descParts.push(og.date);
  const ogDesc = escHtml(descParts.join(" · "));
  const ogW = og.width ? `\n  <meta property="og:image:width" content="${og.width}" />` : "";
  const ogH = og.height ? `\n  <meta property="og:image:height" content="${og.height}" />` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:image" content="${pu}" />
  <meta property="og:image:secure_url" content="${pu}" />${ogW}${ogH}
  <meta property="og:image:alt" content="${al}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDesc}" />
  <meta name="twitter:image" content="${pu}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${ogTitle}</title>
  <style>
    /* ── Exact c2pa app design tokens ── */
    :root {
      --color-bg-primary: #f8f9fa;
      --color-bg-secondary: #f1f3f4;
      --color-bg-tertiary: #e8eaed;
      --color-bg-card: #ffffff;
      --color-border: #dadce0;
      --color-border-light: #f1f3f4;
      --color-text-primary: #202124;
      --color-text-secondary: #5f6368;
      --color-text-tertiary: #80868b;
      --color-text-muted: #9aa0a6;
      --color-success: #1e8e3e;
      --color-success-light: #e6f4ea;
      --color-warning: #f9ab00;
      --color-warning-light: #fef3e8;
      --color-error: #d93025;
      --color-error-light: #fce8e6;
      --color-info: #1a73e8;
      --color-info-light: #e8f0fe;
      --color-accent: #1a73e8;
      --color-accent-hover: #1557b0;
      --shadow-sm: 0 1px 2px rgba(60, 64, 67, 0.1);
      --shadow-md: 0 1px 3px rgba(60, 64, 67, 0.12);
      --shadow-lg: 0 2px 6px rgba(60, 64, 67, 0.15);
      --shadow-xl: 0 4px 12px rgba(60, 64, 67, 0.15);
      --shadow-image: 0 8px 24px rgba(60, 64, 67, 0.2);
      --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'SF Mono', Monaco, monospace;
      --space-1: 0.125rem;
      --space-2: 0.25rem;
      --space-3: 0.375rem;
      --space-4: 0.5rem;
      --space-5: 0.75rem;
      --space-6: 1rem;
      --space-8: 1.25rem;
      --space-10: 1.5rem;
      --space-12: 2rem;
      --sidebar-width: 360px;
      --radius-sm: 2px;
      --radius-md: 4px;
      --radius-lg: 6px;
      --radius-xl: 8px;
      --radius-full: 9999px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body {
      font-family: var(--font-family);
      background-color: var(--color-bg-primary);
      color: var(--color-text-primary);
      overflow: hidden;
      height: 100vh;
      line-height: 1.5;
    }

    /* ── Layout: sidebar LEFT via row-reverse ── */
    .lightbox {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      flex-direction: row-reverse;
    }
    .lightbox-main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
      overflow: hidden;
      background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
      position: relative;
    }
    .lightbox-figure {
      position: relative;
      max-height: 100%;
      max-width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
    }
    .lightbox-img {
      max-height: calc(100vh - var(--space-12) * 2);
      max-width: calc(100vw - var(--sidebar-width) - var(--space-12) * 2);
      object-fit: contain;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-image);
      transition: transform 0.3s ease;
    }

    /* ── Sidebar ── */
    .lightbox-sidebar {
      width: var(--sidebar-width);
      background: var(--color-bg-card);
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      z-index: 10;
    }

    /* Sidebar Toolbar */
    .sidebar-toolbar {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: var(--space-5) var(--space-5);
      min-height: 64px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg-card);
    }
    .toolbar-buttons { display: flex; gap: var(--space-2); }
    .toolbar-text-link {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-text-primary);
      text-decoration: none;
      transition: color 0.2s ease;
      letter-spacing: -0.01em;
    }
    .toolbar-text-link:hover { color: var(--color-accent); }

    /* Image Title Header */
    .image-title-header {
      padding: var(--space-4) var(--space-5);
      background: var(--color-bg-card);
      border-bottom: 1px solid var(--color-border);
      display: block;
      min-height: 64px;
    }
    .image-title-header.has-content { display: block; }
    .image-title {
      font-size: 1.125rem; font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
      line-height: 1.4; word-break: break-word;
    }

    .sidebar-content {
      flex: 1; overflow-y: auto; padding: var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-4);
    }
    .sidebar-content::-webkit-scrollbar { width: 6px; }
    .sidebar-content::-webkit-scrollbar-track { background: transparent; }
    .sidebar-content::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: var(--radius-full); }
    .sidebar-content::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }

    /* ── Section base styles ── */
    .cc-status-section,
    .overview-section,
    .provenance-section,
    .technical-section,
    .creator-section,
    .description-section {
      background: var(--color-bg-card);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      overflow: visible;
    }
    .section-title {
      font-size: 0.6875rem; font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase; letter-spacing: 0.03em; margin: 0;
    }

    /* ── CC Status ── */
    .cc-status-section { border: none; background: transparent; }
    .cc-status-card {
      padding: var(--space-4) var(--space-5);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-bg-card);
      transition: border-color 0.15s ease;
    }
    .cc-status-card.verified { background: var(--color-success-light); border-color: var(--color-success); }
    .cc-status-card.unverified { background: var(--color-warning-light); border-color: var(--color-warning); }
    .cc-status-header { display: flex; align-items: center; gap: var(--space-3); }
    .cc-status-icon {
      width: 28px; height: 28px; border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; background: var(--color-bg-tertiary);
    }
    .cc-status-card.verified .cc-status-icon { background: var(--color-success); color: white; }
    .cc-status-card.verified .cc-status-icon::after {
      content: ''; width: 14px; height: 14px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
      background-size: contain; background-repeat: no-repeat;
    }
    .cc-status-card.unverified .cc-status-icon::after {
      content: ''; width: 14px; height: 14px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa0a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cline x1='12' y1='8' x2='12' y2='12'%3E%3C/line%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'%3E%3C/line%3E%3C/svg%3E");
      background-size: contain; background-repeat: no-repeat;
    }
    .cc-status-title { display: flex; flex-direction: column; gap: 0; }
    .cc-status-label { font-size: 0.625rem; font-weight: 500; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.02em; }
    .cc-status-value { font-size: 0.875rem; font-weight: 500; color: var(--color-text-primary); }
    .cc-status-card.verified .cc-status-value { color: var(--color-success); }

    /* ── Digital Source Type Badge ── */
    .digital-source-section { margin-bottom: 0; }
    .digital-source-section .cc-status-card.verified { background: var(--color-success-light); border-color: var(--color-success); }
    .digital-source-section .cc-status-card.verified .cc-status-icon { background: var(--color-success); color: white; }
    .digital-source-section .cc-status-card.verified .cc-status-value { color: var(--color-success); }
    .digital-source-section .cc-status-card.ai-generated { background: var(--color-warning-light); border-color: var(--color-warning); }
    .digital-source-section .cc-status-card.ai-generated .cc-status-icon { background: var(--color-warning); color: white; }
    .digital-source-section .cc-status-card.ai-generated .cc-status-icon::after {
      content: ''; width: 14px; height: 14px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A1.5 1.5 0 0 0 6 14.5 1.5 1.5 0 0 0 7.5 16 1.5 1.5 0 0 0 9 14.5 1.5 1.5 0 0 0 7.5 13m9 0a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5M12 17a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1z'/%3E%3C/svg%3E");
      background-size: contain; background-repeat: no-repeat;
    }
    .digital-source-section .cc-status-card.ai-generated .cc-status-value { color: #b45309; }

    /* ── Overview Section ── */
    .overview-section { padding: var(--space-4) var(--space-5); }
    .overview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
    .file-badge {
      display: inline-flex; align-items: center;
      padding: var(--space-1) var(--space-2);
      background: var(--color-bg-tertiary);
      color: var(--color-text-secondary);
      font-size: 0.625rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.03em;
      border-radius: var(--radius-sm);
    }
    .overview-content { display: flex; flex-direction: column; gap: var(--space-3); }
    .thumbnail-container {
      flex-shrink: 0; width: 100%; max-width: 280px;
      height: auto; aspect-ratio: 4/3;
      border-radius: var(--radius-sm); overflow: hidden;
      background: var(--color-bg-secondary);
      display: flex; align-items: center; justify-content: center;
      position: relative; margin: 0 auto;
    }
    .thumbnail { width: 100%; height: 100%; object-fit: contain; background: var(--color-bg-secondary); display: block; margin: 0 auto; }
    .thumbnail-placeholder { color: var(--color-text-muted); }
    .thumbnail-placeholder svg { width: 24px; height: 24px; }
    .overview-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .filename { font-size: 0.8125rem; font-weight: 500; color: var(--color-text-primary); word-break: break-word; margin: 0; }
    .dimensions, .filesize { font-size: 0.75rem; color: var(--color-text-tertiary); margin: 0; }
    .overview-dates {
      display: flex; flex-direction: column; gap: var(--space-2);
      margin-top: var(--space-3); padding-top: var(--space-3);
      border-top: 1px solid var(--color-border-light);
    }
    .date-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.6875rem; color: var(--color-text-tertiary); }
    .date-label { font-weight: 500; color: var(--color-text-secondary); }
    .date-value { color: var(--color-text-primary); font-family: var(--font-mono); }
    #gpsCoordinates { margin-left: auto; }
    #gpsCoordinates a { color: var(--color-accent); text-decoration: none; }
    #gpsCoordinates a:hover { text-decoration: underline; }

    /* ── Provenance Timeline ── */
    .provenance-section { padding: var(--space-4) var(--space-5); }
    .provenance-section .section-title { margin-bottom: var(--space-3); }
    .provenance-timeline { position: relative; }
    .timeline-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-2); padding: var(--space-6) var(--space-4);
      color: var(--color-text-muted); text-align: center;
    }
    .timeline-empty svg { width: 24px; height: 24px; opacity: 0.5; }
    .timeline-empty p { font-size: 0.8125rem; margin: 0; }
    .provenance-list { list-style: none; padding: 0; margin: 0; position: relative; }
    .provenance-list::before {
      content: ''; position: absolute;
      left: 11px; top: 6px; bottom: 6px; width: 1px;
      background: var(--color-border); border-radius: var(--radius-full);
    }
    .provenance-item { position: relative; padding-left: 32px; padding-bottom: var(--space-3); }
    .provenance-item:last-child { padding-bottom: 0; }
    .provenance-item::before {
      content: ''; position: absolute;
      left: 7px; top: 3px; width: 9px; height: 9px;
      background: var(--color-bg-card); border: 1px solid var(--color-accent);
      border-radius: var(--radius-full); z-index: 1;
    }
    .provenance-item.verified::before { background: var(--color-accent); }
    .provenance-item strong { display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text-primary); margin-bottom: var(--space-1); }
    .provenance-item p { font-size: 0.75rem; color: var(--color-text-tertiary); margin: 0; line-height: 1.4; }
    .provenance-item .timestamp { font-size: 0.6875rem; color: var(--color-text-muted); margin-top: var(--space-1); }
    .expand-toggle, .collapse-toggle {
      margin-top: var(--space-2); margin-bottom: var(--space-2);
      padding: 0; background: none; border: none;
      position: relative; padding-left: 32px;
    }
    .expand-toggle::before, .collapse-toggle::before { display: none; }
    .expand-btn {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-2); width: 100%;
      padding: var(--space-3) var(--space-4);
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-size: 0.6875rem; font-weight: 500;
      cursor: pointer; transition: all 0.15s ease;
    }
    .expand-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
    .expand-btn svg { transition: transform 0.15s ease; }
    .collapse-toggle .expand-btn svg { transform: rotate(180deg); }

    /* ── Technical Details ── */
    .technical-section { padding: var(--space-4) var(--space-5); }
    .technical-section .section-title { margin-bottom: var(--space-4); }
    .tech-group { margin-bottom: var(--space-4); }
    .tech-group:last-child { margin-bottom: 0; }
    .tech-group-title {
      display: flex; align-items: center; gap: var(--space-2);
      font-size: 0.6875rem; font-weight: 600;
      color: var(--color-text-tertiary); text-transform: uppercase;
      letter-spacing: 0.02em; margin: 0 0 var(--space-2) 0;
    }
    .tech-group-title svg { width: 12px; height: 12px; color: var(--color-text-muted); }
    .tech-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3) var(--space-4); }
    .tech-item { display: flex; flex-direction: column; gap: 0; padding: var(--space-1) 0; }
    .tech-label { font-size: 0.6875rem; color: var(--color-text-tertiary); font-weight: 500; }
    .tech-value { font-size: 0.8125rem; color: var(--color-text-primary); font-weight: 500; }
    .tech-value:empty::before, .creator-value:empty::before { content: '\\2014'; color: var(--color-text-muted); }

    /* ── Creator Section ── */
    .creator-section { padding: var(--space-4) var(--space-5); }
    .creator-section .section-title { margin-bottom: var(--space-3); }
    .creator-grid { display: grid; gap: var(--space-2); }
    .creator-item {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border-light);
    }
    .creator-item:last-child { border-bottom: none; padding-bottom: 0; }
    .creator-item:first-child { padding-top: 0; }
    .creator-label { font-size: 0.75rem; color: var(--color-text-tertiary); font-weight: 500; }
    .creator-value { font-size: 0.8125rem; color: var(--color-text-primary); font-weight: 500; text-align: right; }
    .creator-value a { color: var(--color-accent); text-decoration: none; word-break: break-all; }
    .creator-value a:hover { text-decoration: underline; }

    /* Social links */
    .creator-social {
      display: flex; flex-direction: row; justify-content: space-between;
      align-items: baseline; gap: var(--space-2);
      padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-light);
    }
    .social-links { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: flex-end; }
    .social-link {
      display: inline-flex; align-items: center; justify-content: center;
      width: auto; height: auto; padding: 0;
      background: transparent; border-radius: 0;
      color: var(--color-text-secondary); text-decoration: none;
      transition: all 0.15s ease; border: none;
    }
    .social-link svg { width: 21px; height: 21px; }
    .social-link:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); border-color: var(--color-accent); transform: translateY(-1px); }
    .social-link.instagram:hover { color: #E1306C; border-color: #E1306C; }
    .social-link.twitter:hover, .social-link.x:hover { color: #000000; border-color: #000000; }
    .social-link.linkedin:hover { color: #0077B5; border-color: #0077B5; }
    .social-link.facebook:hover { color: #1877F2; border-color: #1877F2; }
    .social-link.github:hover { color: #333333; border-color: #333333; }
    .social-link.youtube:hover { color: #FF0000; border-color: #FF0000; }
    .social-link.behance:hover { color: #1769FF; border-color: #1769FF; }
    .social-link.dribbble:hover { color: #EA4C89; border-color: #EA4C89; }
    .social-link.tiktok:hover { color: #000000; border-color: #000000; }
    .social-link.flickr:hover { color: #0063DC; border-color: #0063DC; }
    .social-link.unsplash:hover { color: #000000; border-color: #000000; }
    .social-link.website:hover { color: var(--color-accent); border-color: var(--color-accent); }

    /* ── Description Section ── */
    .description-section {
      padding: var(--space-4) var(--space-5);
      background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--color-accent);
      box-shadow: var(--shadow-sm);
    }
    .description-section .section-title { margin-bottom: var(--space-3); color: var(--color-text-secondary); font-size: 0.625rem; }
    .description-section h2 { font-size: 1.25rem; font-weight: 600; color: var(--color-text-primary); margin: 0 0 var(--space-4); }
    .iptc-title { margin-top: 1rem; margin-bottom: 0.75rem; font-size: 1.1rem; font-weight: 600; color: var(--color-text-primary); }
    .description-text { font-size: 0.9375rem; line-height: 1.7; color: var(--color-text-primary); margin: 0; }
    .description-text:empty { display: none; }
    .iptc-location { margin-top: 0.5rem; font-style: italic; color: var(--color-text-secondary); font-size: 0.8125rem; }
    .iptc-keywords { margin-top: 0.5rem; font-size: 0.9rem; color: var(--color-text-primary); }
    .iptc-keywords strong { color: var(--color-text-secondary); }
    .description-empty { font-size: 0.8125rem; color: var(--color-text-muted); font-style: italic; text-align: center; padding: var(--space-4) 0; margin: 0; }

    /* ── Loading/error states ── */
    .hidden { display: none !important; }
    .loading-meta, .error-meta { margin: 0; font-size: 0.875rem; color: var(--color-text-secondary); }
    .error-meta { color: var(--color-error); }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      body { overflow: auto; height: auto; }
      .lightbox { flex-direction: column; height: auto; min-height: 100vh; overflow: visible; }
      .lightbox-main { order: 2; min-height: 50vh; position: relative; }
      .lightbox-sidebar {
        order: 1; width: 100%; border-right: none;
        border-bottom: 1px solid var(--color-border);
        max-height: none; flex: none;
      }
      .lightbox-img { max-width: calc(100vw - var(--space-8) * 2); max-height: none; margin: 0 auto; display: block; }
      .sidebar-content { overflow: visible; padding-bottom: var(--space-12); display: flex; flex-direction: column; }
      .cc-status-section { order: 1; }
      .overview-section { order: 5; }
      .provenance-section { order: 6; }
      .technical-section { order: 7; }
      .creator-section { order: 8; }
      .description-section { order: 9; }
    }
  </style>
</head>
<body>
  <main class="lightbox" aria-label="Image viewer">
    <section class="lightbox-main">
      <figure class="lightbox-figure">
        <img id="image" class="lightbox-img" src="${pu}" alt="${al}" />
      </figure>
    </section>

    <aside class="lightbox-sidebar" aria-label="Image metadata panel">
      <!-- Toolbar -->
      <div class="sidebar-toolbar">
        <div class="toolbar-buttons"></div>
        <a class="toolbar-text-link" href="https://thecontrarian.in" target="_blank" rel="noopener">thecontrarian.in</a>
      </div>

      <!-- Image Title Header -->
      <div class="image-title-header" id="imageTitleHeader">
        <h1 class="image-title" id="imageTitle"></h1>
      </div>

      <div class="sidebar-content">
        <div id="meta-status" class="loading-meta">Fetching metadata\u2026</div>

        <!-- CC Status -->
        <div class="cc-status-section" id="ccStatusSection">
          <div class="cc-status-card unverified" id="ccStatusCard">
            <div class="cc-status-header">
              <div class="cc-status-icon"></div>
              <div class="cc-status-title">
                <span class="cc-status-label">Content Credentials</span>
                <span class="cc-status-value" id="ccStatusValue">Checking\u2026</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Digital Source Type -->
        <div class="digital-source-section" id="digitalSourceSection" style="display:none;">
          <div class="cc-status-card" id="digitalSourceCard">
            <div class="cc-status-header">
              <div class="cc-status-icon"></div>
              <div class="cc-status-title">
                <span class="cc-status-label">Digital Source Type</span>
                <span class="cc-status-value" id="digitalSourceValue">\u2014</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Source Image / Overview -->
        <div class="overview-section">
          <div class="overview-header">
            <h3 class="section-title">Source Image</h3>
            <span class="file-badge" id="formatBadge">\u2014</span>
          </div>
          <div class="overview-content">
            <div class="thumbnail-container">
              <img class="thumbnail" id="sourceImage" style="display:none;" alt="Source thumbnail" />
              <div class="thumbnail-placeholder" id="thumbnailPlaceholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
            </div>
            <div class="overview-dates" id="overviewDates">
              <div class="date-item">
                <span class="date-label">Captured</span>
                <span class="date-value" id="dateCaptured">\u2014</span>
              </div>
              <div class="date-item">
                <span class="date-label">Digitized</span>
                <span class="date-value" id="dateDigitized">\u2014</span>
              </div>
              <div class="date-item" id="gpsItem" style="display:none;">
                <span class="date-label">Location</span>
                <span class="date-value" id="gpsCoordinates">\u2014</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Provenance -->
        <div class="provenance-section">
          <h3 class="section-title">Provenance History</h3>
          <div class="provenance-timeline">
            <ul class="provenance-list" id="provenanceList" style="display:none;"></ul>
            <div class="timeline-empty" id="provenanceEmpty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p>No provenance history available</p>
            </div>
          </div>
        </div>

        <!-- Technical Details -->
        <div class="technical-section" id="technicalSection">
          <h3 class="section-title">Technical Details</h3>
          <div id="techContent"></div>
        </div>

        <!-- Creator Information -->
        <div class="creator-section" id="creatorSection">
          <h3 class="section-title">Creator Information</h3>
          <div class="creator-grid" id="creatorGrid">
            <div class="creator-item"><span class="creator-label">Artist</span><span class="creator-value" id="artist">\u2014</span></div>
            <div class="creator-item" id="authorWebsiteItem" style="display:none;"><span class="creator-label">Website</span><span class="creator-value" id="authorWebsite"></span></div>
            <div class="creator-item" id="authorEmailItem" style="display:none;"><span class="creator-label">Email</span><span class="creator-value" id="authorEmail"></span></div>
            <div class="creator-item" id="authorPhoneItem" style="display:none;"><span class="creator-label">Phone</span><span class="creator-value" id="authorPhone"></span></div>
            <div class="creator-item" id="authorJobItem" style="display:none;"><span class="creator-label">Title</span><span class="creator-value" id="authorJob"></span></div>
            <div class="creator-item" id="authorOrgItem" style="display:none;"><span class="creator-label">Organization</span><span class="creator-value" id="authorOrg"></span></div>
            <div class="creator-social" id="authorSocial" style="display:none;">
              <span class="creator-label">Social Media</span>
              <div class="social-links" id="socialLinks"></div>
            </div>
          </div>
        </div>

        <!-- Title & Caption -->
        <div class="description-section" id="descriptionSection">
          <h2>Title &amp; Caption</h2>
          <h3 class="iptc-title" id="iptcTitle" style="display:none;"></h3>
          <p class="description-text" id="imageDescription"></p>
          <p class="iptc-location" id="iptcLocation" style="display:none;"></p>
          <p class="iptc-keywords" id="iptcKeywords" style="display:none;"></p>
          <p class="description-empty" id="descriptionEmpty">No description available</p>
        </div>
      </div>

    </aside>
  </main>

  <script>
    const C2PA_API = 'https://apps.thecontrarian.in/c2pa';

    /* ── DOM refs ── */
    const $ = (id) => document.getElementById(id);
    const imageEl              = $('image');
    const metaStatus           = $('meta-status');
    const imageTitleHeader     = $('imageTitleHeader');
    const imageTitle           = $('imageTitle');

    const ccStatusCard         = $('ccStatusCard');
    const ccStatusValue        = $('ccStatusValue');
    const digitalSourceSection = $('digitalSourceSection');
    const digitalSourceCard    = $('digitalSourceCard');
    const digitalSourceValue   = $('digitalSourceValue');

    const formatBadge          = $('formatBadge');
    const sourceImage          = $('sourceImage');
    const thumbnailPlaceholder = $('thumbnailPlaceholder');
    const dateCaptured         = $('dateCaptured');
    const dateDigitizedEl      = $('dateDigitized');
    const gpsItem              = $('gpsItem');
    const gpsCoordinates       = $('gpsCoordinates');

    const provenanceList       = $('provenanceList');
    const provenanceEmpty      = $('provenanceEmpty');
    const techContent          = $('techContent');

    const artistEl             = $('artist');
    const authorWebsiteItem    = $('authorWebsiteItem');
    const authorWebsite        = $('authorWebsite');
    const authorEmailItem      = $('authorEmailItem');
    const authorEmail          = $('authorEmail');
    const authorPhoneItem      = $('authorPhoneItem');
    const authorPhone          = $('authorPhone');
    const authorOrgItem        = $('authorOrgItem');
    const authorOrg            = $('authorOrg');
    const authorJobItem        = $('authorJobItem');
    const authorJob            = $('authorJob');
    const authorSocial         = $('authorSocial');
    const socialLinks          = $('socialLinks');

    const iptcTitleEl          = $('iptcTitle');
    const imageDescription     = $('imageDescription');
    const iptcLocation         = $('iptcLocation');
    const iptcKeywords         = $('iptcKeywords');
    const descriptionEmpty     = $('descriptionEmpty');

    /* ── Utilities ── */
    const imageUri = imageEl ? imageEl.currentSrc || imageEl.src : '';
    const imagePathname = (() => {
      try { return decodeURIComponent(new URL(imageUri, window.location.origin).pathname || ''); }
      catch { return imageUri; }
    })();

    const basename = (input) => {
      if (!input) return '';
      const cleaned = String(input).split('?')[0].split('#')[0].replace(/\\\\/g, '/');
      const parts = cleaned.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : cleaned;
    };

    const esc = (value) => String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const formatDate = (dateStr) => {
      if (!dateStr) return '\\u2014';
      const cleaned = String(dateStr).replace(/^(\\d{4}):(\\d{2}):(\\d{2})/, '$1-$2-$3');
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return month + ' ' + day + ', ' + year + ' at ' + hours + ':' + minutes + ' ' + ampm;
    };

    const formatExposure = (time) => {
      if (!time) return '';
      if (time >= 1) return time + 's';
      const inv = Math.round(1 / time);
      return inv > 0 ? '1/' + inv + 's' : '';
    };

    const formatCameraFull = (make, model) => {
      if (!model) return make || '';
      if (!make) return model;
      if (model.toUpperCase().includes(make.toUpperCase())) return model;
      return make + ' ' + model;
    };

    const setText = (el, val) => { if (el) el.textContent = val || '\\u2014'; };
    const setHtml = (el, val) => { if (el) el.innerHTML = val; };
    const show = (el) => { if (el) el.style.display = ''; };
    const hide = (el) => { if (el) el.style.display = 'none'; };

    /* ── Image Title Header ── */
    const updateImageTitle = (filename) => {
      if (!imageTitleHeader || !imageTitle) return;
      if (filename) {
        imageTitle.textContent = filename;
        imageTitleHeader.classList.add('has-content');
      } else {
        imageTitle.textContent = '';
        imageTitleHeader.classList.remove('has-content');
      }
    };

    /* ── Social icon SVGs ── */
    const socialSvg = {
      instagram: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
      twitter: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
      linkedin: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
      behance: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 3.211 3.483 3.312 4.588 2.029h3.168zm-7.686-4h4.965c-.105-1.547-1.136-2.219-2.477-2.219-1.466 0-2.277.768-2.488 2.219zm-9.574 6.988H0V5.021h6.953c5.476.081 5.58 5.444 2.72 6.906 3.461 1.26 3.577 8.061-3.207 8.061zM3 11h3.584c2.508 0 2.906-3-.312-3H3v3zm3.391 3H3v3.016h3.341c3.055 0 2.868-3.016.05-3.016z"/></svg>',
      dribbble: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.025-8.04 6.4 1.73 1.36 3.94 2.166 6.27 2.166 1.42 0 2.77-.29 4-.814zm-11.62-2.58c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.855zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.17zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.825 0-1.63.1-2.4.285zm10.335 3.483c-.218.29-1.935 2.493-5.724 4.04.24.49.47.985.68 1.486.08.18.15.36.22.53 3.41-.43 6.8.26 7.14.33-.02-2.42-.88-4.64-2.31-6.38z"/></svg>',
      github: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>',
      flickr: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M0 12c0 3.074 2.494 5.564 5.565 5.564 3.075 0 5.569-2.49 5.569-5.564S8.641 6.436 5.565 6.436C2.495 6.436 0 8.926 0 12zm12.866 0c0 3.074 2.493 5.564 5.567 5.564C21.496 17.564 24 15.074 24 12s-2.492-5.564-5.564-5.564c-3.075 0-5.57 2.49-5.57 5.564z"/></svg>',
      '500px': '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.439 9.01A2.994 2.994 0 004.449 12a2.993 2.993 0 002.99 2.99 2.994 2.994 0 002.99-2.99 2.993 2.993 0 00-2.99-2.99zm0 4.48A1.49 1.49 0 015.949 12c0-.825.665-1.49 1.49-1.49s1.49.665 1.49 1.49-.665 1.49-1.49 1.49zM16.551 9.01A2.993 2.993 0 0013.561 12a2.993 2.993 0 002.99 2.99 2.994 2.994 0 002.99-2.99 2.994 2.994 0 00-2.99-2.99zm0 4.48A1.49 1.49 0 0115.061 12c0-.825.665-1.49 1.49-1.49s1.49.665 1.49 1.49-.665 1.49-1.49 1.49z"/></svg>',
      unsplash: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z"/></svg>',
      website: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
    };

    /* ── State ── */
    const state = { mini: null, exif: null, c2pa: null, exifLoaded: false, c2paLoaded: false };

    /* ── Render: CC Status ── */
    const renderCCStatus = () => {
      const mini = state.mini;
      const c2pa = state.c2pa;
      const hasC2PA = !!(c2pa?.c2pa_data || mini?.status);

      if (hasC2PA) {
        ccStatusCard.className = 'cc-status-card verified';
        setText(ccStatusValue, 'Authenticity Verified');
      } else {
        ccStatusCard.className = 'cc-status-card unverified';
        setText(ccStatusValue, 'No Content Credentials Found');
      }

      /* Digital source type */
      const sourceType = c2pa?.digital_source_type || c2pa?.c2pa_data?.digital_source_type || {};
      const sourceLabel = sourceType.label || mini?.digital_source_type || mini?.source || '';
      const sourceCode = sourceType.code || '';
      if (sourceLabel) {
        show(digitalSourceSection);
        setText(digitalSourceValue, sourceLabel);
        digitalSourceCard.classList.remove('verified', 'ai-generated');
        const isAI = sourceCode === 'trainedAlgorithmicMedia' || sourceCode === 'algorithmicallyEnhanced'
          || sourceLabel.toLowerCase().includes('ai') || sourceLabel.toLowerCase().includes('generated');
        digitalSourceCard.classList.add(isAI ? 'ai-generated' : 'verified');
      }
    };

    /* ── Render: Overview (EXIF data) ── */
    const renderOverview = (meta) => {
      const photo = meta.photography || {};
      const exif = meta.exif || {};
      const iptc = meta.iptc || {};
      const gps = meta.gps || {};

      const name = basename(meta.filename) || basename(imagePathname || imageUri) || 'Image';
      updateImageTitle(name);

      const format = (meta.format || '').toUpperCase();
      setText(formatBadge, format || '\\u2014');

      const captured = formatDate(photo.date_original || exif.DateTimeOriginal || '');
      const digitized = formatDate(photo.date_digitized || exif.DateTimeDigitized || '');
      setText(dateCaptured, captured);
      setText(dateDigitizedEl, digitized);

      /* GPS */
      if (gps.latitude !== undefined && gps.longitude !== undefined) {
        show(gpsItem);
        const lat = Number(gps.latitude).toFixed(6);
        const lon = Number(gps.longitude).toFixed(6);
        const locationName = [gps.location_name, gps.city, iptc.location, iptc.city].filter(Boolean).join(', ');
        const label = locationName || (lat + ', ' + lon);
        const mapsUrl = 'https://www.google.com/maps?q=' + lat + ',' + lon;
        setHtml(gpsCoordinates, '<a href="' + esc(mapsUrl) + '" target="_blank" rel="noopener">' + esc(label) + '</a>');
      }

      /* Thumbnail */
      if (imageEl && imageEl.src) {
        sourceImage.src = imageEl.src;
        show(sourceImage);
        hide(thumbnailPlaceholder);
      }
    };

    /* ── Render: Technical Details ── */
    const exposureModes = { 0: 'Auto', 1: 'Manual', 2: 'Aperture Priority', 3: 'Shutter Priority' };
    const meteringModes = { 0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot', 5: 'Matrix' };
    const flashStates = { 0: 'No Flash', 1: 'Flash Fired' };
    const whiteBalanceModes = { 0: 'Auto', 1: 'Manual' };

    const renderTechnical = (meta) => {
      const photo = meta.photography || {};
      const exif = meta.exif || {};

      const cameraMake = photo.camera_make || exif.Make || '';
      const cameraModel = photo.camera_model || exif.Model || '';
      const focalLengthVal = photo.focal_length || (exif.FocalLength ? exif.FocalLength + 'mm' : '');
      const focalWith35mm = focalLengthVal && exif.FocalLengthIn35mmFilm
        ? focalLengthVal + ' (' + exif.FocalLengthIn35mmFilm + 'mm eq.)'
        : focalLengthVal;
      const dimensions = (meta.width && meta.height) ? meta.width + ' \\u00d7 ' + meta.height : '';
      const resolution = (exif.XResolution && exif.YResolution) ? exif.XResolution + ' \\u00d7 ' + exif.YResolution + ' DPI' : '';
      const expMode = exif.ExposureMode !== undefined ? (exposureModes[exif.ExposureMode] || '') : '';
      const wb = exif.WhiteBalance !== undefined ? (whiteBalanceModes[exif.WhiteBalance] || '') : '';
      const flash = exif.Flash !== undefined ? (flashStates[exif.Flash] || '') : '';

      const item = (label, value) => '<div class="tech-item"><span class="tech-label">' + esc(label) + '</span><span class="tech-value">' + esc(value || '\\u2014') + '</span></div>';

      setHtml(techContent, [
        '<div class="tech-group"><h4 class="tech-group-title">Camera & Lens</h4><div class="tech-grid">',
        item('Camera Make', cameraMake),
        item('Camera Model', cameraModel),
        '</div><div class="tech-grid">',
        item('Lens', photo.lens_model),
        '</div></div>',
        '<div class="tech-group"><h4 class="tech-group-title">Exposure Settings</h4><div class="tech-grid">',
        item('Exposure Mode', expMode),
        item('White Balance', wb),
        '</div><div class="tech-grid">',
        item('Flash', flash),
        '</div><div class="tech-grid">',
        item('Aperture', photo.aperture || (exif.FNumber ? 'f/' + exif.FNumber : '')),
        item('Shutter', photo.shutter_speed || formatExposure(exif.ExposureTime)),
        '</div><div class="tech-grid">',
        item('ISO', photo.iso || exif.ISOSpeedRatings),
        item('Focal Length', focalWith35mm),
        '</div></div>',
        '<div class="tech-group"><h4 class="tech-group-title">Image Properties</h4><div class="tech-grid">',
        item('Resolution', resolution),
        item('Dimensions', dimensions),
        '</div><div class="tech-grid">',
        item('Color Space', photo.color_space || exif.ColorSpace),
        item('Color Profile', photo.color_profile || exif.ProfileDescription),
        '</div><div class="tech-grid">',
        item('Software', exif.Software),
        '</div></div>'
      ].join(''));
    };

    /* ── Render: Creator (from C2PA manifest author_info) ── */
    const getSocialPlatform = (url) => {
      const d = url.toLowerCase();
      if (d.includes('instagram')) return 'instagram';
      if (d.includes('twitter') || d.includes('x.com')) return 'twitter';
      if (d.includes('facebook')) return 'facebook';
      if (d.includes('linkedin')) return 'linkedin';
      if (d.includes('youtube')) return 'youtube';
      if (d.includes('tiktok')) return 'tiktok';
      if (d.includes('behance')) return 'behance';
      if (d.includes('dribbble')) return 'dribbble';
      if (d.includes('github')) return 'github';
      if (d.includes('flickr')) return 'flickr';
      if (d.includes('500px')) return '500px';
      if (d.includes('unsplash')) return 'unsplash';
      return 'website';
    };

    const renderCreator = (meta, c2paData) => {
      const photo = meta?.photography || {};
      const exif = meta?.exif || {};
      const authorInfo = c2paData?.c2pa_data?.author_info || c2paData?.author_info || {};

      /* Artist name: prefer C2PA author, fall back to EXIF */
      const authorName = authorInfo.name || authorInfo.author || authorInfo.identifier || '';
      const artist = (typeof authorName === 'string' && authorName.trim())
        ? authorName.trim()
        : (photo.artist || state.mini?.creator || '');
      setText(artistEl, artist);

      /* Website */
      if (authorInfo.url && typeof authorInfo.url === 'string') {
        show(authorWebsiteItem);
        const displayUrl = authorInfo.url.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
        setHtml(authorWebsite, '<a href="' + esc(authorInfo.url) + '" target="_blank" rel="noopener">' + esc(displayUrl) + '</a>');
      }
      /* Email */
      if (authorInfo.email) {
        show(authorEmailItem);
        setHtml(authorEmail, '<a href="mailto:' + esc(authorInfo.email) + '">' + esc(authorInfo.email) + '</a>');
      }
      /* Phone */
      if (authorInfo.telephone) {
        show(authorPhoneItem);
        setText(authorPhone, authorInfo.telephone);
      }
      /* Job Title */
      if (authorInfo.jobTitle) { show(authorJobItem); setText(authorJob, authorInfo.jobTitle); }
      /* Organization */
      if (authorInfo.worksFor) { show(authorOrgItem); setText(authorOrg, authorInfo.worksFor); }

      /* Social links — collect from sameAs, social_links, social_accounts, socials */
      const allSocials = new Set();

      if (Array.isArray(authorInfo.sameAs)) {
        authorInfo.sameAs.forEach(u => { if (typeof u === 'string' && u.trim()) allSocials.add(u.trim()); });
      }
      if (authorInfo.social_links && typeof authorInfo.social_links === 'object') {
        Object.values(authorInfo.social_links).forEach(u => { if (typeof u === 'string' && u.trim()) allSocials.add(u.trim()); });
      }
      const accountsList = authorInfo.social_accounts || authorInfo.socials || [];
      if (Array.isArray(accountsList)) {
        accountsList.forEach(s => {
          const u = s.url || s['@id'] || '';
          if (u) allSocials.add(u.trim());
        });
      }

      if (allSocials.size && socialLinks) {
        show(authorSocial);
        let html = '';
        allSocials.forEach(url => {
          const platform = getSocialPlatform(url);
          const icon = socialSvg[platform] || socialSvg.website;
          html += '<a class="social-link ' + esc(platform) + '" href="' + esc(url) + '" target="_blank" rel="noopener" title="' + esc(platform) + '">' + icon + '</a>';
        });
        socialLinks.innerHTML = html;
      }
    };

    /* ── Render: Title & Caption (IPTC) ── */
    const renderDescription = (meta) => {
      const photo = meta?.photography || {};
      const iptc = meta?.iptc || {};
      let hasContent = false;

      if (iptc.title) {
        setText(iptcTitleEl, iptc.title);
        show(iptcTitleEl);
        hasContent = true;
      }

      const desc = iptc.description || photo.description || (imageEl ? imageEl.alt : '') || '';
      if (desc) {
        setText(imageDescription, desc);
        show(imageDescription);
        hasContent = true;
      } else {
        hide(imageDescription);
      }

      const loc = [iptc.location, iptc.city].filter(Boolean).join(', ');
      if (loc) {
        setHtml(iptcLocation, '\\ud83d\\udccd ' + esc(loc));
        show(iptcLocation);
        hasContent = true;
      }

      if (iptc.keywords) {
        setHtml(iptcKeywords, '<strong>Keywords:</strong> ' + esc(iptc.keywords));
        show(iptcKeywords);
        hasContent = true;
      }

      if (hasContent) {
        hide(descriptionEmpty);
      } else {
        show(descriptionEmpty);
      }
    };

    /* ── Render: Provenance Timeline ── */
    const renderProvenance = (c2paData) => {
      const provenance = Array.isArray(c2paData?.provenance) ? c2paData.provenance : [];
      if (!provenance.length) { hide(provenanceList); show(provenanceEmpty); return; }

      show(provenanceList);
      hide(provenanceEmpty);

      const getActionLabel = (item) => {
        const action = item?.action ? String(item.action) : '';
        if (!action) return 'Action';
        const label = action.replace('c2pa.', '').replace(/_/g, ' ');
        return label.charAt(0).toUpperCase() + label.slice(1);
      };

      const getActionDescription = (item) => {
        const params = item?.parameters || {};
        if (params.ingredients) return 'Opened source file';
        if (params['com.adobe.acr']) {
          const key = params['com.adobe.acr'];
          const val = params['com.adobe.acr.value'];
          return (val === undefined || val === null || val === '') ? key : key + ': ' + val;
        }
        return item?.action || 'Image edit operation';
      };

      const headerItems = [];
      const middleItems = [];
      const verifyItem = [];

      provenance.forEach((item) => {
        let title = '', desc = '', timestamp = '', verified = false, icon = '';

        if (item.generator) {
          title = 'Claim Generator'; desc = item.generator; icon = '\\u2699\\ufe0f';
          timestamp = item.version ? 'Version: ' + item.version : '';
          headerItems.push({ title, desc, timestamp, verified, icon });
        } else if (item.issuer && item.name === 'Issued By') {
          title = 'Issued By'; desc = item.issuer; icon = '\\ud83c\\udfdb\\ufe0f';
          headerItems.push({ title, desc, timestamp, verified, icon });
        } else if (item.date && item.name === 'Issued On') {
          title = 'Issued On'; desc = item.date; icon = '\\ud83d\\udcc5';
          headerItems.push({ title, desc, timestamp, verified, icon });
        } else if (item.verification) {
          title = 'Verification'; desc = item.verification; icon = '\\u2713';
          timestamp = item.issuer ? 'Issuer: ' + item.issuer : '';
          verified = String(item.verification).toLowerCase().includes('valid');
          verifyItem.push({ title, desc, timestamp, verified, icon });
        } else if (item.name === 'Action' && item.action) {
          title = getActionLabel(item); desc = getActionDescription(item);
          icon = '\\ud83d\\udccb';
          timestamp = [item.software ? 'Tool: ' + item.software : '', item.when || ''].filter(Boolean).join(' \\u00b7 ');
          middleItems.push({ title, desc, timestamp, verified, icon });
        } else if (item.name === 'Ingredient') {
          title = 'Original Image'; desc = 'Source image with embedded C2PA metadata'; icon = '\\ud83d\\udcf8';
          timestamp = item.relationship ? 'Relationship: ' + item.relationship : '';
          verified = true;
          middleItems.push({ title, desc, timestamp, verified, icon });
        } else if (item.author && item.name !== 'Author') {
          title = 'Author'; desc = item.author; icon = '\\ud83d\\udc64'; verified = true;
          middleItems.push({ title, desc, timestamp, verified, icon });
        } else if (item.title) {
          title = 'Title'; desc = item.title; icon = '\\ud83d\\udcdd';
          middleItems.push({ title, desc, timestamp, verified, icon });
        }
      });

      const ordered = [...headerItems, ...middleItems, ...verifyItem];
      if (!ordered.length) { hide(provenanceList); show(provenanceEmpty); return; }

      const totalItems = ordered.length;
      const topVisible = headerItems.length;
      const shouldCollapse = middleItems.length > 0 && totalItems >= 6;

      const renderRow = (row, isHidden) => {
        const cls = 'provenance-item' + (row.verified ? ' verified' : '') + (isHidden ? ' collapsed-item' : '');
        const style = isHidden ? ' style="display:none;"' : '';
        return '<li class="' + cls + '"' + style + '>'
          + '<strong>' + row.icon + ' ' + esc(row.title) + '</strong>'
          + '<p>' + esc(row.desc || '\\u2014') + '</p>'
          + (row.timestamp ? '<p class="timestamp">' + esc(row.timestamp) + '</p>' : '')
          + '</li>';
      };

      let html = '';

      headerItems.forEach(r => { html += renderRow(r, false); });

      if (shouldCollapse) {
        middleItems.forEach(r => { html += renderRow(r, true); });

        const hiddenCount = middleItems.length;
        html += '<li class="expand-toggle" id="provenanceToggle">'
          + '<button class="expand-btn" type="button" onclick="toggleProvenanceExpansion()">'
          + '<span>+' + hiddenCount + ' more entries</span>'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'
          + '</button></li>'
          + '<li class="collapse-toggle" id="provenanceCollapse" style="display:none;">'
          + '<button class="expand-btn" type="button" onclick="toggleProvenanceExpansion()">'
          + '<span>Show less</span>'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>'
          + '</button></li>';
      } else {
        middleItems.forEach(r => { html += renderRow(r, false); });
      }

      verifyItem.forEach(r => { html += renderRow(r, false); });

      provenanceList.innerHTML = html;
    };

    window.toggleProvenanceExpansion = () => {
      const items = document.querySelectorAll('.collapsed-item');
      const toggleBtn = $('provenanceToggle');
      const collapseBtn = $('provenanceCollapse');
      const isExpanded = collapseBtn && collapseBtn.style.display !== 'none';
      items.forEach(el => { el.style.display = isExpanded ? 'none' : ''; });
      if (toggleBtn) toggleBtn.style.display = isExpanded ? '' : 'none';
      if (collapseBtn) collapseBtn.style.display = isExpanded ? 'none' : '';
    };

    /* ── Render: C2PA thumbnail ── */
    const renderSourceThumbnail = (c2paData) => {
      const thumbnails = c2paData?.thumbnails;
      if (thumbnails?.ingredient_thumbnail) {
        sourceImage.src = 'data:image/jpeg;base64,' + thumbnails.ingredient_thumbnail;
        show(sourceImage);
        hide(thumbnailPlaceholder);
        sourceImage.addEventListener('load', function() { this.style.margin = '0 auto'; });
        sourceImage.addEventListener('error', function() {
          hide(this);
          show(thumbnailPlaceholder);
        });
      }
    };

    /* ── Master render ── */
    const renderAll = () => {
      if (!state.exifLoaded || !state.c2paLoaded) {
        show(metaStatus);
        setText(metaStatus, state.exifLoaded || state.c2paLoaded ? 'Loading metadata\\u2026' : 'Fetching credentials\\u2026');
      } else {
        hide(metaStatus);
      }

      renderCCStatus();
      if (state.exif) {
        renderOverview(state.exif);
        renderTechnical(state.exif);
        renderDescription(state.exif);
      }
      renderCreator(state.exif, state.c2pa);
      if (state.c2pa) {
        renderProvenance(state.c2pa);
        renderSourceThumbnail(state.c2pa);
      }
    };

    /* ── Data fetching ── */
    const fetchC2PAMini = async () => {
      if (!imageUri) return;
      try {
        const resp = await fetch(C2PA_API + '/api/c2pa_mini?uri=' + encodeURIComponent(imageUri));
        if (resp.ok) {
          const data = await resp.json();
          if (data && typeof data === 'object') state.mini = data;
        }
      } catch { /* silent */ }
      renderAll();
    };

    const loadDetailedData = async () => {
      if (!imageUri) {
        metaStatus.className = 'error-meta';
        setText(metaStatus, 'Image URI not available.');
        return;
      }

      const exifPromise = (async () => {
        try {
          const resp = await fetch(C2PA_API + '/api/exif_metadata?uri=' + encodeURIComponent(imageUri));
          if (!resp.ok) return;
          const data = await resp.json();
          const key = Object.keys(data)[0];
          if (key && data[key]) state.exif = data[key];
        } finally { state.exifLoaded = true; renderAll(); }
      })();

      const c2paPromise = (async () => {
        try {
          const resp = await fetch(C2PA_API + '/api/c2pa_metadata?uri=' + encodeURIComponent(imageUri));
          if (!resp.ok) return;
          state.c2pa = await resp.json();
        } finally { state.c2paLoaded = true; renderAll(); }
      })();

      try { await Promise.all([exifPromise, c2paPromise]); }
      catch {
        metaStatus.className = 'error-meta';
        setText(metaStatus, 'Failed to fetch metadata.');
      }
    };

    /* ── Boot: load everything on page load ── */
    fetchC2PAMini();
    loadDetailedData();
    renderAll();
  </script>
</body>
</html>`;
}

/* ── Worker entry point ── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ── Route the request to an image path ──────────────────────
    let imagePath = "";

    if (pathname.startsWith("/library/originals/")) {
      imagePath = pathname.slice("/library/originals/".length);
    } else if (pathname.startsWith("/library/")) {
      imagePath = pathname.slice("/library/".length);
    } else if (
      url.hostname === "library.thecontrarian.in" &&
      pathname.startsWith("/originals/")
    ) {
      // Worker route: library.thecontrarian.in/originals/* → pathname is /originals/…
      imagePath = pathname.slice("/originals/".length);
    } else if (url.hostname === "library.thecontrarian.in") {
      imagePath = pathname.slice(1);
    } else {
      return fetch(request);
    }

    const path = sanitizePath(imagePath);
    if (!path) {
      return new Response("Invalid image path.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const r2Key = "originals/" + path;
    const imgPublicUrl = publicUrl(r2Key);

    // ── Decide: raw image or lightbox HTML ──────────────────────
    // Top-level navigations (Sec-Fetch-Dest: document) ALWAYS get lightbox HTML,
    // even when Referer is our own site (e.g. "Open Image in New Tab").
    const secFetchDest = (request.headers.get("Sec-Fetch-Dest") || "").toLowerCase();
    if (secFetchDest === "document") {
      // Fall through to lightbox HTML path below
    } else {
      // Serve raw image if ANY of these are true:
      //  1. Referer is from an allowed origin (embedded <img> on our site)
      //  2. Referer is from library.thecontrarian.in itself (lightbox <img> loading)
      //  3. Sec-Fetch-Dest: image (browser <img> tag fetch)
      //  4. Accept header prefers image/* over text/html (non-browser image clients)
      const refHost = refererHost(request);
      const isSelfReferer = refHost === "library.thecontrarian.in";
      const isImageFetch = secFetchDest === "image";
      const acceptsImage = (request.headers.get("Accept") || "").startsWith("image/");

      if (isAllowedReferer(request) || isSelfReferer || isImageFetch || acceptsImage) {
        return proxyRawImage(r2Key, env);
      }
    }

    // ── Lightbox HTML path (browsers + social crawlers) ─────────
    // Use Cloudflare Cache API so repeated crawler hits are instant.
    // IMPORTANT: Cache key must differ from the raw URL — otherwise
    // the browser's <img> tag fetching the same URL gets cached HTML
    // instead of image bytes, breaking the image display.
    const cache = caches.default;
    const lightboxUrl = new URL(url.toString());
    lightboxUrl.searchParams.set("_view", "lightbox");
    const cacheKey = new Request(lightboxUrl.toString(), { method: "GET" });
    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;

    // Fetch OG metadata server-side (2s timeout — won't block forever)
    let og = {};
    try {
      og = await fetchOGMetadata(imgPublicUrl);
    } catch { /* render with defaults if metadata fetch fails */ }

    const altText = path;
    const html = lightboxHtml(imgPublicUrl, altText, og);
    const response = new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Vary": "Sec-Fetch-Dest",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });

    // Cache in background — don't block the response
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
