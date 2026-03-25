/* ===================================
   SolarVision — App JavaScript v3
   All UI/UX Improvements Integrated
   =================================== */

// --- State ---
let currentData = null;
let forecastDays = 3;
let radiationChart = null;
let powerChart = null;
let energyChart = null;
let selectedLat = null;
let selectedLon = null;
let currentMode = null;
let mapInitialized = false;
let map = null;
let mapMarker = null;

// Village Mode state
let villageLat = null;
let villageLon = null;
let villagePanel = null;
let lastVillageData = null;

const DEFAULT_LAT = 20.5937;
const DEFAULT_LON = 78.9629;
const DEFAULT_ZOOM = 5;
const GRID_RATE_PER_KWH = 8; // ₹/kWh for cost savings

// --- Appliance constants (expanded) ---
const appliances = {
    waterPump:  { watts: 750, icon: '💧', nameKey: 'appliance_pump' },
    ledBulb:    { watts: 10,  icon: '💡', nameKey: 'appliance_bulb', multiplier: 4 },
    ceilingFan: { watts: 75,  icon: '🌀', nameKey: 'appliance_fan' },
    tv:         { watts: 100, icon: '📺', nameKey: 'appliance_tv' },
    phone:      { watts: 5,   icon: '📱', nameKey: 'appliance_phone', multiplier: 3 },
    fridge:     { watts: 150, icon: '🧊', nameKey: 'appliance_fridge' },
    iron:       { watts: 1000,icon: '👕', nameKey: 'appliance_iron' },
    washer:     { watts: 500, icon: '🧺', nameKey: 'appliance_washer' },
};

// Panel presets for Easy Home Mode
const panelPresets = {
    small:    { area_m2: 1.5,  efficiency_pct: 18, tilt_deg: 30, azimuth_deg: 180 },
    standard: { area_m2: 3.5,  efficiency_pct: 18, tilt_deg: 30, azimuth_deg: 180 },
    large:    { area_m2: 10.0, efficiency_pct: 18, tilt_deg: 30, azimuth_deg: 180 },
};

// ==========================================
// ONBOARDING TOUR (first visit)
// ==========================================
function initOnboarding() {
    if (localStorage.getItem('solarvision-onboarded')) return;
    const tour = document.getElementById('onboarding-tour');
    if (!tour) return;
    tour.style.display = 'flex';
    let step = 0;
    const steps = tour.querySelectorAll('.onboarding-step');
    const dots = tour.querySelectorAll('.onboarding-dot');
    const nextBtn = document.getElementById('onboarding-next');
    const skipBtn = document.getElementById('onboarding-skip');

    function showStep(n) {
        steps.forEach((s, i) => s.style.display = i === n ? 'block' : 'none');
        dots.forEach((d, i) => d.classList.toggle('active', i === n));
        nextBtn.textContent = n === steps.length - 1 ? 'Get Started ✨' : 'Next →';
    }

    nextBtn.addEventListener('click', () => {
        step++;
        if (step >= steps.length) {
            closeTour();
        } else {
            showStep(step);
        }
    });

    skipBtn.addEventListener('click', closeTour);

    function closeTour() {
        tour.style.display = 'none';
        localStorage.setItem('solarvision-onboarded', '1');
    }
}

// ==========================================
// LANGUAGE SELECTOR
// ==========================================
const langSelect = document.getElementById('lang-select');
const savedLang = localStorage.getItem('solarvision-lang') || 'en';
setLanguage(savedLang);
if (langSelect) langSelect.value = savedLang;

langSelect?.addEventListener('change', (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    // Re-render village results if visible
    if (lastVillageData && document.getElementById('village-results-section').style.display !== 'none') {
        displayVillageResults(lastVillageData);
    }
});

// ==========================================
// MODE SELECTION OVERLAY
// ==========================================

// Add a quick way to view the welcome screen again via URL parameter
if (window.location.search.includes('reset=1')) {
    localStorage.removeItem('solarvision-mode');
    localStorage.removeItem('solarvision-onboarded');
    window.history.replaceState({}, document.title, window.location.pathname);
}

const modeOverlay = document.getElementById('mode-overlay');
const appHeader = document.getElementById('app-header');
const mainContent = document.getElementById('main-content');
const professionalModeDiv = document.getElementById('professional-mode');
const easyModeDiv = document.getElementById('easy-mode');

const savedMode = localStorage.getItem('solarvision-mode');
if (savedMode) {
    activateMode(savedMode);
} else {
    modeOverlay.style.display = 'flex';
}

document.getElementById('select-professional').addEventListener('click', () => activateMode('professional'));
document.getElementById('select-easy').addEventListener('click', () => activateMode('easy'));
document.getElementById('switch-mode-btn').addEventListener('click', () => {
    activateMode(currentMode === 'professional' ? 'easy' : 'professional');
});

function activateMode(mode) {
    currentMode = mode;
    localStorage.setItem('solarvision-mode', mode);
    modeOverlay.style.display = 'none';
    appHeader.style.display = 'flex';
    mainContent.style.display = 'block';

    if (mode === 'professional') {
        professionalModeDiv.style.display = 'block';
        easyModeDiv.style.display = 'none';
        if (!mapInitialized) initLeafletMap();
        showMobileBar(true);
        // Show onboarding on first professional mode entry
        initOnboarding();
        // Show map tooltip on first use
        showMapTooltip();
    } else {
        professionalModeDiv.style.display = 'none';
        easyModeDiv.style.display = 'block';
        document.getElementById('village-results-section').style.display = 'none';
        showMobileBar(false);
    }
    applyTranslations();
}

// ==========================================
// THEME TOGGLE (Fixed Sliding Switch)
// ==========================================
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('solarvista-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

const themeThumbIcon = document.getElementById('theme-thumb-icon');
function updateThemeThumb(theme) {
    if (!themeThumbIcon) return;
    themeThumbIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

if (themeToggle) themeToggle.checked = savedTheme === 'light';
updateThemeThumb(savedTheme);

themeToggle?.addEventListener('change', () => {
    const next = themeToggle.checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('solarvista-theme', next);
    updateThemeThumb(next);
    if (currentData) renderCharts(currentData);
});

// ==========================================
// PROFESSIONAL MODE — DOM ELEMENTS
// ==========================================
const form = document.getElementById('prediction-form');
const predictBtn = document.getElementById('predict-btn');
const errorBox = document.getElementById('error-message');
const resultsSection = document.getElementById('results-section');
const resultsSkeleton = document.getElementById('results-skeleton');
const cityInput = document.getElementById('city-input');
const suggestionsList = document.getElementById('city-suggestions');
const mapCoordsDisplay = document.getElementById('map-coords');
const selectedLatInput = document.getElementById('selected-lat');
const selectedLonInput = document.getElementById('selected-lon');
const geoBtn = document.getElementById('use-location-btn');

// Sliders (Advanced)
const panelAreaSlider = document.getElementById('panel-area');
const panelEffSlider = document.getElementById('panel-efficiency');
const panelTiltSlider = document.getElementById('panel-tilt');
const panelCountAdvSlider = document.getElementById('panel-count-adv');
const areaInput = document.getElementById('area-input');
const effInput = document.getElementById('efficiency-input');
const tiltInput = document.getElementById('tilt-input');
const countInputAdv = document.getElementById('count-input-adv');

// Panel Inputs (Simplified)
const panelOrientationSelect = document.getElementById('panel-orientation');
const panelTiltSelect = document.getElementById('panel-tilt-simple');
const panelCountInput = document.getElementById('panel-count');
const panelAgeSelect = document.getElementById('panel-age');

// Toggle Elements
const specsToggleRadios = document.querySelectorAll('input[name="specs_mode"]');
const advancedSpecsDiv = document.getElementById('advanced-specs');
const simplifiedSpecsDiv = document.getElementById('simplified-specs');

// ==========================================
// MAP TOOLTIP (first-use)
// ==========================================
function showMapTooltip() {
    if (localStorage.getItem('solarvision-map-tooltip-dismissed')) return;
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.style.display = 'flex';
}

document.getElementById('map-tooltip-close')?.addEventListener('click', () => {
    document.getElementById('map-tooltip').style.display = 'none';
    localStorage.setItem('solarvision-map-tooltip-dismissed', '1');
});

// ==========================================
// FORM STEP INDICATORS
// ==========================================
function updateFormSteps() {
    const steps = document.querySelectorAll('.form-step');
    const hasLocation = selectedLat !== null || cityInput.value.trim().length > 0;
    const hasPanels = true; // Always configured via defaults

    steps.forEach(s => {
        s.classList.remove('active', 'completed');
    });

    if (hasLocation) {
        steps[0]?.classList.add('completed');
        steps[1]?.classList.add('active');
    } else {
        steps[0]?.classList.add('active');
    }
    if (hasLocation && hasPanels) {
        steps[1]?.classList.add('completed');
        steps[2]?.classList.add('active');
    }
}

cityInput?.addEventListener('input', updateFormSteps);

// ==========================================
// SETUP MODE TOGGLE
// ==========================================
specsToggleRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'advanced') {
            advancedSpecsDiv.style.display = 'grid';
            simplifiedSpecsDiv.style.display = 'none';
        } else {
            advancedSpecsDiv.style.display = 'none';
            simplifiedSpecsDiv.style.display = 'grid';
        }
    });
});

// ==========================================
// SLIDER & MANUAL INPUT SYNC
// ==========================================
function syncSliderAndInput(slider, input) {
    if (!slider || !input) return;
    
    // Slider changes update Input
    slider.addEventListener('input', () => {
        input.value = slider.value;
    });
    
    // Input changes update Slider
    input.addEventListener('input', () => {
        let val = parseFloat(input.value);
        let min = parseFloat(slider.min);
        let max = parseFloat(slider.max);
        
        if (!isNaN(val)) {
            if (val >= min && val <= max) {
                slider.value = val;
            } else if (val > max) {
                slider.value = max;
            } else if (val < min) {
                slider.value = min;
            }
        }
    });

    // Enforce min/max boundaries visually when input loses focus
    input.addEventListener('blur', () => {
        let val = parseFloat(input.value);
        let min = parseFloat(slider.min);
        let max = parseFloat(slider.max);
        
        if (isNaN(val) || val < min) input.value = min;
        else if (val > max) input.value = max;
    });
}

syncSliderAndInput(panelAreaSlider, areaInput);
syncSliderAndInput(panelEffSlider, effInput);
syncSliderAndInput(panelTiltSlider, tiltInput);
syncSliderAndInput(panelCountAdvSlider, countInputAdv);

// ==========================================
// ADVANCED CAPACITY PREVIEW
// ==========================================
function updateAdvancedCapacity() {
    const area = parseFloat(panelAreaSlider.value) || 0;
    const eff = (parseFloat(panelEffSlider.value) || 0) / 100;
    
    // Formula: Area (m2) * 1000 W/m2 (Standard irradiance) * Efficiency
    const peakPower_kW = (area * 1000 * eff) / 1000;
    // Assuming 5 hours of peak sun on a clear day for theoretical max
    const maxYield_kWh = peakPower_kW * 5;

    const peakEl = document.getElementById('adv-peak');
    const yieldEl = document.getElementById('adv-yield');
    
    if (peakEl) peakEl.innerHTML = `${peakPower_kW.toFixed(2)} <small>kW</small>`;
    if (yieldEl) yieldEl.innerHTML = `~${maxYield_kWh.toFixed(1)} <small>kWh</small>`;
    
    // Add brief highlight animation
    [peakEl, yieldEl].forEach(el => {
        if (!el) return;
        el.classList.remove('updated');
        void el.offsetWidth; // trigger reflow
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 500);
    });
}

// Attach to relevant advanced sliders and inputs
[panelAreaSlider, areaInput, panelEffSlider, effInput].forEach(el => {
    el?.addEventListener('input', updateAdvancedCapacity);
});

// Initialize once
setTimeout(updateAdvancedCapacity, 150);

// ==========================================
// PANEL SPECS PARSER
// ==========================================
function getPanelSpecs() {
    const isAdvanced = document.querySelector('input[name="specs_mode"]:checked').value === 'advanced';
    const badge = document.getElementById('confidence-badge');
    const badgeText = document.getElementById('confidence-level');

    if (isAdvanced) {
        if (badge && badgeText) {
            badge.style.display = 'inline-block';
            badge.className = 'confidence-badge high-confidence';
            badgeText.textContent = 'High (Advanced Details)';
        }
        return {
            area_m2: parseFloat(panelAreaSlider.value),
            efficiency_pct: parseFloat(panelEffSlider.value),
            tilt_deg: parseFloat(panelTiltSlider.value),
            azimuth_deg: 180
        };
    }

    let providedDetails = false;
    let area_m2 = 1.6, tilt_deg = 30, efficiency_pct = 18.0, azimuth_deg = 180;

    const countVal = parseInt(panelCountInput.value);
    if (!isNaN(countVal) && countVal > 0) { area_m2 = countVal * 1.6; providedDetails = true; }

    const tiltVal = panelTiltSelect.value;
    if (tiltVal === 'Flat') { tilt_deg = 0; providedDetails = true; }
    else if (tiltVal === 'Steep') { tilt_deg = 60; providedDetails = true; }
    else if (tiltVal === 'Medium') { tilt_deg = 30; providedDetails = true; }

    const orientVal = panelOrientationSelect.value;
    if (orientVal === 'N') { azimuth_deg = 0; providedDetails = true; }
    else if (orientVal === 'E') { azimuth_deg = 90; providedDetails = true; }
    else if (orientVal === 'S') { azimuth_deg = 180; providedDetails = true; }
    else if (orientVal === 'W') { azimuth_deg = 270; providedDetails = true; }

    const ageVal = panelAgeSelect.value;
    if (ageVal === '0-5') { efficiency_pct = 18.0; providedDetails = true; }
    else if (ageVal === '5-10') { efficiency_pct = 16.2; providedDetails = true; }
    else if (ageVal === '10+') { efficiency_pct = 14.4; providedDetails = true; }

    if (badge && badgeText) {
        badge.style.display = 'inline-block';
        if (providedDetails) {
            badge.className = 'confidence-badge high-confidence';
            badgeText.textContent = 'High (Custom Details)';
        } else {
            badge.className = 'confidence-badge medium-confidence';
            badgeText.textContent = 'Medium (Default Assumptions)';
        }
    }
    return { area_m2, tilt_deg, efficiency_pct, azimuth_deg };
}

// ==========================================
// SMART ESTIMATE CARD (Quick Setup)
// ==========================================
function updateSmartEstimate() {
    let area_m2 = 1.6, tilt_deg = 30, efficiency_pct = 18.0;

    const countVal = parseInt(panelCountInput.value);
    if (!isNaN(countVal) && countVal > 0) area_m2 = countVal * 1.6;

    const tiltVal = panelTiltSelect.value;
    if (tiltVal === 'Flat') tilt_deg = 0;
    else if (tiltVal === 'Steep') tilt_deg = 60;
    
    const ageVal = panelAgeSelect.value;
    if (ageVal === '5-10') efficiency_pct = 16.2;
    else if (ageVal === '10+') efficiency_pct = 14.4;

    const sizeEl = document.getElementById('est-size');
    const effEl = document.getElementById('est-eff');
    const tiltEl = document.getElementById('est-tilt');
    
    if (sizeEl) sizeEl.textContent = `~${area_m2.toFixed(1)} m²`;
    if (effEl) effEl.textContent = `${efficiency_pct.toFixed(1)}%`;
    if (tiltEl) tiltEl.textContent = `${tilt_deg}°`;
    
    // Add brief highlight animation
    [sizeEl, effEl, tiltEl].forEach(el => {
        if (!el) return;
        el.classList.remove('updated');
        void el.offsetWidth; // trigger reflow
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 500);
    });
}

// Attach listeners
panelCountInput?.addEventListener('input', updateSmartEstimate);
panelTiltSelect?.addEventListener('change', updateSmartEstimate);
panelAgeSelect?.addEventListener('change', updateSmartEstimate);
panelOrientationSelect?.addEventListener('change', updateSmartEstimate);

// Initialize once
setTimeout(updateSmartEstimate, 100);

// ==========================================
// DAY SELECTOR
// ==========================================
document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.day-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        forecastDays = parseInt(btn.dataset.days);
    });
});

// ==========================================
// CHART TABS
// ==========================================
document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.chart-tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        const chartId = tab.dataset.chart;
        document.querySelectorAll('.chart-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById(`chart-panel-${chartId}`);
        if (panel) panel.style.display = 'block';

        // Resize chart to fix canvas rendering
        setTimeout(() => {
            if (chartId === 'radiation' && radiationChart) radiationChart.resize();
            if (chartId === 'power' && powerChart) powerChart.resize();
            if (chartId === 'energy' && energyChart) energyChart.resize();
        }, 50);
    });
});

// ==========================================
// CITY AUTOCOMPLETE
// ==========================================
let debounceTimer;
cityInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = cityInput.value.trim();
    if (query.length < 2) { suggestionsList.classList.remove('show'); return; }
    debounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/cities?q=${encodeURIComponent(query)}`);
            const cities = await res.json();
            if (cities.length > 0) {
                suggestionsList.innerHTML = cities.map(c => `<li data-city="${c}">${c}</li>`).join('');
                suggestionsList.classList.add('show');
            } else {
                suggestionsList.classList.remove('show');
            }
        } catch (e) { console.error('Autocomplete error:', e); }
    }, 200);
});

suggestionsList?.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
        cityInput.value = e.target.dataset.city;
        suggestionsList.classList.remove('show');
        syncMapToCity(e.target.dataset.city);
        updateFormSteps();
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) suggestionsList?.classList.remove('show');
});

// ==========================================
// LEAFLET MAP
// ==========================================
function initLeafletMap() {
    if (mapInitialized) return;
    map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LON], DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
    }).addTo(map);

    mapMarker = L.marker([DEFAULT_LAT, DEFAULT_LON], { draggable: true, autoPan: true }).addTo(map);

    map.on('click', (e) => {
        mapMarker.setLatLng([e.latlng.lat, e.latlng.lng]);
        setSelectedCoords(e.latlng.lat, e.latlng.lng);
        reverseGeocodeAndFill(e.latlng.lat, e.latlng.lng);
        // Dismiss map tooltip on first click
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) { tooltip.style.display = 'none'; localStorage.setItem('solarvision-map-tooltip-dismissed', '1'); }
    });

    mapMarker.on('dragend', () => {
        const pos = mapMarker.getLatLng();
        setSelectedCoords(pos.lat, pos.lng);
        reverseGeocodeAndFill(pos.lat, pos.lng);
    });
    mapInitialized = true;
}

function triggerMapFocusRipple(lat, lon) {
    if (!map || !mapInitialized) return;
    const container = map.getContainer();
    if (!container) return;
    const point = map.latLngToContainerPoint([lat, lon]);
    const ripple = document.createElement('div');
    ripple.className = 'map-focus-ripple';
    ripple.style.left = `${point.x}px`;
    ripple.style.top = `${point.y}px`;
    container.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

function setSelectedCoords(lat, lon) {
    selectedLat = lat; selectedLon = lon;
    selectedLatInput.value = lat.toFixed(6);
    selectedLonInput.value = lon.toFixed(6);
    mapCoordsDisplay.textContent = `📍 ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
    mapCoordsDisplay.classList.add('active');
    triggerMapFocusRipple(lat, lon);
    updateFormSteps();
}

function clearSelectedCoords() {
    selectedLat = null; selectedLon = null;
    selectedLatInput.value = ''; selectedLonInput.value = '';
    mapCoordsDisplay.textContent = 'Click on the map to select a location';
    mapCoordsDisplay.classList.remove('active');
    updateFormSteps();
}

let reverseGeoTimer;
function reverseGeocodeAndFill(lat, lon) {
    clearTimeout(reverseGeoTimer);
    reverseGeoTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            if (data?.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || '';
                if (city) cityInput.value = city;
            }
        } catch (err) { console.warn('Reverse geocode failed:', err); }
    }, 300);
}

// ==========================================
// GEOLOCATION (Professional)
// ==========================================
geoBtn?.addEventListener('click', () => {
    if (!navigator.geolocation) { showError('Geolocation is not supported by your browser.'); return; }
    geoBtn.classList.add('loading');
    geoBtn.textContent = '⏳ Locating...';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude, lon = pos.coords.longitude;
            if (map) { map.setView([lat, lon], 12); mapMarker.setLatLng([lat, lon]); }
            setSelectedCoords(lat, lon);
            reverseGeocodeAndFill(lat, lon);
            geoBtn.classList.remove('loading');
            geoBtn.innerHTML = '<span aria-hidden="true">📍</span> Use Current Location';
        },
        (error) => {
            geoBtn.classList.remove('loading');
            geoBtn.innerHTML = '<span aria-hidden="true">📍</span> Use Current Location';
            const msgs = {
                [error.PERMISSION_DENIED]: 'Location permission denied. Please allow location access in your browser settings.',
                [error.POSITION_UNAVAILABLE]: 'Location information is unavailable.',
                [error.TIMEOUT]: 'Location request timed out. Please try again.',
            };
            showError(msgs[error.code] || 'An unknown error occurred.', true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
});

function syncMapToCity(cityName) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`, { headers: { 'Accept-Language': 'en' } })
    .then(r => r.json())
    .then(results => {
        if (results?.length > 0) {
            const lat = parseFloat(results[0].lat), lon = parseFloat(results[0].lon);
            if (map) { map.setView([lat, lon], 10); mapMarker.setLatLng([lat, lon]); }
            setSelectedCoords(lat, lon);
        }
    })
    .catch(err => console.warn('Geocode failed:', err));
}

// ==========================================
// PREDICTION PROGRESS STEPPER
// ==========================================
function showProgressStepper() {
    const prog = document.getElementById('prediction-progress');
    if (!prog) return;
    prog.style.display = 'block';
    const steps = prog.querySelectorAll('.progress-step');
    steps.forEach(s => { s.classList.remove('active', 'done'); });

    let stepIdx = 0;
    function advanceStep() {
        if (stepIdx > 0) steps[stepIdx - 1]?.classList.replace('active', 'done');
        if (stepIdx < steps.length) {
            steps[stepIdx]?.classList.add('active');
            stepIdx++;
            setTimeout(advanceStep, 1200);
        }
    }
    advanceStep();
}

function hideProgressStepper() {
    const prog = document.getElementById('prediction-progress');
    if (prog) prog.style.display = 'none';
}

// ==========================================
// PREDICTION FORM SUBMIT
// ==========================================
let lastPayload = null;

form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await doPrediction();
});

// Mobile sticky bar predict button
document.getElementById('mobile-predict-btn')?.addEventListener('click', () => {
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
});

async function doPrediction() {
    errorBox.style.display = 'none';
    const city = cityInput.value.trim();
    if (!city && selectedLat === null) {
        showError('Please select a location on the map or enter a city name.');
        return;
    }

    setLoading(true);
    showProgressStepper();
    // Show skeleton
    if (resultsSkeleton) resultsSkeleton.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';

    try {
        const payload = { city, panel_specs: getPanelSpecs(), forecast_days: forecastDays };
        if (selectedLat !== null && selectedLon !== null) { payload.lat = selectedLat; payload.lon = selectedLon; }
        lastPayload = payload;

        const res = await fetch('/predict', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Prediction failed. Please try again.', true);
            setLoading(false); hideProgressStepper();
            if (resultsSkeleton) resultsSkeleton.style.display = 'none';
            return;
        }

        currentData = data;
        hideProgressStepper();
        if (resultsSkeleton) resultsSkeleton.style.display = 'none';
        displayResults(data);
        setLoading(false);
        resultsSection.style.display = 'block';
        // Stagger animate results
        staggerAnimateResults();
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        console.error('Fetch error:', err);
        showError('Network error. Please check your connection and try again.', true);
        setLoading(false); hideProgressStepper();
        if (resultsSkeleton) resultsSkeleton.style.display = 'none';
    }
}

function setLoading(loading) {
    if (predictBtn) {
        predictBtn.disabled = loading;
        const btnText = predictBtn.querySelector('.btn-text');
        const btnLoader = predictBtn.querySelector('.btn-loader');
        if (btnText) btnText.style.display = loading ? 'none' : 'inline';
        if (btnLoader) btnLoader.style.display = loading ? 'inline' : 'none';
    }
}

function showError(msg, showRetry = false) {
    const textEl = errorBox.querySelector('.error-text-content');
    if (textEl) textEl.textContent = msg;
    else errorBox.textContent = msg;
    errorBox.style.display = 'flex';
    const retryBtn = document.getElementById('error-retry-btn');
    if (retryBtn) retryBtn.style.display = showRetry ? 'inline-block' : 'none';
}

// Retry button
document.getElementById('error-retry-btn')?.addEventListener('click', () => {
    if (lastPayload) doPrediction();
});

// ==========================================
// STAGGER ANIMATIONS
// ==========================================
function staggerAnimateResults() {
    const items = resultsSection.querySelectorAll('.stagger-item');
    items.forEach((item, i) => {
        item.classList.remove('visible');
        setTimeout(() => { item.classList.add('visible'); }, 100 + i * 120);
    });
}

// ==========================================
// DISPLAY RESULTS (Professional)
// ==========================================
function displayResults(data) {
    document.getElementById('result-city').textContent = data.location.city;
    document.getElementById('result-coords').textContent = `${data.location.lat}°N, ${data.location.lon}°E`;

    const cw = data.current.weather;
    if (cw) {
        document.getElementById('current-weather').innerHTML = `
            <div>
                <div class="weather-temp">${Math.round(cw.temperature)}°C</div>
                <div class="weather-desc">${cw.description}</div>
            </div>
            <span class="weather-icon-large" aria-hidden="true">${getWeatherEmoji(cw.main)}</span>
        `;
    }

    animateValue('val-radiation', data.total.peak_radiation_wm2, 1);
    animateValue('val-power', data.total.peak_power_w, 1);
    animateValue('val-energy', data.total.energy_kwh, 2);
    animateValue('val-co2', data.total.co2_savings_kg, 2);

    const env = data.total.environmental;
    document.getElementById('env-trees').textContent = env.trees_planted.toFixed(2);
    document.getElementById('env-cars').textContent = env.cars_off_road.toFixed(3);
    document.getElementById('env-phones').textContent = Math.round(env.phone_charges).toLocaleString();
    document.getElementById('env-led').textContent = Math.round(env.led_bulb_hours).toLocaleString();

    if (data.daily.length > 0 && data.daily[0].peak_hour) {
        const peak = data.daily[0].peak_hour;
        document.getElementById('peak-time').textContent = `${peak.hour}:00`;
        document.getElementById('peak-radiation').textContent = `${peak.radiation_wm2.toFixed(1)} W/m²`;
        document.getElementById('peak-tip').textContent =
            `Best time for solar energy capture on ${data.daily[0].date}. Schedule high-usage appliances around this time.`;
    }

    // Insight banner
    const insightBanner = document.getElementById('insight-banner');
    const insightText = document.getElementById('insight-text');
    if (insightBanner && insightText) {
        const kwh = data.total.energy_kwh;
        const homes = (kwh / 10).toFixed(1);
        const phones = Math.round(kwh * 1000 / 12);
        insightText.textContent = `Your panels will produce ${kwh.toFixed(2)} kWh — enough to charge ${phones} smartphones or power a home for ${homes} hours.`;
        insightBanner.style.display = 'flex';
    }

    const tbody = document.getElementById('daily-tbody');
    tbody.innerHTML = data.daily.map(day => `
        <tr>
            <td>${formatDate(day.date)}</td>
            <td>${day.daily_energy_kwh.toFixed(2)}</td>
            <td>${day.co2_savings_kg.toFixed(3)}</td>
            <td>${day.peak_hour ? day.peak_hour.hour + ':00' : '—'}</td>
        </tr>
    `).join('');

    renderCharts(data);
}

// ==========================================
// CHART RENDERING
// ==========================================
function renderCharts(data) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#8892b0' : '#4a5568';

    const allHourly = [];
    data.daily.forEach(day => { if (day.hours_data) day.hours_data.forEach(h => allHourly.push(h)); });
    if (allHourly.length === 0) return;

    const labels = allHourly.map(h => {
        const dt = new Date(h.datetime);
        return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
    });
    const radiationData = allHourly.map(h => h.radiation_wm2);
    const powerData = allHourly.map(h => h.panel_power_w || 0);
    let cumulative = 0;
    const cumulativeData = allHourly.map(h => { cumulative += (h.energy_wh || 0); return Math.round(cumulative * 100) / 100; });
    const weatherEmojis = allHourly.map(h => getWeatherEmoji(h.weather_main));

    const commonOpts = {
        responsive: true, maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 1200, easing: 'easeOutCubic' },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isDark ? 'rgba(10,14,26,0.9)' : 'rgba(255,255,255,0.95)',
                titleColor: isDark ? '#f0f0f5' : '#1a1a2e',
                bodyColor: isDark ? '#8892b0' : '#4a5568',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1, cornerRadius: 10, padding: 12, displayColors: false,
            },
        },
        scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 24 } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, beginAtZero: true },
        },
    };

    if (radiationChart) radiationChart.destroy();
    radiationChart = new Chart(document.getElementById('radiation-chart'), {
        type: 'line', data: { labels, datasets: [{ label: 'Solar Radiation (W/m²)', data: radiationData,
            borderColor: isDark ? '#ffb347' : '#e6930e', backgroundColor: isDark ? 'rgba(255,179,71,0.1)' : 'rgba(230,147,14,0.1)',
            borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6,
            pointHoverBackgroundColor: isDark ? '#ffb347' : '#e6930e' }] },
        options: { ...commonOpts, plugins: { ...commonOpts.plugins, tooltip: { ...commonOpts.plugins.tooltip,
            callbacks: { title: (items) => labels[items[0].dataIndex], label: (item) => `${weatherEmojis[item.dataIndex]} ${item.parsed.y.toFixed(1)} W/m²` } } },
            scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, title: { display: true, text: 'W/m²', color: textColor } } } },
    });

    if (powerChart) powerChart.destroy();
    powerChart = new Chart(document.getElementById('power-chart'), {
        type: 'line', data: { labels, datasets: [{ label: 'Panel Power (W)', data: powerData,
            borderColor: isDark ? '#64ffda' : '#0d9b76', backgroundColor: isDark ? 'rgba(100,255,218,0.1)' : 'rgba(13,155,118,0.1)',
            borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6,
            pointHoverBackgroundColor: isDark ? '#64ffda' : '#0d9b76' }] },
        options: { ...commonOpts, plugins: { ...commonOpts.plugins, tooltip: { ...commonOpts.plugins.tooltip,
            callbacks: { label: (item) => `⚡ ${item.parsed.y.toFixed(1)} W` } } },
            scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, title: { display: true, text: 'Watts', color: textColor } } } },
    });

    if (energyChart) energyChart.destroy();
    energyChart = new Chart(document.getElementById('energy-chart'), {
        type: 'line', data: { labels, datasets: [{ label: 'Cumulative Energy (Wh)', data: cumulativeData,
            borderColor: isDark ? '#7c4dff' : '#5e35b1', backgroundColor: isDark ? 'rgba(124,77,255,0.1)' : 'rgba(94,53,177,0.1)',
            borderWidth: 2.5, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 6,
            pointHoverBackgroundColor: isDark ? '#7c4dff' : '#5e35b1' }] },
        options: { ...commonOpts, plugins: { ...commonOpts.plugins, tooltip: { ...commonOpts.plugins.tooltip,
            callbacks: { label: (item) => { const wh = item.parsed.y; return wh > 1000 ? `🔋 ${(wh/1000).toFixed(2)} kWh` : `🔋 ${wh.toFixed(1)} Wh`; } } } },
            scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, title: { display: true, text: 'Wh', color: textColor } } } },
    });
}

// ==========================================
// CSV DOWNLOAD
// ==========================================
document.getElementById('download-csv')?.addEventListener('click', async () => {
    if (!currentData) return;
    try {
        const allHourly = [];
        currentData.daily.forEach(day => { if (day.hours_data) day.hours_data.forEach(h => allHourly.push(h)); });
        const res = await fetch('/download/csv', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hourly: allHourly, daily: currentData.daily, city: currentData.location.city, total: currentData.total }),
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `solar_forecast_${currentData.location.city.replace(/\s/g, '_')}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { console.error('Download error:', err); showError('Failed to download CSV.'); }
});

// ==========================================
// SHARE RESULTS
// ==========================================
document.getElementById('share-results')?.addEventListener('click', async () => {
    if (!currentData) return;
    const text = `☀️ SolarVision Prediction for ${currentData.location.city}\n` +
        `⚡ Total Energy: ${currentData.total.energy_kwh.toFixed(2)} kWh\n` +
        `🌱 CO₂ Saved: ${currentData.total.co2_savings_kg.toFixed(2)} kg\n` +
        `🏆 Peak: ${currentData.daily[0]?.peak_hour?.hour || '—'}:00\n` +
        `\nPowered by SolarVision`;

    if (navigator.share) {
        try { await navigator.share({ title: 'SolarVision Prediction', text }); } catch(e) { /* cancelled */ }
    } else {
        try { await navigator.clipboard.writeText(text); alert('Results copied to clipboard!'); } catch(e) { alert(text); }
    }
});

// ==========================================
// EASY HOME MODE (Premium Wizard & Battery)
// ==========================================
const easyStep1 = document.getElementById('easy-step-1');
const easyStep2 = document.getElementById('easy-step-2');
const villageGeoBtn = document.getElementById('village-geo-btn');
const villageLocationStatus = document.getElementById('village-location-status');
const villageLocationText = document.getElementById('village-location-text');
const villagePredictBtn = document.getElementById('village-predict-btn');
const villageError = document.getElementById('village-error');
const svgPanelsGroup = document.getElementById('svg-panels');

// Step 1: Detect Location
villageGeoBtn?.addEventListener('click', () => {
    if (!navigator.geolocation) { showVillageError(t('location_failed')); return; }
    villageGeoBtn.disabled = true;
    villageGeoBtn.querySelector('.btn-text-geo').textContent = t('locating');
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);

    setTimeout(() => { // Artificial delay to enjoy the radar ping animation
        navigator.geolocation.getCurrentPosition(
            (position) => {
                villageLat = position.coords.latitude;
                villageLon = position.coords.longitude;
                document.getElementById('village-lat').value = villageLat;
                document.getElementById('village-lon').value = villageLon;
                reverseGeocodeVillage(villageLat, villageLon);
                villageGeoBtn.disabled = false;
                villageGeoBtn.querySelector('.btn-text-geo').textContent = t('find_my_home');
                if (navigator.vibrate) navigator.vibrate(50);
                
                // Show Step 2 organically
                easyStep2.style.display = 'block';
                setTimeout(() => { easyStep2.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
            },
            (error) => {
                villageGeoBtn.disabled = false;
                villageGeoBtn.querySelector('.btn-text-geo').textContent = t('find_my_home');
                showVillageError(error.code === error.PERMISSION_DENIED ? t('location_denied') : t('location_failed'));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    }, 800); 
});

function reverseGeocodeVillage(lat, lon) {
    const fallbackText = `${t('location_fixed')}: ${lat.toFixed(4)}, ${lon.toFixed(4)} ✅`;
    villageLocationStatus.style.display = 'inline-flex';
    villageLocationText.textContent = fallbackText;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, { headers: { 'Accept-Language': 'en' } })
    .then(r => r.json())
    .then(data => {
        if (data?.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || '';
            if (city) villageLocationText.textContent = `${t('location_fixed')}: ${city} ✅`;
        }
    })
    .catch(() => {});
}

// Draw dynamically expanding panels on SVG House
function drawHousePanels(size) {
    svgPanelsGroup.innerHTML = '';
    const panelRect = `<rect width="20" height="26" fill="url(#panel-grad)" rx="2" class="svg-panel-item" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>`;
    let panels = [];
    if (size === 'small') panels = [{x: 80, y:30}];
    else if (size === 'standard') panels = [{x: 65, y:30}, {x: 95, y:30}];
    else if (size === 'large') panels = [{x: 50, y:30}, {x: 80, y:30}, {x: 110, y:30}, {x: 65, y:60}, {x: 95, y:60}, {x: 125, y:60}];
    
    panels.forEach((p, i) => {
        const pan = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pan.innerHTML = panelRect;
        pan.setAttribute('transform', `translate(${p.x}, ${p.y}) skewX(-20)`);
        pan.querySelector('.svg-panel-item').style.animationDelay = `${i * 0.1}s`;
        svgPanelsGroup.appendChild(pan);
    });
}

// Panel Picker
const panelCards = document.querySelectorAll('.village-panel-card');
panelCards.forEach(card => {
    card.addEventListener('click', () => {
        panelCards.forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        villagePanel = card.dataset.panel;
        drawHousePanels(villagePanel);
        updateVillagePredictBtn();
        if (navigator.vibrate) navigator.vibrate(20);
    });
});

function updateVillagePredictBtn() {
    villagePredictBtn.disabled = !(villageLat !== null && villagePanel !== null);
}

// Village Predict
villagePredictBtn?.addEventListener('click', async () => {
    if (villageLat === null || villagePanel === null) return;
    villageError.style.display = 'none';
    setVillageLoading(true);
    if (navigator.vibrate) navigator.vibrate(30);

    try {
        const payload = { city: '', lat: villageLat, lon: villageLon, panel_specs: panelPresets[villagePanel], forecast_days: 1 };
        const res = await fetch('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { showVillageError(data.error || 'Prediction failed.'); setVillageLoading(false); return; }
        displayVillageResults(data);
        setVillageLoading(false);
    } catch (err) {
        console.error('Village predict error:', err);
        showVillageError('Network error. Please try again.');
        setVillageLoading(false);
    }
});

function setVillageLoading(loading) {
    villagePredictBtn.disabled = loading;
    villagePredictBtn.querySelector('.village-btn-text').style.display = loading ? 'none' : 'inline';
    villagePredictBtn.querySelector('.village-btn-loader').style.display = loading ? 'inline-flex' : 'none';
}

function showVillageError(msg) {
    const textEl = villageError.querySelector('.error-text-content');
    if (textEl) textEl.textContent = msg;
    else villageError.textContent = msg;
    villageError.style.display = 'block';
}

// ==========================================
// DISPLAY VILLAGE RESULTS & BATTERY APP
// ==========================================
let batteryState = {
    totalKwh: 0,
    remainingKwh: 0,
    appliances: {}
};

function displayVillageResults(data) {
    lastVillageData = data;
    const totalKwh = data.total.energy_kwh;
    
    // Safety buffer
    batteryState.totalKwh = totalKwh * 0.8; 
    batteryState.remainingKwh = batteryState.totalKwh;
    batteryState.appliances = {}; // reset toggles

    const villageResults = document.getElementById('village-results-section');
    villageResults.style.display = 'block';
    villageResults.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('initial-kwh-label').textContent = batteryState.totalKwh.toFixed(2);
    updateBatteryVisuals();
    
    // Confetti effect on good yield
    if (totalKwh > 2) triggerConfetti();

    // Cost savings card
    const savings = totalKwh * GRID_RATE_PER_KWH;
    animateValue('village-savings-amount', savings, 0);

    // Weather cue (Apple Style widget)
    const cw = data.current?.weather;
    const weatherCue = document.getElementById('village-weather-cue');
    const weatherBg = document.getElementById('weather-bg');
    if (cw) {
        weatherCue.style.display = 'block';
        document.getElementById('village-weather-emoji').textContent = getWeatherEmoji(cw.main);
        document.getElementById('village-weather-temp').textContent = `${Math.round(cw.temperature)}°C`;
        document.getElementById('village-weather-desc').textContent = cw.description;
        
        weatherBg.className = 'weather-bg-gradient'; // reset
        const mainLower = cw.main.toLowerCase();
        if (mainLower.includes('clear')) weatherBg.classList.add('clear');
        else if (mainLower.includes('cloud')) weatherBg.classList.add('clouds');
        else if (mainLower.includes('rain') || mainLower.includes('drizzle')) weatherBg.classList.add('rain');
    } else {
        weatherCue.style.display = 'none';
    }

    // Build Appliance Toggles
    const applianceGrid = document.getElementById('village-appliance-grid');
    applianceGrid.innerHTML = '';

    for (const [key, appliance] of Object.entries(appliances)) {
        const effectiveWatts = appliance.multiplier ? appliance.watts * appliance.multiplier : appliance.watts;
        const kwhDrain = (effectiveWatts * 1) / 1000; // Define drain per 1 hour of use

        const pill = document.createElement('div');
        pill.className = 'appliance-pill glass-card hover-glow';
        pill.dataset.key = key;
        pill.dataset.drain = kwhDrain;
        
        pill.innerHTML = `
            <span class="app-icon" aria-hidden="true">${appliance.icon}</span>
            <span class="app-name">${t(appliance.nameKey)}</span>
            <span class="app-drain">-${kwhDrain.toFixed(2)} kWh/hr</span>
        `;
        
        pill.addEventListener('click', toggleAppliance);
        applianceGrid.appendChild(pill);
    }
}

function toggleAppliance(e) {
    const pill = e.currentTarget;
    const key = pill.dataset.key;
    const drain = parseFloat(pill.dataset.drain);
    
    // Toggle state
    if (batteryState.appliances[key]) {
        delete batteryState.appliances[key];
        pill.classList.remove('active');
        batteryState.remainingKwh += drain;
        if (navigator.vibrate) navigator.vibrate(10);
    } else {
        batteryState.appliances[key] = true;
        pill.classList.add('active');
        batteryState.remainingKwh -= drain;
        if (navigator.vibrate) navigator.vibrate([10, 30, 20]);
    }
    
    updateBatteryVisuals();
}

function updateBatteryVisuals() {
    // Math
    const pct = Math.max(0, Math.min(100, (batteryState.remainingKwh / batteryState.totalKwh) * 100));
    
    // DOM
    const liquid = document.getElementById('battery-liquid');
    const pctText = document.getElementById('battery-percent-text');
    const kwhText = document.getElementById('battery-kwh-text');
    const statusDot = document.getElementById('village-status-dot');
    const statusText = document.getElementById('village-status-text');
    
    liquid.style.height = `${pct}%`;
    pctText.textContent = Math.round(pct);
    kwhText.textContent = `${Math.max(0, batteryState.remainingKwh).toFixed(2)} kWh left`;
    
    // Colors and warnings
    liquid.className = 'battery-liquid';
    if (pct < 20) {
        liquid.classList.add('danger');
        statusDot.className = 'village-status-dot status-low';
        statusText.textContent = 'Warning: Battery low!';
        statusText.className = 'village-status-text color-low';
    } else if (pct < 50) {
        liquid.classList.add('warning');
        statusDot.className = 'village-status-dot status-ok';
        statusText.textContent = 'Careful power usage';
        statusText.className = 'village-status-text color-ok';
    } else {
        statusDot.className = 'village-status-dot status-good';
        statusText.textContent = 'Plenty of power';
        statusText.className = 'village-status-text color-good';
    }
}

function triggerConfetti() {
    for (let i = 0; i < 50; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.animationDelay = Math.random() * 2 + 's';
        conf.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 4000);
    }
}

// Predict Again
document.getElementById('village-predict-again')?.addEventListener('click', () => {
    document.getElementById('village-results-section').style.display = 'none';
    easyStep2.style.display = 'none';
    villageLat = null; villageLon = null; villagePanel = null;
    villageLocationStatus.style.display = 'none';
    panelCards.forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
    svgPanelsGroup.innerHTML = ''; // Clear SVG roof panels
    updateVillagePredictBtn();
    document.getElementById('easy-step-1').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ==========================================
// MOBILE STICKY BAR
// ==========================================
function showMobileBar(show) {
    const bar = document.getElementById('mobile-sticky-bar');
    if (!bar) return;
    if (window.innerWidth <= 768 && show && currentMode === 'professional') {
        bar.style.display = 'block';
    } else {
        bar.style.display = 'none';
    }
}

window.addEventListener('resize', () => showMobileBar(currentMode === 'professional'));

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function getWeatherEmoji(main) {
    const map = { 'Clear': '☀️', 'Clouds': '⛅', 'Rain': '🌧️', 'Drizzle': '🌦️',
        'Thunderstorm': '⛈️', 'Snow': '🌨️', 'Mist': '🌫️', 'Fog': '🌫️',
        'Haze': '🌫️', 'Smoke': '🌫️', 'Dust': '🌪️' };
    return map[main] || '🌤️';
}

function animateValue(elementId, value, decimals) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const duration = 1000;
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4); // quartic easing for more drama
        element.textContent = (value * eased).toFixed(decimals);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function formatDate(dateStr) {
    const dt = new Date(dateStr);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
