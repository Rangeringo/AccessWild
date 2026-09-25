import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc,
    deleteDoc,
    doc,
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
const map = L.map('map', { 
    tap: false,
    scrollWheelZoom: false, // Controlled via Ctrl + Scroll gesture handler below
    touchZoom: true
}).setView([39.8283, -98.5795], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
}).addTo(map);

// Robust map sizing via ResizeObserver
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

// 4. Gesture Handling: Ctrl + Scroll on Desktop & Two-Finger Pan on Mobile (Google Maps Style)
const gestureOverlay = document.getElementById('gesture-overlay');
const gestureText = document.getElementById('gesture-overlay-text');
let gestureTimeout = null;

function showGestureHint(text) {
    if (!gestureOverlay || !gestureText) return;
    gestureText.textContent = text;
    gestureOverlay.classList.add('active');
    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
        gestureOverlay.classList.remove('active');
    }, 1500);
}

// Desktop: Check for Ctrl key on mouse wheel
mapEl.addEventListener('wheel', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierPressed = isMac ? e.metaKey : e.ctrlKey;

    if (modifierPressed) {
        map.scrollWheelZoom.enable();
    } else {
        map.scrollWheelZoom.disable();
        showGestureHint(isMac ? "Use ⌘ + scroll to zoom the map" : "Use Ctrl + scroll to zoom the map");
    }
}, { passive: true });

// Mobile: Two-finger gesture handling
mapEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        // Allow normal single-finger page scrolling
        map.dragging.disable();
    } else if (e.touches.length >= 2) {
        // Two fingers: activate map panning and pinch-to-zoom
        map.dragging.enable();
    }
}, { passive: true });

mapEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && !map.dragging.enabled()) {
        showGestureHint("Use two fingers to move or zoom the map");
    }
}, { passive: true });

mapEl.addEventListener('touchend', () => {
    map.dragging.enable();
}, { passive: true });

// 5. User Current Location (Google Maps-Style Pulsing Blue Dot)
let userLocationMarker = null;
let userAccuracyCircle = null;

function locateUser(flyTo = true, setDraft = false) {
    if (!navigator.geolocation) {
        announce("Geolocation is not supported by your browser.");
        alert("Geolocation is not supported by your browser.");
        return;
    }

    announce("Detecting your location...");
    const locateBtn = document.getElementById('locate-me-btn');
    if (locateBtn) locateBtn.style.opacity = '0.5';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            if (locateBtn) locateBtn.style.opacity = '1';
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy || 20;

            // Render Google Maps style Blue Dot
            if (!userLocationMarker) {
                const blueDotIcon = L.divIcon({
                    className: 'blue-dot-container',
                    html: `
                        <div class="blue-dot-wrapper">
                            <div class="blue-dot-pulse"></div>
                            <div class="blue-dot" role="img" aria-label="Your current GPS location"></div>
                        </div>
                    `,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                });

                userLocationMarker = L.marker([lat, lng], {
                    icon: blueDotIcon,
                    zIndexOffset: 2000
                }).addTo(map);

                userLocationMarker.bindTooltip("<b>You are here</b>", { direction: "top", offset: [0, -12] });

                userAccuracyCircle = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#2196f3',
                    fillColor: '#2196f3',
                    fillOpacity: 0.12,
                    weight: 1
                }).addTo(map);
            } else {
                userLocationMarker.setLatLng([lat, lng]);
                if (userAccuracyCircle) {
                    userAccuracyCircle.setLatLng([lat, lng]);
                    userAccuracyCircle.setRadius(accuracy);
                }
            }

            if (flyTo) {
                map.flyTo([lat, lng], 15, { duration: 1.2 });
            }

            if (setDraft) {
                setDraftLocation(lat, lng);
            }

            announce(`Your location found at latitude ${lat.toFixed(3)}, longitude ${lng.toFixed(3)}.`);
        },
        (err) => {
            if (locateBtn) locateBtn.style.opacity = '1';
            console.warn("Location error:", err);
            announce("Unable to access your location. Permission was denied or unavailable.");
            alert("Could not retrieve your location. Please check browser location permissions or tap the map to place a pin.");
        },
        { enableHighAccuracy: true, timeout: 12000 }
    );
}

// Connect Map Locate Button
const locateMeBtn = document.getElementById('locate-me-btn');
if (locateMeBtn) {
    locateMeBtn.addEventListener('click', () => locateUser(true, false));
}

// Connect Sidebar GPS Button
const gpsBtn = document.getElementById('use-gps-btn');
if (gpsBtn) {
    gpsBtn.addEventListener('click', () => locateUser(true, true));
}

// 6. Smart Reverse Geocoding & Auto-Naming (OpenStreetMap Nominatim)
let isUserTypingCustomName = false;
let lastAutoSuggestedName = '';

const locNameInput = document.getElementById('loc-name');
const locTypeSelect = document.getElementById('loc-type');
const nameHint = document.getElementById('name-suggestion-hint');

if (locNameInput) {
    locNameInput.addEventListener('input', () => {
        // If user manually edited away from auto-suggestion, remember their preference
        if (locNameInput.value.trim() !== lastAutoSuggestedName) {
            isUserTypingCustomName = true;
        }
    });
}

if (locTypeSelect) {
    locTypeSelect.addEventListener('change', () => {
        // If the current name was auto-suggested, update suffix cleanly
        if (!isUserTypingCustomName && lastAutoSuggestedName && locNameInput) {
            const currentCoords = document.getElementById('coords').value;
            if (currentCoords) {
                const [lat, lng] = currentCoords.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lng)) {
                    suggestLocationName(lat, lng, locTypeSelect.value);
                }
            }
        }
    });
}

async function suggestLocationName(lat, lng, type) {
    if (isUserTypingCustomName && locNameInput && locNameInput.value.trim().length > 0) {
        return; // Preserve custom names entered by user
    }

    if (nameHint) {
        nameHint.textContent = "🔍 Detecting nearby park, trail, or landmark...";
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("Geocode lookup failed");
        const data = await response.json();
        const addr = data.address || {};

        // Find best landmark identifier
        const landmark = data.name ||
                         addr.park ||
                         addr.leisure ||
                         addr.natural ||
                         addr.tourism ||
                         addr.trail ||
                         addr.road ||
                         addr.suburb ||
                         addr.city ||
                         addr.town ||
                         "Nature Area";

        // Build descriptive, clean title
        let suggested = "";
        if (type === "Restroom") {
            suggested = `${landmark} Accessible Restroom`;
        } else if (type === "Trail") {
            suggested = landmark.toLowerCase().includes("trail") ? landmark : `${landmark} Level Trail`;
        } else if (type === "Parking") {
            suggested = `${landmark} Reserved Parking`;
        } else if (type === "Overlook") {
            suggested = `${landmark} Viewpoint`;
        } else {
            suggested = `${landmark} Accessible Point`;
        }

        if (locNameInput) {
            locNameInput.value = suggested;
            lastAutoSuggestedName = suggested;
            isUserTypingCustomName = false;
        }

        if (nameHint) {
            nameHint.textContent = `💡 Suggested from nearby landmark "${landmark}". Click above to customize!`;
        }
    } catch (err) {
        console.warn("Auto-naming lookup notice:", err);
        if (nameHint) {
            nameHint.textContent = "💡 Type a location name above (e.g., South Fork Campground).";
        }
    }
}

// Profanity / Inappropriate Content Filter
const vulgarWords = ['shit', 'fuck', 'bitch', 'crap', 'ass', 'dick', 'pussy', 'nigger', 'faggot', 'bastard', 'cock'];

function validateRespectfulName(name, type) {
    const lower = name.toLowerCase();
    for (const bad of vulgarWords) {
        const regex = new RegExp(`\\b${bad}\\b`, 'i');
        if (regex.test(lower)) {
            return {
                valid: false,
                error: "Please enter a respectful, helpful name that describes the recreation site."
            };
        }
    }

    // Ensure clarity by appending facility type if omitted
    let formatted = name.trim();
    if (!formatted.toLowerCase().includes(type.toLowerCase())) {
        formatted = `${formatted} (${type})`;
    }

    return { valid: true, formatted };
}

// 7. Draft Pin Management
let draftMarker = null;

function setDraftLocation(lat, lng) {
    const coordsInput = document.getElementById('coords');
    if (coordsInput) {
        coordsInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    // Update Status Banner in Sidebar
    const statusText = document.getElementById('selection-status-text');
    const statusContainer = document.getElementById('selection-status');
    const clearBtn = document.getElementById('clear-pin-btn');
    if (statusText) {
        statusText.textContent = `Spot selected! Drag pin to fine-tune.`;
    }
    if (statusContainer) {
        statusContainer.classList.add('is-selected');
    }
    if (clearBtn) {
        clearBtn.style.display = 'inline-block';
    }

    // Update floating map hint
    const mapHintText = document.getElementById('map-hint-text');
    if (mapHintText) {
        mapHintText.textContent = "✅ Pin placed! Drag it to adjust, or complete form to save.";
    }

    // Suggest smart name based on coordinates
    const selectedType = (locTypeSelect && locTypeSelect.value) || "Restroom";
    suggestLocationName(lat, lng, selectedType);

    // Create or update the draft marker
    if (draftMarker) {
        draftMarker.setLatLng([lat, lng]);
    } else {
        const draftIcon = L.divIcon({
            className: 'draft-pin-container',
            html: `
                <div class="draft-pin-wrapper">
                    <div class="draft-pin-pulse"></div>
                    <div class="draft-pin-marker" role="img" aria-label="Selected location pin">
                        <span class="draft-pin-inner-icon">📍</span>
                    </div>
                </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 46]
        });

        draftMarker = L.marker([lat, lng], {
            icon: draftIcon,
            draggable: true,
            zIndexOffset: 1500
        }).addTo(map);

        draftMarker.bindTooltip("<b>📍 Selected Spot</b><br>Drag to fine-tune position", {
            permanent: true,
            direction: "top",
            offset: [0, -44],
            className: "draft-tooltip"
        });

        draftMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            if (coordsInput) {
                coordsInput.value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
            }
            suggestLocationName(pos.lat, pos.lng, locTypeSelect.value);
            announce(`Pin adjusted to latitude ${pos.lat.toFixed(3)}, longitude ${pos.lng.toFixed(3)}`);
        });
    }

    announce(`Pin placed at latitude ${lat.toFixed(3)}, longitude ${lng.toFixed(3)}.`);
}

function clearDraftLocation() {
    if (draftMarker) {
        map.removeLayer(draftMarker);
        draftMarker = null;
    }
    const coordsInput = document.getElementById('coords');
    if (coordsInput) coordsInput.value = '';

    const statusText = document.getElementById('selection-status-text');
    const statusContainer = document.getElementById('selection-status');
    const clearBtn = document.getElementById('clear-pin-btn');
    if (statusText) {
        statusText.textContent = 'No spot selected yet. Tap the map or use the buttons below.';
    }
    if (statusContainer) {
        statusContainer.classList.remove('is-selected');
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }

    const mapHintText = document.getElementById('map-hint-text');
    if (mapHintText) {
        mapHintText.textContent = '💡 Tap or click anywhere on the map to place a pin.';
    }
    announce('Selected pin cleared.');
}

// Map Click Handler (Leaflet suppresses this if user dragged/panned)
map.on('click', (e) => {
    setDraftLocation(e.latlng.lat, e.latlng.lng);
});

// "Pin Map Center" Button
const centerPinBtn = document.getElementById('center-pin-btn');
if (centerPinBtn) {
    centerPinBtn.addEventListener('click', () => {
        const center = map.getCenter();
        setDraftLocation(center.lat, center.lng);
    });
}

// "Clear Pin" Button
const clearPinBtn = document.getElementById('clear-pin-btn');
if (clearPinBtn) {
    clearPinBtn.addEventListener('click', clearDraftLocation);
}

// 8. Editing State Management
let editingLocationId = null;

function startEditLocation(id, name, type, lat, lng) {
    editingLocationId = id;

    // Populate Form Fields
    if (locNameInput) {
        locNameInput.value = name;
        isUserTypingCustomName = true;
    }
    if (locTypeSelect) {
        locTypeSelect.value = type;
    }

    // Set pin on the map
    setDraftLocation(lat, lng);
    map.flyTo([lat, lng], 14, { duration: 1 });

    // Update UI elements for Edit Mode
    const formHeading = document.getElementById('form-heading');
    if (formHeading) formHeading.textContent = "Edit Accessible Point";

    const submitBtn = document.getElementById('submit-location-btn');
    if (submitBtn) submitBtn.textContent = "Save Changes";

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) cancelEditBtn.style.display = 'block';

    const editingBanner = document.getElementById('editing-banner');
    if (editingBanner) {
        editingBanner.style.display = 'flex';
        editingBanner.querySelector('span').textContent = `✏️ Editing "${name}"`;
    }

    // Scroll smoothly to form
    const formContainer = document.getElementById('form-container');
    if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }

    announce(`Editing ${name}. Make your changes in the form and tap Save Changes.`);
}

function cancelEditMode() {
    editingLocationId = null;
    isUserTypingCustomName = false;
    clearDraftLocation();

    const form = document.getElementById('add-location-form');
    if (form) form.reset();

    const formHeading = document.getElementById('form-heading');
    if (formHeading) formHeading.textContent = "Add Accessible Point";

    const submitBtn = document.getElementById('submit-location-btn');
    if (submitBtn) submitBtn.textContent = "Save Location";

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';

    const editingBanner = document.getElementById('editing-banner');
    if (editingBanner) editingBanner.style.display = 'none';

    announce("Editing canceled.");
}

const cancelEditBtn = document.getElementById('cancel-edit-btn');
if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEditMode);

const cancelBannerBtn = document.getElementById('cancel-edit-banner-btn');
if (cancelBannerBtn) cancelBannerBtn.addEventListener('click', cancelEditMode);

// 9. Deleting a Location
async function deleteLocation(id, name) {
    const confirmed = confirm(`Are you sure you want to remove "${name}" from the live map?`);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "locations", id));
        announce(`Successfully deleted ${name} from live map.`);
        if (editingLocationId === id) {
            cancelEditMode();
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("Could not delete location: " + err.message);
    }
}

// 10. Permanent Map Marker Factory with Full Screen-Reader & Action Buttons
function createMarker(id, lat, lng, name, type) {
    const marker = L.marker([lat, lng]).addTo(map);

    const safeName = name.replace(/'/g, "\\'");
    const popupContent = document.createElement('div');
    popupContent.style.minWidth = '180px';
    popupContent.innerHTML = `
        <div style="font-family: inherit;">
            <strong style="font-size: 1.05rem; display: block; margin-bottom: 4px;">${name}</strong>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #e8f5e9; color: #1b5e20; font-weight: bold; font-size: 0.85rem;">
                ${type}
            </span>
            <div style="font-size: 0.8rem; margin: 6px 0; color: #666;">
                Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button type="button" class="edit-btn" style="padding: 2px 8px; font-size: 0.8rem;" aria-label="Edit this location">✏️ Edit</button>
                <button type="button" class="delete-btn" style="padding: 2px 8px; font-size: 0.8rem;" aria-label="Delete this location">🗑️ Delete</button>
            </div>
        </div>
    `;

    popupContent.querySelector('.edit-btn').addEventListener('click', () => {
        marker.closePopup();
        startEditLocation(id, name, type, lat, lng);
    });

    popupContent.querySelector('.delete-btn').addEventListener('click', () => {
        marker.closePopup();
        deleteLocation(id, name);
    });

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

// 11. Real-Time Sync Store
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
            <div class="location-header">
                <div class="location-info">
                    <strong>${p.name}</strong>
                    <span class="location-tag">${p.type}</span>
                </div>
            </div>
            <div class="action-btn-group">
                <button type="button" class="view-btn" aria-label="View ${p.name} on map">
                    👁️ View
                </button>
                <button type="button" class="edit-btn" aria-label="Edit ${p.name}">
                    ✏️ Edit
                </button>
                <button type="button" class="delete-btn" aria-label="Delete ${p.name}">
                    🗑️ Delete
                </button>
            </div>
        `;

        li.querySelector('.view-btn').addEventListener('click', () => {
            map.flyTo([p.lat, p.lng], 14, { duration: 1 });
            p.marker.openPopup();
            announce(`Focused on ${p.name} at zoom level 14`);
        });

        li.querySelector('.edit-btn').addEventListener('click', () => {
            startEditLocation(p.id, p.name, p.type, p.lat, p.lng);
        });

        li.querySelector('.delete-btn').addEventListener('click', () => {
            deleteLocation(p.id, p.name);
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

// 12. Interaction Logic: Form Submission (Create or Update)
const form = document.getElementById('add-location-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-location-btn');
        const fd = new FormData(form);
        const data = Object.fromEntries(fd);

        if (!data.coordinates) {
            announce("Please click on the map or use GPS to set coordinates.");
            alert("Please tap the map or use 'Pin Map Center' / 'Use Current GPS' to set coordinates.");
            return;
        }

        const [lat, lng] = data.coordinates.split(',').map(s => parseFloat(s.trim()));
        if (isNaN(lat) || isNaN(lng)) {
            announce("Invalid coordinates format.");
            alert("Coordinates must be in 'latitude, longitude' format.");
            return;
        }

        // Validate respectful naming
        const validation = validateRespectfulName(data.name, data.type);
        if (!validation.valid) {
            announce(validation.error);
            alert(validation.error);
            if (locNameInput) locNameInput.focus();
            return;
        }

        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = editingLocationId ? "Saving Updates..." : "Publishing to Live Map...";

        try {
            if (editingLocationId) {
                // Update existing location
                await updateDoc(doc(db, "locations", editingLocationId), {
                    name: validation.formatted,
                    type: data.type,
                    lat: lat,
                    lng: lng,
                    updatedAt: serverTimestamp()
                });
                announce(`Success! Updated ${validation.formatted} on the live map.`);
                cancelEditMode();
            } else {
                // Create new location
                await addDoc(locationsCol, {
                    name: validation.formatted,
                    type: data.type,
                    lat: lat,
                    lng: lng,
                    createdAt: serverTimestamp()
                });
                announce(`Success! Published ${validation.formatted} live to everyone's map.`);
                form.reset();
                clearDraftLocation();
                isUserTypingCustomName = false;
            }
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

// 13. Interaction Logic: GeoJSON Export
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

// 14. Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isHC = document.body.toggleAttribute('data-theme');
        themeToggle.setAttribute('aria-pressed', isHC);
        announce(`High contrast mode ${isHC ? 'enabled' : 'disabled'}`);
    });
}

// 15. Service Worker for Wilderness Offline Caching
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
