// A landingre beágyazott minta előállítása: a demót a valódi feldolgozó
// láncon futtatja (Playwright + dev szerver), és kész projektként menti a
// public/demo/project.json-ba, hogy a landing feldolgozás nélkül mutathassa.
// Használat: npm run dev (másik terminálban), majd node scripts/build-demo-project.cjs
// Az időbélyegek UTC-ben rögzített „falióra-idők”; betöltéskor a néző
// időzónájára igazítjuk (src/app/demoProject.ts).
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');

(async () => {
  const url = process.env.URL || 'http://localhost:5173/';
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ timezoneId: 'UTC' })).newPage();
  await page.goto(url);
  await page.evaluate(() => window.__store.getState());
  await page.evaluate(() => import('/src/app/flow.ts').then((m) => m.startDemo()));
  await page.waitForSelector('[data-chapter-id]', { timeout: 60000 });
  const project = await page.evaluate(() => window.__store.getState().project);
  await browser.close();

  for (const p of Object.values(project.photos)) {
    p.src = { display: `demo/${p.fileName}`, thumb: `demo/${p.fileName}` };
  }
  project.id = 'demo-static';
  project.createdAt = 0;
  writeFileSync('public/demo/project.json', JSON.stringify(project));
  console.log(`public/demo/project.json: ${project.chapters.length} fejezet, ${Object.keys(project.photos).length} kép`);
})();
