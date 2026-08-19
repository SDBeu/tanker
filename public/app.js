// ─── Constanten ───────────────────────────────────────────────────────────────

const FUELS = [
  { id: "diesel",  label: "Diesel"   },
  { id: "super95", label: "Super 95" },
  { id: "super98", label: "Super 98" },
  { id: "lpg",     label: "LPG"      },
];

const OSRM             = "https://router.project-osrm.org/route/v1/driving";
const NOMINATIM        = "https://nominatim.openstreetmap.org/search";
const SAMPLE_INTERVAL_KM = 8;
const SAMPLE_MIN_POINTS  = 5;

// ─── State ────────────────────────────────────────────────────────────────────

let nearbyFuel     = localStorage.getItem("fuel")      || "diesel";
let routeFuel      = localStorage.getItem("routeFuel") || "diesel";
let nearbySort     = "price";   // "price" | "distance"
let routeSort      = "price";   // "price" | "distance"
let nearbyStations = [];        // ruwe data, ongesorteerd opgeslagen
let routeStations  = [];        // idem
let gpsPosition    = null;
let nearbyBrand      = "all";
let routeBrand       = "all";
let nearbySelected   = null;        // geselecteerd station in lijst
let routeSelected    = null;
let nearbyPulseMarker = null;
let routePulseMarker  = null;
let nearbySearchPos  = null;        // locatie gebruikt voor nabijheidszoektocht (GPS of geocoded)
let nearbyPriceMax   = Infinity;   // prijsfilter slider
let routePriceMax    = Infinity;
let nearbyMinPrice   = null;
let nearbyMaxPrice   = null;
let routeMinPrice    = null;
let routeMaxPrice    = null;
let tankLiters       = 50;
let nearbyView       = "map";     // "map" | "list"
let routeView        = "map";     // "map" | "list"
let nearbyMap        = null;
let nearbyMarkers    = null;
let nearbyMarkerList = [];        // [{marker, price}] voor prijsfilter
let nearbyGpsMarker  = null;
let routeMap         = null;
let routeMarkers     = null;
let routeMarkerList  = [];        // [{marker, price}] voor prijsfilter
let routePolyline    = null;
let routeCoords      = null;
let routeSamples     = null;   // gesamplede routepunten, hergebruikt bij brandstofwissel
let routeStartPos    = null;   // geocodeerd vertrekpunt
let routeEndPos      = null;   // geocodeerd eindpunt
let routeStartMarker = null;   // cirkelmarker op de kaart
let routeEndMarker   = null;

// ─── DOM ──────────────────────────────────────────────────────────────────────

const statusEl           = document.getElementById("status");
const listEl             = document.getElementById("list");
const fuelBtnsEl         = document.getElementById("fuel-btns");
const sortBtnsEl         = document.getElementById("sort-btns");
const nearbyViewToggleEl = document.getElementById("nearby-view-toggle");
const nearbySliderEl     = document.getElementById("nearby-price-slider");
const nearbyMapEl        = document.getElementById("nearby-map");
const nearbyLocationInput = document.getElementById("nearby-location");
const nearbyGpsBtn        = document.getElementById("nearby-gps-btn");
const routeStatusEl      = document.getElementById("route-status");
const routeInfoEl        = document.getElementById("route-info");
const routeSortBtnsEl    = document.getElementById("route-sort-btns");
const routeViewToggleEl  = document.getElementById("route-view-toggle");
const routeSliderEl      = document.getElementById("route-price-slider");
const routeMapEl         = document.getElementById("route-map");
const routeListEl        = document.getElementById("route-list");
const routeFuelEl        = document.getElementById("route-fuel-btns");
const startInput         = document.getElementById("route-start");
const endInput           = document.getElementById("route-end");
const calcBtn            = document.getElementById("calc-route-btn");
const routeFormFields    = document.getElementById("route-form-fields");
const routeFormSummary   = document.getElementById("route-form-summary");
const routeSummaryText   = document.getElementById("route-summary-text");
const routeEditBtn       = document.getElementById("route-edit-btn");
const savingsDisplayEl   = document.getElementById("savings-display");
const savingsCanEl       = document.getElementById("savings-can");
const savingsAmountEl    = document.getElementById("savings-amount");
const tankLitersInput    = document.getElementById("tank-liters");

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 uur

function cachedFetch(url) {
  const key = "carbu_" + url;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return Promise.resolve(data);
      localStorage.removeItem(key);
    }
  } catch {}
  return fetch(url)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
      return data;
    });
}

// Afronden op ~1 km precisie zodat dichtbijgelegen punten dezelfde cache gebruiken
function roundCoord(v) { return Math.round(v * 100) / 100; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(el, msg, isError = false) {
  el.innerHTML = msg;
  el.className = isError ? "error" : "";
}

function spinner() {
  return '<span class="spinner"></span>';
}

function formatDist(km) {
  if (!km || isNaN(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function googleMapsNav(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function priceColor(price, minPrice, maxPrice) {
  const t = maxPrice === minPrice ? 0 : (price - minPrice) / (maxPrice - minPrice);
  return `hsl(${Math.round(120 * (1 - t))}, 75%, 42%)`;
}

// t = 0 (goedkoopst) → grote pin; t = 1 (duurste) → kleine pin
function createPinIcon(color, isCheapest = false, t = 0) {
  if (isCheapest) {
    return L.divIcon({
      html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.611 0 0 7.611 0 17c0 11.703 17 27 17 27S34 28.703 34 17C34 7.611 26.389 0 17 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="17" y="23" text-anchor="middle" font-size="15" fill="white" font-weight="bold">★</text>
      </svg>`,
      className: "",
      iconSize: [34, 44],
      iconAnchor: [17, 44],
      popupAnchor: [0, -46],
    });
  }
  const w = Math.round(28 - t * 12); // 28px (goedkoopst) → 16px (duurste)
  const h = Math.round(w * 4 / 3);
  return L.divIcon({
    html: `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.284 12 20 12 20S24 20.284 24 12C24 5.373 18.627 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="11" r="4" fill="white" opacity="0.6"/>
    </svg>`,
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -(h + 2)],
  });
}

// Ring gecentreerd op het cirkeldeel van de pin (~20px boven de puntanker)
function createPulseMarker(lat, lng) {
  return L.marker([lat, lng], {
    icon: L.divIcon({
      html: '<div class="pulse-ring"></div>',
      className: "",
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    }),
    interactive: false,
    zIndexOffset: -100,
  });
}

const BRAND_CANONICAL = [
  { canonical: "Avia",          prefixes: ["avia"] },
  { canonical: "DATS 24",       prefixes: ["dats 24", "dats24"] },
  { canonical: "Esso",          prefixes: ["esso"] },
  { canonical: "Gabriëls",      prefixes: ["gabriëls", "gabriels"] },
  { canonical: "G&V",           prefixes: ["g&v", "g & v"] },
  { canonical: "Gulf",          prefixes: ["gulf"] },
  { canonical: "Lukoil",        prefixes: ["lukoil"] },
  { canonical: "Maes",          prefixes: ["maes"] },
  { canonical: "Power",         prefixes: ["power"] },
  { canonical: "Q8",            prefixes: ["q8"] },
  { canonical: "Shell",         prefixes: ["shell"] },
  { canonical: "T-Express",     prefixes: ["t-express"] },
  { canonical: "Taverniers",    prefixes: ["taverniers"] },
  { canonical: "Texaco",        prefixes: ["texaco"] },
  { canonical: "TinQ",          prefixes: ["tinq"] },
  { canonical: "TotalEnergies", prefixes: ["totalenergies", "total-express", "total énergies", "total energies"] },
];

function brandFromStation(s) {
  const name = (s.name || "").trim().toLowerCase();
  for (const { canonical, prefixes } of BRAND_CANONICAL) {
    if (prefixes.some(p => name.startsWith(p))) return canonical;
  }
  return "Andere";
}

function buildBrandFilter(containerEl, stations, getBrand, setBrand, onChange) {
  containerEl.querySelector(".brand-select")?.remove();
  const brands = [...new Set(stations.map(brandFromStation))].sort();
  if (brands.length <= 1) return;
  const current = getBrand();
  const sel = document.createElement("select");
  sel.className = "brand-select" + (current !== "all" ? " active" : "");
  sel.innerHTML = `<option value="all">Alle merken</option>` +
    brands.map(b => `<option value="${b}"${current === b ? " selected" : ""}>${b}</option>`).join("");
  sel.addEventListener("change", e => {
    setBrand(e.target.value);
    sel.classList.toggle("active", e.target.value !== "all");
    onChange();
  });
  containerEl.appendChild(sel);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} u ${m} min` : `${m} min`;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distToRoute(lat, lng, coords) {
  let min = Infinity;
  for (const [rLng, rLat] of coords) {
    const d = haversine(lat, lng, rLat, rLng);
    if (d < min) min = d;
  }
  return min;
}

// Berekent hoeveel km langs de route het dichtstbijzijnde punt ligt (vanaf het startpunt)
function positionOnRoute(lat, lng, coords) {
  let minDist = Infinity;
  let bestPos = 0;
  let cumDist = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const segLen = haversine(lat1, lng1, lat2, lng2);
    const dx = lng2 - lng1, dy = lat2 - lat1;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((lng - lng1) * dx + (lat - lat1) * dy) / len2)) : 0;
    const d = haversine(lat, lng, lat1 + t * dy, lng1 + t * dx);
    if (d < minDist) { minDist = d; bestPos = cumDist + t * segLen; }
    cumDist += segLen;
  }
  return bestPos;
}

function sampleRoute(coords, intervalKm, minPoints = 1) {
  // Bereken totale routelengte
  let totalKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    totalKm += haversine(lat1, lng1, lat2, lng2);
  }

  // Pas interval aan zodat er minstens minPoints punten zijn
  const effectiveInterval = Math.min(intervalKm, totalKm / Math.max(minPoints - 1, 1));

  const points = [coords[0]];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    acc += haversine(lat1, lng1, lat2, lng2);
    if (acc >= effectiveInterval) {
      points.push(coords[i]);
      acc = 0;
    }
  }
  const last = coords[coords.length - 1];
  if (points[points.length - 1] !== last) points.push(last);
  return points;
}

// ─── Stations sorteren ────────────────────────────────────────────────────────

function sortStations(stations, sortBy) {
  const copy = [...stations];
  if (sortBy === "distance") {
    copy.sort((a, b) => (a.routePosition ?? a.distance ?? a.routeOffset ?? Infinity) - (b.routePosition ?? b.distance ?? b.routeOffset ?? Infinity));
  } else {
    copy.sort((a, b) => a.price - b.price);
  }
  return copy;
}

// ─── Stations renderen ────────────────────────────────────────────────────────

function renderStations(containerEl, stations, extraBadge = null, onSelect = null, selectedStation = null) {
  containerEl.innerHTML = "";
  if (!stations.length) {
    containerEl.innerHTML = `<p class="empty">Geen stations gevonden.</p>`;
    return;
  }

  const minPrice = Math.min(...stations.map(s => s.price));
  const maxPrice = Math.max(...stations.map(s => s.price));

  stations.forEach((s, i) => {
    const card = document.createElement("div");
    const color = priceColor(s.price, minPrice, maxPrice);
    const isSelected = selectedStation && selectedStation.id === s.id;
    card.className = "station-card" + (s.price === minPrice ? " cheapest" : "") + (isSelected ? " selected" : "");

    const badge = extraBadge ? extraBadge(s) : "";

    card.innerHTML = `
      <div class="rank" style="color:${color}">${i + 1}</div>
      <div class="info">
        <div class="name">${s.name}</div>
        <div class="address">${s.address || ""}</div>
        ${badge ? `<div class="badge">${badge}</div>` : ""}
      </div>
      <div class="right">
        <div class="price" style="color:${color}">€ ${s.price.toFixed(3)}</div>
        <div class="distance">${s.routePosition != null ? `bij km ${Math.round(s.routePosition)}` : formatDist(s.distance ?? s.routeOffset)}</div>
        <a class="nav-btn" href="${googleMapsNav(s.lat, s.lng)}" target="_blank" rel="noopener">Navigeer</a>
      </div>
    `;
    if (onSelect) {
      card.addEventListener("click", e => {
        if (e.target.closest(".nav-btn")) return; // navigeer-link niet blokkeren
        containerEl.querySelectorAll(".station-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        onSelect(s);
      });
    }
    containerEl.appendChild(card);
  });
}

// ─── Knoppen bouwen ───────────────────────────────────────────────────────────

function buildFuelBtns(containerEl, getActive, setActive, onChange) {
  containerEl.innerHTML = "";
  FUELS.forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.className = "fuel-btn" + (id === getActive() ? " active" : "");
    btn.dataset.fuel = id;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setActive(id);
      containerEl.querySelectorAll(".fuel-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.fuel === id)
      );
      onChange(id);
    });
    containerEl.appendChild(btn);
  });
}

function buildSortBtns(containerEl, getSort, setSort, onSort, distLabel = "Afstand") {
  containerEl.innerHTML = "";
  containerEl.classList.remove("hidden");
  [{ id: "price", label: "Prijs" }, { id: "distance", label: distLabel }].forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.className = "fuel-btn" + (id === getSort() ? " active" : "");
    btn.dataset.sort = id;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setSort(id);
      containerEl.querySelectorAll(".fuel-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.sort === id)
      );
      onSort(id);
    });
    containerEl.appendChild(btn);
  });
}

// ─── Prijsfilter ──────────────────────────────────────────────────────────────

function applyPriceFilter(markerList, layerGroup, maxPrice, extraLayer) {
  layerGroup.clearLayers();
  if (extraLayer) layerGroup.addLayer(extraLayer);
  for (const { marker, price } of markerList) {
    if (price <= maxPrice) layerGroup.addLayer(marker);
  }
}

function buildPriceSlider(wrapEl, markerList, layerGroup, minPrice, maxPrice, extraLayer, onFilter = null) {
  const minColor = priceColor(minPrice, minPrice, maxPrice);
  const maxColor = priceColor(maxPrice, minPrice, maxPrice);
  wrapEl.classList.remove("hidden");
  wrapEl.innerHTML = `
    <span class="slider-label" style="color:${minColor}">€ ${minPrice.toFixed(3)}</span>
    <input type="range" class="price-range"
      min="${minPrice.toFixed(3)}" max="${maxPrice.toFixed(3)}"
      value="${maxPrice.toFixed(3)}" step="0.001">
    <span class="slider-label slider-max">€ <strong style="color:${maxColor}">${maxPrice.toFixed(3)}</strong></span>
  `;
  const range  = wrapEl.querySelector(".price-range");
  const strong = wrapEl.querySelector("strong");
  const updateColor = v => {
    const c = priceColor(v, minPrice, maxPrice);
    strong.style.color = c;
    const svg = `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg"><path d="M50 5 C50 5 10 55 10 75 C10 97 28 115 50 115 C72 115 90 97 90 75 C90 55 50 5 50 5Z" fill="${c}"/><ellipse cx="38" cy="52" rx="7" ry="11" fill="rgba(255,255,255,0.25)" transform="rotate(-20 38 52)"/><text x="50" y="95" text-anchor="middle" font-size="38" font-weight="700" fill="%230f172a" font-family="sans-serif">€</text></svg>`;
    range.style.setProperty("--thumb-image", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  };
  updateColor(maxPrice);
  range.addEventListener("input", () => {
    const v = parseFloat(range.value);
    strong.textContent = v.toFixed(3);
    updateColor(v);
    if (markerList && layerGroup) applyPriceFilter(markerList, layerGroup, v, extraLayer);
    if (onFilter) onFilter(v);
  });
}

// ─── Kaart/lijst toggle ───────────────────────────────────────────────────────

function buildViewToggle(containerEl, mapEl, listEl, getView, setView, getMapInstance, onViewChange) {
  containerEl.innerHTML = "";
  containerEl.classList.remove("hidden");
  [{ id: "map", label: "Kaart" }, { id: "list", label: "Lijst" }].forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.className = "fuel-btn" + (id === getView() ? " active" : "");
    btn.dataset.view = id;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setView(id);
      containerEl.querySelectorAll(".fuel-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.view === id)
      );
      mapEl.classList.toggle("hidden", id !== "map");
      listEl.classList.toggle("hidden", id !== "list");
      if (id === "map") setTimeout(() => { const m = getMapInstance(); if (m) m.invalidateSize(); }, 0);
      if (onViewChange) onViewChange(id);
    });
    containerEl.appendChild(btn);
  });
}

// ─── Tab-navigatie ────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    setTimeout(() => {
      if (btn.dataset.tab === "nearby" && nearbyView === "map" && nearbyMap) nearbyMap.invalidateSize();
      if (btn.dataset.tab === "route"  && routeView  === "map" && routeMap)  routeMap.invalidateSize();
    }, 0);
    if (btn.dataset.tab === "nearby" && !nearbySearchPos && navigator.geolocation) getGPS();
    setTimeout(() => {
      if (btn.dataset.tab === "nearby" && nearbyMap) nearbyMap.invalidateSize();
      if (btn.dataset.tab === "route"  && routeMap)  routeMap.invalidateSize();
    }, 50);
    updateSavings();
  });
});

// ─── Besparing ────────────────────────────────────────────────────────────────

function makeSavingsSVG(fillPct, color, line1 = null, line2 = null, sizePx = null) {
  const bX = 3, bY = 10, bW = 28, bH = 39;
  const fillH = Math.round(bH * fillPct);
  const fillY = bY + bH - fillH;
  const fill = fillH > 1
    ? `<rect x="${bX + 1}" y="${Math.max(fillY, bY + 1)}" width="${bW - 2}" height="${Math.min(fillH - 1, bH - 2)}" rx="2" fill="${color}" opacity="0.9"/>`
    : "";
  const textMid = bY + bH / 2;
  const labels = line1 ? `
    <text x="17" y="${textMid - 2}" text-anchor="middle" font-size="7.5" font-weight="700" fill="white" font-family="sans-serif" opacity="0.95">${line1}</text>
    ${line2 ? `<text x="17" y="${textMid + 8}" text-anchor="middle" font-size="6.5" fill="white" font-family="sans-serif" opacity="0.8">${line2}</text>` : ""}
  ` : "";
  const sizeAttr = sizePx ? `width="${sizePx[0]}" height="${sizePx[1]}"` : "";
  return `<svg ${sizeAttr} viewBox="0 0 34 52" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 6 Q30 6 30 15" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="7" y="3" width="12" height="9" rx="2" fill="#334155"/>
    <rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="4" fill="#1e293b"/>
    ${fill}
    <rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="4" fill="none" stroke="#475569" stroke-width="1.5"/>
    <rect x="7" y="13" width="3" height="33" rx="1.5" fill="rgba(255,255,255,0.07)"/>
    ${labels}
  </svg>`;
}

function updateSavings() {
  const tab = document.querySelector(".tab-btn.active")?.dataset.tab ?? "route";
  const sliderEl = tab === "nearby" ? nearbySliderEl : routeSliderEl;
  const range = sliderEl?.querySelector(".price-range");
  const minP = tab === "nearby" ? nearbyMinPrice : routeMinPrice;
  const maxP = tab === "nearby" ? nearbyMaxPrice : routeMaxPrice;

  if (!range || minP === null || maxP === null) {
    savingsDisplayEl.classList.add("hidden");
    return;
  }

  const sliderVal = parseFloat(range.value);
  const savings = (maxP - sliderVal) * tankLiters;
  const fillPct = maxP === minP ? 0 : (maxP - sliderVal) / (maxP - minP);
  const color = fillPct < 0.01 ? `hsl(0, 75%, 42%)` : `hsl(${Math.round(120 * fillPct)}, 75%, 42%)`;

  savingsDisplayEl.classList.remove("hidden");
  savingsCanEl.innerHTML = makeSavingsSVG(fillPct, color);
  savingsAmountEl.textContent = savings > 0.005 ? `€ ${savings.toFixed(2)}` : "";
  savingsAmountEl.style.color = color;
}

// ─── Tab 1: In de buurt ───────────────────────────────────────────────────────

function initNearbyMap() {
  if (nearbyMap) return;
  nearbyMap = L.map("nearby-map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(nearbyMap);
  nearbyMarkers = L.layerGroup().addTo(nearbyMap);
}

function showNearbyDot(pos) {
  initNearbyMap();
  nearbyMap.setView([pos.lat, pos.lng], 13);
  setTimeout(() => {
    if (nearbyGpsMarker) nearbyMarkers.removeLayer(nearbyGpsMarker);
    nearbyGpsMarker = L.circleMarker([pos.lat, pos.lng], {
      radius: 8, fillColor: "#3b82f6", color: "#fff", weight: 2, fillOpacity: 1,
    }).bindPopup("Gezochte locatie").addTo(nearbyMarkers);
  }, 50);
}

function renderNearbyMap(stations) {
  initNearbyMap();
  nearbyMarkers.clearLayers();
  nearbyMarkerList = [];
  nearbyGpsMarker  = null;

  const minPrice = stations.length ? Math.min(...stations.map(s => s.price)) : null;
  const maxPrice = stations.length ? Math.max(...stations.map(s => s.price)) : null;

  if (nearbySearchPos) {
    nearbyGpsMarker = L.circleMarker([nearbySearchPos.lat, nearbySearchPos.lng], {
      radius: 8, fillColor: "#3b82f6", color: "#fff", weight: 2, fillOpacity: 1,
    }).bindPopup("Gezochte locatie");
    nearbyMarkers.addLayer(nearbyGpsMarker);
  }

  stations.forEach(s => {
    const cheapest = s.price === minPrice;
    const t = maxPrice === minPrice ? 0 : (s.price - minPrice) / (maxPrice - minPrice);
    const color = priceColor(s.price, minPrice, maxPrice);
    const marker = L.marker([s.lat, s.lng], { icon: createPinIcon(color, cheapest, t) }).bindPopup(() => {
      const savings = (maxPrice - s.price) * tankLiters;
      const fillPct = maxPrice === minPrice ? 0 : (maxPrice - s.price) / (maxPrice - minPrice);
      const savingsHtml = savings > 0.005
        ? `<div class="popup-can">${makeSavingsSVG(fillPct, color, `€ ${savings.toFixed(2)}`, `${tankLiters}L`, [68, 104])}</div>`
        : "";
      return `<div class="map-popup">
        <div class="popup-name">${s.name}</div>
        <div class="popup-price" style="color:${color}">€ ${s.price.toFixed(3)}</div>
        ${savingsHtml}
        <div class="popup-address">${s.address || ""}</div>
        <a class="nav-btn" href="${googleMapsNav(s.lat, s.lng)}" target="_blank" rel="noopener">Navigeer</a>
      </div>`;
    });
    marker.on("click", () => {
      if (nearbyPulseMarker) { nearbyMarkers.removeLayer(nearbyPulseMarker); nearbyPulseMarker = null; }
      nearbySelected = null;
      listEl.querySelectorAll(".station-card").forEach(c => c.classList.remove("selected"));
    });
    nearbyMarkerList.push({ marker, price: s.price });
    nearbyMarkers.addLayer(marker);
  });

  const bounds = stations.map(s => [s.lat, s.lng]);
  if (nearbySearchPos) bounds.push([nearbySearchPos.lat, nearbySearchPos.lng]);

  if (minPrice !== null) {
    nearbyMinPrice = minPrice;
    nearbyMaxPrice = maxPrice;
    buildPriceSlider(nearbySliderEl, nearbyMarkerList, nearbyMarkers, minPrice, maxPrice, nearbyGpsMarker, v => {
      nearbyPriceMax = v;
      renderNearbyList();
      updateSavings();
    });
    updateSavings();
  }
  setTimeout(() => {
    nearbyMap.invalidateSize();
    if (bounds.length) nearbyMap.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
  }, 50);
}

function getFilteredNearby() {
  const sorted = sortStations(nearbyStations, nearbySort);
  return (nearbyBrand === "all" ? sorted : sorted.filter(s => brandFromStation(s) === nearbyBrand))
    .filter(s => s.price <= nearbyPriceMax);
}

function renderNearbyList() {
  const filtered = getFilteredNearby();
  if (nearbySelected && !filtered.some(s => s.id === nearbySelected.id)) nearbySelected = null;
  renderStations(listEl, filtered, null, s => {
    nearbySelected = s;
    nearbyViewToggleEl.querySelector('[data-view="map"]')?.click();
  }, nearbySelected);
}

function renderNearby() {
  const filtered = getFilteredNearby();
  if (nearbySelected && !filtered.some(s => s.id === nearbySelected.id)) nearbySelected = null;
  renderStations(listEl, filtered, null, s => {
    nearbySelected = s;
    nearbyViewToggleEl.querySelector('[data-view="map"]')?.click();
  }, nearbySelected);
  renderNearbyMap(filtered);
}

async function loadNearby() {
  if (!nearbySearchPos) {
    setStatus(statusEl, `${spinner()}GPS-locatie bepalen...`);
    return;
  }
  const { lat, lng } = nearbySearchPos;
  setStatus(statusEl, `${spinner()}Stations ophalen...`);
  listEl.innerHTML = "";

  try {
    const rLat = roundCoord(lat), rLng = roundCoord(lng);
    const data = await cachedFetch(`/.netlify/functions/getstations?lat=${rLat}&lng=${rLng}&fuel=${nearbyFuel}`);
    if (data.error) { setStatus(statusEl, data.error, true); return; }

    nearbyStations = data.stations.filter(s => s.price > 0);
    nearbyBrand = "all";
    nearbyPriceMax = Infinity;
    nearbySelected = null;
    nearbyPulseMarker = null;
    nearbyView = "map";
    nearbyMapEl.classList.remove("hidden");
    listEl.classList.add("hidden");
    setStatus(statusEl, `${nearbyStations.length} stations bij ${data.city}`);

    buildSortBtns(sortBtnsEl, () => nearbySort, id => { nearbySort = id; }, () => renderNearby());
    sortBtnsEl.classList.add("hidden"); // verborgen in kaartmodus
    buildBrandFilter(fuelBtnsEl, nearbyStations, () => nearbyBrand, id => { nearbyBrand = id; }, () => renderNearby());
    buildViewToggle(nearbyViewToggleEl, nearbyMapEl, listEl, () => nearbyView, id => { nearbyView = id; }, () => nearbyMap, (view) => {
      sortBtnsEl.classList.toggle("hidden", view === "map");
      if (view === "map" && nearbySelected) {
        if (nearbyPulseMarker) nearbyMarkers.removeLayer(nearbyPulseMarker);
        nearbyPulseMarker = createPulseMarker(nearbySelected.lat, nearbySelected.lng);
        nearbyMarkers.addLayer(nearbyPulseMarker);
        setTimeout(() => nearbyMap.panTo([nearbySelected.lat, nearbySelected.lng]), 50);
      }
      if (view === "list" && nearbyPulseMarker) {
        nearbyMarkers.removeLayer(nearbyPulseMarker);
        nearbyPulseMarker = null;
      }
    });
    renderNearby();
  } catch (e) {
    setStatus(statusEl, "Netwerkfout: " + e.message, true);
  }
}

function getGPS() {
  setStatus(statusEl, `${spinner()}GPS-locatie bepalen...`);
  nearbyLocationInput.value = "Locatie bepalen...";
  nearbyLocationInput.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      nearbySearchPos = gpsPosition;
      nearbyLocationInput.value = "Huidige locatie";
      nearbyLocationInput.disabled = false;
      showNearbyDot(nearbySearchPos);
      loadNearby();
    },
    err => {
      nearbyLocationInput.value = "";
      nearbyLocationInput.disabled = false;
      setStatus(statusEl, "Locatie niet beschikbaar — typ een adres of stad hierboven.", true);
      nearbyLocationInput.focus();
    },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: Infinity }
  );
}

nearbyGpsBtn.addEventListener("click", () => {
  if (gpsPosition) {
    nearbySearchPos = gpsPosition;
    nearbyLocationInput.value = "Huidige locatie";
    showNearbyDot(nearbySearchPos);
    loadNearby();
    return;
  }
  getGPS();
});

nearbyLocationInput.addEventListener("keydown", async e => {
  if (e.key !== "Enter") return;
  const val = nearbyLocationInput.value.trim();
  if (!val) return;
  try {
    nearbySearchPos = await geocode(val);
    showNearbyDot(nearbySearchPos);
    loadNearby();
  } catch (err) {
    setStatus(statusEl, err.message, true);
  }
});

buildFuelBtns(
  fuelBtnsEl,
  () => nearbyFuel,
  id => { nearbyFuel = id; localStorage.setItem("fuel", id); },
  () => loadNearby()
);


// ─── Tab 2: Route ─────────────────────────────────────────────────────────────

function initRouteMap() {
  if (routeMap) return;
  routeMap = L.map("route-map").setView([50.5, 4.5], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(routeMap);
  routeMarkers = L.layerGroup().addTo(routeMap);
}

function renderRouteMap(stations) {
  initRouteMap();
  routeMarkers.clearLayers();
  if (routePolyline)     { routePolyline.remove();     routePolyline     = null; }
  if (routeStartMarker)  { routeStartMarker.remove();  routeStartMarker  = null; }
  if (routeEndMarker)    { routeEndMarker.remove();    routeEndMarker    = null; }

  if (routeCoords && routeCoords.length) {
    const latlngs = routeCoords.map(([lng, lat]) => [lat, lng]);
    routePolyline = L.polyline(latlngs, { color: "#3b82f6", weight: 4, opacity: 0.7 }).addTo(routeMap);
  }

  const minPrice = stations.length ? Math.min(...stations.map(s => s.price)) : null;
  const maxPrice = stations.length ? Math.max(...stations.map(s => s.price)) : null;

  routeMarkerList = [];
  stations.forEach(s => {
    const cheapest = s.price === minPrice;
    const t = maxPrice === minPrice ? 0 : (s.price - minPrice) / (maxPrice - minPrice);
    const color = priceColor(s.price, minPrice, maxPrice);
    const marker = L.marker([s.lat, s.lng], { icon: createPinIcon(color, cheapest, t) }).bindPopup(() => {
      const savings = (maxPrice - s.price) * tankLiters;
      const fillPct = maxPrice === minPrice ? 0 : (maxPrice - s.price) / (maxPrice - minPrice);
      const savingsHtml = savings > 0.005
        ? `<div class="popup-can">${makeSavingsSVG(fillPct, color, `€ ${savings.toFixed(2)}`, `${tankLiters}L`, [68, 104])}</div>`
        : "";
      return `<div class="map-popup">
        <div class="popup-name">${s.name}</div>
        <div class="popup-price" style="color:${color}">€ ${s.price.toFixed(3)}</div>
        ${savingsHtml}
        <div class="popup-address">${s.address || ""}</div>
        <a class="nav-btn" href="${googleMapsNav(s.lat, s.lng)}" target="_blank" rel="noopener">Navigeer</a>
      </div>`;
    });
    marker.on("click", () => {
      if (routePulseMarker) { routeMarkers.removeLayer(routePulseMarker); routePulseMarker = null; }
      routeSelected = null;
      routeListEl.querySelectorAll(".station-card").forEach(c => c.classList.remove("selected"));
    });
    routeMarkerList.push({ marker, price: s.price });
    routeMarkers.addLayer(marker);
  });

  if (minPrice !== null) {
    routeMinPrice = minPrice;
    routeMaxPrice = maxPrice;
    buildPriceSlider(routeSliderEl, routeMarkerList, routeMarkers, minPrice, maxPrice, null, v => {
      routePriceMax = v;
      renderRouteList();
      updateSavings();
    });
    updateSavings();
  }
  setTimeout(() => {
    routeMap.invalidateSize();
    if (routePolyline) {
      routeMap.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });
    } else if (stations.length) {
      routeMap.fitBounds(L.latLngBounds(stations.map(s => [s.lat, s.lng])), { padding: [30, 30] });
    }
    // Cirkelmarkers na fitBounds toevoegen (SVG-renderer is dan klaar)
    // Rechtstreeks op routeMap zodat clearLayers van de slider ze niet wist
    if (routeStartPos) {
      routeStartMarker = L.circleMarker([routeStartPos.lat, routeStartPos.lng], {
        radius: 8, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 1,
      }).bindPopup("Vertrek").addTo(routeMap);
    }
    if (routeEndPos) {
      routeEndMarker = L.circleMarker([routeEndPos.lat, routeEndPos.lng], {
        radius: 8, fillColor: "#ef4444", color: "#fff", weight: 2, fillOpacity: 1,
      }).bindPopup("Bestemming").addTo(routeMap);
    }
  }, 50);
}

function getFilteredRoute() {
  const sorted = sortStations(routeStations, routeSort);
  return (routeBrand === "all" ? sorted : sorted.filter(s => brandFromStation(s) === routeBrand))
    .filter(s => s.price <= routePriceMax);
}

function renderRouteList() {
  const filtered = getFilteredRoute();
  if (routeSelected && !filtered.some(s => s.id === routeSelected.id)) routeSelected = null;
  renderStations(routeListEl, filtered,
    s => s.routeOffset != null ? `${s.routeOffset.toFixed(1)} km van de route` : "",
    s => { routeSelected = s; routeViewToggleEl.querySelector('[data-view="map"]')?.click(); },
    routeSelected);
}

function renderRoute() {
  const filtered = getFilteredRoute();
  if (routeSelected && !filtered.some(s => s.id === routeSelected.id)) routeSelected = null;
  renderStations(routeListEl, filtered,
    s => s.routeOffset != null ? `${s.routeOffset.toFixed(1)} km van de route` : "",
    s => { routeSelected = s; routeViewToggleEl.querySelector('[data-view="map"]')?.click(); },
    routeSelected);
  renderRouteMap(filtered);
}

buildFuelBtns(
  routeFuelEl,
  () => routeFuel,
  id => { routeFuel = id; localStorage.setItem("routeFuel", id); },
  id => { if (routeSamples) loadRouteStations(id); }
);

function showRouteStartDot(pos) {
  routeMap.setView([pos.lat, pos.lng], 13);
  setTimeout(() => {
    if (routeStartMarker) { routeStartMarker.remove(); routeStartMarker = null; }
    routeStartMarker = L.circleMarker([pos.lat, pos.lng], {
      radius: 8, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 1,
    }).bindPopup("Vertrek").addTo(routeMap);
  }, 50);
}

document.getElementById("use-gps-btn").addEventListener("click", () => {
  if (gpsPosition) {
    startInput.value = "Huidige locatie";
    showRouteStartDot(gpsPosition);
    return;
  }
  startInput.value = "Locatie bepalen...";
  startInput.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      startInput.value = "Huidige locatie";
      startInput.disabled = false;
      showRouteStartDot(gpsPosition);
    },
    err => {
      startInput.value = "";
      startInput.disabled = false;
      setStatus(routeStatusEl, "GPS niet beschikbaar: " + err.message, true);
    },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: Infinity }
  );
});

async function geocode(query) {
  if (query.toLowerCase() === "huidige locatie") {
    if (!gpsPosition) throw new Error("GPS-locatie niet beschikbaar");
    return gpsPosition;
  }
  const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coordMatch) return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };

  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=be,nl,lu&accept-language=nl`;
  const res  = await fetch(url, { headers: { "Accept-Language": "nl" } });
  const data = await res.json();
  if (!data.length) throw new Error(`Adres niet gevonden: "${query}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function getRoute(start, end) {
  const url = `${OSRM}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("Route niet berekend.");
  return {
    coords:   data.routes[0].geometry.coordinates,
    distance: data.routes[0].distance / 1000,
    duration: data.routes[0].duration,
  };
}

async function loadRouteStations(fuel) {
  if (!routeSamples || !routeCoords) return;

  setStatus(routeStatusEl, `${spinner()}Stations ophalen langs ${routeSamples.length} punt(en)...`);

  const results = await Promise.allSettled(
    routeSamples.map(([lng, lat]) =>
      cachedFetch(`/.netlify/functions/getstations?lat=${roundCoord(lat)}&lng=${roundCoord(lng)}&fuel=${fuel}`)
    )
  );

  const allStations = new Map();
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value.stations) continue;
    console.log(`[route] stad: ${r.value.city}, stations: ${r.value.stations.length}`);
    for (const s of r.value.stations) {
      if (!allStations.has(s.id)) {
        s.routeOffset   = distToRoute(s.lat, s.lng, routeCoords);
        s.routePosition = positionOnRoute(s.lat, s.lng, routeCoords);
        allStations.set(s.id, s);
      }
    }
  }

  routeStations = [...allStations.values()]
    .filter(s => s.price > 0 && s.routeOffset <= 5)
    .sort((a, b) => a.price - b.price)
    .slice(0, 100);

  if (!routeStations.length) {
    setStatus(routeStatusEl, "Geen stations gevonden langs deze route.", true);
    return;
  }

  routeBrand = "all";
  routePriceMax = Infinity;
  routeSelected = null;
  routePulseMarker = null;
  routeView = "map";
  routeMapEl.classList.remove("hidden");
  routeListEl.classList.add("hidden");

  setStatus(routeStatusEl, `${routeStations.length} stations langs de route`);
  buildSortBtns(routeSortBtnsEl, () => routeSort, id => { routeSort = id; }, () => renderRoute(), "Volgorde");
  routeSortBtnsEl.classList.add("hidden");
  buildBrandFilter(routeFuelEl, routeStations, () => routeBrand, id => { routeBrand = id; }, () => renderRoute());
  buildViewToggle(routeViewToggleEl, routeMapEl, routeListEl, () => routeView, id => { routeView = id; }, () => routeMap, (view) => {
    routeSortBtnsEl.classList.toggle("hidden", view === "map");
    if (view === "map" && routeSelected) {
      if (routePulseMarker) routeMarkers.removeLayer(routePulseMarker);
      routePulseMarker = createPulseMarker(routeSelected.lat, routeSelected.lng);
      routeMarkers.addLayer(routePulseMarker);
      setTimeout(() => routeMap.panTo([routeSelected.lat, routeSelected.lng]), 50);
    }
    if (view === "list" && routePulseMarker) {
      routeMarkers.removeLayer(routePulseMarker);
      routePulseMarker = null;
    }
  });
  renderRoute();
}

routeEditBtn.addEventListener("click", () => {
  routeFormSummary.classList.add("hidden");
  routeFormFields.classList.remove("hidden");
});

calcBtn.addEventListener("click", async () => {
  const startVal = startInput.value.trim();
  const endVal   = endInput.value.trim();
  if (!startVal || !endVal) { setStatus(routeStatusEl, "Vul vertrek en bestemming in.", true); return; }

  calcBtn.disabled = true;
  routeInfoEl.innerHTML = "";
  routeSortBtnsEl.classList.add("hidden");
  routeListEl.innerHTML = "";
  routeStations = [];
  routeSamples  = null;
  routeCoords   = null;
  setStatus(routeStatusEl, `${spinner()}Adressen opzoeken...`);

  try {
    const [start, end] = await Promise.all([geocode(startVal), geocode(endVal)]);
    routeStartPos = start;
    routeEndPos   = end;

    setStatus(routeStatusEl, `${spinner()}Route berekenen...`);
    const route = await getRoute(start, end);

    routeInfoEl.innerHTML = `
      <span>${route.distance.toFixed(0)} km</span> &nbsp;·&nbsp;
      <span>${formatDuration(route.duration)}</span>
    `;

    routeCoords  = route.coords;
    routeSamples = sampleRoute(route.coords, SAMPLE_INTERVAL_KM, SAMPLE_MIN_POINTS);
    await loadRouteStations(routeFuel);

    // Formulier dichtklapt na succesvolle berekening
    routeSummaryText.textContent = `${startVal} → ${endVal}`;
    routeFormFields.classList.add("hidden");
    routeFormSummary.classList.remove("hidden");

  } catch (e) {
    setStatus(routeStatusEl, e.message, true);
  }

  calcBtn.disabled = false;
});

// ─── Sidebar resize (desktop) ─────────────────────────────────────────────────

document.querySelectorAll(".sidebar-resizer").forEach(resizer => {
  resizer.addEventListener("mousedown", e => {
    e.preventDefault();
    const sidebar = resizer.previousElementSibling;
    const startX = e.clientX;
    const startW = sidebar.offsetWidth;
    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = e => {
      const w = Math.max(280, Math.min(700, startW + e.clientX - startX));
      sidebar.style.width = w + "px";
      sidebar.style.flexBasis = w + "px";
    };
    const onUp = () => {
      resizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (nearbyMap) nearbyMap.invalidateSize();
      if (routeMap)  routeMap.invalidateSize();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
});

// ─── Clear-knoppen in tekstvelden ─────────────────────────────────────────────

document.querySelectorAll(".input-wrap").forEach(wrap => {
  const input = wrap.querySelector("input");
  const btn   = wrap.querySelector(".clear-btn");
  const update = () => btn.classList.toggle("visible", input.value.length > 0);
  input.addEventListener("input", update);
  btn.addEventListener("click", () => {
    input.value = "";
    btn.classList.remove("visible");
    input.focus();
    input.dispatchEvent(new Event("input"));
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

if (!navigator.geolocation) {
  setStatus(statusEl, "Geolocation niet ondersteund door deze browser.", true);
}
// GPS wordt pas geladen wanneer de gebruiker naar "In de buurt" navigeert

// Route kaart meteen initialiseren zodat het startscherm niet leeg is
initRouteMap();

tankLitersInput.addEventListener("input", () => {
  tankLiters = Math.max(1, parseInt(tankLitersInput.value) || 50);
  updateSavings();
});
