const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/gif", "image/jpeg", "image/svg+xml"]);

export function initConverters() {
  initMp4Converter();
  const fileInput = document.querySelector("#converter-file");
  const workspace = document.querySelector("#converter-workspace");
  const preview = document.querySelector("#converter-preview");
  const sourceLabel = document.querySelector("#converter-source-label");
  const filename = document.querySelector("#converter-filename");
  const message = document.querySelector("#converter-message");
  const format = document.querySelector("#converter-format");
  const jpegWrap = document.querySelector("#jpeg-background-field");
  const jpegBackground = document.querySelector("#jpeg-background");
  const convertButton = document.querySelector("#converter-button");
  const download = document.querySelector("#converter-download");
  const reset = document.querySelector("#converter-reset");
  const drop = document.querySelector("#converter-drop");
  let source = null;
  let outputUrl = "";
  let serial = 0;

  function setMessage(text, kind = "") {
    message.textContent = text;
    message.classList.toggle("is-error", kind === "error");
  }
  function clearOutput() {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = "";
    download.hidden = true;
    download.removeAttribute("href");
  }
  function showJpegBackground() { jpegWrap.hidden = format.value !== "jpeg"; }
  format.addEventListener("change", () => { showJpegBackground(); clearOutput(); });
  jpegBackground.addEventListener("input", clearOutput);

  async function acceptFile(file) {
    const id = ++serial;
    source = null;
    clearOutput();
    convertButton.disabled = true;
    if (!file) return;
    workspace.hidden = false;
    filename.textContent = file.name;
    sourceLabel.textContent = "Loading preview…";
    preview.removeAttribute("src");
    setMessage("");
    const extension = file.name.split(".").pop().toLowerCase();
    const mime = file.type.toLowerCase();
    const type = extension === "svg" || mime === "image/svg+xml" ? "image/svg+xml" : ["jpg", "jpeg"].includes(extension) || mime === "image/jpeg" ? "image/jpeg" : extension === "gif" || mime === "image/gif" ? "image/gif" : extension === "png" || mime === "image/png" ? "image/png" : "";
    if (!type || (!ALLOWED.has(type))) return fail("Choose a PNG, GIF, JPG, JPEG, or SVG image.");
    if (file.size > MAX_FILE_BYTES) return fail("This image is larger than 25 MB. Choose a smaller file.");

    try {
      const safeBlob = type === "image/svg+xml" ? await sanitizeSvg(file) : file;
      const bitmap = await createImageBitmap(safeBlob);
      if (id !== serial) { bitmap.close(); return; }
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 100_000_000) { bitmap.close(); return fail("This image has unsupported or unusually large dimensions."); }
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0);
      bitmap.close();
      source = { file, type, width: canvas.width, height: canvas.height, canvas };
      preview.src = canvas.toDataURL("image/png");
      sourceLabel.textContent = `${canvas.width} × ${canvas.height} · ${formatName(type)}`;
      convertButton.disabled = false;
      setMessage(type === "image/gif" ? "GIF conversions use the first still frame supported by this browser." : type === "image/svg+xml" ? "Safe, self-contained SVG preview is ready." : "Ready to convert. Your image stays on this device.");
      if (format.value === type.replace("image/", "")) format.value = type === "image/jpeg" ? "png" : "png";
      showJpegBackground();
    } catch (error) {
      fail(error instanceof Error && error.message.startsWith("SVG_") ? svgError(error.message) : "This file could not be previewed as an image.");
    }
  }

  function fail(text) {
    source = null;
    convertButton.disabled = true;
    sourceLabel.textContent = "Preview unavailable";
    setMessage(text, "error");
  }

  convertButton.addEventListener("click", () => {
    if (!source) return;
    clearOutput();
    try {
      let blob;
      const formatValue = format.value;
      if (formatValue === "svg") {
        const png = source.canvas.toDataURL("image/png");
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height}" viewBox="0 0 ${source.width} ${source.height}"><image width="${source.width}" height="${source.height}" href="${png}"/></svg>`;
        blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = source.width; canvas.height = source.height;
        const context = canvas.getContext("2d", { alpha: formatValue !== "jpeg" });
        if (formatValue === "jpeg") { context.fillStyle = jpegBackground.value || "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); }
        context.drawImage(source.canvas, 0, 0);
        const mime = formatValue === "jpeg" ? "image/jpeg" : "image/png";
        const dataUrl = canvas.toDataURL(mime, formatValue === "jpeg" ? 0.92 : undefined);
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        blob = new Blob([bytes], { type: mime });
      }
      outputUrl = URL.createObjectURL(blob);
      const base = source.file.name.replace(/\.[^.]+$/, "") || "ghostly-image";
      const extension = formatValue === "jpeg" ? "jpg" : formatValue;
      download.href = outputUrl;
      download.download = `${base}-converted.${extension}`;
      download.textContent = `Download ${extension.toUpperCase()} image`;
      download.hidden = false;
      setMessage(`Converted successfully · ${source.width} × ${source.height} · ${formatValue.toUpperCase()}`);
    } catch {
      setMessage("Conversion failed in this browser. Try another image format.", "error");
    }
  });

  fileInput.addEventListener("change", () => acceptFile(fileInput.files?.[0]));
  reset.addEventListener("click", () => {
    serial += 1; source = null; fileInput.value = ""; workspace.hidden = true; preview.removeAttribute("src");
    convertButton.disabled = true; clearOutput(); setMessage(""); fileInput.focus();
  });
  for (const eventName of ["dragenter", "dragover"]) drop.addEventListener(eventName, (event) => { event.preventDefault(); drop.classList.add("is-dragging"); });
  for (const eventName of ["dragleave", "drop"]) drop.addEventListener(eventName, (event) => { event.preventDefault(); drop.classList.remove("is-dragging"); });
  drop.addEventListener("drop", (event) => acceptFile(event.dataTransfer?.files?.[0]));
  window.addEventListener("pagehide", () => { if (outputUrl) URL.revokeObjectURL(outputUrl); });

  function formatName(type) { return ({ "image/png": "PNG", "image/gif": "GIF", "image/jpeg": "JPEG", "image/svg+xml": "SVG" })[type]; }
}

async function sanitizeSvg(file) {
  const raw = await file.text();
  if (raw.length > 5 * 1024 * 1024) throw new Error("SVG_SIZE");
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.localName !== "svg" || doc.querySelector("parsererror")) throw new Error("SVG_INVALID");
  const forbidden = new Set(["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "canvas", "style"]);
  for (const node of [...svg.querySelectorAll("*")]) {
    if (forbidden.has(node.localName)) throw new Error("SVG_ACTIVE");
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || name === "style" || /url\s*\(/i.test(value)) throw new Error("SVG_ACTIVE");
      if ((name === "href" || name === "xlink:href") && value && !value.startsWith("#")) throw new Error("SVG_EXTERNAL");
    }
  }
  for (const attribute of [...svg.attributes]) {
    const name = attribute.name.toLowerCase(), value = attribute.value.trim();
    if (name.startsWith("on") || name === "style" || /url\s*\(/i.test(value)) throw new Error("SVG_ACTIVE");
  }
  const cleanSvg = new XMLSerializer().serializeToString(svg);
  return new Blob([cleanSvg], { type: "image/svg+xml" });
}

function svgError(code) {
  if (code === "SVG_INVALID") return "This SVG is malformed or does not have an <svg> root.";
  if (code === "SVG_EXTERNAL") return "SVGs that load linked external files cannot be previewed here.";
  if (code === "SVG_ACTIVE") return "This SVG contains active or embedded content and was blocked for safety.";
  if (code === "SVG_SIZE") return "This SVG is larger than 5 MB. Choose a smaller SVG file.";
  return "This SVG could not be safely previewed.";
}
const FFMPEG_CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
let ffmpegEngine = null;
let ffmpegLoadPromise = null;
let ffmpegCoreUrls = [];

function initMp4Converter() {
  const input = document.querySelector("#mp4-file");
  const name = document.querySelector("#mp4-file-name");
  const convert = document.querySelector("#mp4-convert");
  const download = document.querySelector("#mp3-download");
  const status = document.querySelector("#mp4-status");
  let source = null;
  let outputUrl = "";

  function clearOutput() {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = ""; download.hidden = true; download.removeAttribute("href");
  }
  input.addEventListener("change", () => {
    source = input.files?.[0] || null;
    clearOutput();
    if (!source) { name.textContent = "MP4 only · up to 200 MB"; convert.disabled = true; return; }
    const valid = /\.mp4$/i.test(source.name) && (!source.type || source.type === "video/mp4");
    if (!valid) { source = null; name.textContent = "Choose an MP4 video"; convert.disabled = true; status.textContent = "Please select a supported MP4 video."; status.classList.add("is-error"); return; }
    if (!source.size || source.size > 200 * 1024 * 1024) { source = null; name.textContent = "Choose an MP4 up to 200 MB"; convert.disabled = true; status.textContent = "This video is empty or larger than 200 MB. Choose a smaller MP4."; status.classList.add("is-error"); return; }
    name.textContent = `${source.name} · ${formatBytes(source.size)}`;
    convert.disabled = false; status.classList.remove("is-error"); status.textContent = "Ready. The video will be processed locally; the first conversion downloads the audio engine on demand.";
  });

  convert.addEventListener("click", async () => {
    if (!source) return;
    convert.disabled = true; input.disabled = true; clearOutput(); status.classList.remove("is-error");
    status.classList.add("is-processing"); status.textContent = "Loading the audio engine (about 31 MB) and preparing the local conversion…";
    try {
      const ffmpeg = await loadFfmpeg();
      const inputName = "ghostly-source.mp4", outputName = "ghostly-audio.mp3";
      await ffmpeg.writeFile(inputName, new Uint8Array(await source.arrayBuffer()));
      status.textContent = "Converting audio in your browser. Larger videos can take a while.";
      await ffmpeg.exec(["-nostdin", "-y", "-i", inputName, "-vn", "-map", "0:a:0", "-codec:a", "libmp3lame", "-q:a", "2", outputName]);
      const output = await ffmpeg.readFile(outputName);
      outputUrl = URL.createObjectURL(new Blob([output], { type: "audio/mpeg" }));
      download.href = outputUrl;
      download.download = `${source.name.replace(/\.mp4$/i, "") || "ghostly-audio"}.mp3`;
      download.hidden = false;
      status.classList.remove("is-processing"); status.textContent = `Converted successfully · ${formatBytes(output.byteLength)} MP3. Download it below.`;
      try { await ffmpeg.deleteFile(inputName); await ffmpeg.deleteFile(outputName); } catch { /* The download is already ready. */ }
    } catch (error) {
      status.classList.remove("is-processing"); status.classList.add("is-error");
      const detail = String(error?.message || error);
      status.textContent = /audio|stream|map/i.test(detail) ? "Conversion failed. Check that this MP4 contains an audio track and try another file." : "The audio engine could not load or convert this file. Check your connection and try again.";
      try { if (ffmpegEngine?.loaded) await ffmpegEngine.deleteFile("ghostly-source.mp4"); } catch { /* Keep the conversion error visible. */ }
    } finally {
      input.disabled = false; convert.disabled = !source;
    }
  });
  window.addEventListener("pagehide", clearOutput);
}

async function loadFfmpeg() {
  if (ffmpegEngine?.loaded) return ffmpegEngine;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  ffmpegLoadPromise = (async () => {
    const { FFmpeg } = await import("./assets/vendor/ffmpeg/index.js");
    const ffmpeg = new FFmpeg();
    ffmpegEngine = ffmpeg;
    const [coreURL, wasmURL] = await Promise.all([
      fetchAsBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      fetchAsBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm")
    ]);
    ffmpegCoreUrls = [coreURL, wasmURL];
    const classWorkerURL = new URL("./assets/vendor/ffmpeg/worker.js", import.meta.url).href;
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
    return ffmpeg;
  })().catch((error) => {
    ffmpegLoadPromise = null; ffmpegEngine = null;
    throw error;
  });
  return ffmpegLoadPromise;
}

async function fetchAsBlobURL(url, mimeType) {
  const response = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`Engine download failed (${response.status}).`);
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: mimeType }));
}

function formatBytes(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function initBackgroundRemover() {
  const input = document.querySelector("#bg-file");
  const workspace = document.querySelector("#bg-workspace");
  const preview = document.querySelector("#bg-preview");
  const filename = document.querySelector("#bg-filename");
  const meta = document.querySelector("#bg-file-meta");
  const reset = document.querySelector("#bg-reset");
  const drop = document.querySelector("#bg-drop");
  let previewUrl = "";
  let requestId = 0;

  async function selectFile(file) {
    const id = ++requestId;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = ""; preview.removeAttribute("src");
    if (!file) { workspace.hidden = true; return; }
    workspace.hidden = false;
    filename.textContent = file.name;
    meta.textContent = "Checking image…";
    const supported = /\.(png|jpe?g|webp)$/i.test(file.name) && (!file.type || ["image/png", "image/jpeg", "image/webp"].includes(file.type));
    if (!supported || !file.size || file.size > 20 * 1024 * 1024) {
      meta.textContent = !supported ? "Please choose a PNG, JPG, or WebP image." : "This image is empty or larger than 20 MB.";
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      if (id !== requestId) { bitmap.close(); return; }
      const dimensions = `${bitmap.width} × ${bitmap.height}`; bitmap.close();
      previewUrl = URL.createObjectURL(file); preview.src = previewUrl;
      meta.textContent = `${dimensions} · ${formatBytes(file.size)} · local preview only`;
    } catch { meta.textContent = "This file could not be opened as an image."; }
  }

  input.addEventListener("change", () => selectFile(input.files?.[0]));
  for (const type of ["dragenter", "dragover"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add("is-dragging"); });
  for (const type of ["dragleave", "drop"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove("is-dragging"); });
  drop.addEventListener("drop", (event) => selectFile(event.dataTransfer?.files?.[0]));
  reset.addEventListener("click", () => { requestId += 1; input.value = ""; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ""; preview.removeAttribute("src"); workspace.hidden = true; });
  window.addEventListener("pagehide", () => { if (previewUrl) URL.revokeObjectURL(previewUrl); for (const url of ffmpegCoreUrls) URL.revokeObjectURL(url); });
}
