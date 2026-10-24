// A landing statikus előrenderelése a build után: a dist/index.html már
// tartalmazza a kész HTML-t, így lassú mobilneten is azonnal látszik az
// oldal; a React utána „hidratálja” (src/main.tsx).
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { App } = await vite.ssrLoadModule('/src/app/App.tsx');
  const html = renderToString(createElement(App));
  const file = `${process.argv[2] || 'dist'}/index.html`;
  const page = readFileSync(file, 'utf8');
  if (!page.includes('<div id="root"></div>')) throw new Error('#root nem található a dist/index.html-ben');
  writeFileSync(file, page.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
  console.log(`prerender: ${Math.round(html.length / 1024)} KB HTML a landingről`);
} finally {
  await vite.close();
}
