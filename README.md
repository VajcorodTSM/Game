# Tieň nad Hôrkou

Textové RPG v slovenčine, ktoré sa hrá v prehliadači.

## Ako hrať

Otvor súbor `index.html` v prehliadači. Nič netreba inštalovať.

## Čo hra obsahuje

- **Tvorba postavy:** meno, pohlavie (texty sa prispôsobia), povolanie (Bojovník, Mág, Zlodej), pôvod s bonusom a rozdelenie bodov do vlastností (Sila, Obratnosť, Inteligencia, Odolnosť).
- **Ťahové súboje:** útok, schopnosť (stojí manu), obrana (obnoví trochu many), elixíry a útek.
- **Postup postavy:** skúsenosti, úrovne a zlepšovanie vlastností.
- **Obchod** so zbraňami, zbrojou a elixírmi. **Hostinec** obnoví zdravie aj manu.
- **Príbeh:** Šepkavý les → Zubatá jaskyňa (náčelník Gruzz) → Zrúcaná veža (Tieňový mág Morvent).
- **Ukladanie hry** v prehliadači (tlačidlá Uložiť / Načítať).

## Súbory

- `index.html` – štruktúra stránky
- `style.css` – vzhľad
- `game.js` – celá logika hry (dáta, scény, súboje, ukladanie)

Nové lokality pridáš do objektu `SCENES`, nepriateľov do `ENEMIES` a predmety do `ITEMS` v `game.js`.
