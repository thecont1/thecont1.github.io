(() => {
  "use strict";

  const gallery = document.querySelector("#app-gallery");
  /** @type {{ src: string, alt: string, name: string }[]} */
  let galleryItems = [];

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];

      if (character === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }

    if (cell !== "" || row.length) {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
    }

    const [header = [], ...body] = rows;
    const normalizedHeaders = header.map((value) => value.trim().toLowerCase());
    return body.map((values) => Object.fromEntries(
      normalizedHeaders.map((key, index) => [key, (values[index] || "").trim()]),
    )).filter((app) => app.app_name && app.repo_url);
  }

  function githubIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<path fill="currentColor" d="M8 .198a8 8 0 0 0-2.529 15.591c.4.074.547-.174.547-.385 0-.191-.008-.821-.011-1.489-2.226.484-2.695-.944-2.695-.944-.364-.925-.888-1.171-.888-1.171-.726-.497.055-.486.055-.486.803.056 1.226.824 1.226.824.714 1.223 1.872.869 2.328.665.072-.517.279-.87.508-1.07-1.777-.202-3.645-.888-3.645-3.954 0-.873.313-1.587.824-2.147-.083-.202-.357-1.015.077-2.117 0 0 .672-.215 2.201.82A7.672 7.672 0 0 1 8 4.066c.68.003 1.365.092 2.004.269 1.527-1.035 2.198-.82 2.198-.82.435 1.102.162 1.916.079 2.117.513.56.823 1.274.823 2.147 0 3.073-1.872 3.749-3.653 3.947.287.248.543.735.543 1.481 0 1.07-.009 1.932-.009 2.195 0 .213.144.462.55.384A8 8 0 0 0 8.001.196z"/>';
    return icon;
  }

  function displayUrl(homepage) {
    if (!homepage) return "";
    return String(homepage).replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }

  function createCard(app, metadata, index) {
    const card = document.createElement("article");
    card.className = "app-card";

    const filename = app.image_filename || `${app.app_name}.png`;
    const imageSrc = `./assets/screenshots/${encodeURIComponent(filename)}`;

    const mediaButton = document.createElement("button");
    mediaButton.type = "button";
    mediaButton.className = "app-card-media";
    mediaButton.setAttribute("aria-label", `View screenshot of ${app.app_name}`);
    mediaButton.addEventListener("click", () => openLightbox(index));

    const image = document.createElement("img");
    image.src = imageSrc;
    image.alt = app.app_name;
    image.loading = "lazy";
    image.decoding = "async";
    mediaButton.append(image);

    const body = document.createElement("div");
    body.className = "app-card-body";

    const heading = document.createElement("div");
    heading.className = "app-card-heading";

    const titleLink = document.createElement("a");
    titleLink.className = "app-title-link";
    titleLink.href = app.repo_url;
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer";

    const title = document.createElement("h2");
    title.textContent = app.app_name;
    titleLink.append(title);

    const repoIcon = document.createElement("span");
    repoIcon.className = "repo-link";
    repoIcon.setAttribute("aria-hidden", "true");
    repoIcon.append(githubIcon());
    titleLink.append(repoIcon);
    heading.append(titleLink);

    const description = document.createElement("p");
    description.className = "app-description";
    const descText = metadata?.description || "A small, thoughtful tool by Mahesh Shantaram.";
    description.append(document.createTextNode(descText));

    const homepage = metadata?.homepage;
    if (homepage) {
      description.append(document.createTextNode(" "));
      const siteLink = document.createElement("a");
      siteLink.className = "app-site-link";
      siteLink.href = homepage;
      siteLink.target = "_blank";
      siteLink.rel = "noreferrer";
      siteLink.textContent = displayUrl(homepage);
      description.append(siteLink);
    }

    const tags = document.createElement("div");
    tags.className = "tech-stack";
    tags.setAttribute("aria-label", `Tech stack for ${app.app_name}`);
    const techStack = Array.isArray(metadata?.tech_stack) ? metadata.tech_stack : [];
    (techStack.length ? techStack : ["Open source"]).forEach((tech) => {
      const tag = document.createElement("span");
      tag.className = "tech-tag";
      tag.textContent = tech;
      tags.append(tag);
    });

    body.append(heading, description, tags);
    card.append(mediaButton, body);
    return card;
  }

  function setupLightbox() {
    if (document.querySelector("#screenshot-lightbox")) return;

    const lightbox = document.createElement("div");
    lightbox.id = "screenshot-lightbox";
    lightbox.className = "screenshot-lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = `
      <button type="button" class="lightbox-close" aria-label="Close screenshot viewer">&times;</button>
      <figure class="lightbox-figure">
        <img class="lightbox-image" alt="" />
        <figcaption class="lightbox-caption"></figcaption>
      </figure>
      <div class="lightbox-controls">
        <button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous screenshot">&#8249;</button>
        <button type="button" class="lightbox-nav lightbox-next" aria-label="Next screenshot">&#8250;</button>
      </div>
    `;
    document.body.append(lightbox);

    lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".lightbox-prev").addEventListener("click", () => stepLightbox(-1));
    lightbox.querySelector(".lightbox-next").addEventListener("click", () => stepLightbox(1));
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (lightbox.getAttribute("aria-hidden") === "true") return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") stepLightbox(-1);
      if (event.key === "ArrowRight") stepLightbox(1);
    });
  }

  let lightboxIndex = 0;

  function openLightbox(index) {
    if (!galleryItems.length) return;
    setupLightbox();
    lightboxIndex = ((index % galleryItems.length) + galleryItems.length) % galleryItems.length;
    renderLightbox();
    const lightbox = document.querySelector("#screenshot-lightbox");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    lightbox.querySelector(".lightbox-close").focus();
  }

  function closeLightbox() {
    const lightbox = document.querySelector("#screenshot-lightbox");
    if (!lightbox) return;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
  }

  function stepLightbox(delta) {
    if (!galleryItems.length) return;
    lightboxIndex = (lightboxIndex + delta + galleryItems.length) % galleryItems.length;
    renderLightbox();
  }

  function renderLightbox() {
    const item = galleryItems[lightboxIndex];
    const lightbox = document.querySelector("#screenshot-lightbox");
    if (!item || !lightbox) return;
    const img = lightbox.querySelector(".lightbox-image");
    const caption = lightbox.querySelector(".lightbox-caption");
    img.src = item.src;
    img.alt = item.alt;
    caption.textContent = `${item.name} (${lightboxIndex + 1} / ${galleryItems.length})`;
  }

  async function loadGallery() {
    try {
      const [csvResponse, metadataResponse] = await Promise.all([
        fetch("./apps.csv", { cache: "no-cache" }),
        fetch("./repo-meta.json", { cache: "no-cache" }),
      ]);
      if (!csvResponse.ok) throw new Error(`apps.csv returned ${csvResponse.status}`);
      if (!metadataResponse.ok) throw new Error(`repo-meta.json returned ${metadataResponse.status}`);

      const [csvText, metadata] = await Promise.all([
        csvResponse.text(),
        metadataResponse.json(),
      ]);
      const apps = parseCsv(csvText);

      gallery.replaceChildren();
      galleryItems = [];
      if (!apps.length) {
        const empty = document.createElement("p");
        empty.className = "gallery-status";
        empty.textContent = "No apps found in apps.csv.";
        gallery.append(empty);
        return;
      }

      apps.forEach((app, index) => {
        const filename = app.image_filename || `${app.app_name}.png`;
        galleryItems.push({
          src: `./assets/screenshots/${encodeURIComponent(filename)}`,
          alt: app.app_name,
          name: app.app_name,
        });
        gallery.append(createCard(app, metadata[app.repo_url], index));
      });
    } catch (error) {
      console.error("Could not load app gallery", error);
      gallery.replaceChildren();
      const errorMessage = document.createElement("p");
      errorMessage.className = "gallery-error";
      errorMessage.textContent = "The gallery could not load right now. Please check apps.csv and repo-meta.json.";
      gallery.append(errorMessage);
    }
  }

  function setupHeaderInteractions() {
    const textModeButton = document.querySelector("#toggle-textmode");
    textModeButton?.addEventListener("click", () => {
      const enabled = document.body.classList.toggle("text-only");
      textModeButton.setAttribute("aria-pressed", String(enabled));
    });

    const snowButton = document.querySelector("#toggle-snow");
    snowButton?.addEventListener("click", () => {
      const enabled = document.body.classList.toggle("snow-enabled");
      snowButton.setAttribute("aria-pressed", String(enabled));
    });

    const menuButton = document.querySelector(".mobile-menu-toggle");
    const mobileNav = document.querySelector("#mobile-nav");
    const closeButton = document.querySelector(".mobile-nav-close");
    const overlay = document.querySelector(".mobile-nav-overlay");

    const setMenu = (open) => {
      menuButton?.setAttribute("aria-expanded", String(open));
      mobileNav?.setAttribute("aria-hidden", String(!open));
      if (open) {
        mobileNav?.removeAttribute("inert");
        closeButton?.focus();
      } else {
        mobileNav?.setAttribute("inert", "");
        menuButton?.focus();
      }
    };

    menuButton?.addEventListener("click", () => setMenu(true));
    closeButton?.addEventListener("click", () => setMenu(false));
    overlay?.addEventListener("click", () => setMenu(false));
    mobileNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileNav?.getAttribute("aria-hidden") === "false") setMenu(false);
    });

    const year = document.querySelector("#copyright-year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  async function loadGitHubMetrics() {
    try {
      const response = await fetch("https://api.github.com/users/thecont1", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) return;
      const data = await response.json();
      document.querySelectorAll(".js-github-followers").forEach((el) => {
        el.textContent = String(data.followers);
      });
      document.querySelectorAll(".js-github-following").forEach((el) => {
        el.textContent = String(data.following);
      });
    } catch (error) {
      // Silently keep the hardcoded fallback values
    }
  }

  function formatContributionDate(isoDate) {
    // Parse as local midnight to avoid UTC day-shift
    const date = new Date(`${isoDate}T12:00:00`);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function buildContributionTooltip(tooltip, day) {
    tooltip.replaceChildren();

    const countText =
      day.count === 0
        ? "No contributions"
        : `${day.count} contribution${day.count === 1 ? "" : "s"}`;

    const strong = document.createElement("strong");
    strong.textContent = countText;

    const dateEl = document.createElement("span");
    dateEl.className = "contrib-tooltip-date";
    dateEl.textContent = formatContributionDate(day.date);

    tooltip.append(strong, dateEl);

    if (Array.isArray(day.projects) && day.projects.length) {
      const list = document.createElement("ul");
      list.className = "contrib-tooltip-projects";
      for (const project of day.projects) {
        const item = document.createElement("li");
        item.textContent = project;
        list.append(item);
      }
      tooltip.append(list);
    }
  }

  function positionContributionTooltip(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - 8;

    // Keep inside viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    if (top < 8) top = rect.bottom + 8;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  async function loadContributionGraph() {
    const container = document.querySelector("#contribution-graph");
    if (!container) return;
    try {
      const response = await fetch(
        "https://contributions-router.thecontrarian.workers.dev/contributions",
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { days } = await response.json();
      if (!days?.length) throw new Error("No data");

      // Guarantee complete weeks (Worker should already pad, but be safe)
      while (days.length % 7 !== 0) {
        days.push({ date: "", level: 0, count: 0, projects: [] });
      }
      const totalWeeks = days.length / 7;

      // Month labels: one slot per week; show label when the month changes
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const monthLabels = new Array(totalWeeks).fill("");
      let lastMonth = -1;
      for (let week = 0; week < totalWeeks; week += 1) {
        const sample = days[week * 7];
        if (!sample?.date) continue;
        const month = new Date(`${sample.date}T12:00:00`).getMonth();
        if (month !== lastMonth) {
          monthLabels[week] = monthNames[month];
          lastMonth = month;
        }
      }

      // Wrapper: months row + weekday labels + cell grid
      const wrap = document.createElement("div");
      wrap.className = "contribution-wrap";
      wrap.setAttribute("role", "grid");
      wrap.setAttribute("aria-readonly", "true");

      // Month labels (top)
      const months = document.createElement("div");
      months.className = "contribution-months";
      months.setAttribute("aria-hidden", "true");
      for (const label of monthLabels) {
        const span = document.createElement("span");
        span.textContent = label;
        months.append(span);
      }

      // Weekday labels (left) — all 7 rows exist; only Mon/Wed/Fri are labeled
      // so the unlabeled rows still take up space (true GitHub behavior).
      const weekdayNames = ["", "Mon", "", "Wed", "", "Fri", ""];
      const weekdays = document.createElement("div");
      weekdays.className = "contribution-weekdays";
      weekdays.setAttribute("aria-hidden", "true");
      for (const name of weekdayNames) {
        const span = document.createElement("span");
        span.textContent = name;
        weekdays.append(span);
      }

      // 7-row × N-col grid of fixed-size square cells
      // Days are already column-major (Sun of week 0 … Sat of week 0, …)
      // so grid-auto-flow: column fills correctly.
      const grid = document.createElement("div");
      grid.className = "contribution-grid";
      for (const day of days) {
        const cell = document.createElement("span");
        cell.className = "contrib-day";
        cell.dataset.level = day.level ?? 0;
        if (day.date) {
          cell.dataset.date = day.date;
          cell.dataset.count = String(day.count ?? 0);
          if (day.projects?.length) {
            cell.dataset.projects = day.projects.join(",");
          }
        }
        grid.append(cell);
      }

      wrap.append(months, weekdays, grid);

      // Shared floating tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "contrib-tooltip";
      tooltip.setAttribute("role", "tooltip");
      document.body.append(tooltip);

      grid.addEventListener("mouseover", (event) => {
        const cell = event.target.closest(".contrib-day");
        if (!cell || !cell.dataset.date) {
          tooltip.classList.remove("is-visible");
          return;
        }
        buildContributionTooltip(tooltip, {
          date: cell.dataset.date,
          count: Number(cell.dataset.count || 0),
          projects: cell.dataset.projects
            ? cell.dataset.projects.split(",")
            : [],
        });
        tooltip.classList.add("is-visible");
        positionContributionTooltip(tooltip, cell);
      });

      grid.addEventListener("mousemove", (event) => {
        const cell = event.target.closest(".contrib-day");
        if (cell?.dataset.date) positionContributionTooltip(tooltip, cell);
      });

      grid.addEventListener("mouseleave", () => {
        tooltip.classList.remove("is-visible");
      });

      container.replaceChildren(wrap);

      // On mobile, start scrolled to the most recent weeks (~last 6 months
      // visible) while keeping the full year available via horizontal scroll.
      const scrollToRecent = () => {
        if (window.matchMedia("(max-width: 768px)").matches) {
          container.scrollLeft = container.scrollWidth;
        }
      };
      requestAnimationFrame(scrollToRecent);
      window.addEventListener("resize", scrollToRecent, { passive: true });
    } catch (error) {
      console.error("Could not load contribution graph", error);
      container.replaceChildren();
      const msg = document.createElement("p");
      msg.className = "contribution-status";
      msg.textContent = "Could not load contributions right now.";
      container.append(msg);
    }
  }

  setupHeaderInteractions();
  loadGallery();
  loadGitHubMetrics();
  loadContributionGraph();
})();
