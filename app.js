// 1. Initialize Map
const map = L.map('map', {
    tap: false // Helps with touch devices
}).setView([40.0, -100.0], 4);

// Use the high-reliability OSM tile server
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// CRITICAL FIX: Forces the map to recalculate its container size
setTimeout(() => {
    map.invalidateSize();
}, 100);

// 2. Screen Reader Announcer
function announce(msg) {
    document.getElementById('announcements').textContent = msg;
}

// 3. Accessibility for Map Markers
function createAccessibleMarker(lat, lng, properties) {
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<b>${properties.name}</b><br>${properties.type}`);
    
    // Step 2: Keyboard Access Injection
    marker.on('add', () => {
        const el = marker._icon;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `${properties.type} at ${properties.name}`);
        
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') marker.openPopup();
        });
    });
}

// 4. Capture Coordinates on Map Click
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    document.getElementById('coords').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    announce(`Location selected: ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
});

// 5. Form Submission (Step 3)
document.getElementById('add-location-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
        name: data.get('name'),
        type: data.get('type'),
        coords: data.get('coordinates'),
        id: Date.now()
    };

    console.log("Mock Outbound Data:", JSON.stringify(payload));
    announce(`Success! Added ${payload.name} to the database.`);
    alert("Test Data Logged to Console.");
    e.target.reset();
});

// 6. Theme Toggle (Step 1)
document.getElementById('theme-toggle').addEventListener('click', (e) => {
    const isHC = document.body.hasAttribute('data-theme');
    if (isHC) {
        document.body.removeAttribute('data-theme');
        e.target.setAttribute('aria-pressed', 'false');
    } else {
        document.body.setAttribute('data-theme', 'high-contrast');
        e.target.setAttribute('aria-pressed', 'true');
    }
});

// 7. Service Worker Registration (Step 4)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
