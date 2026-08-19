# Carbu PWA — projectinstructies voor Claude

## Wat is dit project?

Een **Progressive Web App (PWA)** die via GPS de dichtstbijzijnde goedkoopste tankstations toont, op basis van data van [carbu.com](https://carbu.com/belgie/).

Gehost op **Netlify** met serverless functions als proxy (om CORS te omzeilen).

## Mapstructuur

```
CARBU/
├── CLAUDE.md              <- dit bestand (Claude-instructies)
├── docs/                  <- Obsidian documentatie
│   ├── onderzoek.md       <- API-onderzoek resultaten
│   └── architectuur.md    <- technische architectuur
├── netlify/
│   └── functions/         <- serverless proxy functies (Node.js)
├── public/                <- frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── manifest.json      <- PWA manifest
├── netlify.toml           <- Netlify configuratie
└── package.json
```

## Tech stack

- **Frontend:** Vanilla JS + HTML/CSS (geen framework, zo simpel mogelijk)
- **Backend:** Netlify Functions (Node.js serverless)
- **Hosting:** Netlify
- **GPS:** Browser Geolocation API
- **Data:** carbu.com (web scraping via proxy)

## Hoe de data werkt

### Stap 1 — GPS naar areacode
```
GET https://carbu.com/commonFunctions/getlocation/controller.getlocation_JSON.php
  ?lat={lat}&lng={lng}&SHRT=1&L=nl
```
Respons: `[{"ac":"BE_foi_2551","n":"Gent","pc":"9000", ...}]`

### Stap 2 — stations ophalen
```
GET https://carbu.com/belgie/liste-stations-service/{brandstof}/{stad}/{postcode}/{areacode}/0
  ?a={base64(carburant_type=1&areaCode=...&lat=...&lng=...&sortBy=price)}
```

### Data per station (in HTML als data-* attributen)
- `data-name` — naam van het station
- `data-lat` / `data-lng` — coordinaten
- `data-price` — prijs in euro
- `data-distance` — afstand in km
- `data-address` — adres
- `data-fuelname` — brandstoftype
- `data-link` — URL naar stationdetail op carbu.com

### Brandstoftypes
- `diesel` (carburant_type=1)
- `super95`
- `super98`
- `lpg`

## Netlify Functions (proxy)

De browser mag carbu.com niet rechtstreeks aanroepen (CORS). De Netlify Functions doen dat server-side.

- `netlify/functions/getlocation.js` — GPS naar areacode
- `netlify/functions/getstations.js` — stations ophalen + HTML parsen

## Deployment

```bash
npm install
netlify dev        # lokaal testen
netlify deploy     # preview
netlify deploy --prod  # productie
```

## Context van de eerste sessie

- Onderzoek gedaan op 2026-08-19
- API-sleutel gevonden in broncode: `VsVAqT5t6NoRsIAMtUbxAFJh9UVOjkhfibyArhS7` (frontend key, niet bruikbaar voor directe API-toegang)
- Data zit server-side gerenderd in de HTML, scraping met node-html-parser
