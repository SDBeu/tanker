# Voortgang

Korte log van wat er per sessie gebouwd of gewijzigd is.

---

## Sessie 1 — 2026-08-19

### Onderzoek
- carbu.com onderzocht: data zit server-side gerenderd in HTML als `data-*` attributen
- API-endpoints gedocumenteerd (getlocation + stations-URL)
- Frontend API-sleutel gevonden (`VsVAqT5t6NoRsIAMtUbxAFJh9UVOjkhfibyArhS7`), niet bruikbaar voor directe toegang

### Opzet project
- Mapstructuur aangemaakt: `public/`, `netlify/functions/`, `docs/`
- `package.json` met `node-html-parser` als dependency, `netlify-cli` als devDependency
- `netlify.toml` geconfigureerd (publish: public, functions: netlify/functions)
- Eigen devserver `server.js` geschreven (emuleert Netlify Functions lokaal op poort 8888)

### Backend
- `netlify/functions/getlocation.js` — GPS-coördinaten omzetten naar carbu.com areacode
- `netlify/functions/getstations.js` — stations ophalen + HTML parsen, retourneert JSON

### Frontend
- `public/index.html` — twee tabs: "In de buurt" en "Langs route"
- `public/app.js` — volledige logica in vanilla JS
  - Tab 1: GPS -> stations laden, sorteren op prijs/afstand
  - Tab 2: adres invoer -> Nominatim geocoding -> OSRM route -> stations langs route (max 3 km)
  - Brandstofkeuze (diesel/super95/super98/lpg), sorteerknopjes
  - Goedkoopste station(s) groen gemarkeerd
- `public/style.css` — mobiel-first dark theme
- `public/manifest.json` — PWA manifest

---

## Sessie 2 — 2026-08-19

### Bugfixes en verbeteringen (lijst)
- Stations met prijs 0 worden overgeslagen (foutieve data van carbu.com)
- Meerdere stations met dezelfde laagste prijs krijgen allemaal de groene markering (was al correct)
- Sorteren op prijs en afstand werkte al, bevestigd

### Kaartweergave toegevoegd (Leaflet.js)
- Leaflet 1.9.4 via CDN (OpenStreetMap tiles, geen API-sleutel)
- Kaart is de standaardweergave; "Kaart / Lijst" toggle toegevoegd op beide tabs
- Tab 1 (In de buurt): stations als gekleurde cirkels op kaart
  - Groen = goedkoopste, amber = overige, blauw = eigen GPS-positie
- Tab 2 (Langs route): route als blauwe lijn + stations als cirkels
- Popup per station: naam, prijs, adres, navigeerknop

### Navigatie
- Links naar carbu.com volledig verwijderd
- "Navigeer" knop toegevoegd: opent Google Maps met het station als bestemming
  - Op kaartpopup en op lijstkaarten
  - URL: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving`

### Technische problemen opgelost
- `netlify dev` werkt niet lokaal met edge-function stijl (`export default` + `Response.json`)
- Oplossing: eigen `server.js` gebruiken via `node server.js`
