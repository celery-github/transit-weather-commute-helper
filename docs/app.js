import { CONFIG } from "./config.js";

const els = {
  toggleBtn: document.getElementById("toggleBtn"),
  routeTitle: document.getElementById("routeTitle"),
  stopMeta: document.getElementById("stopMeta"),
  updatedAt: document.getElementById("updatedAt"),
  statusPill: document.getElementById("statusPill"),
  arrivals: document.getElementById("arrivals"),
  weather: document.getElementById("weather"),
  suggestion: document.getElementById("suggestion"),
};

// state: true = Home→Work, false = Work→Home
let homeToWork = true;

function currentProfile() {
  const from = homeToWork ? CONFIG.home : CONFIG.work;
  const to = homeToWork ? CONFIG.work : CONFIG.home;
  return { from, to };
}

function setPill(text) {
  els.statusPill.textContent = text;
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

async function fetchArrivals(stopId) {
  const url = `${CONFIG.workerBaseUrl}/api/ttc/arrivals?stopId=${encodeURIComponent(stopId)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Arrivals API failed: ${res.status}`);
  return res.json();
}

async function fetchRain(lat, lon) {
  // Open-Meteo: no key. We'll use hourly precipitation probability + precipitation.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=precipitation_probability,precipitation&forecast_days=1&timezone=America%2FToronto`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  return res.json();
}

function renderArrivals(data) {
  els.arrivals.innerHTML = "";
  if (!data.arrivals || data.arrivals.length === 0) {
    els.arrivals.innerHTML = `<div class="muted">No arrivals found (check stop ID / feed availability).</div>`;
    return;
  }

  for (const a of data.arrivals.slice(0, 6)) {
    const mins = a.minutes === null ? "—" : `${a.minutes} min`;
    const html = `
      <div class="item">
        <div><strong>${a.routeShortName ?? "Route"}</strong> ${a.tripHeadSign ? `→ ${a.tripHeadSign}` : ""}</div>
        <div class="muted">ETA: ${mins} • ${a.scheduledTime ?? ""}</div>
      </div>
    `;
    els.arrivals.insertAdjacentHTML("beforeend", html);
  }
}

function renderWeather(w) {
  els.weather.innerHTML = "";

  const times = w?.hourly?.time || [];
  const prob = w?.hourly?.precipitation_probability || [];
  const precip = w?.hourly?.precipitation || [];

  if (!times.length) {
    els.weather.innerHTML = `<div class="muted">No weather data returned.</div>`;
    return;
  }

  // show next ~2 hours (hourly data → show next 3 entries from "now")
  const now = new Date();
  const idx = times.findIndex(t => new Date(t) >= now);
  const start = idx >= 0 ? idx : 0;
  const end = Math.min(start + 3, times.length);

  for (let i = start; i < end; i++) {
    els.weather.insertAdjacentHTML(
      "beforeend",
      `<div class="item">
        <div><strong>${new Date(times[i]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div>
        <div class="muted">Rain chance: ${prob[i] ?? 0}% • Amount: ${precip[i] ?? 0} mm</div>
      </div>`
    );
  }
}

function computeSuggestion(arrivalsData, weatherData) {
  // MVP logic:
  // - If rain chance in the next hour is >= 60%, suggest "leave sooner if possible"
  // - Else pick the soonest arrival
  const times = weatherData?.hourly?.time || [];
  const prob = weatherData?.hourly?.precipitation_probability || [];

  const now = new Date();
  const nextHourIdx = times.findIndex(t => new Date(t) >= now);
  const rainChance = nextHourIdx >= 0 ? (prob[nextHourIdx] ?? 0) : 0;

  const soonest = arrivalsData?.arrivals?.[0];
  if (!soonest) return "No arrivals found — double-check stop ID.";

  if (rainChance >= 60) {
    return `Rain likely soon (${rainChance}%). If you can, aim for the next arrival (${soonest.minutes ?? "—"} min) to beat the worst of it.`;
  }
  return `Looks decent. Catch the next ride in ${soonest.minutes ?? "—"} min.`;
}

async function refresh() {
  const { from, to } = currentProfile();

  els.toggleBtn.textContent = homeToWork ? "Home → Work" : "Work → Home";
  els.routeTitle.textContent = `${from.label} → ${to.label}`;
  els.stopMeta.textContent = `${from.label} stop ID: ${from.stopId}`;
  setPill("Loading…");
  els.updatedAt.textContent = "—";
  els.suggestion.textContent = "Calculating…";
  els.arrivals.innerHTML = `<div class="muted">Loading…</div>`;
  els.weather.innerHTML = `<div class="muted">Loading…</div>`;

  try {
    const [arrivals, weather] = await Promise.all([
      fetchArrivals(from.stopId),
      fetchRain(to.lat, to.lon)
    ]);

    renderArrivals(arrivals);
    renderWeather(weather);

    els.updatedAt.textContent = fmtTime(arrivals.generatedAt || new Date().toISOString());

    // Status pill is a simple blend: if no arrivals => "Check stop", else rain risk
    const hasArrivals = arrivals.arrivals && arrivals.arrivals.length > 0;
    if (!hasArrivals) setPill("⚠️ No arrivals — check stop");
    else setPill("✅ Updated");

    els.suggestion.textContent = computeSuggestion(arrivals, weather);
  } catch (e) {
    setPill("⚠️ Error");
    els.arrivals.innerHTML = `<div class="muted">${e.message}</div>`;
    els.weather.innerHTML = `<div class="muted">${e.message}</div>`;
    els.suggestion.textContent = "Couldn’t calculate right now.";
  }
}

els.toggleBtn.addEventListener("click", () => {
  homeToWork = !homeToWork;
  refresh();
});

// initial load
refresh();
