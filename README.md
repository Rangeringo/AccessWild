# AccessWild 🌲♿
An accessible, responsive mapping tool for inclusive outdoor recreation.

## Features
- **High-Contrast Mode:** Toggle via the button in the header.
- **Keyboard Optimized:** Full navigation via TAB and ENTER keys.
- **Screen Reader Support:** Semantic HTML5 landmarks and `aria-live` announcements.
- **Offline Ready:** Service Worker caching for use in low-signal wilderness areas.
- **Mobile First:** Responsive layout that shifts from a map-focus to a split-pane desktop view.

## Quick Start
1. Push these files to a GitHub Repository.
2. Go to **Settings > Pages**.
3. Select the `main` branch and `/root` folder.
4. Hit **Save**.

## Data Schema
Submissions generate a JSON object containing:
- `name`: Location name
- `type`: Facility category
- `coordinates`: [Lat, Lng] array
- `timestamp`: ISO format
