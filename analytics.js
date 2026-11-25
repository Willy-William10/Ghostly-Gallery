const POSTHOG_PROJECT_KEY = "phc_uzHxsjwQzrovDkHkyD7uCb4mmUzzyTuLqn2kMNyNkoA6";
const POSTHOG_API_HOST = "https://us.i.posthog.com";
const SAFE_VIEWS = new Set(["all", "favorites", "background-remover", "recommended", "dashboard", "collections", "wallpapers", "phone-wallpapers", "cursors", "icons"]);

let initialized = false;
let lastPageKey = "";
let lastSearchSignature = "";
let activeSegmentStartedAt = document.visibilityState === "hidden" ? null : performance.now();
let activeSegmentMilliseconds = 0;
let durationSentForSegment = false;

function posthog() {
  if (window.__ghostlyPostHogFailed) return null;
  return window.posthog && typeof window.posthog.capture === "function" ? window.posthog : null;
}

function safePagePath(view = "all", assetId = "") {
  const params = new URLSearchParams();
  if (SAFE_VIEWS.has(view) && view !== "all") params.set("view", view);
  if (typeof assetId === "string" && /^[\w-]{1,128}$/.test(assetId)) params.set("asset", assetId);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}`;
}

function sanitizeEvent(event) {
  if (!event || !event.properties || typeof event.properties !== "object") return event;
  const sanitized = { ...event, properties: { ...event.properties } };
  const properties = sanitized.properties;
  for (const key of Object.keys(properties)) {
    if (/url|referrer|^\$search$/i.test(key)) delete properties[key];
  }
  const pagePath = typeof properties.page_path === "string" && properties.page_path.startsWith("/") ? properties.page_path : safePagePathFromLocation();
  properties.$current_url = `${location.origin}${pagePath}`;
  properties.$pathname = pagePath.split("?", 1)[0];
  return sanitized;
}

function safePagePathFromLocation() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view") || params.get("category") || "all";
  const assetId = params.get("asset") || "";
  return safePagePath(view, assetId);
}

function capture(eventName, properties = {}, options) {
  try {
    if (navigator.doNotTrack === "1" || navigator.msDoNotTrack === "1" || window.doNotTrack === "1") return;
    const sdk = posthog();
    if (!sdk) return;
    const cleanProperties = Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined && value !== null));
    sdk.capture(eventName, cleanProperties, options);
  } catch {
    // Analytics is optional; never interrupt gallery behavior.
  }
}

function initialize() {
  if (initialized || window.__ghostlyPostHogInitialized) return;
  initialized = true;
  window.__ghostlyPostHogInitialized = true;
  try {
    if (!window.posthog || typeof window.posthog.init !== "function") return;
    window.posthog.init(POSTHOG_PROJECT_KEY, {
      api_host: POSTHOG_API_HOST,
      defaults: "2026-08-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      respect_dnt: true,
      before_send: sanitizeEvent
    });
    document.querySelector('script[src*="/static/array.js"]')?.addEventListener("error", () => {
      window.__ghostlyPostHogFailed = true;
    }, { once: true });
  } catch {
    window.__ghostlyPostHogFailed = true;
  }
}

function trackPageview({ view = "all", assetId = "" } = {}) {
  const pagePath = safePagePath(view, assetId);
  if (pagePath === lastPageKey) return;
  lastPageKey = pagePath;
  capture("$pageview", {
    $current_url: `${location.origin}${pagePath}`,
    $pathname: location.pathname,
    page_path: pagePath,
    view: SAFE_VIEWS.has(view) ? view : "all"
  });
}

function assetProperties(asset) {
  if (!asset || typeof asset !== "object") return null;
  const assetId = typeof asset.id === "string" ? asset.id.slice(0, 128) : "";
  if (!assetId) return null;
  return {
    asset_id: assetId,
    asset_name: typeof asset.title === "string" ? asset.title.slice(0, 160) : undefined,
    asset_type: typeof (asset.type || asset.device) === "string" ? (asset.type || asset.device).slice(0, 80) : undefined,
    category: typeof asset.category === "string" ? asset.category.slice(0, 80) : undefined
  };
}

function trackDownload(asset) {
  const properties = assetProperties(asset);
  if (!properties) return;
  const file = typeof asset.file === "string" ? asset.file : "";
  const extension = file.match(/\.([a-z\d]{1,12})(?:[?#]|$)/i)?.[1];
  if (extension) properties.file_format = extension.toLowerCase();
  capture("download", properties);
}

function trackFavoriteAdded(asset) {
  const properties = assetProperties(asset);
  if (properties) capture("favorite_added", { asset_id: properties.asset_id, asset_type: properties.asset_type, category: properties.category });
}

function trackFavoriteRemoved(asset) {
  const properties = assetProperties(asset);
  if (properties) capture("favorite_removed", { asset_id: properties.asset_id, asset_type: properties.asset_type, category: properties.category });
}

function trackWallpaperViewed(asset) {
  const properties = assetProperties(asset);
  if (!properties || !["wallpapers", "phone-wallpapers"].includes(asset.category)) return;
  capture("wallpaper_viewed", {
    asset_id: properties.asset_id,
    asset_name: properties.asset_name,
    wallpaper_type: asset.category === "phone-wallpapers" ? "phone" : "desktop",
    category: properties.category,
    resolution: typeof asset.resolution === "string" ? asset.resolution.slice(0, 60) : undefined
  });
}

function trackSearch(query, resultsCount) {
  const queryText = typeof query === "string" ? query.trim() : "";
  const length = Math.max(0, Math.min(256, queryText.length));
  const count = Number.isFinite(Number(resultsCount)) ? Math.max(0, Number(resultsCount)) : undefined;
  let hash = 2166136261;
  for (let index = 0; index < queryText.length; index++) hash = Math.imul(hash ^ queryText.charCodeAt(index), 16777619);
  const signature = `${hash >>> 0}`;
  if (!length || signature === lastSearchSignature) return;
  lastSearchSignature = signature;
  capture("search_submitted", { query_length: length, results_count: count });
}

function resetSearchDeduplication() {
  lastSearchSignature = "";
}

function trackFilter(filterType, filterValue, category) {
  const allowedTypes = new Set(["category", "device", "theme", "color", "tag", "reset"]);
  if (!allowedTypes.has(filterType)) return;
  const properties = { filter_type: filterType };
  if (["category", "device", "theme", "color"].includes(filterType) && typeof filterValue === "string" && filterValue.length <= 80) properties.filter_value = filterValue;
  if (typeof category === "string" && category.length <= 80 && category) properties.category = category;
  capture("filter_used", properties);
}

function trackCollectionViewed(collection) {
  if (!collection || typeof collection !== "object") return;
  const id = collection.collectionId || collection.collection_id || collection.collection || collection.id;
  const name = collection.collection || collection.collectionName || collection.title || collection.package;
  if (typeof id !== "string" || !id || typeof name !== "string" || !name) return;
  capture("collection_viewed", { collection_id: id.slice(0, 128), collection_name: name.slice(0, 160) });
}

function flushVisitDuration() {
  if (activeSegmentStartedAt === null || durationSentForSegment) return;
  activeSegmentMilliseconds += Math.max(0, performance.now() - activeSegmentStartedAt);
  activeSegmentStartedAt = null;
  const durationSeconds = Math.round(activeSegmentMilliseconds / 1000);
  if (durationSeconds <= 0) return;
  durationSentForSegment = true;
  capture("visit_duration", { duration_seconds: durationSeconds, page_path: safePagePathFromLocation() }, { transport: "sendBeacon" });
}

function startForegroundSegment() {
  if (document.visibilityState === "hidden" || activeSegmentStartedAt !== null) return;
  activeSegmentMilliseconds = 0;
  durationSentForSegment = false;
  activeSegmentStartedAt = performance.now();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushVisitDuration();
  else startForegroundSegment();
});
window.addEventListener("pagehide", flushVisitDuration);
window.addEventListener("pageshow", startForegroundSegment);

initialize();

export const Analytics = Object.freeze({
  trackPageview,
  trackDownload,
  trackFavoriteAdded,
  trackFavoriteRemoved,
  trackWallpaperViewed,
  trackSearch,
  resetSearchDeduplication,
  trackFilter,
  trackCollectionViewed,
  getPublishedAssetCount: () => Number(document.documentElement.dataset.publishedAssetCount || 0)
});
