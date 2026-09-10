# NER Landslide Early Warning & Community Monitoring Platform (PWA)

An AI-based landslide early warning and community monitoring platform engineered for pilot districts in the North Eastern Region (NER) of India (East Khasi Hills, Meghalaya). 

Built as a single responsive **Progressive Web App (PWA)** usable by district authorities (GIS & dashboard heavy) and citizens/field officials (offline-resilient hazard reporting).

---

## 🚀 Key Features

1. **AI-Powered Landslide Predictor**:
   - Interactive ML test bench running risk prediction models.
   - Sliders for 12 geological, topographical, and rainfall features (slope, aspect, elevation, 24h/72h/7d rain, ARI, soil moisture, curvature, drainage distance).
   - Instant visual gauge calculation and real-time risk classification.

2. **Intelligent AI Chat Assistant**:
   - Built-in AI chatbot capable of answering queries related to landslide safety, early warnings, emergency procedures, and platform usage.
   - Provides instant guidance on evacuation protocols and hazard mitigation based on historical and real-time data.

3. **Advanced Alert & Warning System**:
   - District authorities can forward critical warnings directly to citizens and field officials.
   - Integrated SMS gateway for instant mobile text alerts.
   - App-based siren triggers for immediate attention in high-risk zones.
   - DEOC network dispatch capabilities for coordinated response.

4. **Real-Time Data & GIS Dashboard**:
   - Interactive GIS map powered by Leaflet & CartoDB Dark Matter / OSM tiles.
   - Live spatial risk heatmap color-coded by severity (Critical, High, Medium, Low).
   - Real-time road connectivity overlay with authority status override (`clear`, `partial`, `blocked`).
   - Live incoming field reports stream with official **Verify** and **Dismiss** triage actions.

5. **Offline-Resilient Field Reporting (PWA)**:
   - Mobile-first report submission with auto-GPS coordinates detection.
   - **IndexedDB Queueing**: When offline or in low-network mountainous terrain, submissions are safely stored locally.
   - **Automatic Synchronization**: Background Sync API flushes queued batches when network connectivity returns.
   - Photo capture with instant preview and pre-configured landslide hazard observation tags.

6. **Public Community Bulletins**:
   - Fast, accessible emergency public alerts view requiring no login.
   - Local emergency disaster helpline directory (DEOC 1077, SDRF Meghalaya, State Police).
   - Landslide safety directives and evacuation guidelines cached for offline availability.

7. **Multilingual Support (i18n)**:
   - Powered by `react-i18next` with language persistence.
   - Supports **English**, **Khasi (Ka Ktien Khasi - Meghalaya)**, and **Assamese (অসমীয়া)**.

8. **Light & Pure-Black Dark Theme**:
   - Class-based theme system supporting both clean light mode and **true-black dark mode** (`#000000`, `#0a0a0a`).
   - Dark theme uses high-contrast neutral zinc borders and glowing status accents.

---

## 🛠️ Tech Stack

- **Framework**: React 18 + Vite 6
- **Styling**: Tailwind CSS (class-based dark mode, custom true-black palette)
- **Maps / GIS**: Leaflet.js & `react-leaflet` (CartoDB Dark Matter / Voyager tiles)
- **Charts**: Recharts (Responsive SVG area and trend charts)
- **State & Caching**: `@tanstack/react-query`
- **PWA & Service Worker**: `vite-plugin-pwa` (Workbox runtime tile & API caching)
- **Offline Storage**: IndexedDB via `idb`
- **i18n**: `i18next` & `react-i18next`
- **Icons**: Lucide React

---

## 📦 Setup & Installation

### Prerequisites
- Node.js (v18+ or v24)
- npm (v9+)

### Installation
```bash
# Clone or navigate to the repository
cd frontend

# Install dependencies
npm install
```

### Running Locally
```bash
# Start development server
npm run dev

# Or run from workspace root:
npm run dev
```
Open your browser and visit: `http://localhost:3000` (or the port indicated in the terminal).

### Building for Production
```bash
npm run build
npm run preview
```

---

## ⚙️ Environment Variables & API Toggle

Create or edit `.env` inside the `frontend/` directory:

```env
# Backend Base URL
VITE_API_URL=http://localhost:8000/api

# Mock Mode Toggle:
# Set to true to run against the built-in realistic mock data engine
# Set to false to transmit requests directly to the live backend server
VITE_USE_MOCKS=true
```

---

## 🔐 Official Authority Credentials (Demo)

Click **Official Login** in the top navigation bar to authenticate as a district official:
- **District Admin**: `official_shillong` / `meghalaya2026`
- **SDRF Commander**: `sdrf_lead_sohra` / `rescue2026`
*(Quick-fill buttons are provided on the login page for demo convenience)*
