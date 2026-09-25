import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. Firebase Configuration (AccessWild project in nam5 multi-region)
const firebaseConfig = {
    projectId: "accesswild",
    appId: "1:1013816605246:web:3786196e25f15dd23c6f6f",
    storageBucket: "accesswild.firebasestorage.app",
    apiKey: "AIzaSyCv_wsjDii-j_oMJfVa-Mv8VrBH-0OitMg",
    authDomain: "accesswild.firebaseapp.com",
    messagingSenderId: "1013816605246",
    measurementId: "G-CJ8Q3DSHY1"
};

// Initialize Firebase & Cloud Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const locationsCol = collection(db, "locations");

// Enable offline caching for low-signal wilderness use
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Firestore offline persistence: multiple tabs open.");
        } else if (err.code === 'unimplemented') {
            console.warn("Browser does not support Firestore offline persistence.");
        }
    });
} catch (e) {
    console.warn("Persistence init note:", e);
}

// 2. Initialize Leaflet Map
// scrollWheelZoom: false avoids scroll hijacking during page scrolling
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

// Robust map sizing via ResizeObserver (cures desktop F12 / blank map issue permanently)
const mapEl = document.getElementById('map');
if (window.ResizeObserver && mapEl) {
    const ro = new ResizeObserver(() => {
        map.invalidateSize();
    });
    ro.observe(mapEl);
}
window.addEventListener('load', () => map.invalidateSize());
setTimeout(() => map.invalidateSize(), 150);
setTimeout(() => map.invalidateSize(), 500);

// 3. Screen Reader Announcer
function announce(msg) {
    const el = document.getElementById('announcements');
    if (el) el.textContent = msg;
}

// 4. Map Marker Factory with A11y
function createMarker(id, lat, lng, name, type) {
    const marker = L.marker([lat, lng]).addTo(map);
    const popupContent = `
        <div style="font-family: inherit; min-width: 160px;">
            <strong style="font-size: 1.05rem; display: block; margin-bottom: 4px;">${name}</strong>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #e8f5e9; color: #1b5e20; font-weight: bold; font-size: 0.85rem;">
                ${type}
            </span>
            <div style="font-size: 0.8rem; margin-top: 6px; color: #666;">
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

    return marker;
}

// 5. Real-Time Sync Store
const markersMap = new Map();

function renderLocationsList() {
    const listEl = document.getElementById('locations-list');
    const countEl = document.getElementById('points-count');
    if (!listEl) return;

    listEl.innerHTML = '';
    const pointsArray = Array.from(markersMap.values());
    if (countEl) countEl.textContent = pointsArray.length;

    pointsArray.forEach((p) => {
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

// Subscribe to Live Crowdsourced Firestore Updates
const q = query(locationsCol, orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const doc = change.doc;
        const data = doc.data();
        const id = doc.id;

        if (change.type === "added") {
            if (typeof data.lat === 'number' && typeof data.lng === 'number') {
                const marker = createMarker(id, data.lat, data.lng, data.name || "Accessible Point", data.type || "Other");
                markersMap.set(id, { ...data, id, marker });
            }
        }
        if (change.type === "removed") {
            if (markersMap.has(id)) {
                const item = markersMap.get(id);
                map.removeLayer(item.marker);
                markersMap.delete(id);
            }
        }
        if (change.type === "modified") {
            if (markersMap.has(id)) {
                const item = markersMap.get(id);
                map.removeLayer(item.marker);
                const marker = createMarker(id, data.lat, data.lng, data.name || "Accessible Point", data.type || "Other");
                markersMap.set(id, { ...data, id, marker });
            }
        }
    });

    renderLocationsList();
}, (error) => {
    console.error("Firestore real-time sync error:", error);
    announce("Working with cached offline points.");
});

// 6. Interaction Logic: Map Click Coordinates
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const coordsInput = document.getElementById('coords');
    if (coordsInput) {
        coordsInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    announce(`Coordinates set to ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
});

// 7. Interaction Logic: GPS Button
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

// 8. Interaction Logic: Form Submission Directly to Firestore
const form = document.getElementById('add-location-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('.submit-btn');
        const fd = new FormData(form);
        const data = Object.fromEntries(fd);

        if (!data.coordinates) {
            announce("Please click on the map or use GPS to set coordinates.");
            alert("Please click the map or use the GPS button to set coordinates.");
            return;
        }

        const [lat, lng] = data.coordinates.split(',').map(s => parseFloat(s.trim()));
        if (isNaN(lat) || isNaN(lng)) {
            announce("Invalid coordinates format.");
            alert("Coordinates must be in 'latitude, longitude' format.");
            return;
        }

        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Publishing to Live Map...";

        try {
            await addDoc(locationsCol, {
                name: data.name.trim(),
                type: data.type,
                lat: lat,
                lng: lng,
                createdAt: serverTimestamp()
            });

            announce(`Success! Published ${data.type} "${data.name}" live to everyone's map.`);
            form.reset();
        } catch (err) {
            console.error("Error saving point to Firestore:", err);
            announce("Error saving location. Check your internet connection.");
            alert("Could not save to live database: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// 9. Interaction Logic: GeoJSON Export
const exportBtn = document.getElementById('export-btn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const pointsArray = Array.from(markersMap.values());
        const geojson = {
            type: "FeatureCollection",
            features: pointsArray.map(p => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [p.lng, p.lat]
                },
                properties: {
                    id: p.id,
                    name: p.name,
                    type: p.type
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

// 10. Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isHC = document.body.toggleAttribute('data-theme');
        themeToggle.setAttribute('aria-pressed', isHC);
        announce(`High contrast mode ${isHC ? 'enabled' : 'disabled'}`);
    });
}

// 11. Service Worker for Wilderness Offline Caching
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
