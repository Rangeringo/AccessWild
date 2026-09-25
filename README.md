# AccessWild 🌲♿
**Inclusive, Crowdsourced Nature & Recreation Mapping**

AccessWild is an accessible web application and Progressive Web App (PWA) designed to help individuals with disabilities, seniors, and outdoor enthusiasts locate, map, and document accessible recreation sites, ADA-compliant restrooms, level trails, and accessible parking across public and private lands.

**Live Application:** [https://rangeringo.github.io/AccessWild/](https://rangeringo.github.io/AccessWild/)

---

## 🌟 Current Features

- **Inclusive & Accessible Interface:**
  - Designed for high contrast, large touch targets (minimum 48px), screen reader announcements (`aria-live`), and keyboard navigation.
  - One-click **High Contrast Mode** toggle for visual impairments.
  - Multi-tier facility types: *Accessible Restroom*, *Highway Rest Stop / Gas Station*, *Level Trail*, *Accessible Parking*, *Accessible Viewpoint / Overlook*, and *Accessible Business*.
- **Interactive Multi-Layer Map (Leaflet):**
  - **🗺️ Streets:** Standard OpenStreetMap.
  - **🛰️ Satellite:** Esri High-Resolution World Imagery.
  - **⛰️ Topo & Trails:** OpenTopoMap contour and trail networks.
  - **🏷️ Place & Trail Labels:** Esri boundary and trail marker overlay.
  - **🎯 Locate Me:** Google Maps-style pulsing blue GPS dot with real-time accuracy circle.
  - **Touch & Desktop Gesture Handling:** Prevents page hijacking; uses `Ctrl + Scroll` on desktop and two-finger gestures on mobile.
- **Backcountry Offline Resilience (PWA):**
  - **Progressive Web App:** Installable on iOS (Add to Home Screen) and Android/Desktop without app store barriers.
  - **Service Worker Cache:** Pre-caches app shell, styles, icons, Leaflet, and Firebase SDK for dead-zone launches.
  - **Runtime Map Tile Storage:** Caches viewed map regions for offline backcountry navigation.
  - **Offline Submissions & Edits:** Powered by Firestore IndexedDB persistence. Users can add or edit pins while offline; changes queue locally and automatically sync to the live database when cell service returns.
- **Smart Reverse Geocoding & Landmark Detection:**
  - Integrates OpenStreetMap Nominatim to auto-suggest respectful location names based on nearby parks, trails, and landmarks.
  - Integrated profanity and inappropriate content filter.
- **Community Moderation & Admin Control:**
  - **🛡️ Admin Mode:** Passcode-protected administrative override (`accesswild2026`). Only administrators can delete or veto points from the map.
  - **⭐ Verification:** Admins can designate locations as `✓ Verified Accessible`.
  - **🚩 Community Reporting:** Users can flag suspicious or inaccurate points for moderation review (`⚠️ Reported by community`).
  - **↩ 15-Second Grace Undo:** Immediate grace period allowing creators to undo accidental submissions before they solidify.

---

## 🗺️ Future Roadmap & Planned Features

This section tracks planned enhancements and long-term milestones for future releases:

### 1. 📱 Native Mobile & Tablet Applications
- [ ] Build native iOS and Android apps (via Flutter or React Native) for mobile and rugged tablet use.
- [ ] Support offline vector map packs and offline topographic elevation downloads.
- [ ] Integration with external Bluetooth GPS receivers for precise backcountry trail mapping.

### 2. 👤 User Authentication & Profiles
- [ ] Implement optional user authentication (Google Sign-In, Apple ID, Email).
- [ ] User profiles displaying contributions, verified submissions, and community reputation badges.
- [ ] Custom user saved lists (e.g., "My Favorite Accessible Trails").

### 3. 💬 Community Comments & Condition Reports
- [ ] Add comment threads on location pins for real-time condition updates (e.g., seasonal closures, muddy trails, broken latch/ramp).
- [ ] Moderation queue with automated spam filters and optional admin pre-approval for public comments.
- [ ] Upvoting / helpfulness ratings on community notes.

### 4. 📸 Photo Verification & Visual Audits
- [ ] Enable crowdsourced photo uploads for each pin.
- [ ] Visual documentation categories: entrance ramps, doorway width, grab bar placement, trail tread surface, and parking signage.
- [ ] Image blur/moderation screening to keep photos helpful and respectful.

### 5. 🏛️ Public Lands Agency Collaboration (USFS, BLM & State Parks)
- [ ] Automated reporting dashboards and data exports tailored for land management agencies.
- [ ] Tracking capital replacement lifecycles: highlighting older non-accessible vault restrooms that need ADA modernization.
- [ ] Formal advocacy partnerships with outdoor accessibility organizations and park liaisons.

### 6. 🏪 Private & Commercial Recreation Corridor Directory
- [ ] Expand verified listings for rural gas stations, rest stops, diners, and outfitters along major scenic byways.
- [ ] Partner with accessible local businesses to showcase accessible amenities.

### 7. 🗄️ Database Architecture & Nationwide Scaling
- [ ] Monitor Cloud Firestore capacity as the dataset expands across all 50 states.
- [ ] Create automated pipelines to export or synchronize Firestore collections into an enterprise spatial SQL database (PostgreSQL with PostGIS) for complex geospatial polygon queries, distance-matrix calculations, and GIS desktop exports (Shapefile / QGIS).

### 8. 🔍 Advanced Search & Accessibility Filters
- [ ] Filter points by specific accommodation needs:
  - Paved asphalt vs. compacted crushed stone vs. boardwalk.
  - Maximum slope/grade percentage (e.g., under 5% or 8%).
  - Restroom stall door swing (inward vs. outward) and companion/unisex facilities.
  - Accessible parking van-accessible space availability.
- [ ] Proximity search: "Show accessible spots within 25 miles of current location".

### 9. 📈 Elevation Profiles & Trail Slope Visualization
- [ ] Generate interactive elevation profile charts for trails.
- [ ] Highlight steep grade warnings, cross-slope challenges, and barrier obstacles (steps, roots, gates) for wheelchair and mobility device users.

---

## 🛠️ Technology Stack

- **Frontend:** Vanilla HTML5, CSS3 (CSS Variables, Flexbox/Grid, High-Contrast Media), ES6 JavaScript Modules.
- **Mapping:** [Leaflet.js 1.9.4](https://leafletjs.com/), OpenStreetMap, Esri World Imagery & Labels, OpenTopoMap.
- **Geocoding:** OpenStreetMap Nominatim Reverse Geocoding API.
- **Database & Sync:** [Google Cloud Firestore](https://firebase.google.com/docs/firestore) (Nam5 Multi-Region) with IndexedDB offline persistence.
- **PWA & Offline:** Service Worker Cache API, Web App Manifest.
- **Hosting:** Static GitHub Pages with custom domain support.

---

## 💻 Local Development

1. Clone or download the repository:
   ```bash
   git clone https://github.com/Rangeringo/AccessWild.git
   cd AccessWild
   ```
2. Serve via any local HTTP server (required for Service Worker and ES modules):
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```
3. Open `http://localhost:8080` in your web browser.

---

## 📄 License
Open source and community-focused under the MIT License.
