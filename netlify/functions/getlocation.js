export default async (req) => {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  if (!lat || !lng) {
    return Response.json({ error: "lat en lng zijn verplicht" }, { status: 400 });
  }

  const carbuUrl = `https://carbu.com/commonFunctions/getlocation/controller.getlocation_JSON.php?lat=${lat}&lng=${lng}&SHRT=1&L=nl`;

  const res = await fetch(carbuUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36",
      "Accept": "application/json, text/javascript, */*",
      "Referer": "https://carbu.com/belgie/",
    },
  });

  if (!res.ok) {
    return Response.json({ error: "carbu.com niet bereikbaar" }, { status: 502 });
  }

  const data = await res.json();

  if (!data || data.length === 0) {
    return Response.json({ error: "Geen locatie gevonden" }, { status: 404 });
  }

  const loc = data[0];
  return Response.json({ ac: loc.ac, n: loc.n, pc: loc.pc });
};

export const config = { path: "/.netlify/functions/getlocation" };
