import { playUiSound, setSoundEffectsEnabled, soundEffectsEnabled } from "./sounds.js";
import { initConverters, initBackgroundRemover } from "./converters.js";
import { THEMES, THEME_BY_ID, THEME_ALIASES } from "./themes.js";

const CATEGORIES = {
  wallpapers: { label: "Desktop", accent: "var(--wall)" },
  "phone-wallpapers": { label: "Phone", accent: "var(--phone)" },
  cursors: { label: "Cursors", accent: "var(--cursor)" },
  icons: { label: "Icons", accent: "var(--icons)" }
};
const elements = {
  app: document.querySelector("#app-shell"), sidebar: document.querySelector("#sidebar"), sidebarToggle: document.querySelector("#sidebar-collapse-button"), topbarMenu: document.querySelector("#topbar-menu-button"), scrim: document.querySelector("#sidebar-scrim"),
  search: document.querySelector("#search-input"), searchClear: document.querySelector("#search-clear"), sortTrigger: document.querySelector("#sort-trigger"), sortMenu: document.querySelector("#sort-menu"), sortCurrent: document.querySelector("#sort-current"),
  filterToggle: document.querySelector("#filter-toggle"), filterPanel: document.querySelector("#filter-panel"), filterClose: document.querySelector("#filter-close"),
  filterEmpty: document.querySelector("#filter-empty"), filterFields: document.querySelector("#filter-fields"), filterReset: document.querySelector("#filter-reset"),
  filterDevice: document.querySelector("#filter-device"), filterTheme: document.querySelector("#filter-theme"), filterColor: document.querySelector("#filter-color"), filterTag: document.querySelector("#filter-tag"),
  filterDeviceWrap: document.querySelector("#filter-device-wrap"), filterThemeWrap: document.querySelector("#filter-theme-wrap"), filterColorWrap: document.querySelector("#filter-color-wrap"), filterTagWrap: document.querySelector("#filter-tag-wrap"),
  filterDot: document.querySelector("#filter-active-dot"), activeFilters: document.querySelector("#active-filters"),
  grid: document.querySelector("#gallery-grid"), favoriteCount: document.querySelector("#favorite-count"), empty: document.querySelector("#empty-state"), emptyDescription: document.querySelector("#empty-description"), emptyReset: document.querySelector("#empty-reset"),
  error: document.querySelector("#error-state"), errorMessage: document.querySelector("#error-message"), retry: document.querySelector("#retry-button"), loading: document.querySelector("#loading-state"), resultCount: document.querySelector("#result-count"),
  collectionTitle: document.querySelector("#collection-title"), collectionKicker: document.querySelector("#collection-kicker"), breadcrumb: document.querySelector("#breadcrumb-title"),
  themeGrid: document.querySelector("#theme-grid"), themeSearch: document.querySelector("#theme-search"), settingsDialog: document.querySelector("#settings-dialog"), soundToggle: document.querySelector("#sound-toggle"), toast: document.querySelector("#toast"), assetDialog: document.querySelector("#asset-dialog"), assetContent: document.querySelector("#asset-dialog-content"),
  onboarding: document.querySelector("#onboarding-dialog"), onboardingForm: document.querySelector("#onboarding-form"), profileName: document.querySelector("#profile-name"), profileError: document.querySelector("#profile-error"),
  dashboard: document.querySelector("#dashboard"), welcomeStrip: document.querySelector("#welcome-strip")
};
const state = {
  assets: [], catalogAssets: [], visibleAssets: [], favorites: readFavorites(), view: "all", query: "", sort: "newest",
  filters: { device: "", theme: "", color: "", tag: "" }, loadState: "loading", openAssetId: null,
  searchTimer: null, toastTimer: null, sidebarOpen: false, sidebarCollapsed: readSidebarCollapsed(), toolPane: "background-remover", assetHistoryPushed: false, mediaMobile: matchMedia("(max-width: 820px)"),
  profile: readProfile(), activity: readActivity()
};

function readProfile() { try { const value = JSON.parse(localStorage.getItem("ghostly_user_profile_v1") || "null"); return value?.hasCompletedOnboarding ? value : null; } catch { return null; } }
function readActivity() { try { const value = JSON.parse(localStorage.getItem("ghostly.activity.v1") || "{}"); return { downloads: Math.max(0, Number(value.downloads) || 0), conversions: Math.max(0, Number(value.conversions) || 0), visits: value.visits && typeof value.visits === "object" ? value.visits : {} }; } catch { return { downloads: 0, conversions: 0, visits: {} }; } }
function saveActivity() {
  try { localStorage.setItem("ghostly.activity.v1", JSON.stringify(state.activity)); } catch { showToast("Activity is available for this visit only."); }
  if (state.profile) {
    state.profile.stats ||= {};
    Object.assign(state.profile.stats, { totalDownloads: state.activity.downloads, totalFavorites: state.favorites.size, totalConversions: state.activity.conversions, categoryVisits: { ...state.activity.visits } });
    try { localStorage.setItem("ghostly_user_profile_v1", JSON.stringify(state.profile)); } catch {}
  }
  updateDashboard();
}

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

applyTheme(readTheme());
bindEvents();
readUrlState();
setSidebarOpen(false);
if (state.profile) {
  showProfile();
  const params = new URL(location.href).searchParams;
  if (params.has("view") || params.has("category")) setView(state.view, false);
  else { setView("recommended", false); writeUrl(false); }
} else { elements.onboarding.showModal(); }
initBackgroundRemover();
initConverters();
renderThemeOptions();
renderSortOptions();
if (["background-remover", "dashboard", "collections"].includes(state.view) || CATEGORIES[state.view]) setView(state.view, false);
applySidebarLayout();
loadAssets();

function bindEvents() {
  elements.sidebarToggle.addEventListener("click", () => state.mediaMobile.matches ? setSidebarOpen(false) : toggleSidebar());
  elements.topbarMenu.addEventListener("click", () => setSidebarOpen(!state.sidebarOpen));
  elements.scrim.addEventListener("click", () => setSidebarOpen(false));
  document.querySelector("#settings-open").addEventListener("click", () => { if (state.mediaMobile.matches) setSidebarOpen(false); elements.settingsDialog.showModal(); playUiSound("open"); });
  document.querySelector("#settings-close").addEventListener("click", () => { elements.settingsDialog.close(); playUiSound("close"); });
  elements.settingsDialog.addEventListener("click", (event) => { if (event.target === elements.settingsDialog) { elements.settingsDialog.close(); playUiSound("close"); } });
  elements.themeGrid.addEventListener("click", (event) => { const option = event.target.closest("[data-theme-option]"); if (option) applyTheme(option.dataset.themeOption, true); });
  elements.themeSearch.addEventListener("focus", () => playUiSound("search"));
  elements.themeSearch.addEventListener("input", () => renderThemeOptions(elements.themeSearch.value));
  elements.themeGrid.addEventListener("keydown", (event) => {
    const options = [...elements.themeGrid.querySelectorAll("[data-theme-option]")];
    const index = options.indexOf(event.target.closest("[data-theme-option]"));
    if (index < 0) return;
    const columns = Math.max(1, getComputedStyle(elements.themeGrid).gridTemplateColumns.split(" ").length);
    const moves = { ArrowRight:1, ArrowLeft:-1, ArrowDown:columns, ArrowUp:-columns, Home:-index, End:options.length - 1 - index };
    if (!(event.key in moves)) return;
    event.preventDefault(); const next = Math.max(0, Math.min(options.length - 1, index + moves[event.key])); options[next].focus();
  });
  elements.sortTrigger.addEventListener("click", () => setSortOpen(elements.sortMenu.hidden));
  elements.sortMenu.addEventListener("click", (event) => { const option = event.target.closest("[data-sort-option]"); if (!option) return; state.sort = option.dataset.sortOption; playUiSound("sort"); renderSortOptions(); renderGallery(); writeUrl(false); setSortOpen(false); elements.sortTrigger.focus(); });
  document.querySelector('[data-action="open-converter"]').addEventListener("click", () => { state.toolPane = "converter"; syncViewPanels(); document.querySelector("#converter-title").scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.querySelector('[data-action="tools-home"]').addEventListener("click", () => { state.toolPane = "background-remover"; syncViewPanels(); document.querySelector("#bg-title").scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.querySelector('[data-action="open-image-converter"]').addEventListener("click", () => { setView("background-remover", true); state.toolPane = "converter"; syncViewPanels(); document.querySelector("#converter-title").scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.querySelector('[data-action="open-background-remover"]').addEventListener("click", () => { setView("background-remover", true); document.querySelector("#bg-title").scrollIntoView({ behavior: "smooth", block: "start" }); });
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view, true)));
  document.querySelectorAll('[data-action="all-assets"]').forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault(); setView("all", true); document.querySelector("#collection").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  elements.search.addEventListener("focus", () => playUiSound("search"));
  elements.search.addEventListener("input", () => {
    state.query = elements.search.value.trim();
    elements.searchClear.hidden = !state.query;
    renderGallery();
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => writeUrl(false), 180);
  });
  elements.searchClear.addEventListener("click", () => clearSearch(true));
  elements.filterToggle.addEventListener("click", () => setFilterOpen(elements.filterPanel.hidden));
  elements.filterClose.addEventListener("click", () => setFilterOpen(false));
  elements.filterReset.addEventListener("click", clearFilters);
  [elements.filterDevice, elements.filterTheme, elements.filterColor].forEach((select) => select.addEventListener("change", () => {
    playUiSound("filter");
    state.filters.device = elements.filterDevice.value;
    state.filters.theme = elements.filterTheme.value;
    state.filters.color = elements.filterColor.value;
    renderGallery(); writeUrl(false);
  }));
  elements.filterTag.addEventListener("change", () => playUiSound("filter"));
  elements.filterTag.addEventListener("input", () => { state.filters.tag = elements.filterTag.value.trim(); renderGallery(); writeUrl(false); });
  elements.retry.addEventListener("click", loadAssets);
  elements.emptyReset.addEventListener("click", () => { if (state.query || hasActiveFilter()) resetAllFilters(); else setView("all", true); });
  elements.soundToggle.addEventListener("click", () => {
    const enabled = !soundEffectsEnabled();
    setSoundEffectsEnabled(enabled);
    syncSoundToggle();
    if (enabled) playUiSound("toggle");
  });
  elements.onboardingForm.addEventListener("submit", saveProfileFromForm);
  document.addEventListener("ghostly:conversion-complete", () => { state.activity.conversions += 1; saveActivity(); playUiSound("success"); });
  document.querySelector("#edit-profile").addEventListener("click", () => openProfileEditor());
  document.querySelector("#reset-profile").addEventListener("click", resetLocalProfile);
  syncSoundToggle();
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("popstate", syncFromUrl);
  state.mediaMobile.addEventListener("change", () => { state.sidebarOpen = false; elements.app.classList.remove("is-sidebar-open"); elements.scrim.hidden = true; applySidebarLayout(); });
  elements.assetDialog.addEventListener("click", (event) => { if (event.target === elements.assetDialog) elements.assetDialog.close(); });
  elements.assetDialog.addEventListener("close", () => {
    playUiSound("close");
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
  if (!elements.sortMenu.hidden && !event.target.closest(".sort-wrap")) setSortOpen(false);
  const action = event.target.closest("[data-card-action]");
  if (action) {
    const id = action.dataset.assetId;
    if (action.dataset.cardAction === "details") openAssetDetails(id);
    if (action.dataset.cardAction === "favorite") toggleFavorite(id);
  }
}

function handleKeydown(event) {
  if (event.key === "/" && !isTypingTarget(event.target) && !elements.assetDialog.open && !elements.app.classList.contains("is-tool-view")) { event.preventDefault(); elements.search.focus(); }
  if (event.key === "Escape") { if (elements.onboarding.open) { event.preventDefault(); return; } setFilterOpen(false); if (!elements.sortMenu.hidden) { setSortOpen(false); elements.sortTrigger.focus(); } setSidebarOpen(false); if (elements.assetDialog.open) elements.assetDialog.close(); }
  if (!elements.sortMenu.hidden && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    const options = [...elements.sortMenu.querySelectorAll("[role=option]")];
    const index = options.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    event.preventDefault(); options[next]?.focus();
  }
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
    state.catalogAssets = normalized.assets;
    state.assets = [...state.catalogAssets];
    if (normalized.invalidCount) console.warn(`Ghostly Gallery skipped ${normalized.invalidCount} invalid asset entr${normalized.invalidCount === 1 ? "y" : "ies"}.`);
    await verifyDownloadFiles(state.assets);
    setLoadState("ready");
    updateFilterOptions();
    syncFilterControls();
    renderGallery();
    if (state.openAssetId) { state.assetHistoryPushed = Boolean(history.state?.ghostly && history.state.asset === state.openAssetId); openAssetDetails(state.openAssetId, false); }
  } catch (error) {
    console.error("Ghostly Gallery could not load its collection:", error);
    state.assets = []; state.catalogAssets = [];
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
      theme: clean(item.theme), aesthetic: clean(item.aesthetic), style: clean(item.style), colors: cleanArray(item.colors), tags: cleanArray(item.tags),
      collection: clean(item.collection || item.collectionName), collectionId: clean(item.collectionId), package: clean(item.package || item.packageName), packageId: clean(item.packageId), file, preview,
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
    if (asset.file.startsWith("blob:")) { asset.downloadAvailable = true; return; }
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
    while (select.options.length > 1) select.remove(1);
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
    if (state.view === "recommended" && recommendationScore(asset) <= 0) return false;
    if (state.view === "favorites" && !state.favorites.has(asset.id)) return false;
    if (state.view === "collections" && !isCollectionPackageAsset(asset)) return false;
    if (CATEGORIES[state.view] && asset.category !== state.view) return false;
    if (query) {
      const searchable = [asset.title, asset.description, asset.category, asset.type, asset.device, asset.theme, asset.aesthetic, asset.style, asset.resolution, ...asset.colors, ...asset.tags].join(" ").toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
    }
    if (state.filters.device && asset.device !== state.filters.device) return false;
    if (state.filters.theme && asset.theme !== state.filters.theme) return false;
    if (state.filters.color && !asset.colors.some((color) => color.toLocaleLowerCase() === state.filters.color.toLocaleLowerCase())) return false;
    if (state.filters.tag && !asset.tags.some((tag) => tag.toLocaleLowerCase().includes(state.filters.tag.toLocaleLowerCase()))) return false;
    return true;
  });
  state.visibleAssets = state.view === "recommended" ? filtered.sort((a, b) => recommendationScore(b) - recommendationScore(a) || dateValue(b.createdAt) - dateValue(a.createdAt)) : sortAssets(filtered, state.sort);
  elements.grid.replaceChildren(...state.visibleAssets.map(createCard));
  const hasAssets = state.visibleAssets.length > 0;
  elements.grid.hidden = !hasAssets;
  elements.empty.hidden = hasAssets;
  updateCollectionHeading();
  const hasCriteria = Boolean(state.query || hasActiveFilter());
  const isSpecificView = state.view !== "all";
  elements.emptyReset.hidden = !isSpecificView && !hasCriteria;
  elements.emptyReset.textContent = hasCriteria ? "Browse all assets ↗" : "Browse all assets ↗";
  if (!state.assets.length) elements.emptyDescription.textContent = "No published assets are available yet. Gallery admins publish new assets to the catalog.";
  else if (hasCriteria) elements.emptyDescription.textContent = "No published assets match your search or filters. Browse the full collection while the shelves grow.";
  else if (state.view === "favorites" && !state.favorites.size) elements.emptyDescription.textContent = "Keep the things you love close. Favourite an asset and it will wait here for you.";
  else if (state.view === "recommended") elements.emptyDescription.textContent = "No published assets match your selected interests yet. Browse the full collection while the shelves grow.";
  else if (state.view === "collections") elements.emptyDescription.textContent = "No published collections or packages are available yet. Gallery admins curate and publish them here.";
  else if (isSpecificView) elements.emptyDescription.textContent = `No published ${viewLabel(state.view).toLocaleLowerCase()} match this view yet. Browse the full collection while the shelves grow.`;
  else elements.emptyDescription.textContent = "The shelves are waiting for their first little oddity.";
  elements.resultCount.textContent = `${state.visibleAssets.length} ${state.visibleAssets.length === 1 ? "asset" : "assets"}${state.view !== "all" ? ` · ${viewLabel(state.view)}` : ""}`;
  elements.favoriteCount.textContent = String(state.favorites.size);
  elements.favoriteCount.hidden = state.favorites.size === 0;
  renderFilterTokens();
  updateDashboard();
}

function isCollectionPackageAsset(asset) {
  return Boolean(asset.collection || asset.collectionId || asset.package || asset.packageId);
}


function recommendationScore(asset) {
  if (!state.profile) return 0;
  const preferred = state.profile.preferredAssetTypes || [];
  const categoryKeys = { wallpapers: "desktop-wallpapers", "phone-wallpapers": "phone-wallpapers", cursors: "mouse-cursors", icons: "icon-packs" };
  let score = preferred.includes(categoryKeys[asset.category]) ? 3 : 0;
  const corpus = [asset.title, asset.description, asset.theme, asset.aesthetic, asset.style, asset.type, ...asset.tags].join(" ").toLowerCase();
  const terms = { minimalism: ["minimal", "simple", "clean"], cyberpunk: ["cyber", "neon", "tech"], "fantasy-rpg": ["fantasy", "magic", "rpg", "arcane"], "nordic-nature": ["nature", "nordic", "forest", "rain", "snow"], "pixel-art": ["pixel", "8-bit"], "studio-abstract": ["abstract", "studio"], monochrome: ["mono", "black", "white", "ink"], "isometric-3d": ["isometric", "3d"] };
  for (const interest of state.profile.interests || []) if ((terms[interest] || []).some((term) => corpus.includes(term))) score += 2;
  return score;
}

function sortAssets(assets, sort) {
  const result = [...assets];
  if (sort === "title") return result.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  if (sort === "title-desc") return result.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: "base" }));
  if (sort === "oldest") return result.sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt));
  return result.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
}
function dateValue(value) { const date = Date.parse(value); return Number.isFinite(date) ? date : 0; }
function viewLabel(view) { return view === "all" ? "All assets" : view === "favorites" ? "Favourites" : view === "background-remover" ? "Workshop" : view === "recommended" ? "For you" : view === "dashboard" ? "Activity" : view === "collections" || view === "packages" ? "Collections & packages" : CATEGORIES[view]?.label || "Collection"; }
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
  body.append(titleLine);
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
  link.addEventListener("click", () => {
    playUiSound("download");
    state.activity.downloads += 1;
    if (state.profile) state.profile.stats.totalDownloads = state.activity.downloads;
    saveActivity();
    try { if (state.profile) localStorage.setItem("ghostly_user_profile_v1", JSON.stringify(state.profile)); } catch {}
    link.classList.add("is-downloading");
    setTimeout(() => link.classList.remove("is-downloading"), 520);
  });
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
  if (!elements.assetDialog.open) { elements.assetDialog.showModal(); playUiSound("open"); }
  if (push) { writeUrl(true, id); state.assetHistoryPushed = true; }
}

function toggleFavorite(id) {
  const selected = state.favorites.has(id);
  if (selected) state.favorites.delete(id); else state.favorites.add(id);
  saveFavorites();
  renderGallery();
  if (state.profile) { state.profile.stats.totalFavorites = state.favorites.size; try { localStorage.setItem("ghostly_user_profile_v1", JSON.stringify(state.profile)); } catch {} }
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
  if (view === "packages") view = "collections";
  if (!( ["all", "favorites", "background-remover", "recommended", "dashboard", "collections"].includes(view) || CATEGORIES[view])) return;
  const changed = state.view !== view;
  state.view = view;
  if (changed) state.toolPane = "background-remover";
  if (changed && state.profile && CATEGORIES[view]) { state.activity.visits[view] = (Number(state.activity.visits[view]) || 0) + 1; saveActivity(); }
  elements.sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  syncViewPanels();
  if (["all", "favorites", "recommended", "collections", ...Object.keys(CATEGORIES)].includes(view)) renderGallery();
  if (state.mediaMobile.matches) setSidebarOpen(false);
  if (changed) {
    playUiSound("navigation");
    const panel = view === "dashboard" ? elements.dashboard : view === "background-remover" ? document.querySelector("#background-remover") : document.querySelector("#collection");
    panel.classList.remove("view-enter"); void panel.offsetWidth; panel.classList.add("view-enter");
    setTimeout(() => panel.classList.remove("view-enter"), 500);
  }
  if (["dashboard", "background-remover"].includes(view)) requestAnimationFrame(() => document.querySelector(view === "dashboard" ? "#dashboard" : "#background-remover").scrollIntoView({ behavior: "smooth", block: "start" }));
  else if (view !== "recommended") requestAnimationFrame(() => document.querySelector("#collection").scrollIntoView({ behavior: "smooth", block: "start" }));
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
  const toolView = state.view === "background-remover";
  const separateView = state.view === "dashboard";
  elements.app.classList.toggle("is-tool-view", toolView || state.view === "dashboard");
  document.querySelector("#home").hidden = state.view !== "all";
  elements.welcomeStrip.hidden = !state.profile || state.view === "dashboard" || toolView || separateView;
  document.querySelector("#collection").hidden = toolView || separateView;
  elements.dashboard.hidden = state.view !== "dashboard";
  document.querySelector("#background-remover").hidden = !toolView || state.toolPane === "converter";
  document.querySelector("#converters").hidden = !toolView || state.toolPane !== "converter";
  elements.breadcrumb.textContent = toolView || separateView ? viewLabel(state.view) : state.view === "all" ? "The Gallery" : viewLabel(state.view);
}

function syncFilterControls() {
  elements.filterDevice.value = state.filters.device;
  elements.filterTheme.value = state.filters.theme;
  elements.filterColor.value = state.filters.color;
  elements.filterTag.value = state.filters.tag;
  elements.search.value = state.query;
  elements.searchClear.hidden = !state.query;
  const selected = sortLabel(state.sort);
  if (elements.sortCurrent) elements.sortCurrent.textContent = selected;
}

function setFilterOpen(open) {
  if (open !== elements.filterPanel.hidden) return;
  elements.filterPanel.hidden = !open;
  elements.filterToggle.setAttribute("aria-expanded", String(open));
  playUiSound(open ? "open" : "close");
  if (open) elements.filterClose.focus();
}

function readSidebarCollapsed() { try { return localStorage.getItem("ghostly.sidebar.compact.v1") === "true"; } catch { return false; } }
function applySidebarLayout() {
  elements.app.classList.toggle("is-sidebar-collapsed", state.sidebarCollapsed && !state.mediaMobile.matches);
  elements.sidebar.setAttribute("aria-hidden", String(state.mediaMobile.matches && !state.sidebarOpen));
  const sidebarLabel = state.mediaMobile.matches ? "Close navigation" : (state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
  const mobileLabel = state.sidebarOpen ? "Close navigation" : "Open navigation";
  elements.sidebarToggle.setAttribute("aria-label", sidebarLabel); elements.sidebarToggle.setAttribute("aria-expanded", String(state.mediaMobile.matches ? state.sidebarOpen : !state.sidebarCollapsed)); elements.sidebarToggle.title = sidebarLabel;
  elements.topbarMenu.setAttribute("aria-label", mobileLabel); elements.topbarMenu.setAttribute("aria-expanded", String(state.sidebarOpen)); elements.topbarMenu.title = mobileLabel;
}
function toggleSidebar() {
  if (state.mediaMobile.matches) setSidebarOpen(!state.sidebarOpen);
  else {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    try { localStorage.setItem("ghostly.sidebar.compact.v1", String(state.sidebarCollapsed)); } catch {}
    applySidebarLayout();
  }
}
function setSidebarOpen(open) {
  state.sidebarOpen = Boolean(open);
  elements.app.classList.toggle("is-sidebar-open", state.sidebarOpen);
  elements.scrim.hidden = !state.sidebarOpen;
  document.body.classList.toggle("sidebar-open", state.mediaMobile.matches && state.sidebarOpen);
  applySidebarLayout();
  if (state.sidebarOpen) elements.sidebar.querySelector(".nav-item[data-view]")?.focus({ preventScroll: true });
}

function syncSoundToggle() {
  const enabled = soundEffectsEnabled();
  const label = enabled ? "Mute button sounds" : "Enable button sounds";
  elements.soundToggle.setAttribute("aria-pressed", String(enabled));
  elements.soundToggle.setAttribute("aria-label", label);
  elements.soundToggle.title = label;
  elements.soundToggle.querySelector(".sound-icon").innerHTML = enabled
    ? '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>';
}
function readTheme() {
  try {
    const profileTheme = JSON.parse(localStorage.getItem("ghostly_user_profile_v1") || "null")?.themePreference;
    const saved = localStorage.getItem("ghostly.theme.registry.v1") || localStorage.getItem("ghostly.theme.v1") || profileTheme;
    if (saved) { const migrated = THEME_ALIASES[saved] || saved; if (THEME_BY_ID.has(migrated)) return migrated; }
  } catch { /* Use the branded dark default. */ }
  return "ghostlight";
}
function applyTheme(themeId, save = false) {
  const selected = THEME_BY_ID.get(THEME_ALIASES[themeId] || themeId) || THEME_BY_ID.get("catppuccin-mocha");
  document.documentElement.dataset.theme = selected.id;
  document.documentElement.dataset.themeScheme = selected.colorScheme;
  document.documentElement.style.colorScheme = selected.colorScheme;
  for (const [token, value] of Object.entries(selected.tokens)) document.documentElement.style.setProperty(token, value);
  document.querySelector('meta[name="theme-color"]').content = selected.bg;
  elements.themeGrid?.querySelectorAll("[data-theme-option]").forEach((option) => {
    const active = option.dataset.themeOption === selected.id;
    option.setAttribute("aria-selected", String(active)); option.classList.toggle("is-selected", active);
  });
  if (save) {
    try { localStorage.setItem("ghostly.theme.registry.v1", selected.id); localStorage.removeItem("ghostly.theme.v1"); } catch { showToast("Theme changed for this visit."); }
    if (state.profile) { state.profile.themePreference = selected.id; try { localStorage.setItem("ghostly_user_profile_v1", JSON.stringify(state.profile)); } catch {} }
    playUiSound("theme");
  }
}

function renderThemeOptions(query = "") {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleThemes = THEMES.filter((theme) => !normalizedQuery || theme.name.toLocaleLowerCase().includes(normalizedQuery) || theme.id.includes(normalizedQuery));
  elements.themeGrid.replaceChildren(...visibleThemes.map((theme) => {
    const option = el("button", "theme-option"); option.type = "button"; option.dataset.themeOption = theme.id; option.setAttribute("role", "option"); option.setAttribute("aria-selected", String(document.documentElement.dataset.theme === theme.id)); option.classList.toggle("is-selected", document.documentElement.dataset.theme === theme.id); option.setAttribute("aria-label", theme.name); option.title = theme.name;
    option.style.setProperty("--theme-swatch-bg", theme.bg); option.style.setProperty("--theme-swatch-surface", theme.surface); option.style.setProperty("--theme-swatch-accent", theme.accent);
    option.innerHTML = '<span class="theme-swatch" aria-hidden="true"><i></i><b></b></span><span class="theme-option-copy"><span class="theme-name"></span><small class="theme-kind"></small></span><span class="theme-check" aria-hidden="true">✓</span>';
    option.querySelector(".theme-name").textContent = theme.name; option.querySelector(".theme-kind").textContent = theme.colorScheme === "light" ? "Light" : "Dark"; return option;
  }));
}
function sortLabel(sort) { return ({ newest:"Newest", oldest:"Oldest", title:"Name A–Z", "title-desc":"Name Z–A" })[sort] || "Newest"; }
function renderSortOptions() {
  if (!elements.sortMenu) return;
  const options = [["newest","Newest"],["oldest","Oldest"],["title","Name A–Z"],["title-desc","Name Z–A"]];
  elements.sortMenu.replaceChildren(...options.map(([value,label]) => { const button = el("button", "sort-option", label); button.type = "button"; button.dataset.sortOption = value; button.setAttribute("role", "option"); button.setAttribute("aria-selected", String(state.sort === value)); button.tabIndex = state.sort === value ? 0 : -1; return button; }));
  elements.sortCurrent.textContent = sortLabel(state.sort);
}
function setSortOpen(open) {
  if (open !== elements.sortMenu.hidden) return;
  elements.sortMenu.hidden = !open; elements.sortTrigger.setAttribute("aria-expanded", String(open));
  playUiSound(open ? "open" : "close");
  if (open) (elements.sortMenu.querySelector('[aria-selected="true"]') || elements.sortMenu.firstElementChild)?.focus();
}
function saveProfileFromForm(event) {
  event.preventDefault();
  const name = elements.profileName.value.trim();
  if (!/^[a-zA-Z0-9_\-\s]{2,32}$/.test(name)) { elements.profileError.textContent = "Use 2–32 letters, numbers, spaces, hyphens, or underscores."; elements.profileError.hidden = false; elements.profileName.focus(); return; }
  const form = new FormData(elements.onboardingForm);
  const now = Date.now();
  const previous = state.profile;
  state.profile = { id: previous?.id || crypto.randomUUID(), username: name, interests: form.getAll("interest"), preferredAssetTypes: form.getAll("assetType"), vibe: form.get("vibe"), avatarSeed: name.toLowerCase().replace(/\s+/g, "-"), stats: previous?.stats || { totalDownloads: state.activity.downloads, totalFavorites: state.favorites.size, totalConversions: state.activity.conversions, categoryVisits: {}, styleInteractions: {}, registeredTimestamp: now }, themePreference: document.documentElement.dataset.theme, hasCompletedOnboarding: true };
  state.profile.stats.totalFavorites = state.favorites.size;
  try { localStorage.setItem("ghostly_user_profile_v1", JSON.stringify(state.profile)); } catch { showToast("Profile is available for this visit only."); }
  showProfile();
  elements.onboarding.classList.add("is-closing");
  setTimeout(() => {
    elements.onboarding.classList.remove("is-closing");
    elements.onboarding.close();
    setView("recommended", true);
    showToast(`Welcome to your workspace, ${name}.`);
  }, 300);
}

function showProfile() {
  if (!state.profile) return;
  document.querySelector("#welcome-name").textContent = `Hello, ${state.profile.username}.`;
  const vibe = ({ calm: "Calm & Cozy", cyber: "High-Tech Cyber", arcane: "Arcane RPG", editorial: "Editorial Modern" })[state.profile.vibe] || "your own style";
  document.querySelector("#welcome-note").textContent = `${vibe} · Your preferences stay in this browser.`;
  elements.welcomeStrip.hidden = false;
  updateDashboard();
}

function openProfileEditor() {
  if (state.profile) {
    elements.profileName.value = state.profile.username;
    document.querySelectorAll('[name="interest"]').forEach((input) => { input.checked = state.profile.interests.includes(input.value); });
    document.querySelectorAll('[name="assetType"]').forEach((input) => { input.checked = state.profile.preferredAssetTypes.includes(input.value); });
    elements.onboardingForm.elements.vibe.value = state.profile.vibe;
    document.querySelector("#onboarding-title").textContent = "Your Ghostly preferences";
    elements.onboardingForm.querySelector(".onboarding-submit").innerHTML = 'Save preferences <span aria-hidden="true">↗</span>';
  } else {
    elements.onboardingForm.reset();
    document.querySelector("#onboarding-title").textContent = "Welcome to Ghostly Gallery";
    elements.onboardingForm.querySelector(".onboarding-submit").innerHTML = 'Enter Your Workspace <span aria-hidden="true">↗</span>';
  }
  elements.onboarding.showModal();
}

function updateDashboard() {
  if (!state.profile) return;
  document.querySelector("#stat-downloads").textContent = String(state.activity.downloads);
  document.querySelector("#stat-favorites").textContent = String(state.favorites.size);
  document.querySelector("#stat-conversions").textContent = String(state.activity.conversions);
  const top = Object.entries(state.activity.visits).sort((a, b) => b[1] - a[1])[0];
  document.querySelector("#stat-category").textContent = top ? viewLabel(top[0]) : "—";
  const tags = document.querySelector("#profile-tags");
  tags.replaceChildren(...(state.profile.interests || []).map((value) => el("span", "meta-pill", value.replace(/-/g, " "))));
}

function resetLocalProfile() {
  try { localStorage.removeItem("ghostly_user_profile_v1"); localStorage.removeItem("ghostly.activity.v1"); localStorage.removeItem("ghostly.favorites.guest.v1"); } catch {}
  state.profile = null; state.activity = { downloads: 0, conversions: 0, visits: {} }; state.favorites.clear();
  elements.profileName.value = "";
  document.querySelectorAll('[name="interest"], [name="assetType"]').forEach((input) => { input.checked = false; });
  document.querySelector("#onboarding-title").textContent = "Welcome to Ghostly Gallery";
  elements.onboardingForm.querySelector(".onboarding-submit").innerHTML = 'Enter Your Workspace <span aria-hidden="true">↗</span>';
  setView("all", false); elements.onboarding.showModal(); showToast("Local profile and activity cleared.");
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
  state.view = rawView === "converters" ? "all" : rawView === "packages" ? "collections" : (["all", "favorites", "background-remover", "recommended", "dashboard", "collections"].includes(rawView) || CATEGORIES[rawView] ? rawView : "all");
  state.toolPane = "background-remover";
  state.query = params.get("q") || "";
  const sort = params.get("sort") || "newest";
  state.sort = ["newest", "oldest", "title", "title-desc"].includes(sort) ? sort : "newest";
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
  renderGallery();
  if (state.openAssetId) { state.assetHistoryPushed = Boolean(history.state?.ghostly && history.state.asset === state.openAssetId); openAssetDetails(state.openAssetId, false); }
  else if (elements.assetDialog.open) { state.assetHistoryPushed = false; elements.assetDialog.close(); }
}



