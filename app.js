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

// 1B. Network Status Detection & PWA App Installation
const networkBadge = document.getElementById('network-status');
const networkStatusText = document.getElementById('network-status-text');
const offlineBar = document.getElementById('offline-bar');

function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (networkBadge && networkStatusText) {
        if (isOnline) {
            networkBadge.className = 'network-badge online';
            networkStatusText.textContent = 'Online';
            networkBadge.title = 'Connected: Points sync live with all users';
            if (offlineBar) offlineBar.style.display = 'none';
        } else {
            networkBadge.className = 'network-badge offline';
            networkStatusText.textContent = 'Offline (Saved Locally)';
            networkBadge.title = 'Offline: New points and edits are saved on this device and will sync when reconnected';
            if (offlineBar) offlineBar.style.display = 'block';
        }
    }
}

window.addEventListener('online', () => {
    updateNetworkStatus();
    announce("Internet connection restored. Live sync active.");
});

window.addEventListener('offline', () => {
    updateNetworkStatus();
    announce("You are offline. New points and edits are saved locally on your device and will sync when reconnected.");
});

updateNetworkStatus();

// PWA Install Prompt (Add to Home Screen)
let deferredInstallPrompt = null;
const pwaInstallBtn = document.getElementById('pwa-install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'inline-flex';
    }
});

if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
            announce('AccessWild installed to your device!');
        }
        deferredInstallPrompt = null;
        pwaInstallBtn.style.display = 'none';
    });
}

window.addEventListener('appinstalled', () => {
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
    announce("AccessWild successfully installed as an app.");
});

// 2. Client Device Identity (Prevents Trolls from Deleting Others' Submissions)
let myClientId = localStorage.getItem('accesswild_client_id');
if (!myClientId) {
    myClientId = 'usr_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('accesswild_client_id', myClientId);
}

// 3. Admin Authentication & Moderation System
let isAdmin = localStorage.getItem('accesswild_is_admin') === 'true';
const ADMIN_PASSCODE = "accesswild2026"; // Default secure override passcode

const adminBtn = document.getElementById('admin-btn');
function updateAdminUI() {
    if (!adminBtn) return;
    if (isAdmin) {
        adminBtn.textContent = "🛡️ Admin: Active";
        adminBtn.classList.add('is-admin');
        adminBtn.title = "Click to log out of Admin Mode";
    } else {
        adminBtn.textContent = "🛡️ Admin";
        adminBtn.classList.remove('is-admin');
        adminBtn.title = "Click to enter Admin Mode";
    }
}
updateAdminUI();

if (adminBtn) {
    adminBtn.addEventListener('click', () => {
        if (isAdmin) {
            const logout = confirm("You are currently in Admin Mode. Log out?");
            if (logout) {
                isAdmin = false;
                localStorage.removeItem('accesswild_is_admin');
                updateAdminUI();
                renderLocationsList();
                refreshAllMarkers();
                announce("Logged out of Admin Mode.");
            }
        } else {
            const code = prompt("🛡️ Admin Moderation Access\nEnter your Admin Passcode to enable full moderation, veto, and verification powers:");
            if (code && code.trim() === ADMIN_PASSCODE) {
                isAdmin = true;
                localStorage.setItem('accesswild_is_admin', 'true');
                updateAdminUI();
                renderLocationsList();
                refreshAllMarkers();
                announce("Admin Mode activated. You have full moderation and veto permissions.");
                alert("🛡️ Admin Mode Activated!\nYou can now verify locations, view flag reports, and veto/delete any inappropriate submission.");
            } else if (code !== null) {
                alert("Incorrect passcode.");
            }
        }
    });
}

// 4. Free Map Tile Layers (Streets, Satellite, Topo Trails & Labels)
const osmStreets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
});

const satelliteImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles © <a href="https://www.esri.com" target="_blank">Esri</a>, Maxar, Earthstar Geographics'
});

const outdoorTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Style: © <a href="https://opentopomap.org">OpenTopoMap</a>'
});

// Overlay Layer: Trailheads, Parks & Place Names (Completely Free)
const placeLabelsOverlay = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Labels © Esri'
});

// Initialize Leaflet Map with Streets & Labels
const map = L.map('map', { 
    layers: [osmStreets, placeLabelsOverlay],
    tap: false,
    scrollWheelZoom: false,
    touchZoom: true
}).setView([39.8283, -98.5795], 4);

// Map Layer Switcher Control
const baseLayers = {
    "🗺️ Streets": osmStreets,
    "🛰️ Satellite": satelliteImagery,
    "⛰️ Outdoor Topo & Trails": outdoorTopo
};

const overlayLayers = {
    "🏷️ Place & Trail Labels": placeLabelsOverlay
};

L.control.layers(baseLayers, overlayLayers, { position: 'topright' }).addTo(map);

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

// 5. Screen Reader Announcer
function announce(msg) {
    const el = document.getElementById('announcements');
    if (el) el.textContent = msg;
}

// 6. Gesture Handling: Ctrl + Scroll on Desktop & Two-Finger Pan on Mobile
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

mapEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        map.dragging.disable();
    } else if (e.touches.length >= 2) {
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

// 7. User Current Location (Pulsing Blue Dot)
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

const locateMeBtn = document.getElementById('locate-me-btn');
if (locateMeBtn) {
    locateMeBtn.addEventListener('click', () => locateUser(true, false));
}

const gpsBtn = document.getElementById('use-gps-btn');
if (gpsBtn) {
    gpsBtn.addEventListener('click', () => locateUser(true, true));
}

// 8. Smart Reverse Geocoding & Auto-Naming (OpenStreetMap Nominatim)
let isUserTypingCustomName = false;
let lastAutoSuggestedName = '';

const locNameInput = document.getElementById('loc-name');
const locTypeSelect = document.getElementById('loc-type');
const nameHint = document.getElementById('name-suggestion-hint');

if (locNameInput) {
    locNameInput.addEventListener('input', () => {
        if (locNameInput.value.trim() !== lastAutoSuggestedName) {
            isUserTypingCustomName = true;
        }
    });
}

if (locTypeSelect) {
    locTypeSelect.addEventListener('change', () => {
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
        return;
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

        const landmark = data.name ||
                         addr.park ||
                         addr.leisure ||
                         addr.natural ||
                         addr.tourism ||
                         addr.trail ||
                         addr.amenity ||
                         addr.road ||
                         addr.suburb ||
                         addr.city ||
                         addr.town ||
                         "Nature Spot";

        let suggested = "";
        if (type === "Restroom") {
            suggested = `${landmark} Accessible Restroom`;
        } else if (type === "Rest Stop") {
            suggested = `${landmark} Rest Area & Services`;
        } else if (type === "Trail") {
            suggested = landmark.toLowerCase().includes("trail") ? landmark : `${landmark} Level Trail`;
        } else if (type === "Accessible Parking" || type === "Parking") {
            suggested = `${landmark} Accessible Parking`;
        } else if (type === "Overlook") {
            suggested = `${landmark} Viewpoint`;
        } else if (type === "Business") {
            suggested = `${landmark} Accessible Facility`;
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

function validateRespectfulName(name) {
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

    return { valid: true, formatted: name.trim() };
}

// 9. Draft Pin Management & Removal (Accidental Pin Protection)
let draftMarker = null;

function setDraftLocation(lat, lng) {
    const coordsInput = document.getElementById('coords');
    if (coordsInput) {
        coordsInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    const statusText = document.getElementById('selection-status-text');
    const statusContainer = document.getElementById('selection-status');
    const clearBtn = document.getElementById('clear-pin-btn');
    const removeFormBtn = document.getElementById('remove-pin-form-btn');
    if (statusText) {
        statusText.textContent = `Spot selected! Drag pin to adjust or remove below.`;
    }
    if (statusContainer) {
        statusContainer.classList.add('is-selected');
    }
    if (clearBtn) {
        clearBtn.style.display = 'inline-flex';
    }
    if (removeFormBtn) {
        removeFormBtn.style.display = 'inline-flex';
    }

    const mapHintText = document.getElementById('map-hint-text');
    if (mapHintText) {
        mapHintText.textContent = "✅ Pin placed! Tap pin to remove, or drag to adjust position.";
    }

    const selectedType = (locTypeSelect && locTypeSelect.value) || "Restroom";
    suggestLocationName(lat, lng, selectedType);

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

        const popupDiv = document.createElement('div');
        popupDiv.style.textAlign = 'center';
        popupDiv.style.minWidth = '160px';
        popupDiv.innerHTML = `
            <strong>📍 Selected Spot</strong>
            <p style="margin: 4px 0 8px 0; font-size: 0.85rem; color: #555;">Drag to adjust position</p>
            <button type="button" class="danger-btn" style="width: 100%; justify-content: center; padding: 4px;" aria-label="Remove this pin">
                ❌ Remove Pin
            </button>
        `;
        popupDiv.querySelector('button').addEventListener('click', () => {
            clearDraftLocation();
        });

        draftMarker.bindPopup(popupDiv);

        draftMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            if (coordsInput) {
                coordsInput.value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
            }
            suggestLocationName(pos.lat, pos.lng, locTypeSelect.value);
            announce(`Pin adjusted to latitude ${pos.lat.toFixed(3)}, longitude ${pos.lng.toFixed(3)}`);
        });
    }

    announce(`Pin placed at latitude ${lat.toFixed(3)}, longitude ${lng.toFixed(3)}. You can drag the pin to adjust or remove it.`);
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
    const removeFormBtn = document.getElementById('remove-pin-form-btn');

    if (statusText) {
        statusText.textContent = 'No spot selected yet. Tap the map or use the buttons below.';
    }
    if (statusContainer) {
        statusContainer.classList.remove('is-selected');
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    if (removeFormBtn) {
        removeFormBtn.style.display = 'none';
    }

    const mapHintText = document.getElementById('map-hint-text');
    if (mapHintText) {
        mapHintText.textContent = '💡 Tap or click anywhere on the map to place a pin.';
    }
    announce('Selected pin removed.');
}

const clearPinBtn = document.getElementById('clear-pin-btn');
if (clearPinBtn) clearPinBtn.addEventListener('click', clearDraftLocation);

const removeFormBtn = document.getElementById('remove-pin-form-btn');
if (removeFormBtn) removeFormBtn.addEventListener('click', clearDraftLocation);

map.on('click', (e) => {
    setDraftLocation(e.latlng.lat, e.latlng.lng);
});

const centerPinBtn = document.getElementById('center-pin-btn');
if (centerPinBtn) {
    centerPinBtn.addEventListener('click', () => {
        const center = map.getCenter();
        setDraftLocation(center.lat, center.lng);
    });
}

// 10. Undo Accidental Live Submissions
let lastCreatedDocId = null;
let undoTimeout = null;
const undoBanner = document.getElementById('undo-banner');
const undoText = document.getElementById('undo-banner-text');
const undoBtn = document.getElementById('undo-save-btn');

function showUndoOption(id, name) {
    if (!undoBanner || !undoText) return;
    lastCreatedDocId = id;
    undoText.textContent = `✅ Published "${name}" live!`;
    undoBanner.style.display = 'flex';

    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        if (undoBanner) undoBanner.style.display = 'none';
        lastCreatedDocId = null;
    }, 15000);
}

if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
        if (!lastCreatedDocId) return;
        const targetId = lastCreatedDocId;
        undoBanner.style.display = 'none';
        try {
            await deleteDoc(doc(db, "locations", targetId));
            announce("Submission undone and removed from live map.");
            alert("Location submission undone and removed from the live map.");
        } catch (e) {
            console.error("Undo error:", e);
        }
        lastCreatedDocId = null;
    });
}

// 11. Editing State Management
let editingLocationId = null;

function startEditLocation(id, name, type, lat, lng, notes = "") {
    editingLocationId = id;

    if (locNameInput) {
        locNameInput.value = name;
        isUserTypingCustomName = true;
    }
    if (locTypeSelect) {
        locTypeSelect.value = (type === "Parking") ? "Accessible Parking" : type;
    }
    const notesInput = document.getElementById('loc-notes');
    if (notesInput) {
        notesInput.value = notes;
    }

    setDraftLocation(lat, lng);
    map.flyTo([lat, lng], 14, { duration: 1 });

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

// 12. Moderation: Deleting & Vetoing Locations (Admin Only)
async function deleteLocation(id, name, isVeto = false) {
    if (!isAdmin) {
        alert("Only administrators can delete points from the map. If a point is incorrect or needs removal, please click 🚩 Report to flag it for admin review.");
        return;
    }

    const promptMsg = `🛡️ Admin Deletion: Permanently remove "${name}" from the live map?`;

    const confirmed = confirm(promptMsg);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "locations", id));
        announce(`Successfully removed ${name} from the map.`);
        if (editingLocationId === id) {
            cancelEditMode();
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("Could not delete location: " + err.message);
    }
}

// 13. Moderation: Verifying Locations (Admin Only)
async function toggleVerifyLocation(id, name, currentStatus) {
    try {
        const newStatus = !currentStatus;
        await updateDoc(doc(db, "locations", id), {
            isVerified: newStatus,
            verifiedAt: serverTimestamp()
        });
        announce(`${name} is now ${newStatus ? 'Verified Accessible' : 'Unverified'}.`);
    } catch (err) {
        console.error("Verify error:", err);
        alert("Could not update verification: " + err.message);
    }
}

// 14. Moderation: Reporting & Clearing Flags (Anti-Troll Defense)
async function reportLocation(id, name) {
    const confirmed = confirm(`Report "${name}" as spam, incorrect, or inappropriate? Our moderation will review it.`);
    if (!confirmed) return;

    try {
        const item = markersMap.get(id);
        const currentFlags = (item && item.flags) || 0;
        await updateDoc(doc(db, "locations", id), {
            flags: currentFlags + 1,
            lastReportedAt: serverTimestamp()
        });
        announce("Thank you for your report. The location has been flagged for review.");
        alert("Thank you. This location has been flagged for moderation review.");
    } catch (err) {
        console.error("Report error:", err);
    }
}

async function clearFlags(id, name) {
    try {
        await updateDoc(doc(db, "locations", id), {
            flags: 0
        });
        announce(`Flags cleared for ${name}.`);
    } catch (err) {
        console.error("Clear flags error:", err);
    }
}

// 15. Permanent Map Marker Factory
function createMarker(id, lat, lng, name, type, notes = "", flags = 0, createdBy = "", isVerified = false, isPendingSync = false) {
    const marker = L.marker([lat, lng]).addTo(map);

    const displayType = (type === "Parking") ? "Accessible Parking" : type;
    const canEdit = isAdmin || (createdBy === myClientId);

    const popupContent = document.createElement('div');
    popupContent.style.minWidth = '210px';
    popupContent.innerHTML = `
        <div style="font-family: inherit;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                <strong style="font-size: 1.05rem;">${name}</strong>
                ${isVerified ? '<span class="verified-badge" title="Verified Accessible">✓ Verified</span>' : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #e8f5e9; color: #1b5e20; font-weight: bold; font-size: 0.85rem;">
                    ${displayType}
                </span>
                ${isPendingSync ? '<span class="pending-sync-badge" title="Saved on your device. Will sync to everyone when reconnected.">⏳ Saved Offline</span>' : ''}
            </div>
            ${flags > 0 ? `<div class="flagged-warning">⚠️ Reported by community (${flags})</div>` : ''}
            ${notes ? `<div style="font-size: 0.85rem; margin-top: 6px; padding: 4px 6px; background: #f5f5f5; border-radius: 4px; color: #333;">♿ ${notes}</div>` : ''}
            <div style="font-size: 0.8rem; margin: 6px 0; color: #666;">
                Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
            </div>
            <div style="display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap;">
                ${canEdit ? '<button type="button" class="edit-btn" style="padding: 2px 8px; font-size: 0.8rem;">✏️ Edit</button>' : ''}
                ${isAdmin ? `
                    <button type="button" class="verify-btn" style="padding: 2px 8px; font-size: 0.8rem;">${isVerified ? 'Unverify' : '⭐ Verify'}</button>
                    <button type="button" class="delete-btn" style="padding: 2px 8px; font-size: 0.8rem;">🛡️ Delete</button>
                    ${flags > 0 ? '<button type="button" class="view-btn" style="padding: 2px 6px; font-size: 0.8rem;">Dismiss Flags</button>' : ''}
                ` : ''}
                <button type="button" class="report-btn" style="padding: 2px 6px; font-size: 0.8rem;" title="Report this location">🚩</button>
            </div>
        </div>
    `;

    const editBtn = popupContent.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            marker.closePopup();
            startEditLocation(id, name, displayType, lat, lng, notes);
        });
    }

    const deleteBtn = popupContent.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            marker.closePopup();
            deleteLocation(id, name, isAdmin);
        });
    }

    const verifyBtn = popupContent.querySelector('.verify-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            marker.closePopup();
            toggleVerifyLocation(id, name, isVerified);
        });
    }

    const dismissBtn = popupContent.querySelector('.view-btn');
    if (dismissBtn && flags > 0) {
        dismissBtn.addEventListener('click', () => {
            marker.closePopup();
            clearFlags(id, name);
        });
    }

    const reportBtn = popupContent.querySelector('.report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            marker.closePopup();
            reportLocation(id, name);
        });
    }

    marker.bindPopup(popupContent);

    const setupMarkerA11y = () => {
        const el = marker._icon;
        if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-label', `${displayType}: ${name}`);
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

// 16. Real-Time Sync Store
const markersMap = new Map();

function refreshAllMarkers() {
    markersMap.forEach((data, id) => {
        map.removeLayer(data.marker);
        const marker = createMarker(id, data.lat, data.lng, data.name, data.type, data.notes, data.flags, data.createdBy, data.isVerified, data.isPendingSync || false);
        markersMap.set(id, { ...data, marker });
    });
}

function renderLocationsList() {
    const listEl = document.getElementById('locations-list');
    const countEl = document.getElementById('points-count');
    if (!listEl) return;

    listEl.innerHTML = '';
    const pointsArray = Array.from(markersMap.values());
    if (countEl) countEl.textContent = pointsArray.length;

    pointsArray.forEach((p) => {
        const displayType = (p.type === "Parking") ? "Accessible Parking" : p.type;
        const canEdit = isAdmin || (p.createdBy === myClientId);

        const li = document.createElement('li');
        li.className = 'location-item';
        li.innerHTML = `
            <div class="location-header">
                <div class="location-info">
                    <div>
                        <strong>${p.name}</strong>
                        ${p.isVerified ? '<span class="verified-badge">✓ Verified</span>' : ''}
                        ${p.isPendingSync ? '<span class="pending-sync-badge">⏳ Offline (Sync Pending)</span>' : ''}
                        ${p.flags > 0 ? `<span class="flagged-warning">⚠️ Reported (${p.flags})</span>` : ''}
                    </div>
                    <span class="location-tag">${displayType}</span>
                    ${p.notes ? `<div class="location-notes">♿ ${p.notes}</div>` : ''}
                </div>
            </div>
            <div class="action-btn-group">
                <button type="button" class="view-btn" aria-label="View ${p.name} on map">
                    👁️ View
                </button>
                ${canEdit ? `<button type="button" class="edit-btn" aria-label="Edit ${p.name}">✏️ Edit</button>` : ''}
                ${isAdmin ? `
                    <button type="button" class="verify-btn" aria-label="Verify ${p.name}">${p.isVerified ? 'Unverify' : '⭐ Verify'}</button>
                    <button type="button" class="delete-btn" aria-label="Delete ${p.name}">🛡️ Delete</button>
                    ${p.flags > 0 ? `<button type="button" class="view-btn clear-flags-btn" aria-label="Clear flags">Dismiss</button>` : ''}
                ` : ''}
                <button type="button" class="report-btn" aria-label="Report ${p.name}">
                    🚩 Report
                </button>
            </div>
        `;

        li.querySelector('.view-btn').addEventListener('click', () => {
            map.flyTo([p.lat, p.lng], 14, { duration: 1 });
            p.marker.openPopup();
            announce(`Focused on ${p.name} at zoom level 14`);
        });

        const editBtn = li.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                startEditLocation(p.id, p.name, displayType, p.lat, p.lng, p.notes || "");
            });
        }

        const deleteBtn = li.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteLocation(p.id, p.name, isAdmin);
            });
        }

        const verifyBtn = li.querySelector('.verify-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                toggleVerifyLocation(p.id, p.name, p.isVerified);
            });
        }

        const clearFlagsBtn = li.querySelector('.clear-flags-btn');
        if (clearFlagsBtn) {
            clearFlagsBtn.addEventListener('click', () => {
                clearFlags(p.id, p.name);
            });
        }

        li.querySelector('.report-btn').addEventListener('click', () => {
            reportLocation(p.id, p.name);
        });

        listEl.appendChild(li);
    });
}

// Subscribe to Live Crowdsourced Firestore Updates (With Offline Cache Metadata)
const q = query(locationsCol, orderBy("createdAt", "desc"));
onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const docSnap = change.doc;
        const data = docSnap.data();
        const id = docSnap.id;
        const isPendingSync = docSnap.metadata.hasPendingWrites;

        if (change.type === "added") {
            if (typeof data.lat === 'number' && typeof data.lng === 'number') {
                const marker = createMarker(id, data.lat, data.lng, data.name || "Accessible Point", data.type || "Other", data.notes || "", data.flags || 0, data.createdBy || "", data.isVerified || false, isPendingSync);
                markersMap.set(id, { ...data, id, marker, isPendingSync });
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
                const marker = createMarker(id, data.lat, data.lng, data.name || "Accessible Point", data.type || "Other", data.notes || "", data.flags || 0, data.createdBy || "", data.isVerified || false, isPendingSync);
                markersMap.set(id, { ...data, id, marker, isPendingSync });
            }
        }
    });

    renderLocationsList();
}, (error) => {
    console.warn("Firestore real-time sync notice:", error);
    announce("Working with cached offline points.");
});

// 17. Form Submission (Create or Update with Offline Resilience)
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

        const validation = validateRespectfulName(data.name);
        if (!validation.valid) {
            announce(validation.error);
            alert(validation.error);
            if (locNameInput) locNameInput.focus();
            return;
        }

        const cleanNotes = (data.notes || "").trim().substring(0, 300);

        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = editingLocationId ? "Saving Updates..." : (navigator.onLine ? "Publishing to Live Map..." : "Saving Offline...");

        try {
            if (editingLocationId) {
                await updateDoc(doc(db, "locations", editingLocationId), {
                    name: validation.formatted,
                    type: data.type,
                    lat: lat,
                    lng: lng,
                    notes: cleanNotes,
                    updatedAt: serverTimestamp()
                });

                if (navigator.onLine) {
                    announce(`Success! Updated ${validation.formatted} on the live map.`);
                } else {
                    announce(`Updated ${validation.formatted} offline. It will sync automatically when reconnected.`);
                    alert(`📡 Saved Offline!\n"${validation.formatted}" was updated in your browser's local cache. It will automatically sync to everyone's map as soon as you reconnect to cell service.`);
                }
                cancelEditMode();
            } else {
                const docRef = await addDoc(locationsCol, {
                    name: validation.formatted,
                    type: data.type,
                    lat: lat,
                    lng: lng,
                    notes: cleanNotes,
                    flags: 0,
                    isVerified: isAdmin, // Automatically verified if submitted in Admin Mode
                    createdBy: myClientId,
                    createdAt: serverTimestamp()
                });

                if (navigator.onLine) {
                    announce(`Success! Published ${validation.formatted} live to everyone's map.`);
                } else {
                    announce(`Published ${validation.formatted} offline. It will sync automatically when reconnected.`);
                    alert(`📡 Saved Offline!\n"${validation.formatted}" is saved locally on your device and visible on your map. It will automatically sync to everyone's map when you regain cell service.`);
                }

                form.reset();
                clearDraftLocation();
                isUserTypingCustomName = false;

                showUndoOption(docRef.id, validation.formatted);
            }
        } catch (err) {
            console.error("Error saving point to Firestore:", err);
            announce("Saved to local offline cache. Changes will sync when reconnected.");
            alert("📡 Saved locally on your device! Your submission is stored in the browser offline cache and will sync once cell service is available.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// 18. GeoJSON Export
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
                    type: p.type,
                    notes: p.notes || "",
                    isVerified: p.isVerified || false
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

// 19. Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isHC = document.body.toggleAttribute('data-theme');
        themeToggle.setAttribute('aria-pressed', isHC);
        announce(`High contrast mode ${isHC ? 'enabled' : 'disabled'}`);
    });
}

// 20. Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
