// A claude.ai Artifact-előnézet oldalfájlja: az Artifact a publikáláskor
// maga teszi köré a <!doctype>/<head>/<body> vázat, ezért a buildelt
// index.html fejéből és törzséből egy váz nélküli page.html készül.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = process.argv[2] || 'dist-artifact';
const html = readFileSync(`${dir}/index.html`, 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keep = head
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !/<meta charset|<meta name="viewport"|rel="icon"/i.test(l))
  // a <title> legyen az első (a tool az első 8 KB-ban keresi)
  .sort((a, b) => Number(b.startsWith('<title')) - Number(a.startsWith('<title')));
writeFileSync(`${dir}/page.html`, `${keep.join('\n')}\n${body.trim()}\n`);
console.log(`artifact: ${dir}/page.html`);
