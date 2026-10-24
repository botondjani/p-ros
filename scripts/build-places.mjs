// Offline helynév-adatbázis előállítása a GeoNames cities15000 fájlból.
// Használat: node scripts/build-places.mjs path/to/cities15000.txt
// Forrás: https://download.geonames.org/export/dump/cities15000.zip (CC BY 4.0)
import { readFileSync, writeFileSync } from 'node:fs';

// Gyakori magyar exonimák (GeoNames-név|országkód → magyar név).
const HU = {
  'Vienna|AT': 'Bécs', 'Graz|AT': 'Grác', 'Salzburg|AT': 'Salzburg', 'Linz|AT': 'Linz',
  'Bratislava|SK': 'Pozsony', 'Kosice|SK': 'Kassa', 'Komarno|SK': 'Révkomárom', 'Nitra|SK': 'Nyitra',
  'Cluj-Napoca|RO': 'Kolozsvár', 'Oradea|RO': 'Nagyvárad', 'Timisoara|RO': 'Temesvár', 'Brasov|RO': 'Brassó',
  'Targu Mures|RO': 'Marosvásárhely', 'Sibiu|RO': 'Nagyszeben', 'Arad|RO': 'Arad', 'Satu Mare|RO': 'Szatmárnémeti',
  'Miercurea Ciuc|RO': 'Csíkszereda', 'Sfantu Gheorghe|RO': 'Sepsiszentgyörgy', 'Odorheiu Secuiesc|RO': 'Székelyudvarhely',
  'Bucharest|RO': 'Bukarest', 'Subotica|RS': 'Szabadka', 'Novi Sad|RS': 'Újvidék', 'Belgrade|RS': 'Belgrád',
  'Uzhhorod|UA': 'Ungvár', 'Mukacheve|UA': 'Munkács', 'Kyiv|UA': 'Kijev', 'Lviv|UA': 'Lemberg',
  'Zagreb|HR': 'Zágráb', 'Rijeka|HR': 'Fiume', 'Split|HR': 'Split', 'Dubrovnik|HR': 'Dubrovnik', 'Osijek|HR': 'Eszék',
  'Ljubljana|SI': 'Ljubljana', 'Prague|CZ': 'Prága', 'Brno|CZ': 'Brünn', 'Warsaw|PL': 'Varsó', 'Krakow|PL': 'Krakkó',
  'Berlin|DE': 'Berlin', 'Munich|DE': 'München', 'Cologne|DE': 'Köln', 'Nuremberg|DE': 'Nürnberg',
  'Rome|IT': 'Róma', 'Milan|IT': 'Milánó', 'Venice|IT': 'Velence', 'Florence|IT': 'Firenze', 'Naples|IT': 'Nápoly',
  'Turin|IT': 'Torino', 'Genoa|IT': 'Genova', 'Padua|IT': 'Padova', 'Syracuse|IT': 'Szirakúza', 'Trieste|IT': 'Trieszt',
  'Paris|FR': 'Párizs', 'Marseille|FR': 'Marseille', 'Lyon|FR': 'Lyon', 'Nice|FR': 'Nizza',
  'London|GB': 'London', 'Edinburgh|GB': 'Edinburgh', 'Dublin|IE': 'Dublin',
  'Lisbon|PT': 'Lisszabon', 'Porto|PT': 'Porto', 'Madrid|ES': 'Madrid', 'Barcelona|ES': 'Barcelona',
  'Seville|ES': 'Sevilla', 'Athens|GR': 'Athén', 'Thessaloniki|GR': 'Szaloniki', 'Istanbul|TR': 'Isztambul',
  'Moscow|RU': 'Moszkva', 'Saint Petersburg|RU': 'Szentpétervár', 'Copenhagen|DK': 'Koppenhága',
  'Stockholm|SE': 'Stockholm', 'Oslo|NO': 'Oslo', 'Helsinki|FI': 'Helsinki', 'Brussels|BE': 'Brüsszel',
  'Antwerpen|BE': 'Antwerpen', 'Amsterdam|NL': 'Amszterdam', 'The Hague|NL': 'Hága', 'Geneva|CH': 'Genf',
  'Zurich|CH': 'Zürich', 'Basel|CH': 'Bázel', 'Bern|CH': 'Bern', 'Valletta|MT': 'Valletta',
  'Cairo|EG': 'Kairó', 'Jerusalem|IL': 'Jeruzsálem', 'Beijing|CN': 'Peking', 'Tokyo|JP': 'Tokió',
  'New York City|US': 'New York', 'Mexico City|MX': 'Mexikóváros', 'Gdansk|PL': 'Gdańsk',
};

const src = process.argv[2];
if (!src) throw new Error('Add meg a cities15000.txt útvonalát');
const rows = readFileSync(src, 'utf8').split('\n').filter(Boolean);
const names = [];
const cc = [];
const pts = [];
for (const line of rows) {
  const f = line.split('\t');
  const name = f[1];
  const asciiName = f[2];
  const lat = Number(f[4]);
  const lng = Number(f[5]);
  const country = f[8];
  const hu = HU[`${name}|${country}`] ?? HU[`${asciiName}|${country}`];
  names.push(hu ?? name);
  cc.push(country);
  pts.push(Math.round(lat * 1000), Math.round(lng * 1000));
}
const countries = [...new Set(cc)];
const out = { n: names, c: cc.map((c) => countries.indexOf(c)), cl: countries, p: pts };
writeFileSync('public/places.json', JSON.stringify(out));
console.log(`${names.length} város → public/places.json`);
