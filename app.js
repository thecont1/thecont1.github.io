(() => {
  "use strict";

  const gallery = document.querySelector("#app-gallery");

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
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<path d="M12 3a9 9 0 0 0-2.8 17.6c.4.1.6-.2.6-.4v-1.5c-2.5.5-3-.9-3-.9-.4-1-.9-1.2-.9-1.2-.8-.5.1-.5.1-.5.9.1 1.3.9 1.3.9.8 1.3 2 1 2.5.8.1-.5.3-.9.6-1.1-2-.2-4.1-1-4.1-4.4 0-1 .3-1.8.9-2.4-.1-.2-.4-1.1.1-2.3 0 0 .8-.2 2.4.9a8.3 8.3 0 0 1 4.4 0c1.6-1.1 2.4-.9 2.4-.9.5 1.2.2 2.1.1 2.3.6.6.9 1.4.9 2.4 0 3.4-2.1 4.2-4.1 4.4.3.3.6.8.6 1.6v2.4c0 .2.2.5.6.4A9 9 0 0 0 12 3Z" />';
    return icon;
  }

  function createCard(app, metadata) {
    const card = document.createElement("article");
    card.className = "app-card";

    const mediaLink = document.createElement("a");
    mediaLink.className = "app-card-media";
    mediaLink.href = app.repo_url;
    mediaLink.target = "_blank";
    mediaLink.rel = "noreferrer";
    mediaLink.setAttribute("aria-label", `Open ${app.app_name} on GitHub`);

    const image = document.createElement("img");
    // Screenshots live under assets/screenshots/ and are named per the
    // image_filename column in apps.csv. Encode the filename portion so
    // spaces, punctuation, emoji, and other characters request correctly.
    const filename = app.image_filename || `${app.app_name}.png`;
    image.src = `./assets/screenshots/${encodeURIComponent(filename)}`;
    image.alt = app.app_name;
    image.loading = "lazy";
    image.decoding = "async";
    mediaLink.append(image);

    const body = document.createElement("div");
    body.className = "app-card-body";

    const heading = document.createElement("div");
    heading.className = "app-card-heading";

    const title = document.createElement("h2");
    title.textContent = app.app_name;
    heading.append(title);

    const repoLink = document.createElement("a");
    repoLink.className = "repo-link";
    repoLink.href = app.repo_url;
    repoLink.target = "_blank";
    repoLink.rel = "noreferrer";
    repoLink.setAttribute("aria-label", `View ${app.app_name} repository on GitHub`);
    repoLink.append(githubIcon());
    heading.append(repoLink);

    const description = document.createElement("p");
    description.className = "app-description";
    description.textContent = metadata?.description || "A small, thoughtful tool by Mahesh Shantaram.";

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
    card.append(mediaLink, body);
    return card;
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
      if (!apps.length) {
        const empty = document.createElement("p");
        empty.className = "gallery-status";
        empty.textContent = "No apps found in apps.csv.";
        gallery.append(empty);
        return;
      }

      apps.forEach((app) => gallery.append(createCard(app, metadata[app.repo_url])));
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

  setupHeaderInteractions();
  loadGallery();
})();
