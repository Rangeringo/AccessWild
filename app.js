// 1. Initialize Map
const map = L.map('map', { tap: false }).setView([39.8283, -98.5795], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Fix for grey box on load
setTimeout(() => { map.invalidateSize(); }, 200);

// 2. Screen Reader Announcer
function announce(msg) {
    document.getElementById('announcements').textContent = msg;
}

// 3. A11y Marker Logic
function addPoint(lat, lng, name, type) {
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<b>${name}</b><br>${type}`);
    const setupMarkerA11y = () => {
        const el = marker._icon;
        if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-label', `${type} at ${name}`);
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

// 4. Interaction Logic
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    document.getElementById('coords').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    announce(`Location selected at ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
});

document.getElementById('add-location-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    console.log("JSON Payload:", JSON.stringify(data));

    if (data.coordinates) {
        const [lat, lng] = data.coordinates.split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
            addPoint(lat, lng, data.name, data.type);
            announce(`Success! Added ${data.type} "${data.name}" to map.`);
        } else {
            announce("Success! Location logged to console.");
        }
    } else {
        announce("Success! Location logged to console.");
    }
    e.target.reset();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    const isHC = document.body.toggleAttribute('data-theme');
    document.getElementById('theme-toggle').setAttribute('aria-pressed', isHC);
});

// Seed initial sample accessible recreation points for immediate testing
const samplePoints = [
    { lat: 37.7749, lng: -122.4194, name: "Golden Gate Park Paved Trail", type: "Trail" },
    { lat: 39.7392, lng: -104.9903, name: "City Park Accessible Restroom", type: "Restroom" },
    { lat: 47.6062, lng: -122.3321, name: "Discovery Park Reserved Parking", type: "Parking" }
];
samplePoints.forEach(p => addPoint(p.lat, p.lng, p.name, p.type));

// 5. Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
