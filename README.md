# Időkapszula

Húzd be egy közös év vagy út fotóit, és pár másodperc alatt kapsz egy szép, görgethető visszatekintő oldalt: fejezetekre bontott idővonal, animált térkép, a legjobb képek, a végén személyes üzenet. Ajándéknak készült. Nincs regisztráció, és **a fotóid nem hagyják el a böngésződet**.

- **Élő oldal:** https://botondjani.github.io/p-ros/
- **Demo:** a landing oldalon görgetve rögtön megjelenik egy kész minta (32 kép egy portugáliai útról). A „Próbáld ki a szerkesztőt a mintán” gomb ugyanezt nyitja meg szerkeszthetően.
- **Stack:** Vite + React + TypeScript, Tailwind v4, Zustand, IndexedDB (idb-keyval), MapLibre GL + OpenFreeMap, exifr, libheif (WebAssembly), Web Workerek. Opcionális AI: egy Vercel-függvény az Anthropic API felé.

## Futtatás

```bash
npm install
npm run dev        # http://localhost:5173 (előtte lefordítja az export-megjelenítőt is)
npm test           # egységtesztek (Vitest)
npm run build      # éles build a dist/ mappába (+ landing-prerender, service worker)
npm run preview    # az éles build kipróbálása
```

Node 20+ kell. Az AI-szépítés kulcs nélkül is kipróbálható: ilyenkor a panel jelzi, hogy nincs beállítva, és **semmit nem küld el**.

## Környezeti változók

Lásd `.env.example`. Mind opcionális.

| Változó | Hol | Mire |
|---|---|---|
| `ANTHROPIC_API_KEY` | szerver (Vercel) | Az AI-szépítés kulcsa. **Csak a szerveren van**, a kliens kódjába sosem kerül. |
| `ANTHROPIC_MODEL` | szerver | Másik modell. Alapértelmezés: `claude-opus-5-5`. |
| `ALLOWED_ORIGIN` | szerver | Ha be van állítva, a végpont csak erről az originről fogad kérést. |
| `VITE_ENHANCE_URL` | kliens (build) | Másik AI-végpont címe. Alapértelmezés: `/api/enhance`. |

Fejlesztéskor a `.env` fájlból olvas, és a Vite dev szerver is kiszolgálja az `/api/enhance` végpontot.

## Privacy-modell

| Adat | Hova kerül |
|---|---|
| Eredeti fájlok (JPEG, HEIC, …) | **Sehova.** A böngészőben olvassuk be őket, a feldolgozás után eldobjuk. |
| EXIF (idő, GPS) | A böngészőben dolgozzuk fel. A pontos képenkénti koordináták nem kerülnek se az exportba, se az AI-hoz. |
| Kicsinyített másolatok (1600 px és 720 px) | IndexedDB, ugyanabban a böngészőben. Így frissítés után is megmarad a munka. Az „Új” gomb törli. |
| Megosztás (egy HTML-fájl vagy zip) | A gépeden/telefonodon készül, szerverre nem megy. Csak a látható képek kerülnek bele, fájlnevek és képenkénti GPS nélkül, a fejezet szintű helyekkel. |
| AI-szépítés | **Csak ha rákattintasz, és elfogadod.** Fejezetenként legfeljebb 6 kép megy el, 768 px-es, EXIF nélkül újratömörített JPEG-ként, plusz a fejezetek dátuma, helyneve és címe. A végpont csak továbbítja a kérést az Anthropic API-nak; nem tárol és nem naplóz képet. Előtte egy kép nélküli GET megnézi, be van-e állítva a kulcs. |
| Helynevek | Offline, beépített városlistából (GeoNames, 15 000 főnél nagyobb települések). Koordináta nem megy ki. |
| Térképcsempék | Az OpenFreeMap-ről jönnek. Ezek a térkép egy részletét kérik le, képet nem küldenek. A lekért terület elárulja, nagyjából merre jártál. Ha ez gond, kapcsold ki a netet: ilyenkor egy offline útvonalvázlat látszik. |

### Ellenőrzés a Network fülön

1. Nyisd meg a DevTools → Network fület, pipáld be a *Preserve log* opciót.
2. Tölts fel képeket (vagy indítsd el a demót).
3. Szűrj `method:POST`-ra: **nincs találat**. A feltöltés alatt csak az alkalmazás saját fájljai (worker, `places.json`, betűtípusok) és a `blob:` URL-ek látszanak. Ezek a böngészőn belüli hivatkozások, nem mennek ki a hálózatra.
4. Az egyetlen kérés, amely képadatot visz, az AI-szépítés `POST /api/enhance`-e. Ez csak a panel „Rendben, mehet” gombjára indul el.

Ugyanezt automatikusan is ellenőriztük headless Chromiummal (Playwright): 50 kép feldolgozása alatt egyetlen POST sem indult. A kérések: a worker-fájl, a `places.json`, a HEIC-dekóder chunk és a `blob:` URL-ek. Az exportnál csak a viewer-fájlok és a térképcsempék töltődtek le.

## Hogyan működik

```
Fájlok / demo ──► Source ──► Worker pool: EXIF · dekódolás (HEIC: libheif wasm) · kicsinyítés
                              · élesség · fényerő · dHash
               ──► Elemzés (fő szál): minőségszűrés → duplikátumok → eseményekre bontás
                              → helynevek → válogatás → Project
               ──► Zustand + IndexedDB ──► Történet-nézet · Szerkesztő · Export · AI
```

- **Eseményekre bontás** (`src/analysis/cluster.ts`): időrendben új esemény kezdődik 6 óránál nagyobb szünet vagy 30 km-nél nagyobb elmozdulás után. A hely nélküli események 12 órán belül a szomszédos, hellyel rendelkező eseményhez olvadnak, különben „hely nélkül” maradnak. Az egyképes esemény a szomszédjához olvad. Ha 12-nél több fejezet jönne ki, napokra, hetekre, majd hónapokra vonjuk össze őket. A dátum nélküli, de GPS-es kép a legközelebbi fejezetbe kerül, a többi a „Dátum nélkül” fejezetbe.
- **Minőség** (`src/analysis/quality.ts`):
  - Élesség: Laplace-variancia 768 px-en, plusz egy skálaarány (768 és 384 px közötti Laplace-energia). Ez a kontraszttól független: bemozdult képen ~0,3, élesen ≥0,55, így az éjszakai képek nem esnek ki.
  - Sötét kép: nagyon sötét, vagy sötét és lapos.
  - Duplikátum (`dedup.ts`): 64 bites dHash, Hamming ≤ 6, 10 perces ablakban; a jobb pontszámú kép marad.
- **Válogatás** (`select.ts`): fejezetenként 3–8 kép (a képszám gyökével arányosan). Mohó algoritmus, amely bünteti a sorozatképeket.
- **Fejezetcím AI nélkül:** a hely neve, ennek hiányában a dátum. A szövegek visszafogottak; a szerkesztőben átírhatók.
- **`Source` absztrakció** (`src/model/types.ts`): az MVP-ben fájlok és a demo. Később ide köthető bármilyen külső forrás, a feldolgozó lánc változtatása nélkül.

## Szerkesztés

A „Szerkesztés” gomb után:
- bármelyik cím vagy szöveg helyben átírható;
- fejezetenként látszik az összes kép, a kiszűrtek indoklással (életlen, túl sötét, ismétlődő, kimaradt);
- a képek ki- és visszakapcsolhatók, a ★ jelöli a kiemelt képet, a képek sorrendje húzással változtatható (egérrel, érintéssel, billentyűzettel);
- képaláírás adható, a fejezetek sorrendje módosítható;
- 4 téma közül lehet választani, Ctrl+Z visszavon.

Minden automatikusan mentődik ezen a gépen.

## Megosztás

A „Megosztás” gomb **egyetlen HTML-fájlt** készít, szerver nélkül. A fájl mindent tartalmaz: a megjelenítőt, a betűtípusokat és az 1280 px-re kicsinyített képeket (a mintával ~6 MB).
- **Telefonon** a rendszer megosztás-menüje nyílik meg (Messenger, WhatsApp, e-mail…), ha a böngésző tud fájlt megosztani. Ha nem tud, a fájl letöltődik.
- **Gépen** a fájl letöltődik; e-mailhez vagy üzenethez csatolható.
- A címzett **böngészőben** a teljes, görgethető oldalt látja (a térkép helyett az útvonalvázlatot, mert egy helyi fájlból nem tölthetők térképcsempék).
- Ha egy telefon csak **előnézetben** nyitja meg (pl. iOS Quick Look, ahol nem fut JavaScript), akkor is látszik egy egyszerű album: a címek, a képek, a képaláírások és az üzenet. A képek csak egyszer vannak a fájlban; a megjelenítő ugyanezeket használja.

**Jelszavas védelem (opcionális):** PBKDF2-SHA256 (250 000 iteráció) + AES-GCM, WebCrypto. A képek és a szövegek is a titkosított blokkban vannak, a cím sem látszik. Jelszóval a fájl csak böngészőben nyitható meg.

> ⚠️ **Ez nem erős védelem.** A véletlen betekintés ellen véd. Aki megszerzi a fájlt, offline próbálgathatja a jelszót, ezért rövid vagy kitalálható jelszóval könnyen feltörhető. Érzékeny képekhez ne erre hagyatkozz.

**Haladó: weboldal-csomag (zip).** A panel alján lenyitható. Ez egy statikus weboldalt ad (`index.html`, `viewer.js`/`viewer.css`, `data.js`, `img/`), saját tárhelyre (Netlify, GitHub Pages). Webszerverről a térkép is teljes értékű.

## AI-szépítés

`api/enhance.ts` (Vercel-függvény) → `server/enhance.ts`. Fejezetenként egy kérés megy ki, hogy beleférjen a Vercel 4,5 MB-os body-limitjébe, és látszódjon a haladás. A beállítások:
- modell: `claude-opus-5-5`, strukturált kimenettel (Zod séma), `effort: low`;
- a válasz: magyar cím (legfeljebb 5 szó), 1–2 mondatos hangulatszöveg és a legjobb kép azonosítója;
- ha a modell biztonsági okból elutasít egy kérést, a szerver automatikusan egy tartalék modellel próbálja újra (`fallbacks: "default"`);
- a prompt kéri: ne legyen közhelyes vagy túlzó, ne találjon ki eseményeket, és ne azonosítson embereket;
- a user által átírt címet és szöveget nem írja felül, és minden módosítás visszavonható.

## A landing beágyazott mintája

A landing alján látható minta előre kiszámolt projekt (`public/demo/project.json`). Ugyanazon a feldolgozó láncon készült, mint a feltöltött képek, így a landing azonnal, feldolgozás nélkül mutatja. A kód csak akkor töltődik be, amikor a user görgetni kezd felé. A mintaképek vagy a feldolgozás változása után így kell újragenerálni:

```bash
npm run dev            # egy másik terminálban
node scripts/build-demo-project.cjs
```

## Offline működés

Az első látogatáskor egy service worker (`src/sw.template.js`) eltárolja az alkalmazás összes fájlját: a workert, a HEIC-dekódert, a helynév-adatbázist és a viewert. Utána hálózat nélkül is megy a feltöltés, az elemzés, a megjelenítés és az export; csak a térképcsempék hiányoznak. Képet, API-választ és csempét a service worker nem tárol.

## Deploy Vercelre

1. Importáld a repót a Vercelben (Framework: Vite). A beállításokat a `vercel.json` adja: build `npm run build`, output `dist`, az `api/enhance.ts` függvény 60 mp-es időkorláttal.
2. Opcionálisan: Project Settings → Environment Variables → `ANTHROPIC_API_KEY` (és ha kell, `ALLOWED_ORIGIN`).
3. Deploy. Kulcs nélkül minden működik, csak az AI-szépítés jelzi, hogy nincs beállítva.

## Mérések

Headless Chromiumban mértük, 4 magos konténerben.

| Mérés | Eredmény |
|---|---|
| 50 vegyes kép (40 JPEG + 10 HEIC, 12 MP, 35 GPS-es, 2 dátum nélküli) → idővonal | **~7–8 mp** (cél: 30 mp) |
| Ugyanez offline (service worker után) | **~8 mp** |
| Demo (32 kép) → idővonal | ~1–1,5 mp |
| Lighthouse, landing, mobil (lassú 4G + 4× CPU) | Performance **96**, Accessibility 100, Best Practices 100, SEO 100 |
| Lighthouse, landing, asztali | Performance **100** |

A landing gyorsaságát a build-idejű prerender (`scripts/prerender.mjs`), a magyar karakterekre szűkített, előtöltött fontok és a lustán betöltött nézetek (térkép, szerkesztő, export, AI) adják.

## Ismert korlátok

- **iOS fájlválasztó:** a fotótárból választáskor az iOS a HEIC-et JPEG-re alakíthatja, és beállítástól függően elhagyhatja a helyadatokat. Ilyenkor a képek „hely nélkül” vagy a szomszédos képek helyével jelennek meg.
- **Megosztott fájl iOS-en:** az iOS a csatolt HTML-t előnézetben nyitja meg, ahol nem fut JavaScript. Ilyenkor a statikus album látszik, a görgethető oldal és a térképvázlat nem.
- **Időzónák:** az EXIF-idő helyi „falióra-idő” (időzóna nélkül), ezért úgy kezeljük, mintha a böngésző időzónájában készült volna. Ez a napokat és napszakokat a képen látható idő szerint adja vissza, de időzónák közötti utazásnál a sorrend órákkal elcsúszhat.
- A térkép a fejezetek *középpontjait* köti össze légvonalban. Ez nem a valódi útvonal.
- Az AI-végpontot élő kulccsal ebben a fejlesztői környezetben nem futtattuk le (nem volt kulcs); a szerverlogikát mockolt klienssel teszteltük.

## Projektstruktúra

```
api/enhance.ts            Vercel-függvény (vékony burok)
server/enhance.ts         AI-logika: Anthropic SDK, séma, prompt
scripts/                  places.json (GeoNames), landing-prerender, a beágyazott minta előállítása
src/model/                adatmodell, Zustand store, IndexedDB-mentés
src/sources/              FileSource, DemoSource (Source absztrakció)
src/pipeline/             worker pool, EXIF, HEIC
src/analysis/             csoportosítás, minőség, dHash, duplikátum, válogatás, statisztika, helynevek
src/story/                történet-nézet (az exportált oldal is ezt használja)
src/editor/               szerkesztő rács, alsó sáv
src/export/               egyfájlos HTML és zip, titkosítás, megosztás-panel
src/ai/                   AI-kliens, hozzájárulás-panel
src/viewer/               az exportált oldal belépési pontja
tests/                    Vitest egységtesztek a tiszta logikára
```

## Licencek és források

- Mintaképek: [Unsplash License](https://unsplash.com/license). A szerzők listája a `public/demo/demo.json`-ban van. Az időpontok és helyek illusztratívak. Két kép szándékosan elrontott másolat (bemozdult, sötét), a minőségszűrés bemutatására.
- Helynevek: [GeoNames](https://www.geonames.org/) (CC BY 4.0), `scripts/build-places.mjs`.
- Térkép: [OpenFreeMap](https://openfreemap.org/), © OpenMapTiles, © OpenStreetMap közreműködők.
- Betűtípusok: Fraunces és Inter (SIL Open Font License), `src/assets/fonts/`.
- HEIC-dekódolás: [libheif](https://github.com/strukturag/libheif) (LGPL-3.0), külön, lustán betöltött chunkként.
