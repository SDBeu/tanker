import { parse } from "node-html-parser";

const FUEL_TYPES = {
  diesel:  1,
  super95: 2,
  super98: 3,
  lpg:     6,
};

// Correcte URL-slug zoals carbu.com zelf gebruikt (selectProduct waarden)
const FUEL_SLUGS = {
  diesel:  "GO",
  super95: "E10",
  super98: "SP98",
  lpg:     "GPL",
};

export default async (req) => {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const fuel = url.searchParams.get("fuel") || "diesel";

  if (!lat || !lng) {
    return Response.json({ error: "lat en lng zijn verplicht" }, { status: 400 });
  }

  // Stap 1: areacode ophalen
  const locUrl = `https://carbu.com/commonFunctions/getlocation/controller.getlocation_JSON.php?lat=${lat}&lng=${lng}&SHRT=1&L=nl`;
  const locRes = await fetch(locUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36",
      "Referer": "https://carbu.com/belgie/",
    },
  });

  if (!locRes.ok) {
    return Response.json({ error: "Locatie niet gevonden" }, { status: 502 });
  }

  const locData = await locRes.json();
  if (!locData || locData.length === 0) {
    return Response.json({ error: "Geen locatie gevonden voor deze GPS-positie" }, { status: 404 });
  }

  const { ac, n, pc } = locData[0];
  const carburantType = FUEL_TYPES[fuel] || 1;
  const fuelSlug      = FUEL_SLUGS[fuel] || fuel;

  // Stap 2: a-parameter opbouwen (base64)
  const params = `carburant_type=${carburantType}&areaCode=${ac}&lat=${lat}&lng=${lng}&z=z&checked=true&sortBy=price`;
  const a = Buffer.from(params).toString("base64");

  // Stap 3: HTML ophalen
  const stationsUrl = `https://carbu.com/belgie/liste-stations-service/${fuelSlug}/${encodeURIComponent(n)}/${pc}/${ac}/0?a=${a}`;
  const htmlRes = await fetch(stationsUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36",
      "Accept": "text/html",
      "Referer": "https://carbu.com/belgie/",
    },
  });

  if (!htmlRes.ok) {
    return Response.json({ error: "Stations niet opgehaald" }, { status: 502 });
  }

  const html = await htmlRes.text();

  // Stap 4: parsen
  const root = parse(html);
  const cards = root.querySelectorAll("[data-price]");

  const stations = cards
    .map((el) => ({
      id: el.getAttribute("data-id"),
      name: el.getAttribute("data-name"),
      lat: parseFloat(el.getAttribute("data-lat")),
      lng: parseFloat(el.getAttribute("data-lng")),
      price: parseFloat(el.getAttribute("data-price")),
      distance: parseFloat(el.getAttribute("data-distance")),
      fuelname: el.getAttribute("data-fuelname"),
      address: el.getAttribute("data-address")?.replace(/<br\s*\/?>/gi, ", "),
      logo: el.getAttribute("data-logo"),
      link: el.getAttribute("data-link"),
    }))
    .filter((s) => s.name && !isNaN(s.price) && s.price > 0)
    // Dedupliceer op id (elk station staat meerdere keren in de HTML)
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
    .sort((a, b) => a.price - b.price);

  return Response.json({ city: n, fuel, stations });
};

export const config = { path: "/.netlify/functions/getstations" };
