# Ghostly Gallery

A static, metadata-driven public gallery for PC wallpapers, phone wallpapers, cursor packs, and icon packs. The site requires no build step, backend, or publisher. The MP4 converter fetches its optional FFmpeg/WASM engine from a CDN only when a user starts a conversion.

## Run locally

Serve this folder over HTTP so the browser can load the JSON collection and ES modules. From the project folder, run `py -m http.server 8000`, then visit `http://localhost:8000`. GitHub Pages can serve the same files from a repository subpath.

## Add assets

Add entries to `data/assets.json` and place their files in the matching folder under `assets/`. The collection starts empty intentionally. Example:

```json
{
  "id": "unique-asset-id",
  "title": "Asset title",
  "description": "A short description.",
  "category": "wallpapers",
  "type": "desktop",
  "resolution": "2560x1440",
  "fileSize": "2.4 MB",
  "colors": ["purple", "blue"],
  "tags": ["abstract", "night"],
  "preview": "assets/wallpapers/asset-preview.jpg",
  "download": "assets/wallpapers/asset.jpg",
  "createdAt": "2026-09-27"
}
```

The initial category values are `wallpapers`, `phone-wallpapers`, `cursors`, and `icons`. `file` or `download` points directly to the downloadable file; `preview` can point to a different image. The gallery checks local file paths and disables downloads for missing files. Optional metadata is hidden when absent.

## Guest favourites and image conversion

Favourites are saved in this browser only. The gallery has no account, login, signup, or publishing server.

The Converters section works locally in the browser. It accepts PNG, GIF, JPG/JPEG, and SVG files up to 25 MB and can export PNG, JPEG, or SVG. GIF conversion uses a still frame. JPEG fills transparent areas with white by default, with a background color picker. SVG input is checked for scripts, external links, and embedded active content before preview. SVG output embeds the converted raster image; it does not vectorize it.

Selected actions can play quiet, synthesized button sounds. They are created locally with the Web Audio API; no sound files or external services are loaded. Use Button sounds in the sidebar to mute or enable them.

## Additional tools

MP4 → MP3 is available from the Converters page. FFmpeg/WASM is loaded only after the user selects an MP4 and starts conversion. Its core files (about 31 MB) are fetched from jsDelivr on that first conversion; the video itself is processed in the browser and is not uploaded. The site must be served over HTTP or HTTPS for the worker to run.

The Background Remover page currently provides local file validation and preview only. No background-removal engine or model is included, so it does not claim to produce a transparent result or offer a fake download.
