# Ghostly Gallery

A static, metadata-driven public gallery for PC wallpapers, phone wallpapers, cursor packs, and icon packs. The site requires no build step, backend, runtime dependency, publisher, or third-party service.

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

## Profiles and favourites

Profiles, login IDs, theme preferences, and favourites are stored in this browser only. There is no account server, authentication service, or cross-device sync. A generated ID can sign into a profile saved in the same browser; it cannot restore a profile on a different device. Treat the ID as a local key, keep it private, and do not reuse it as a password elsewhere.

Selected actions can play quiet, synthesized button sounds. They are created locally with the Web Audio API; no sound files or external services are loaded. Turn them off in Settings.

The QR generator runs locally. QR camera scanning is offered only after choosing that option and requires a secure context (`https://` or `localhost`) plus browser support for `BarcodeDetector`; manual ID entry remains available when scanning is unsupported.
