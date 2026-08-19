# Architectuur

## Overzicht

```
[Telefoon/Browser]
       |
       | HTTPS
       v
[Netlify CDN]
   /public/*              -> statische bestanden (HTML, CSS, JS, manifest)
   /.netlify/functions/*  -> serverless Node.js functies
       |
       | server-side HTTP (geen CORS)
       v
[carbu.com]
```

Externe diensten (rechtstreeks vanuit browser, geen CORS-probleem):
- **Nominatim** (OpenStreetMap) — adres naar coordinaten, gratis
- **OSRM** (project-osrm.org) — routeberekening, gratis, geen API-sleutel

## Tabs

### Tab 1: In de buurt
```
1. GPS via navigator.geolocation
2. fetch('/.netlify/functions/getstations?lat=&lng=&fuel=')
3. Netlify Function -> carbu.com HTML ophalen + parsen
4. JSON terug -> lijst gesorteerd op prijs
```

### Tab 2: Langs route
```
1. Adres invoer -> Nominatim geocoding -> coordinaten
2. OSRM -> routegeometrie (GeoJSON LineString)
3. Monsterpunten elke 15 km langs de route
4. Per punt: fetch('/.netlify/functions/getstations?lat=&lng=&fuel=') (parallel)
5. Alle stations samenvoegen, dedupliceren op ID
6. Filter: max 3 km van de route
7. Sorteren op prijs -> tonen
```

## Frontend (public/)

- `index.html` — twee tabs: "In de buurt" en "Langs route"
- `app.js` — alle logica, vanilla JS
- `style.css` — mobiel-first dark theme
- `manifest.json` — PWA installeerbaar maken

## Backend (netlify/functions/)

### getlocation.js
- Input: `?lat=&lng=`
- Output: `{ ac, n, pc }` (areacode, naam, postcode)

### getstations.js
- Input: `?lat=&lng=&fuel=diesel`
- Stap 1: getlocation aanroepen voor areacode
- Stap 2: carbu.com HTML ophalen, gesorteerd op prijs
- Stap 3: data-* attributen parsen met node-html-parser
- Output: `{ city, fuel, stations[] }`

## Externe diensten (gratis, geen registratie)

| Dienst | Gebruik | Limiet |
|---|---|---|
| Nominatim | Adres -> coordinaten | 1 req/s, fair use |
| OSRM | Routeberekening | Fair use |
| carbu.com | Stationsdata (scraping) | Geen formele limiet |

## PWA

- `manifest.json` -> installeerbaar op Android en iOS
- GPS via `navigator.geolocation`
- Geen service worker voor MVP
