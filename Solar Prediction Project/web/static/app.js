/* ===================================
   SolarVista — App JavaScript
   Chart.js, API calls, Theme Toggle
   =================================== */

// --- State ---
let currentData = null;
let forecastDays = 3;
let radiationChart = null;
let powerChart = null;
let energyChart = null;
let selectedLat = null;
let selectedLon = null;

// --- DOM Elements ---
const form = document.getElementById('prediction-form');
const predictBtn = document.getElementById('predict-btn');
const btnText = predictBtn.querySelector('.btn-text');
const btnLoader = predictBtn.querySelector('.btn-loader');
const errorBox = document.getElementById('error-message');
const resultsSection = document.getElementById('results-section');
const themeToggle = document.getElementById('theme-toggle');
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
const areaValue = document.getElementById('area-value');
const effValue = document.getElementById('efficiency-value');
const tiltValue = document.getElementById('tilt-value');
const countValueAdv = document.getElementById('count-value-adv');

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
// SETUP MODE TOGGLE
// ==========================================
specsToggleRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'advanced') {
            advancedSpecsDiv.style.display = 'grid';
            simplifiedSpecsDiv.style.display = 'none';
        } else {
            advancedSpecsDiv.style.display = 'none';
            simplifiedSpecsDiv.style.display = 'grid'; // .form-row uses grid
        }
    });
});

// ==========================================
// THEME TOGGLE
// ==========================================
const savedTheme = localStorage.getItem('solarvista-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('solarvista-theme', next);
    updateThemeIcon(next);
    // Re-render charts with new theme colors
    if (currentData) renderCharts(currentData);
});

function updateThemeIcon(theme) {
    themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ==========================================
// SLIDER VALUE DISPLAY
// ==========================================
panelAreaSlider.addEventListener('input', () => {
    areaValue.textContent = `${panelAreaSlider.value} m²`;
});
panelEffSlider.addEventListener('input', () => {
    effValue.textContent = `${panelEffSlider.value}%`;
});
panelTiltSlider.addEventListener('input', () => {
    tiltValue.textContent = `${panelTiltSlider.value}°`;
});
if (panelCountAdvSlider) {
    panelCountAdvSlider.addEventListener('input', () => {
        countValueAdv.textContent = `${panelCountAdvSlider.value}`;
    });
}

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
            azimuth_deg: 180 // Default south for advanced sliders (can be added later if needed)
        };
    }

    // Simplified Mode Logic
    let providedDetails = false;
    
    // Default assumptions
    let area_m2 = 1.6; // 1 panel
    let tilt_deg = 30; // Medium
    let efficiency_pct = 18.0; // 0-5 yrs
    let azimuth_deg = 180; // South
    
    // Number of panels
    const countVal = parseInt(panelCountInput.value);
    if (!isNaN(countVal) && countVal > 0) {
        area_m2 = countVal * 1.6;
        providedDetails = true;
    }
    
    // Tilt
    const tiltVal = panelTiltSelect.value;
    if (tiltVal === 'Flat') { tilt_deg = 0; providedDetails = true; }
    else if (tiltVal === 'Steep') { tilt_deg = 60; providedDetails = true; }
    else if (tiltVal === 'Medium') { tilt_deg = 30; providedDetails = true; }
    
    // Orientation
    const orientVal = panelOrientationSelect.value;
    if (orientVal === 'N') { azimuth_deg = 0; providedDetails = true; }
    else if (orientVal === 'E') { azimuth_deg = 90; providedDetails = true; }
    else if (orientVal === 'S') { azimuth_deg = 180; providedDetails = true; }
    else if (orientVal === 'W') { azimuth_deg = 270; providedDetails = true; }

    // Age / Efficiency
    const ageVal = panelAgeSelect.value;
    if (ageVal === '0-5') { efficiency_pct = 18.0; providedDetails = true; }
    else if (ageVal === '5-10') { efficiency_pct = 16.2; providedDetails = true; }
    else if (ageVal === '10+') { efficiency_pct = 14.4; providedDetails = true; }

    // Update confidence badge for simplified mode
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
// DAY SELECTOR
// ==========================================
document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        forecastDays = parseInt(btn.dataset.days);
    });
});

// ==========================================
// CITY AUTOCOMPLETE
// ==========================================
let debounceTimer;
cityInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = cityInput.value.trim();
    if (query.length < 2) {
        suggestionsList.classList.remove('show');
        return;
    }
    debounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/cities?q=${encodeURIComponent(query)}`);
            const cities = await res.json();
            if (cities.length > 0) {
                suggestionsList.innerHTML = cities.map(c =>
                    `<li data-city="${c}">${c}</li>`
                ).join('');
                suggestionsList.classList.add('show');
            } else {
                suggestionsList.classList.remove('show');
            }
        } catch (e) {
            console.error('Autocomplete error:', e);
        }
    }, 200);
});

suggestionsList.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
        const selectedCity = e.target.dataset.city;
        cityInput.value = selectedCity;
        suggestionsList.classList.remove('show');
        // Sync map to the selected city
        syncMapToCity(selectedCity);
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
        suggestionsList.classList.remove('show');
    }
});

// ==========================================
// LEAFLET MAP INITIALIZATION
// ==========================================
// Default center: New Delhi, India
const DEFAULT_LAT = 20.5937;
const DEFAULT_LON = 78.9629;
const DEFAULT_ZOOM = 5;

const map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LON], DEFAULT_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
}).addTo(map);

// Draggable marker
let mapMarker = L.marker([DEFAULT_LAT, DEFAULT_LON], {
    draggable: true,
    autoPan: true,
}).addTo(map);

// --- Map Click: Move marker & capture coordinates ---
map.on('click', function(e) {
    const { lat, lng } = e.latlng;
    mapMarker.setLatLng([lat, lng]);
    setSelectedCoords(lat, lng);
    reverseGeocodeAndFill(lat, lng);
});

// --- Marker Drag: Capture coordinates ---
mapMarker.on('dragend', function(e) {
    const pos = mapMarker.getLatLng();
    setSelectedCoords(pos.lat, pos.lng);
    reverseGeocodeAndFill(pos.lat, pos.lng);
});

/**
 * Set selected coordinates in state and hidden form fields.
 */
function setSelectedCoords(lat, lon) {
    selectedLat = lat;
    selectedLon = lon;
    selectedLatInput.value = lat.toFixed(6);
    selectedLonInput.value = lon.toFixed(6);
    mapCoordsDisplay.textContent = `📍 ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
    mapCoordsDisplay.classList.add('active');
}

/**
 * Clear selected coordinates (e.g., when user types a city manually)
 */
function clearSelectedCoords() {
    selectedLat = null;
    selectedLon = null;
    selectedLatInput.value = '';
    selectedLonInput.value = '';
    mapCoordsDisplay.textContent = 'Click on the map to select a location';
    mapCoordsDisplay.classList.remove('active');
}

/**
 * Reverse geocode coordinates using Nominatim and fill the city input.
 */
let reverseGeoTimer;
function reverseGeocodeAndFill(lat, lon) {
    clearTimeout(reverseGeoTimer);
    reverseGeoTimer = setTimeout(async () => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            if (data && data.address) {
                const city = data.address.city
                    || data.address.town
                    || data.address.village
                    || data.address.county
                    || data.address.state
                    || '';
                if (city) {
                    cityInput.value = city;
                }
            }
        } catch (err) {
            console.warn('Reverse geocode failed:', err);
        }
    }, 300);
}

// ==========================================
// USE CURRENT LOCATION (Browser Geolocation)
// ==========================================
geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }
    geoBtn.classList.add('loading');
    geoBtn.textContent = '⏳ Locating...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            map.setView([lat, lon], 12);
            mapMarker.setLatLng([lat, lon]);
            setSelectedCoords(lat, lon);
            reverseGeocodeAndFill(lat, lon);
            geoBtn.classList.remove('loading');
            geoBtn.textContent = '📍 Use Current Location';
        },
        (error) => {
            geoBtn.classList.remove('loading');
            geoBtn.textContent = '📍 Use Current Location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    showError('Location permission denied. Please allow location access in your browser settings.');
                    break;
                case error.POSITION_UNAVAILABLE:
                    showError('Location information is unavailable.');
                    break;
                case error.TIMEOUT:
                    showError('Location request timed out. Please try again.');
                    break;
                default:
                    showError('An unknown error occurred while getting your location.');
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
});

// ==========================================
// CITY INPUT → MAP SYNC
// ==========================================
// When user selects a city from autocomplete, pan the map to that city
function syncMapToCity(cityName) {
    // Use Nominatim to forward geocode and move marker
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
    )
    .then(res => res.json())
    .then(results => {
        if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            map.setView([lat, lon], 10);
            mapMarker.setLatLng([lat, lon]);
            setSelectedCoords(lat, lon);
        }
    })
    .catch(err => console.warn('Forward geocode for map sync failed:', err));
}

// ==========================================
// PREDICTION FORM SUBMIT
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const city = cityInput.value.trim();
    if (!city && selectedLat === null) {
        showError('Please select a location on the map or enter a city name.');
        return;
    }

    setLoading(true);

    try {
        const payload = {
            city: city,
            panel_specs: getPanelSpecs(),
            forecast_days: forecastDays,
        };

        // Include lat/lon if map was used
        if (selectedLat !== null && selectedLon !== null) {
            payload.lat = selectedLat;
            payload.lon = selectedLon;
        }

        const res = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Prediction failed. Please try again.');
            setLoading(false);
            return;
        }

        currentData = data;
        displayResults(data);
        setLoading(false);
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        console.error('Fetch error:', err);
        showError('Network error. Please check your connection and try again.');
        setLoading(false);
    }
});

function setLoading(loading) {
    predictBtn.disabled = loading;
    btnText.style.display = loading ? 'none' : 'inline';
    btnLoader.style.display = loading ? 'inline' : 'none';
}

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
}

// ==========================================
// DISPLAY RESULTS
// ==========================================
function displayResults(data) {
    // Location header
    document.getElementById('result-city').textContent = data.location.city;
    document.getElementById('result-coords').textContent =
        `${data.location.lat}°N, ${data.location.lon}°E`;

    // Current weather
    const cw = data.current.weather;
    if (cw) {
        document.getElementById('current-weather').innerHTML = `
            <div>
                <div class="weather-temp">${Math.round(cw.temperature)}°C</div>
                <div class="weather-desc">${cw.description}</div>
            </div>
            <span class="weather-icon-large">${getWeatherEmoji(cw.main)}</span>
        `;
    }

    // Metric cards with count-up animation
    animateValue('val-radiation', data.total.peak_radiation_wm2, 1);
    animateValue('val-power', data.total.peak_power_w, 1);
    animateValue('val-energy', data.total.energy_kwh, 2);
    animateValue('val-co2', data.total.co2_savings_kg, 2);

    // Environmental impact
    const env = data.total.environmental;
    document.getElementById('env-trees').textContent = env.trees_planted.toFixed(2);
    document.getElementById('env-cars').textContent = env.cars_off_road.toFixed(3);
    document.getElementById('env-phones').textContent = Math.round(env.phone_charges).toLocaleString();
    document.getElementById('env-led').textContent = Math.round(env.led_bulb_hours).toLocaleString();

    // Peak solar hour (first day)
    if (data.daily.length > 0 && data.daily[0].peak_hour) {
        const peak = data.daily[0].peak_hour;
        document.getElementById('peak-time').textContent = `${peak.hour}:00`;
        document.getElementById('peak-radiation').textContent =
            `${peak.radiation_wm2.toFixed(1)} W/m²`;
        document.getElementById('peak-tip').textContent =
            `Best time for solar energy capture on ${data.daily[0].date}. Schedule high-usage appliances around this time for maximum efficiency.`;
    }

    // Daily summary table
    const tbody = document.getElementById('daily-tbody');
    tbody.innerHTML = data.daily.map(day => `
        <tr>
            <td>${formatDate(day.date)}</td>
            <td>${day.daily_energy_kwh.toFixed(2)}</td>
            <td>${day.co2_savings_kg.toFixed(3)}</td>
            <td>${day.peak_hour ? day.peak_hour.hour + ':00' : '—'}</td>
        </tr>
    `).join('');

    // Charts
    renderCharts(data);
}

// ==========================================
// CHART RENDERING
// ==========================================
function renderCharts(data) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#8892b0' : '#4a5568';

    // Flatten all hourly data
    const allHourly = [];
    data.daily.forEach(day => {
        if (day.hours_data) {
            day.hours_data.forEach(h => allHourly.push(h));
        }
    });

    if (allHourly.length === 0) return;

    const labels = allHourly.map(h => {
        const dt = new Date(h.datetime);
        return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
    });

    const shortLabels = allHourly.map(h => {
        const dt = new Date(h.datetime);
        return dt.toLocaleString('en-US', { hour: 'numeric', hour12: true });
    });

    const radiationData = allHourly.map(h => h.radiation_wm2);
    const powerData = allHourly.map(h => h.panel_power_w || 0);

    // Cumulative energy
    let cumulative = 0;
    const cumulativeData = allHourly.map(h => {
        cumulative += (h.energy_wh || 0);
        return Math.round(cumulative * 100) / 100;
    });

    // Weather emojis for tooltips
    const weatherEmojis = allHourly.map(h => getWeatherEmoji(h.weather_main));

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isDark ? 'rgba(10,14,26,0.9)' : 'rgba(255,255,255,0.95)',
                titleColor: isDark ? '#f0f0f5' : '#1a1a2e',
                bodyColor: isDark ? '#8892b0' : '#4a5568',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                cornerRadius: 10,
                padding: 12,
                displayColors: false,
            },
        },
        scales: {
            x: {
                grid: { color: gridColor },
                ticks: {
                    color: textColor,
                    font: { size: 10 },
                    maxRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 24,
                },
            },
            y: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { size: 11 } },
                beginAtZero: true,
            },
        },
    };

    // --- Radiation Chart ---
    if (radiationChart) radiationChart.destroy();
    radiationChart = new Chart(document.getElementById('radiation-chart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solar Radiation (W/m²)',
                data: radiationData,
                borderColor: isDark ? '#ffb347' : '#e6930e',
                backgroundColor: isDark
                    ? 'rgba(255,179,71,0.1)'
                    : 'rgba(230,147,14,0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: isDark ? '#ffb347' : '#e6930e',
            }],
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                        title: (items) => labels[items[0].dataIndex],
                        label: (item) => {
                            const emoji = weatherEmojis[item.dataIndex];
                            return `${emoji} ${item.parsed.y.toFixed(1)} W/m²`;
                        },
                    },
                },
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: { display: true, text: 'W/m²', color: textColor },
                },
            },
        },
    });

    // --- Power Chart ---
    if (powerChart) powerChart.destroy();
    powerChart = new Chart(document.getElementById('power-chart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Panel Power (W)',
                data: powerData,
                borderColor: isDark ? '#64ffda' : '#0d9b76',
                backgroundColor: isDark
                    ? 'rgba(100,255,218,0.1)'
                    : 'rgba(13,155,118,0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: isDark ? '#64ffda' : '#0d9b76',
            }],
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                        label: (item) => `⚡ ${item.parsed.y.toFixed(1)} W`,
                    },
                },
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: { display: true, text: 'Watts', color: textColor },
                },
            },
        },
    });

    // --- Cumulative Energy Chart ---
    if (energyChart) energyChart.destroy();
    energyChart = new Chart(document.getElementById('energy-chart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Energy (Wh)',
                data: cumulativeData,
                borderColor: isDark ? '#7c4dff' : '#5e35b1',
                backgroundColor: isDark
                    ? 'rgba(124,77,255,0.1)'
                    : 'rgba(94,53,177,0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: isDark ? '#7c4dff' : '#5e35b1',
            }],
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                        label: (item) => {
                            const wh = item.parsed.y;
                            return wh > 1000
                                ? `🔋 ${(wh / 1000).toFixed(2)} kWh`
                                : `🔋 ${wh.toFixed(1)} Wh`;
                        },
                    },
                },
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: { display: true, text: 'Wh', color: textColor },
                },
            },
        },
    });
}

// ==========================================
// CSV DOWNLOAD
// ==========================================
document.getElementById('download-csv').addEventListener('click', async () => {
    if (!currentData) return;

    try {
        // Flatten hourly data for download
        const allHourly = [];
        currentData.daily.forEach(day => {
            if (day.hours_data) {
                day.hours_data.forEach(h => allHourly.push(h));
            }
        });

        const res = await fetch('/download/csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hourly: allHourly,
                daily: currentData.daily,
                city: currentData.location.city,
                total: currentData.total,
            }),
        });

        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solar_forecast_${currentData.location.city.replace(/\s/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Download error:', err);
        showError('Failed to download CSV. Please try again.');
    }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function getWeatherEmoji(main) {
    const map = {
        'Clear': '☀️',
        'Clouds': '⛅',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '🌨️',
        'Mist': '🌫️',
        'Fog': '🌫️',
        'Haze': '🌫️',
        'Smoke': '🌫️',
        'Dust': '🌪️',
    };
    return map[main] || '🌤️';
}

function animateValue(elementId, value, decimals) {
    const element = document.getElementById(elementId);
    const duration = 800;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = start + (value - start) * eased;
        element.textContent = current.toFixed(decimals);
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function formatDate(dateStr) {
    const dt = new Date(dateStr);
    return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}
