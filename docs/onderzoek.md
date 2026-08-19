# Carbu.com API-onderzoek

Datum: 2026-08-19

## Bevindingen

### Publieke API (api.carbu.com/v1.1)

- Bestaat, maar vereist een registratie/API-sleutel die niet publiek beschikbaar is
- De frontend-key in de broncode (`VsVAqT5t6NoRsIAMtUbxAFJh9UVOjkhfibyArhS7`) geeft `API_KEY_MISSING` terug — niet bruikbaar

### Werkende endpoints (geen auth vereist)

#### Locatie opzoeken op naam
```
GET https://carbu.com/commonFunctions/getlocation/controller.getlocation_JSON.php
  ?location=gent&page_limit=10&minLevel=5&maxLevel=6&SHRT=1&country=BE&L=nl
```

#### Locatie opzoeken op GPS
```
GET https://carbu.com/commonFunctions/getlocation/controller.getlocation_JSON.php
  ?lat=51.0543&lng=3.7174&SHRT=1&L=nl
```

Respons:
```json
[{
  "id": "BE_foi_2551",
  "ac": "BE_foi_2551",
  "n": "Gent",
  "pc": "9000",
  "rn": "Oost-Vlaanderen",
  "cn": "Belgie"
}]
```

#### Stationslijst (HTML scraping)
```
GET https://carbu.com/belgie/liste-stations-service/diesel/Gent/9000/BE_foi_2551/0
  ?a=Y2FyYnVyYW50X3R5cGU9MSZhcmVhQ29kZT1CRV9mb2lfMjU1MSZsYXQ9NTEuMDc2MzIxJmxuZz0zLjcyOTI3MyZ6PXomY2hlY2tlZD10cnVlJnNvcnRCeT1wcmljZQ==
```

De `a`-parameter is base64 van:
```
carburant_type=1&areaCode=BE_foi_2551&lat=51.076321&lng=3.729273&z=z&checked=true&sortBy=price
```

Sorteeropties: `price`, `distance`, `service`

### Data in de HTML (data-* attributen per station)

```html
<div
  data-id="434"
  data-name="Esso Express Gent Wiedauwkaai"
  data-lat="51.081623961262"
  data-lng="3.7250075926597"
  data-price="2.119"
  data-distance="0.66067366696891"
  data-fuelname="Diesel (B7)"
  data-address="Wiedauwkaai 82 9000 Gent"
  data-logo="esso_express.gif"
  data-link="https://carbu.com/belgie/index.php/station/esso-express/gent/9000/434"
>
```

### Brandstoftypes (in URL)
| URL-segment | carburant_type | Label |
|---|---|---|
| `diesel` | 1 | Diesel (B7) |
| `super95` | ? | Super 95 |
| `super98` | ? | Super 98 |
| `lpg` | ? | LPG |

## Conclusie

Web scraping van de HTML-pagina is de meest haalbare aanpak voor eigen gebruik. De data zit in `data-*` attributen en is eenvoudig te parsen met node-html-parser.
