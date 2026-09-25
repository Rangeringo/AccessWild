// 1. Initialize Map
// scrollWheelZoom: false prevents scroll hijacking when scrolling down the page
const map = L.map('map', { 
    tap: false,
    scrollWheelZoom: false 
}).setView([39.8283, -98.5795], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
}).addTo(map);

// Enable scroll wheel zoom only on intentional click or focus, disable when mouse leaves
map.on('focus', () => map.scrollWheelZoom.enable());
map.on('click', () => map.scrollWheelZoom.enable());
map.on('mouseout', () => map.scrollWheelZoom.disable());

// Robust map invalidation using ResizeObserver (solves the desktop F12 / blank map issue)
const mapEl = document.getElementById('map');
if (window.ResizeObserver && mapEl) {
    const ro = new ResizeObserver(() => {
        map.invalidateSize();
    });
    ro.observe(mapEl);
}
window.addEventListener('load', () => map.invalidateSize());
document.addEventListener('DOMContentLoaded', () => map.invalidateSize());
setTimeout(() => map.invalidateSize(), 100);
setTimeout(() => map.invalidateSize(), 400);

// 2. Screen Reader Announcer
function announce(msg) {
    const el = document.getElementById('announcements');
    if (el) el.textContent = msg;
}

// 3. State & Marker Store
const markers = [];
const allPoints = [];

function addPoint(lat, lng, name, type, isCustom = false) {
    const marker = L.marker([lat, lng]).addTo(map);
    const popupContent = `
        <div style="font-family: inherit;">
            <strong style="font-size: 1.05rem; display: block; margin-bottom: 4px;">${name}</strong>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #e8f5e9; color: #1b5e20; font-weight: bold; font-size: 0.85rem;">
                ${type}
            </span>
            <div style="font-size: 0.8rem; margin-top: 6px; color: #555;">
                Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
            </div>
        </div>
    `;
    marker.bindPopup(popupContent);

    const setupMarkerA11y = () => {
        const el = marker._icon;
        if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-label', `${type}: ${name}`);
            el.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    marker.openPopup(); 
                }
            });
        }
    };
    marker.on('add', setupMarkerA11y);
    if (marker._icon) {
        setupMarkerA11y();
    }

    const pointObj = { lat, lng, name, type, isCustom, marker };
    markers.push(marker);
    allPoints.push(pointObj);

    renderLocationsList();
    return marker;
}

// 4. Render Accessible Locations in Sidebar
function renderLocationsList() {
    const listEl = document.getElementById('locations-list');
    const countEl = document.getElementById('points-count');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (countEl) countEl.textContent = allPoints.length;

    allPoints.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'location-item';
        li.innerHTML = `
            <div class="location-info">
                <strong>${p.name}</strong>
                <span class="location-tag">${p.type}</span>
            </div>
            <button type="button" class="view-btn" aria-label="View ${p.name} on map">
                View on Map
            </button>
        `;

        li.querySelector('.view-btn').addEventListener('click', () => {
            map.setView([p.lat, p.lng], 13);
            p.marker.openPopup();
            announce(`Focused on ${p.name} at zoom level 13`);
        });

        listEl.appendChild(li);
    });
}

// 5. Interaction Logic: Map Click
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const coordsInput = document.getElementById('coords');
    if (coordsInput) {
        coordsInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    announce(`Coordinates set to ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
});

// 6. Interaction Logic: GPS Button
const gpsBtn = document.getElementById('use-gps-btn');
if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            announce("Geolocation is not supported by your browser.");
            alert("Geolocation is not supported by your browser.");
            return;
        }
        announce("Detecting your location...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const coordsInput = document.getElementById('coords');
                if (coordsInput) {
                    coordsInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                }
                map.setView([lat, lng], 13);
                announce(`GPS position found at ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
            },
            () => {
                announce("Unable to retrieve location. Please click the map instead.");
                alert("Location access denied or unavailable. Please click the map to set coordinates.");
            }
        );
    });
}

// 7. Interaction Logic: Form Submission with localStorage Persistence
const form = document.getElementById('add-location-form');
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd);

        if (data.coordinates) {
            const [lat, lng] = data.coordinates.split(',').map(s => parseFloat(s.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
                addPoint(lat, lng, data.name, data.type, true);
                saveCustomPoint({ lat, lng, name: data.name, type: data.type });
                announce(`Success! Saved ${data.type} "${data.name}" to your map.`);
            } else {
                announce("Error: Invalid coordinates. Please click on the map.");
            }
        }
        e.target.reset();
    });
}

function saveCustomPoint(point) {
    try {
        const saved = JSON.parse(localStorage.getItem('accesswild_custom_points') || '[]');
        saved.push(point);
        localStorage.setItem('accesswild_custom_points', JSON.stringify(saved));
    } catch (err) {
        console.error("Could not save to localStorage", err);
    }
}

function loadCustomPoints() {
    try {
        const saved = JSON.parse(localStorage.getItem('accesswild_custom_points') || '[]');
        saved.forEach(p => addPoint(p.lat, p.lng, p.name, p.type, true));
    } catch (err) {
        console.error("Could not load from localStorage", err);
    }
}

// 8. Interaction Logic: GeoJSON Export
const exportBtn = document.getElementById('export-btn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const geojson = {
            type: "FeatureCollection",
            features: allPoints.map(p => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [p.lng, p.lat]
                },
                properties: {
                    name: p.name,
                    type: p.type,
                    isCustom: p.isCustom
                }
            }))
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'accesswild-points.geojson';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        announce("Exported GeoJSON file downloaded.");
    });
}

// 9. Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isHC = document.body.toggleAttribute('data-theme');
        themeToggle.setAttribute('aria-pressed', isHC);
        announce(`High contrast mode ${isHC ? 'enabled' : 'disabled'}`);
    });
}

// 10. Initial Seed Data & Load Saved Points
const defaultPoints = [
    { lat: 37.7749, lng: -122.4194, name: "Golden Gate Park Paved Trail", type: "Trail" },
    { lat: 39.7392, lng: -104.9903, name: "City Park Accessible Restroom", type: "Restroom" },
    { lat: 47.6062, lng: -122.3321, name: "Discovery Park Reserved Parking", type: "Parking" },
    { lat: 39.0968, lng: -120.0324, name: "Emerald Bay Overlook", type: "Overlook" }
];
defaultPoints.forEach(p => addPoint(p.lat, p.lng, p.name, p.type, false));
loadCustomPoints();

// 11. Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
