/* ============================================================
   Tangydust — application logic
   ============================================================ */
(function () {
  "use strict";

  const DB_KEY = "tangydust_db_v1";
  const SESSION_KEY = "tangydust_session_v1";
  const DEF = window.TANGYDUST_DEFAULTS;

  /* ---------------- Utilities ---------------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&" + "amp;", "<": "&" + "lt;", ">": "&" + "gt;", '"': "&" + "quot;", "'": "&" + "#39;" }[c];
    });
  }

  function uid() {
    return "site-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  async function sha256(text) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (e) { /* fall through */ }
    }
    // Fallback (non-cryptographic) for non-secure contexts
    let h1 = 0x811c9dc5, h2 = 0x01000193, s = "s:" + text;
    for (let i = 0; i < s.length; i++) {
      h1 = (h1 ^ s.charCodeAt(i)) * 16777619 >>> 0;
      h2 = (h2 + s.charCodeAt(i) * (i + 7)) >>> 0;
    }
    return "fb" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0") + s.length.toString(16);
  }

  function toast(msg, ok) {
    const t = document.createElement("div");
    t.className = "toast " + (ok === false ? "err" : "ok");
    t.innerHTML = '<span class="t-icon">' + (ok === false ? "✕" : "✓") + "</span><span>" + esc(msg) + "</span>";
    $("#toasts").appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 2800);
  }

  function hexToRgba(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "rgba(255,157,47," + a + ")";
    const n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  // Compress an uploaded image file to a data URL (keeps localStorage small)
  function fileToCompressedDataURL(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode failed"));
        img.onload = () => {
          try {
            const scale = Math.min(1, maxW / img.width);
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", quality));
          } catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------------- Database (localStorage) ---------------- */
  let db = null;
  let session = null;

  function loadDB() {
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.sites) || !db.admin) {
      db = {
        brand: DEF.brand || "Tangydust",
        admin: { username: DEF.admin.username, passHash: DEF.admin.passHash, mustChange: true },
        sites: JSON.parse(JSON.stringify(DEF.sites || []))
      };
      saveDB();
    }
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }
  }

  function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  function isAdmin() { return !!(session && session.role === "admin"); }

  /* ---------------- Logo / accent helpers ---------------- */
  function accentVars(site) {
    const acc = site.accent || "#ff9d2f";
    return (
      "--accent:" + acc + ";" +
      "--accent-glow:" + hexToRgba(acc, 0.38) + ";" +
      "--accent-bg:" + hexToRgba(acc, 0.14) + ";"
    );
  }

  function logoHTML(site, monoSize) {
    if (site.logo) {
      return '<img src="' + esc(site.logo) + '" alt="' + esc(site.name) + ' logo" loading="lazy" />';
    }
    const ch = (site.name || "?").trim().charAt(0).toUpperCase() || "?";
    return '<span class="logo-mono" style="font-size:' + (monoSize || 26) + 'px">' + esc(ch) + "</span>";
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  /* ---------------- Auth ---------------- */
  function openModal(id) { $("#" + id).classList.remove("hidden"); }
  function closeModal(id) { $("#" + id).classList.add("hidden"); }

  function updateAuthUI() {
    const loginBtn = $("#loginBtn"), chip = $("#userChip"), adminLink = $('a[data-nav="admin"]');
    if (session) {
      loginBtn.classList.add("hidden");
      chip.classList.remove("hidden");
      $("#userName").textContent = session.username;
      $("#userAvatar").textContent = session.username.charAt(0).toUpperCase();
      if (session.role === "admin") adminLink.classList.remove("hidden");
    } else {
      loginBtn.classList.remove("hidden");
      chip.classList.add("hidden");
      adminLink.classList.add("hidden");
    }
  }

  async function doLogin(username, password) {
    const hash = await sha256(password);
    if (username === db.admin.username && hash === db.admin.passHash) {
      session = { username: db.admin.username, role: "admin" };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      updateAuthUI();
      return true;
    }
    return false;
  }

  function doLogout() {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    updateAuthUI();
    toast("Signed out. See you soon!");
    if (location.hash.startsWith("#/admin")) location.hash = "#/";
    else route();
  }

  /* ---------------- Router ---------------- */
  function route() {
    const hash = location.hash || "#/";
    const view = $("#view");
    view.classList.remove("enter");
    void view.offsetWidth; // restart animations

    if (hash.startsWith("#/site/")) {
      renderSiteDetail(decodeURIComponent(hash.slice(7)));
    } else if (hash.startsWith("#/admin")) {
      renderAdmin();
    } else {
      renderHome();
    }
    view.classList.add("enter");

    $$(".nav-links a").forEach((a) => a.classList.remove("active"));
    if (hash.startsWith("#/admin")) { const a = $('a[data-nav="admin"]'); if (a) a.classList.add("active"); }
    else { const a = $('a[data-nav="home"]'); if (a) a.classList.add("active"); }
  }

  /* ---------------- Home view ---------------- */
  function renderHome() {
    const view = $("#view");
    const sites = db.sites;
    const cards = sites
      .map((s, i) => {
        const adminBtns = isAdmin()
          ? '<div class="card-actions">' +
            '<button class="icon-btn" title="Edit" onclick="TD.editSite(\'' + s.id + '\')">✎</button>' +
            '<button class="icon-btn danger" title="Delete" onclick="TD.deleteSite(\'' + s.id + '\')">🗑</button></div>'
          : "";
        return (
          '<article class="site-card" style="' + accentVars(s) + "animation-delay:" + (i * 0.07) + 's" data-id="' + esc(s.id) + '" tabindex="0" role="link" aria-label="Open ' + esc(s.name) + '">' +
          '<div class="logo-wrap">' + logoHTML(s) + "</div>" +
          "<h3>" + esc(s.name) + (adminBtns ? "" : "") + "</h3>" +
          '<p class="tagline">' + esc(s.tagline || "") + "</p>" +
          '<div class="card-foot">' +
          '<span class="host-pill">' + esc(hostOf(s.url) || "website") + "</span>" +
          '<span class="card-cta">Explore <span>→</span></span>' +
          "</div>" +
          adminBtns +
          "</article>"
        );
      })
      .join("");

    view.innerHTML =
      '<section class="hero">' +
      '<div class="hero-eyebrow"><span class="dot"></span>The Tangydust family</div>' +
      "<h1>One hub.<br />Every <span class=\"grad-text\">world</span> we build.</h1>" +
      '<p class="sub">Tangydust brings all of our websites and apps together in one premium, dark and beautiful place. Pick a card, explore, and dive in.</p>' +
      '<div class="hero-stats">' +
      "<div class=\"stat\"><b>" + sites.length + "</b><span>Websites</span></div>" +
      "<div class=\"stat\"><b>24/7</b><span>Always on</span></div>" +
      "<div class=\"stat\"><b>∞</b><span>Places to go</span></div>" +
      "</div>" +
      "</section>" +
      '<section id="sites">' +
      '<div class="section-head reveal"><div><h2>Our sites</h2><p>Click any card to see what it is, then jump straight in.</p></div>' +
      (isAdmin() ? '<button class="btn btn-primary" onclick="TD.openEditor(null)">+ Add site</button>' : "") +
      "</div>" +
      '<div class="cards-grid">' +
      (cards ||
        '<div class="empty-state"><div class="big">✨</div><p>No sites yet.' +
        (isAdmin() ? " Add your first one with the button above." : " Check back soon.") +
        "</p></div>") +
      "</div>" +
      "</section>";

    // Card hover spotlight follows cursor
    $$(".site-card", view).forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      });
      const open = () => { location.hash = "#/site/" + encodeURIComponent(card.dataset.id); };
      card.addEventListener("click", (e) => {
        if (e.target.closest(".icon-btn")) return;
        open();
      });
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    });

    observeReveals();
  }

  /* ---------------- Site detail view ---------------- */
  let lightboxImages = [], lightboxIndex = 0;

  function renderSiteDetail(id) {
    const view = $("#view");
    const s = db.sites.find((x) => x.id === id);
    if (!s) {
      view.innerHTML =
        '<div class="empty-state" style="margin-top:60px"><div class="big">🛸</div><p>That site doesn\'t exist (or was removed).</p><a class="btn btn-ghost" style="margin-top:16px" href="#/">← Back home</a></div>';
      return;
    }
    lightboxImages = s.images || [];

    view.innerHTML =
      '<a class="back-link" href="#/">← All sites</a>' +
      '<div class="detail-hero-card" style="' + accentVars(s) + '">' +
      '<div class="detail-logo">' + logoHTML(s, 40) + "</div>" +
      '<div class="detail-info">' +
      "<h1>" + esc(s.name) + "</h1>" +
      '<p class="tagline">' + esc(s.tagline || "") + "</p>" +
      '<div class="detail-actions">' +
      '<a class="btn btn-primary" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">Open website ↗</a>' +
      '<a class="btn btn-outline-accent" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">⚡ Try it</a>' +
      (isAdmin()
        ? '<button class="btn btn-ghost" onclick="TD.editSite(\'' + s.id + '\')">✎ Edit</button>'
        : "") +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="detail-body">' +
      '<div class="section-head reveal"><div><h2>About ' + esc(s.name) + "</h2></div></div>" +
      '<p class="detail-desc reveal">' + esc(s.description || "") + "</p>" +
      (lightboxImages.length
        ? '<div class="section-head reveal" style="margin-top:44px"><div><h2>Demo gallery</h2><p>A peek inside — click any image to view it larger.</p></div></div>' +
          '<div class="gallery-grid">' +
          lightboxImages
            .map(
              (img, i) =>
                '<div class="gallery-item" style="animation-delay:' + (i * 0.06) + 's" data-lb="' + i + '"><img src="' + esc(img) + '" alt="' + esc(s.name) + ' demo screenshot ' + (i + 1) + '" loading="lazy" /></div>'
            )
            .join("") +
          "</div>"
        : "") +
      "</div>";

    $$(".gallery-item", view).forEach((el) =>
      el.addEventListener("click", () => openLightbox(parseInt(el.dataset.lb, 10)))
    );
    observeReveals();
  }

  function openLightbox(i) {
    if (!lightboxImages.length) return;
    lightboxIndex = i;
    $("#lbImg").src = lightboxImages[i];
    $("#lightbox").classList.remove("hidden");
  }
  function stepLightbox(d) {
    if (!lightboxImages.length) return;
    lightboxIndex = (lightboxIndex + d + lightboxImages.length) % lightboxImages.length;
    $("#lbImg").src = lightboxImages[lightboxIndex];
  }

  /* ---------------- Admin view ---------------- */
  let adminTab = "sites";

  function renderAdmin() {
    const view = $("#view");
    if (!isAdmin()) {
      view.innerHTML =
        '<div class="empty-state" style="margin-top:60px"><div class="big">🔐</div><p>This area is for the administrator.</p><button class="btn btn-primary" style="margin-top:16px" id="adminLoginPrompt">Sign in as admin</button></div>';
      $("#adminLoginPrompt").addEventListener("click", () => openModal("loginModal"));
      return;
    }

    let body = "";
    if (adminTab === "sites") {
      const rows = db.sites
        .map(
          (s, i) =>
            '<div class="admin-row" style="' + accentVars(s) + ";animation-delay:" + (i * 0.05) + 's">' +
            '<div class="row-logo">' + logoHTML(s, 18) + "</div>" +
            '<div class="row-main"><b>' + esc(s.name) + "</b><span>" + esc(hostOf(s.url) || s.url) + " · " + (s.images || []).length + " demo images</span></div>" +
            '<div class="row-actions">' +
            '<button class="icon-btn" title="Edit" onclick="TD.editSite(\'' + s.id + '\')">✎</button>' +
            '<button class="icon-btn danger" title="Delete" onclick="TD.deleteSite(\'' + s.id + '\')">🗑</button>' +
            "</div></div>"
        )
        .join("");
      body =
        '<div class="admin-list">' +
        (rows || '<div class="empty-state"><div class="big">📭</div><p>No sites yet — add your first one.</p></div>') +
        "</div>";
    } else {
      body =
        '<div class="settings-card reveal visible"><h3>Change admin password</h3><p class="hint">Your password is stored as a hash in this browser. A strong, unique password is recommended.</p>' +
        '<div class="settings-row"><label class="field" style="flex:1;min-width:200px"><span>New password</span><input type="password" id="newPass" placeholder="New password" /></label>' +
        '<button class="btn btn-primary" id="savePassBtn">Update password</button></div></div>' +
        '<div class="settings-card reveal visible"><h3>Publish changes for everyone</h3><p class="hint">Edits made here live in your browser. To make them visible to <b>all visitors</b>, download the generated file and replace <code>js/defaults.js</code> in your GitHub repository.</p>' +
        '<div class="settings-row"><button class="btn btn-primary" id="publishBtn">⬇ Download js/defaults.js</button></div></div>' +
        '<div class="settings-card reveal visible"><h3>Backup & restore</h3><p class="hint">Export all site data as JSON, or import a previous export.</p>' +
        '<div class="settings-row"><button class="btn btn-ghost" id="exportBtn">Export JSON</button><input type="file" id="importFile" accept="application/json,.json" class="file-input" style="max-width:240px" /><button class="btn btn-danger" id="resetBtn">Reset to defaults</button></div></div>';
    }

    view.innerHTML =
      '<div class="admin-head"><div><h2 style="font-family:var(--font-head);font-size:clamp(26px,4vw,36px)">Admin panel</h2><p style="color:var(--muted);margin-top:4px">Manage your sites, links and demo images.</p></div>' +
      '<button class="btn btn-primary" onclick="TD.openEditor(null)">+ Add site</button></div>' +
      (db.admin.mustChange ? '<div class="notice">⚠ You are still using the default admin password. Change it in <b>Settings</b> below.</div>' : "") +
      '<div class="admin-tabs">' +
      '<button class="admin-tab' + (adminTab === "sites" ? " active" : "") + '" data-tab="sites">Sites</button>' +
      '<button class="admin-tab' + (adminTab === "settings" ? " active" : "") + '" data-tab="settings">Settings</button>' +
      "</div>" +
      body;

    $$(".admin-tab", view).forEach((b) =>
      b.addEventListener("click", () => { adminTab = b.dataset.tab; renderAdmin(); })
    );

    if (adminTab === "settings") {
      $("#savePassBtn").addEventListener("click", async () => {
        const np = $("#newPass").value;
        if (!np || np.length < 6) return toast("Password must be at least 6 characters.", false);
        db.admin.passHash = await sha256(np);
        db.admin.mustChange = false;
        saveDB();
        $("#newPass").value = "";
        toast("Password updated.");
        renderAdmin();
      });
      $("#publishBtn").addEventListener("click", publishDefaults);
      $("#exportBtn").addEventListener("click", () => {
        download("tangydust-backup.json", JSON.stringify(db, null, 2), "application/json");
        toast("Backup downloaded.");
      });
      $("#importFile").addEventListener("change", importJSON);
      $("#resetBtn").addEventListener("click", () => {
        confirmAction("Reset everything?", "All local changes will be lost and the default sites restored.", "Reset", () => {
          localStorage.removeItem(DB_KEY);
          loadDB();
          toast("Data reset to defaults.");
          route();
        });
      });
    }
  }

  function publishDefaults() {
    const payload =
      "/* ============================================================\n" +
      "   Tangydust — default content (generated by the Admin panel).\n" +
      "   Replace this file in your GitHub repository to publish your\n" +
      "   sites, links and images for all visitors.\n" +
      "   ============================================================ */\n" +
      "window.TANGYDUST_DEFAULTS = " +
      JSON.stringify({ brand: db.brand, admin: db.admin, sites: db.sites }, null, 2) +
      ";\n";
    download("defaults.js", payload, "text/javascript");
    toast("Downloaded — replace js/defaults.js in your repo.");
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.sites)) throw new Error("bad file");
        db.sites = data.sites;
        if (data.admin && data.admin.username) db.admin = data.admin;
        saveDB();
        toast("Data imported.");
        route();
      } catch (err) {
        toast("That file doesn't look like a Tangydust backup.", false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  /* ---------------- Site editor ---------------- */
  let editingId = null; // null = new
  let pendingImages = [];
  let pendingLogo = "";

  function openEditor(id) {
    if (!isAdmin()) return;
    editingId = id;
    const s = id ? db.sites.find((x) => x.id === id) : null;
    $("#editorTitle").textContent = s ? "Edit " + s.name : "Add a new site";
    $("#fName").value = s ? s.name : "";
    $("#fTagline").value = s ? s.tagline || "" : "";
    $("#fUrl").value = s ? s.url : "";
    $("#fDesc").value = s ? s.description || "" : "";
    $("#fAccent").value = s && s.accent ? s.accent : "#ff9d2f";
    $("#fLogoUrl").value = s && s.logo && !String(s.logo).startsWith("data:") ? s.logo : "";
    $("#fImgUrl").value = "";
    pendingImages = s ? (s.images || []).slice() : [];
    pendingLogo = s && String(s.logo).startsWith("data:") ? s.logo : "";
    renderLogoPreview();
    renderThumbs();
    openModal("editorModal");
  }

  function renderLogoPreview() {
    const name = $("#fName").value || "?";
    const el = $("#logoPreview");
    if (pendingLogo) el.innerHTML = '<img src="' + esc(pendingLogo) + '" alt="" />';
    else el.textContent = name.trim().charAt(0).toUpperCase() || "?";
  }

  function renderThumbs() {
    $("#imgThumbs").innerHTML = pendingImages
      .map(
        (img, i) =>
          '<div class="img-thumb"><img src="' + esc(img) + '" alt="demo ' + (i + 1) + '" /><button type="button" data-i="' + i + '" title="Remove">✕</button></div>'
      )
      .join("");
    $$("#imgThumbs button").forEach((b) =>
      b.addEventListener("click", () => {
        pendingImages.splice(parseInt(b.dataset.i, 10), 1);
        renderThumbs();
      })
    );
  }

  function saveSite(e) {
    e.preventDefault();
    const name = $("#fName").value.trim();
    const url = $("#fUrl").value.trim();
    if (!name || !url) return toast("Name and link are required.", false);
    const logoField = $("#fLogoUrl").value.trim();
    const data = {
      name: name,
      tagline: $("#fTagline").value.trim(),
      url: url,
      description: $("#fDesc").value.trim(),
      accent: $("#fAccent").value,
      logo: pendingLogo || logoField || "",
      images: pendingImages
    };
    if (editingId) {
      const s = db.sites.find((x) => x.id === editingId);
      if (s) Object.assign(s, data);
    } else {
      data.id = uid();
      db.sites.unshift(data);
    }
    saveDB();
    closeModal("editorModal");
    toast(editingId ? "Site updated." : "Site added.");
    route();
  }

  function deleteSite(id) {
    const s = db.sites.find((x) => x.id === id);
    if (!s) return;
    confirmAction('Delete "' + s.name + '"?', "This removes the site from your hub. This can't be undone.", "Delete", () => {
      db.sites = db.sites.filter((x) => x.id !== id);
      saveDB();
      toast("Site deleted.");
      if ((location.hash || "").startsWith("#/site/" + id)) location.hash = "#/";
      else route();
    });
  }

  /* ---------------- Confirm dialog ---------------- */
  let confirmCb = null;
  function confirmAction(title, msg, okLabel, cb) {
    $("#confirmTitle").textContent = title;
    $("#confirmMsg").textContent = msg;
    $("#confirmOk").textContent = okLabel || "Confirm";
    confirmCb = cb;
    openModal("confirmModal");
  }

  /* ---------------- Scroll reveal ---------------- */
  let revealObserver = null;
  function observeReveals() {
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            revealObserver.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    $$(".reveal").forEach((el) => revealObserver.observe(el));
  }

  /* ---------------- Public API (inline handlers) ---------------- */
  window.TD = { openEditor, deleteSite, editSite: openEditor };

  /* ---------------- Boot ---------------- */
  function bindGlobalEvents() {
    // Nav
    $("#loginBtn").addEventListener("click", () => {
      $("#loginError").classList.add("hidden");
      openModal("loginModal");
      setTimeout(() => $("#loginUser").focus(), 60);
    });
    $("#logoutBtn").addEventListener("click", doLogout);

    // Login form
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = await doLogin($("#loginUser").value.trim(), $("#loginPass").value);
      if (ok) {
        closeModal("loginModal");
        $("#loginForm").reset();
        toast("Welcome back, " + session.username + "!");
        if (db.admin.mustChange) {
          toast("Tip: change the default password in Admin → Settings.", true);
          location.hash = "#/admin";
        } else {
          route();
        }
      } else {
        $("#loginError").classList.remove("hidden");
      }
    });

    // Modal close buttons & backdrop click
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close)));
    $$(".modal-backdrop").forEach((bd) =>
      bd.addEventListener("click", (e) => { if (e.target === bd) bd.classList.add("hidden"); })
    );

    // Editor form
    $("#editorForm").addEventListener("submit", saveSite);
    $("#fName").addEventListener("input", renderLogoPreview);
    $("#fLogoUrl").addEventListener("input", () => { pendingLogo = ""; renderLogoPreview(); });
    $("#fLogoFile").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        pendingLogo = await fileToCompressedDataURL(f, 400, 0.82);
        $("#fLogoUrl").value = "";
        renderLogoPreview();
        toast("Logo added.");
      } catch (err) { toast("Couldn't read that image.", false); }
      e.target.value = "";
    });
    $("#addImgUrlBtn").addEventListener("click", () => {
      const u = $("#fImgUrl").value.trim();
      if (!u) return toast("Paste an image URL first.", false);
      pendingImages.push(u);
      $("#fImgUrl").value = "";
      renderThumbs();
    });
    $("#fImgFile").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        try { pendingImages.push(await fileToCompressedDataURL(f, 1280, 0.78)); }
        catch (err) { toast("Couldn't read an image.", false); }
      }
      renderThumbs();
      e.target.value = "";
    });

    // Confirm dialog
    $("#confirmOk").addEventListener("click", () => {
      closeModal("confirmModal");
      if (confirmCb) { const cb = confirmCb; confirmCb = null; cb(); }
    });

    // Lightbox
    $("#lbClose").addEventListener("click", () => $("#lightbox").classList.add("hidden"));
    $("#lbPrev").addEventListener("click", () => stepLightbox(-1));
    $("#lbNext").addEventListener("click", () => stepLightbox(1));
    $("#lightbox").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
    });
    document.addEventListener("keydown", (e) => {
      if (!$("#lightbox").classList.contains("hidden")) {
        if (e.key === "Escape") $("#lightbox").classList.add("hidden");
        if (e.key === "ArrowLeft") stepLightbox(-1);
        if (e.key === "ArrowRight") stepLightbox(1);
      } else if (e.key === "Escape") {
        $$(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
      }
    });

    // Router
    window.addEventListener("hashchange", route);

    $("#year").textContent = new Date().getFullYear();
  }

  loadDB();
  updateAuthUI();
  bindGlobalEvents();
  route();
})();
