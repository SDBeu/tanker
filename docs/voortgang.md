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

---

## Sessie 3 — 2026-08-19

### Bugfix routestations
- Stations langs route stopten in de regio Antwerpen, bereikten Sint-Niklaas niet
- Oorzaak: Map-volgorde bevoordeelde vroege monsterpunten (Herentals e.o.)
- Oplossing: alle stations sorteren op prijs **vóór** `slice(0, 100)` zodat geografische spreiding niet verloren gaat

### Kaart bij opstart (routetab)
- Routetab toonde een lege rechterkant bij opstart
- Oplossing A gekozen: Belgiakaart meteen tonen bij init (`setView([50.5, 4.5], 8)`)
- `initRouteMap()` wordt nu aangeroepen bij het laden van de pagina

### GPS-bolletje routetab
- Knop "gebruik mijn locatie" toonde al een bolletje op de nearbytab, niet op de routetab
- Nieuwe functie `showRouteStartDot(pos)` toegevoegd: groene cirkel op de routekaart

### Positie langs de route
- Nieuwe functie `positionOnRoute(lat, lng, coords)`: projecteert een station op het dichtstbijzijnde routesegment via dot-product, retourneert km vanuit startpunt
- Stationskaarten tonen nu "bij km X" in plaats van de afstand van carbu.com
- Sorteren op "Volgorde" sorteert op `routePosition` (km vanuit start)
- Sorteertab op routetab heet "Volgorde" i.p.v. "Afstand"

### Favicon en icoontjes
- Favicon was gebroken PNG → vervangen door SVG favicon (`favicon.svg`)
- `favicon.svg`: donkerblauwe achtergrond, amber druppel met €-teken
- `icon-192.png` en `icon-512.png` hergegenereerd via Playwright canvas → Node.js Buffer
- Geplaatst als PWA-icoon in `manifest.json`

### Open Graph meta-tags
- Link previews toegevoegd voor Teams, WhatsApp, Signal, ...
- `og:title`, `og:description`, `og:image`, `twitter:card` etc. in `index.html`
- Eigen OG-afbeelding gegenereerd: `public/og-image.png`
- Geen em-dash in titels of beschrijvingen (Vlaamse schrijfstijl)

### Besparingsindicator in de header
- Nieuw element `#savings-display` in de header naast het logo
- Toont: jerrycan-SVG | invoerveld tankinhoud (standaard 50 L) | besparingsbedrag
- Besparing = (duurste station − sliderwaarde) × tankinhoud liter
- Jerrycan heeft gradient: groen (veel besparing) → rood (weinig/geen besparing)
- Leeg en rood wanneer de slider nog niet is aangeraakt (motiverende startstatus)
- `tankLiters` instelbaar; updateSavings() wordt ook getriggerd bij wijziging tankinhoud

### Besparingsindicator in popups
- Elke kaartpopup toont een middelgrote jerrycan (68 × 104 px) met:
  - Vulniveau = procentuele besparing t.o.v. duurste station
  - Tekst in de can: `€ X.XX` (regel 1) en `50L` (regel 2)
- Popup-inhoud wordt dynamisch berekend bij openen (`bindPopup(function)`)
  zodat een gewijzigde tankinhoud meteen correct zichtbaar is

### Besparingsindicator in de lijst
- Elke stationskaart in de lijstweergave toont een kleine jerrycan (16 × 25 px) + `€ X.XX`
- Berekend t.o.v. de **globale max** (duurste station bij laden) × tankinhoud
- Kleur volgt de prijs-gradient (groen = goedkoop, rood = duur)

### Consistentie besparingsreferentie (bugfix)
- Probleem: popup, lijst en header gebruikten elk een ander referentiepunt → tegenstrijdige bedragen
- Oplossing: vaste referentie = `globalMax` (duurste station bij laden van de set, verandert niet)
  - **Popup**: (globalMax − station.price) × liters
  - **Lijst**: (globalMax − station.price) × liters — via `globalMaxPrice` parameter in `renderStations()`
  - **Header**: (globalMax − sliderwaarde) × liters = *minimale* besparing van elk zichtbaar station
    - Slider helemaal rechts (= globalMax): header = € 0
    - Slider schuift naar links: header stijgt
    - Elk station in de lijst bespaart altijd ≥ header (want station.price ≤ sliderwaarde)
- `og-image.png` was beschadigd (geen geldige PNG) → opnieuw gegenereerd via Playwright screenshot 1200×630 px

### Slider duimknop als jerrycan
- Slider-duimknop heeft een jerrycan-SVG als achtergrondafbeelding
- Kleur past mee met de sliderwaarde via CSS custom property `--thumb-image`
- SVG als data-URL gegenereerd in JavaScript, gezet via `style.setProperty`

### GitHub
- Repository aangemaakt: `https://github.com/SDBeu/tanker`
- Alle code gepusht naar `master` branch
