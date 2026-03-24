# DicomDrift

A lightweight, open-source, browser-based DICOM 3D/volume viewer for smoothly drifting through CT and MRI slices.

DicomDrift runs **entirely in your browser** — no server, no uploads, no accounts. Load your DICOM files, generate a 3D mesh, and explore it interactively.

## Features

- **Browser-only processing** — DICOM parsing, volume assembly, and mesh generation all happen client-side
- **3D mesh generation** — Marching cubes algorithm with configurable threshold, resolution, and smoothing
- **Interactive viewer** — Arcball rotation, pan, zoom with smooth inertia. Works on desktop and mobile
- **Multiple series support** — Automatically detects and lets you choose between DICOM series
- **Save & load** — Export processed models as `.dicomdrift` files for instant reload
- **STL export** — Export meshes for 3D printing
- **Screenshot capture** — Save the current 3D view as PNG
- **Clipping plane** — Slice through your mesh to inspect internal structures
- **Keyboard shortcuts** — Quick access to common actions
- **Multi-language** — English and German, with browser language auto-detection

## Privacy

**Your data never leaves your device.**

- All DICOM parsing and 3D mesh generation runs locally in your browser using Web Workers
- No data is uploaded to any server — there is no server
- No analytics, tracking, or telemetry
- Saved `.dicomdrift` files contain only mesh geometry — no patient names, IDs, or other DICOM metadata
- Patient-identifying DICOM tags are explicitly discarded during processing

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. **Load DICOM files** — Drag and drop a folder of DICOM files or use the folder picker
2. **Select series** — If multiple series are detected, choose the one you want to visualize
3. **Configure parameters** — Adjust ISO threshold, resolution, and smoothing (sensible defaults are provided)
4. **Explore** — Rotate, pan, and zoom the 3D model. Toggle layers, adjust opacity, use the clipping plane
5. **Save your work** — Export as `.dicomdrift` for later viewing, STL for 3D printing, or PNG for screenshots

## Tech Stack

- React + TypeScript + Vite
- Three.js for 3D rendering
- Web Workers for heavy computation
- Zustand for state management
- i18next for internationalization

## License

MIT — see [LICENSE](LICENSE) for details.
