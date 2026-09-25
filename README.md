# AccessWild 🌲♿
An accessible mapping tool for inclusive outdoor recreation. Built for resilience in wilderness areas and ease of use for people with mobility or visual impairments.

## Developer Instructions
- **Hosting:** Optimized for GitHub Pages (Static hosting).
- **Functionality:** Capture coordinates via map-click, toggle high-contrast UI, and browse locations via keyboard.
- **Offline:** Assets are cached via Service Worker for use in low-signal environments.

## Getting Started
1. Open `index.html` in any modern web browser or serve via a local HTTP server:
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```
2. For offline Service Worker testing, serve over `http://localhost` or `https://`.

## Deployment to GitHub Pages
1. Push this repository to GitHub.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select `Deploy from a branch`.
4. Choose the `main` branch and `/ (root)` folder, then save.
