import { playUiSound, setSoundEffectsEnabled, soundEffectsEnabled } from "./sounds.js";
import { initConverters, initBackgroundRemover } from "./converters.js";

const CATEGORIES = {
  wallpapers: { label: "PC Wallpapers", accent: "var(--wall)" },
  "phone-wallpapers": { label: "Phone Wallpapers", accent: "var(--phone)" },
  cursors: { label: "Cursor Packs", accent: "var(--cursor)" },
  icons: { label: "Icon Packs", accent: "var(--icons)" }
};
const elements = {
  app: document.querySelector("#app-shell"), sidebar: document.querySelector("#sidebar"), menuButton: document.querySelector("#mobile-menu-button"), scrim: document.querySelector("#sidebar-scrim"),
  search: document.querySelector("#search-input"), searchClear: document.querySelector("#search-clear"), sort: document.querySelector("#sort-select"),
  filterToggle: document.querySelector("#filter-toggle"), filterPanel: document.querySelector("#filter-panel"), filterClose: document.querySelector("#filter-close"),
  filterEmpty: document.querySelector("#filter-empty"), filterFields: document.querySelector("#filter-fields"), filterReset: document.querySelector("#filter-reset"),
  filterDevice: document.querySelector("#filter-device"), filterTheme: document.querySelector("#filter-theme"), filterColor: document.querySelector("#filter-color"), filterTag: document.querySelector("#filter-tag"),
  filterDeviceWrap: document.querySelector("#filter-device-wrap"), filterThemeWrap: document.querySelector("#filter-theme-wrap"), filterColorWrap: document.querySelector("#filter-color-wrap"), filterTagWrap: document.querySelector("#filter-tag-wrap"),
  filterDot: document.querySelector("#filter-active-dot"), activeFilters: document.querySelector("#active-filters"),
  grid: document.querySelector("#gallery-grid"), favoriteCount: document.querySelector("#favorite-count"), empty: document.querySelector("#empty-state"), emptyDescription: document.querySelector("#empty-description"), emptyReset: document.querySelector("#empty-reset"),
  error: document.querySelector("#error-state"), errorMessage: document.querySelector("#error-message"), retry: document.querySelector("#retry-button"), loading: document.querySelector("#loading-state"), resultCount: document.querySelector("#result-count"),
  collectionTitle: document.querySelector("#collection-title"), collectionKicker: document.querySelector("#collection-kicker"), breadcrumb: document.querySelector("#breadcrumb-title"),
  themeToggle: document.querySelector("#theme-toggle"), soundToggle: document.querySelector("#sound-toggle"), toast: document.querySelector("#toast"), assetDialog: document.querySelector("#asset-dialog"), assetContent: document.querySelector("#asset-dialog-content")
};
const state = {
  assets: [], visibleAssets: [], favorites: readFavorites(), view: "all", query: "", sort: "newest",
  filters: { device: "", theme: "", color: "", tag: "" }, loadState: "loading", openAssetId: null,
  searchTimer: null, toastTimer: null, sidebarOpen: false, sidebarTab: "gallery", assetHistoryPushed: false, mediaMobile: matchMedia("(max-width: 820px)")
};

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem("ghostly.favorites.guest.v1") || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
  } catch { return new Set(); }
}

function saveFavorites() {
  try { localStorage.setItem("ghostly.favorites.guest.v1", JSON.stringify([...state.favorites])); }
  catch { showToast("Favourites are saved for this visit."); }
}

function bindHeroGaze() {
  const ghost = document.querySelector(".hero-ghost");
  if (!ghost) return;
  const desktopPointer = matchMedia("(min-width: 821px) and (hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let pointerX = 0;
  let pointerY = 0;
  let frame = 0;
  const resetGaze = () => {
    ghost.style.removeProperty("--gaze-x");
    ghost.style.removeProperty("--gaze-y");
  };
  const trackPointer = (event) => {
    if (!desktopPointer.matches || reducedMotion.matches) { resetGaze(); return; }
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = ghost.getBoundingClientRect();
      if (!rect.width) return;
      const horizontal = Math.max(-1, Math.min(1, (pointerX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)));
      const vertical = Math.max(-1, Math.min(1, (pointerY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)));
      ghost.style.setProperty("--gaze-x", `${horizontal * rect.width * 0.018}px`);
      ghost.style.setProperty("--gaze-y", `${vertical * rect.height * 0.018}px`);
    });
  };
  window.addEventListener("pointermove", trackPointer, { passive: true });
  window.addEventListener("blur", resetGaze);
  desktopPointer.addEventListener("change", (event) => { if (!event.matches) resetGaze(); });
  reducedMotion.addEventListener("change", (event) => { if (event.matches) resetGaze(); });
}


applyTheme(readTheme());
bindEvents();
bindHeroGaze();
readUrlState();
setSidebarTab("gallery");
setSidebarOpen(false);
initConverters();
initBackgroundRemover();
if (state.view === "converters" || state.view === "background-remover") setSidebarTab("tools");
if (state.view === "converters" || state.view === "background-remover") setView(state.view, false);
loadAssets();

function bindEvents() {
  elements.menuButton.addEventListener("click", () => setSidebarOpen(!state.sidebarOpen));
  elements.scrim.addEventListener("click", () => setSidebarOpen(false));
  document.querySelectorAll("[data-sidebar-tab]").forEach((button) => button.addEventListener("click", () => setSidebarTab(button.dataset.sidebarTab)));
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view, true)));
  document.querySelectorAll('[data-action="all-assets"]').forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault(); setView("all", true); document.querySelector("#collection").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value.trim();
    elements.searchClear.hidden = !state.query;
    renderGallery();
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => writeUrl(false), 180);
  });
  elements.searchClear.addEventListener("click", () => clearSearch(true));
  elements.sort.addEventListener("change", () => { state.sort = elements.sort.value; renderGallery(); writeUrl(false); });
  elements.filterToggle.addEventListener("click", () => setFilterOpen(elements.filterPanel.hidden));
  elements.filterClose.addEventListener("click", () => setFilterOpen(false));
  elements.filterReset.addEventListener("click", clearFilters);
  [elements.filterDevice, elements.filterTheme, elements.filterColor].forEach((select) => select.addEventListener("change", () => {
    state.filters.device = elements.filterDevice.value;
    state.filters.theme = elements.filterTheme.value;
    state.filters.color = elements.filterColor.value;
    renderGallery(); writeUrl(false);
  }));
  elements.filterTag.addEventListener("input", () => { state.filters.tag = elements.filterTag.value.trim(); renderGallery(); writeUrl(false); });
  elements.retry.addEventListener("click", loadAssets);
  elements.emptyReset.addEventListener("click", resetAllFilters);
  elements.themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
  elements.soundToggle.addEventListener("click", () => {
    const enabled = !soundEffectsEnabled();
    setSoundEffectsEnabled(enabled);
    syncSoundToggle();
    if (enabled) playUiSound("toggle");
  });
  syncSoundToggle();
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("popstate", syncFromUrl);
  elements.assetDialog.addEventListener("click", (event) => { if (event.target === elements.assetDialog) elements.assetDialog.close(); });
  elements.assetDialog.addEventListener("close", () => {
    state.openAssetId = null;
    elements.assetContent.replaceChildren();
    const url = new URL(location.href);
    if (state.assetHistoryPushed && url.searchParams.has("asset")) {
      state.assetHistoryPushed = false;
      history.back();
    } else if (url.searchParams.has("asset")) {
      state.assetHistoryPushed = false;
      url.searchParams.delete("asset");
      history.replaceState(history.state, "", url);
    }
  });

}

function handleDocumentClick(event) {
  if (!elements.filterPanel.hidden && !event.target.closest(".filter-wrap")) setFilterOpen(false);
  const action = event.target.closest("[data-card-action]");
  if (action) {
    const id = action.dataset.assetId;
    if (action.dataset.cardAction === "details") openAssetDetails(id);
    if (action.dataset.cardAction === "favorite") toggleFavorite(id);
  }
}

function handleKeydown(event) {
  if (event.key === "/" && !isTypingTarget(event.target) && !elements.assetDialog.open && !elements.app.classList.contains("is-tool-view")) { event.preventDefault(); elements.search.focus(); }
  if (event.key === "Escape") { setFilterOpen(false); setSidebarOpen(false); if (elements.assetDialog.open) elements.assetDialog.close(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") { event.preventDefault(); setSidebarOpen(!state.sidebarOpen); }
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

async function loadAssets() {
  setLoadState("loading");
  try {
    const response = await fetch("data/assets.json", { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 404 ? "The collection file is missing. Add data/assets.json and try again." : `The collection returned HTTP ${response.status}.`);
    let raw;
    try { raw = await response.json(); } catch { throw new Error("The collection file is not valid JSON. Check data/assets.json and try again."); }
    if (!Array.isArray(raw)) throw new Error("The collection must be a JSON array. Check data/assets.json and try again.");
    const normalized = normalizeAssets(raw);
    state.assets = normalized.assets;
    if (normalized.invalidCount) console.warn(`Ghostly Gallery skipped ${normalized.invalidCount} invalid asset entr${normalized.invalidCount === 1 ? "y" : "ies"}.`);
    await verifyDownloadFiles(state.assets);
    setLoadState("ready");
    updateFilterOptions();
    syncFilterControls();
    renderGallery();
    if (state.openAssetId) { state.assetHistoryPushed = Boolean(history.state?.ghostly && history.state.asset === state.openAssetId); openAssetDetails(state.openAssetId, false); }
  } catch (error) {
    console.error("Ghostly Gallery could not load its collection:", error);
    state.assets = [];
    setLoadState("error", error instanceof Error ? error.message : "The collection could not be loaded.");
  }
}

function normalizeAssets(items) {
  const assets = [];
  const seen = new Set();
  let invalidCount = 0;
  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) { invalidCount += 1; return; }
    const category = normalizeCategory(item.category);
    const id = clean(item.id) || `${category || "asset"}-${index + 1}`;
    if (seen.has(id)) { invalidCount += 1; return; }
    seen.add(id);
    const file = safePath(item.file || item.download);
    const preview = safePath(item.preview);
    if ((item.file || item.download) && !file) invalidCount += 1;
    if (item.preview && !preview) invalidCount += 1;
    assets.push({
      id, title: clean(item.title) || "Untitled", description: clean(item.description), category: category || "uncategorized",
      type: clean(item.type), device: clean(item.device || item.type), resolution: clean(item.resolution), size: clean(item.size || item.fileSize),
      theme: clean(item.theme), colors: cleanArray(item.colors), tags: cleanArray(item.tags), file, preview,
      createdAt: clean(item.createdAt || item.dateAdded || item.addedAt), downloadAvailable: false
    });
  });
  return { assets, invalidCount };
}

function normalizeCategory(value) {
  const key = clean(value).toLocaleLowerCase().replace(/[_\s]+/g, "-");
  const aliases = {
    "wallpaper": "wallpapers", "desktop": "wallpapers", "desktop-wallpaper": "wallpapers", "desktop-wallpapers": "wallpapers", "pc-wallpapers": "wallpapers",
    "phone": "phone-wallpapers", "phone-wallpaper": "phone-wallpapers", "mobile-wallpapers": "phone-wallpapers", "phonewallpapers": "phone-wallpapers",
    "cursor": "cursors", "cursor-packs": "cursors", "icon": "icons", "icon-packs": "icons"
  };
  return aliases[key] || key;
}

function safePath(value) {
  const path = clean(value);
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.includes("?") || /^[a-z][a-z\d+.-]*:/i.test(path)) return "";
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return ""; }
  if (decoded.startsWith("/") || decoded.includes("\\") || decoded.split("/").some((part) => part === ".." || part === ".")) return "";
  return path;
}

async function verifyDownloadFiles(assets) {
  const verified = new Map();
  await Promise.all(assets.map(async (asset) => {
    if (!asset.file) return;
    if (verified.has(asset.file)) { asset.downloadAvailable = verified.get(asset.file); return; }
    const url = new URL(asset.file, document.baseURI);
    if (url.origin !== location.origin) { asset.downloadAvailable = false; return; }
    try {
      const response = await fetch(url.href, { method: "HEAD", cache: "no-store" });
      asset.downloadAvailable = response.ok;
      verified.set(asset.file, response.ok);
    } catch { asset.downloadAvailable = false; verified.set(asset.file, false); }
  }));
}

function setLoadState(next, message = "") {
  state.loadState = next;
  elements.loading.hidden = next !== "loading";
  elements.error.hidden = next !== "error";
  elements.grid.hidden = next !== "ready";
  elements.empty.hidden = true;
  elements.grid.setAttribute("aria-busy", String(next === "loading"));
  if (next === "error") { elements.errorMessage.textContent = message; elements.resultCount.textContent = "Collection unavailable"; }
  if (next === "loading") elements.resultCount.textContent = "Gathering the collection...";
}

function updateFilterOptions() {
  const fields = [
    ["device", elements.filterDevice, elements.filterDeviceWrap],
    ["theme", elements.filterTheme, elements.filterThemeWrap],
    ["color", elements.filterColor, elements.filterColorWrap]
  ];
  let available = false;
  for (const [kind, select, wrapper] of fields) {
    const values = unique(state.assets.flatMap((asset) => kind === "color" ? asset.colors : [asset[kind]]).filter(Boolean));
    wrapper.hidden = !values.length;
    values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).forEach((value) => select.append(new Option(value, value)));
    available ||= values.length > 0;
  }
  const hasTags = state.assets.some((asset) => asset.tags.length > 0);
  elements.filterTagWrap.hidden = !hasTags;
  available ||= hasTags;
  elements.filterEmpty.hidden = available;
  elements.filterFields.hidden = !available;
}

function renderGallery() {
  if (state.loadState !== "ready") return;
  const query = state.query.toLocaleLowerCase();
  const filtered = state.assets.filter((asset) => {
    if (state.view === "favorites" && !state.favorites.has(asset.id)) return false;
    if (CATEGORIES[state.view] && asset.category !== state.view) return false;
    if (query) {
      const searchable = [asset.title, asset.description, asset.category, asset.type, asset.device, asset.theme, asset.resolution, ...asset.colors, ...asset.tags].join(" ").toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
    }
    if (state.filters.device && asset.device !== state.filters.device) return false;
    if (state.filters.theme && asset.theme !== state.filters.theme) return false;
    if (state.filters.color && !asset.colors.some((color) => color.toLocaleLowerCase() === state.filters.color.toLocaleLowerCase())) return false;
    if (state.filters.tag && !asset.tags.some((tag) => tag.toLocaleLowerCase().includes(state.filters.tag.toLocaleLowerCase()))) return false;
    return true;
  });
  state.visibleAssets = sortAssets(filtered, state.sort);
  elements.grid.replaceChildren(...state.visibleAssets.map(createCard));
  const hasAssets = state.visibleAssets.length > 0;
  elements.grid.hidden = !hasAssets;
  elements.empty.hidden = hasAssets;
  updateCollectionHeading();
  const active = state.view !== "all" || state.query || hasActiveFilter();
  elements.emptyReset.hidden = !active;
  if (!state.assets.length) elements.emptyDescription.textContent = "The shelves are waiting for their first little oddity. Check back soon.";
  else if (state.view === "favorites" && !state.favorites.size) elements.emptyDescription.textContent = "Keep the things you love close. Favourite an asset and it will wait here for you.";
  else if (active) elements.emptyDescription.textContent = state.query || hasActiveFilter() ? "Nothing matches this little search. Try another word or clear your filters." : `There aren’t any ${viewLabel(state.view).toLocaleLowerCase()} here just yet.`;
  else elements.emptyDescription.textContent = "The shelves are waiting for their first little oddity. Check back soon.";
  elements.resultCount.textContent = `${state.visibleAssets.length} ${state.visibleAssets.length === 1 ? "asset" : "assets"}${state.view !== "all" ? ` · ${viewLabel(state.view)}` : ""}`;
  elements.favoriteCount.textContent = String(state.favorites.size);
  elements.favoriteCount.hidden = state.favorites.size === 0;
  renderFilterTokens();
}

function sortAssets(assets, sort) {
  const result = [...assets];
  if (sort === "title") return result.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  if (sort === "oldest") return result.sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt));
  return result.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
}
function dateValue(value) { const date = Date.parse(value); return Number.isFinite(date) ? date : 0; }
function viewLabel(view) { return view === "all" ? "All assets" : view === "favorites" ? "Favourites" : view === "converters" ? "Converters" : view === "background-remover" ? "Background Remover" : CATEGORIES[view]?.label || "Collection"; }
function updateCollectionHeading() {
  const active = viewLabel(state.view);
  elements.collectionTitle.textContent = state.view === "all" ? "A strange little library." : `${active}.`;
  elements.collectionKicker.textContent = state.view === "all" ? "THE COLLECTION" : state.view === "favorites" ? "KEPT CLOSE" : "THE COLLECTION / " + active.toLocaleUpperCase();
  elements.breadcrumb.textContent = state.view === "all" ? "The Gallery" : active;
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const selected = button.dataset.view === state.view;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  });
}
function createCard(asset, index) {
  const card = el("article", "asset-card");
  card.style.setProperty("--card-accent", CATEGORIES[asset.category]?.accent || "var(--accent)");
  card.style.animationDelay = `${Math.min(index * 45, 240)}ms`;
  const preview = el("div", `card-preview${asset.category === "phone-wallpapers" ? " is-portrait" : ""}`);
  const image = createPreview(asset);
  if (image) preview.append(image);
  preview.append(el("span", "card-category", categoryLabel(asset.category)));
  const body = el("div", "card-body");
  const titleLine = el("div", "card-title-line");
  titleLine.append(el("h3", "card-title", asset.title));
  const favorite = el("button", `card-favorite${state.favorites.has(asset.id) ? " is-favorite" : ""}`);
  favorite.type = "button";
  favorite.dataset.cardAction = "favorite";
  favorite.dataset.assetId = asset.id;
  favorite.setAttribute("aria-label", state.favorites.has(asset.id) ? `Remove ${asset.title} from favourites` : `Add ${asset.title} to favourites`);
  favorite.setAttribute("aria-pressed", String(state.favorites.has(asset.id)));
  favorite.innerHTML = heartIcon();
  titleLine.append(favorite);
  body.append(titleLine, el("p", "card-description", asset.description || "A new little oddity from the Ghostly shelves."));
  const meta = el("div", "card-meta");
  [asset.device, asset.resolution, asset.size].filter(Boolean).slice(0, 3).forEach((value) => meta.append(el("span", "meta-pill", value)));
  if (meta.childElementCount) body.append(meta);
  const footer = el("div", "card-footer");
  const tags = el("div", "card-tags");
  asset.tags.slice(0, 3).forEach((tag) => tags.append(el("span", "card-tag", `#${tag}`)));
  if (tags.childElementCount) footer.append(tags);
  const actions = el("div", "card-actions");
  const details = el("button", "card-action", "Details");
  details.type = "button"; details.dataset.cardAction = "details"; details.dataset.assetId = asset.id;
  details.setAttribute("aria-label", `View details for ${asset.title}`);
  details.innerHTML += '<span aria-hidden="true">↗</span>';
  actions.append(details, createDownload(asset));
  footer.append(actions);
  body.append(footer);
  card.append(preview, body);
  return card;
}

function createDownload(asset, extraClass = "") {
  if (!asset.file || !asset.downloadAvailable) {
    const disabled = el("button", `card-action card-download is-disabled ${extraClass}`.trim(), "Unavailable");
    disabled.type = "button";
    disabled.disabled = true;
    disabled.title = asset.file ? "This asset file is missing." : "A download has not been published for this asset.";
    disabled.setAttribute("aria-label", `Download unavailable for ${asset.title}`);
    return disabled;
  }
  const link = el("a", `card-action card-download ${extraClass}`.trim());
  link.href = asset.file;
  link.download = "";
  link.setAttribute("aria-label", `Download ${asset.title}`);
  link.addEventListener("click", () => playUiSound("download"));
  link.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m-3-3 3 3 3-3M3 12.5v1h10v-1"/></svg><span>Download</span>`;
  return link;
}

function createPreview(asset) {
  if (!asset.preview) return previewFallback();
  const image = el("img");
  image.src = asset.preview;
  image.alt = `Preview of ${asset.title}`;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.replaceWith(previewFallback()), { once: true });
  return image;
}

function previewFallback() {
  const fallback = el("div", "preview-fallback");
  fallback.setAttribute("aria-label", "Preview unavailable");
  fallback.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5.5" y="7" width="29" height="26" rx="6"/><circle cx="14" cy="15" r="2"/><path d="m7 28 8-8 5 5 4-4 9 9"/></svg>';
  return fallback;
}

function openAssetDetails(id, push = true) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) return;
  state.openAssetId = id;
  elements.assetContent.replaceChildren();
  const shell = el("div", "asset-detail-layout");
  shell.style.setProperty("--card-accent", CATEGORIES[asset.category]?.accent || "var(--accent)");
  const preview = el("div", "asset-detail-preview");
  const image = createPreview(asset);
  if (image) preview.append(image);
  const info = el("section", "asset-detail-info");
  const close = el("button", "dialog-close");
  close.type = "button"; close.setAttribute("aria-label", "Close details");
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  close.addEventListener("click", () => elements.assetDialog.close());
  info.append(close, el("p", "eyebrow", categoryLabel(asset.category).toUpperCase()));
  const title = el("h1", "", asset.title); title.id = "asset-dialog-title";
  info.append(title);
  if (asset.description) info.append(el("p", "", asset.description));
  const metadata = [["Device / type", asset.device || asset.type], ["Resolution", asset.resolution], ["File size", asset.size], ["Theme", asset.theme]].filter(([, value]) => value);
  if (metadata.length) {
    const list = el("dl", "detail-meta");
    metadata.forEach(([label, value]) => { const cell = el("div"); cell.append(el("dt", "", label), el("dd", "", value)); list.append(cell); });
    info.append(list);
  }
  if (asset.colors.length || asset.tags.length) {
    const tags = el("div", "detail-tags");
    asset.colors.forEach((color) => tags.append(el("span", "meta-pill", color)));
    asset.tags.forEach((tag) => tags.append(el("span", "meta-pill", `#${tag}`)));
    info.append(tags);
  }
  const download = createDownload(asset, "detail-download");
  if (download.classList.contains("is-disabled")) download.textContent = "Download unavailable";
  info.append(download);
  const favorite = el("button", `detail-favorite${state.favorites.has(asset.id) ? " is-favorite" : ""}`);
  favorite.type = "button"; favorite.dataset.cardAction = "favorite"; favorite.dataset.assetId = asset.id;
  favorite.setAttribute("aria-pressed", String(state.favorites.has(asset.id)));
  favorite.innerHTML = `${heartIcon()}<span>${state.favorites.has(asset.id) ? "Saved to favourites" : "Add to favourites"}</span>`;
  info.append(favorite);
  shell.append(preview, info);
  elements.assetContent.append(shell);
  if (!elements.assetDialog.open) elements.assetDialog.showModal();
  if (push) { writeUrl(true, id); state.assetHistoryPushed = true; }
}

function toggleFavorite(id) {
  const selected = state.favorites.has(id);
  if (selected) state.favorites.delete(id); else state.favorites.add(id);
  saveFavorites();
  renderGallery();
  if (state.openAssetId === id) openAssetDetails(id, false);
  playUiSound("favorite");
  showToast(selected ? "Kept close in your favourites." : "Removed from your favourites.");
}

function categoryLabel(category) { return CATEGORIES[category]?.label || category.replace(/-/g, " "); }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function cleanArray(value) { return Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }
function unique(values) { return [...new Set(values)]; }
function el(tag, className = "", text = "") { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
function heartIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.6Z"/></svg>'; }

function resetAllFilters() { state.view = "all"; state.query = ""; state.filters = { device: "", theme: "", color: "", tag: "" }; syncFilterControls(); renderGallery(); writeUrl(false); }

function setView(view, push = true) {
  if (view !== "all" && view !== "favorites" && view !== "converters" && view !== "background-remover" && !CATEGORIES[view]) return;
  const changed = state.view !== view;
  state.view = view;
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  const toolView = view === "converters" || view === "background-remover";
  syncViewPanels();
  if (!toolView) renderGallery();
  if (view === "converters" || view === "background-remover") setSidebarTab("tools");
  else if (view !== "all") setSidebarTab("gallery");
  if (state.mediaMobile.matches) setSidebarOpen(false);
  if (changed) playUiSound("navigation");
  if (!toolView) requestAnimationFrame(() => document.querySelector("#collection").scrollIntoView({ behavior: "smooth", block: "start" }));
  else document.querySelector(view === "converters" ? "#converters" : "#background-remover").scrollIntoView({ behavior: "smooth", block: "start" });
  if (push) writeUrl(true);
}

function clearSearch(focus = false) {
  elements.search.value = "";
  elements.searchClear.hidden = true;
  state.query = "";
  renderGallery();
  writeUrl(false);
  if (focus) elements.search.focus();
}

function clearFilters() {
  state.filters = { device: "", theme: "", color: "", tag: "" };
  syncFilterControls();
  renderGallery();
  writeUrl(false);
}

function hasActiveFilter() { return Object.values(state.filters).some(Boolean); }

function renderFilterTokens() {
  elements.activeFilters.replaceChildren();
  const tokens = [];
  if (state.query) tokens.push([`Search: ${state.query}`, () => clearSearch()]);
  for (const [key, value] of Object.entries(state.filters)) if (value) tokens.push([`${key[0].toUpperCase()}${key.slice(1)}: ${value}`, () => {
    state.filters[key] = ""; syncFilterControls(); renderGallery(); writeUrl(false);
  }]);
  tokens.forEach(([label, clear]) => {
    const token = el("span", "filter-token", label);
    const button = el("button", "", "×"); button.type = "button"; button.setAttribute("aria-label", `Remove ${label} filter`); button.addEventListener("click", clear); token.append(button); elements.activeFilters.append(token);
  });
  elements.filterDot.hidden = !hasActiveFilter();
}

function syncViewPanels() {
  const toolView = state.view === "converters" || state.view === "background-remover";
  const converters = state.view === "converters";
  elements.app.classList.toggle("is-tool-view", toolView);
  document.querySelector("#home").hidden = toolView;
  document.querySelector("#collection").hidden = toolView;
  document.querySelector("#converters").hidden = !converters;
  document.querySelector("#background-remover").hidden = state.view !== "background-remover";
  elements.breadcrumb.textContent = toolView ? viewLabel(state.view) : state.view === "all" ? "The Gallery" : viewLabel(state.view);
}

function syncFilterControls() {
  elements.filterDevice.value = state.filters.device;
  elements.filterTheme.value = state.filters.theme;
  elements.filterColor.value = state.filters.color;
  elements.filterTag.value = state.filters.tag;
  elements.search.value = state.query;
  elements.searchClear.hidden = !state.query;
  elements.sort.value = state.sort;
}

function setFilterOpen(open) {
  elements.filterPanel.hidden = !open;
  elements.filterToggle.setAttribute("aria-expanded", String(open));
  if (open) elements.filterClose.focus();
}

function setSidebarTab(tab) {
  if (!["gallery", "tools", "settings"].includes(tab)) return;
  state.sidebarTab = tab;
  document.querySelectorAll("[data-sidebar-tab]").forEach((button) => {
    const selected = button.dataset.sidebarTab === tab;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll("[data-sidebar-panel]").forEach((panel) => { panel.hidden = panel.dataset.sidebarPanel !== tab; });
}

function setSidebarOpen(open) {
  state.sidebarOpen = Boolean(open);
  elements.app.classList.toggle("is-sidebar-open", state.sidebarOpen);
  elements.scrim.hidden = !state.sidebarOpen;
  elements.sidebar.setAttribute("aria-hidden", String(!state.sidebarOpen));
  elements.menuButton.setAttribute("aria-expanded", String(state.sidebarOpen));
  elements.menuButton.setAttribute("aria-label", state.sidebarOpen ? "Close menu" : "Open menu");
  elements.menuButton.title = state.sidebarOpen ? "Close menu" : "Open menu";
  document.body.classList.toggle("sidebar-open", state.sidebarOpen);
  if (state.sidebarOpen) {
    const activeTab = document.querySelector(`[data-sidebar-tab="${state.sidebarTab}"]`);
    if (activeTab) activeTab.focus({ preventScroll: true });
  }
}

function syncSoundToggle() {
  const enabled = soundEffectsEnabled();
  const label = enabled ? "Mute button sounds" : "Enable button sounds";
  elements.soundToggle.setAttribute("aria-pressed", String(enabled));
  elements.soundToggle.setAttribute("aria-label", label);
  elements.soundToggle.title = label;
}

function readTheme() {
  try { const value = localStorage.getItem("ghostly.theme.v1"); if (value === "light" || value === "dark") return value; } catch { /* Use the branded dark default. */ }
  return "dark";
}
function applyTheme(theme, save = false) {
  const selected = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]').content = selected === "dark" ? "#08060f" : "#f7f5ff";
  elements.themeToggle.dataset.theme = selected;
  const label = selected === "dark" ? "Switch to light theme" : "Switch to dark theme";
  elements.themeToggle.setAttribute("aria-label", label);
  elements.themeToggle.title = label;
  if (save) {
    try { localStorage.setItem("ghostly.theme.v1", selected); } catch { showToast("Theme changed for this visit."); }
    playUiSound("theme");
  }
}


function makeClose(action) {
  const button = el("button", "dialog-close"); button.type = "button"; button.setAttribute("aria-label", "Close dialog");
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  button.addEventListener("click", action); return button;
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function writeUrl(push, assetId = null) {
  const url = new URL(location.href);
  if (state.view === "all") url.searchParams.delete("view"); else url.searchParams.set("view", state.view);
  if (state.query) url.searchParams.set("q", state.query); else url.searchParams.delete("q");
  if (state.sort !== "newest") url.searchParams.set("sort", state.sort); else url.searchParams.delete("sort");
  for (const [key, value] of Object.entries(state.filters)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
  if (assetId) url.searchParams.set("asset", assetId);
  else if (!state.openAssetId) url.searchParams.delete("asset");
  history[push ? "pushState" : "replaceState"]({ ghostly: true, asset: assetId || null }, "", url);
}

function readUrlState() {
  const params = new URL(location.href).searchParams;
  const rawView = params.get("view") || params.get("category") || "all";
  state.view = rawView === "all" || rawView === "favorites" || rawView === "converters" || rawView === "background-remover" || CATEGORIES[rawView] ? rawView : "all";
  state.query = params.get("q") || "";
  const sort = params.get("sort") || "newest";
  state.sort = ["newest", "oldest", "title"].includes(sort) ? sort : "newest";
  state.filters = { device: params.get("device") || "", theme: params.get("theme") || "", color: params.get("color") || "", tag: params.get("tag") || "" };
  state.openAssetId = params.get("asset");
  syncFilterControls();
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active); button.setAttribute("aria-current", active ? "page" : "false");
  });
  syncViewPanels();
}

function syncFromUrl() {
  readUrlState();
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (state.view === "converters" || state.view === "background-remover") setSidebarTab("tools");
  else setSidebarTab("gallery");
  renderGallery();
  if (state.openAssetId) { state.assetHistoryPushed = Boolean(history.state?.ghostly && history.state.asset === state.openAssetId); openAssetDetails(state.openAssetId, false); }
  else if (elements.assetDialog.open) { state.assetHistoryPushed = false; elements.assetDialog.close(); }
}


