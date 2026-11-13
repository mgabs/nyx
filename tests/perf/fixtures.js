// @ts-check

import {createHash} from 'node:crypto';

/** @type {Record<string, Record<string, string>>} */
const FIXTURES = {
    article: {
        '/article.html': `<!doctype html><html><head><title>Article</title><link rel="stylesheet" href="/article.css"></head><body><main><article><h1>Typography & Long-Form Reading</h1>${'<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>'.repeat(120)}</article></main></body></html>`,
        '/article.css': `:root { --bg: #ffffff; --fg: #1a1a1a; --accent: #0055cc; } body { background: var(--bg); color: var(--fg); font-family: Georgia, serif; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 24px; } h1 { color: var(--accent); }`,
    },
    gallery: {
        '/gallery.html': `<!doctype html><html><head><title>Gallery</title><style>body{background:#fafafa;color:#222;margin:0;padding:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#fff;border:1px solid #ddd;padding:8px}</style></head><body><div class="grid">${Array.from({length: 24}, (_, i) => `<div class="card"><img src="/img-${i}.svg" width="120" height="80" alt="img ${i}"><div>Caption ${i}</div></div>`).join('')}</div></body></html>`,
        ...Object.fromEntries(Array.from({length: 24}, (_, i) => [`/img-${i}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#${((i * 37) % 256).toString(16).padStart(2, '0')}c0e0"/><circle cx="60" cy="40" r="22" fill="#ffffff"/></svg>`])),
    },
    dashboard: {
        '/dashboard.html': `<!doctype html><html><head><title>Dashboard</title><link rel="stylesheet" href="/dashboard.css"></head><body><div class="layout"><aside class="nav">${Array.from({length: 20}, (_, i) => `<a href="#item-${i}">Nav ${i}</a>`).join('')}</aside><main class="cards">${Array.from({length: 60}, (_, i) => `<section class="panel"><h3>Metric ${i}</h3><div class="val">${(i * 13.7).toFixed(1)}</div></section>`).join('')}</main></div></body></html>`,
        '/dashboard.css': `:root { --surface: #f4f6f8; --card: #ffffff; --border: #dce1e7; --text: #111827; } body { margin: 0; background: var(--surface); color: var(--text); font-family: system-ui, sans-serif; } .layout { display: grid; grid-template-columns: 220px 1fr; gap: 16px; padding: 16px; } .nav a { display: block; padding: 6px 10px; color: #1d4ed8; } .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; } .panel { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }`,
    },
    'spa-churn': {
        '/spa-churn.html': `<!doctype html><html><head><title>SPA Churn</title><style>body{background:#fff;color:#111}.row{padding:4px 8px;border-bottom:1px solid #eee}</style></head><body><div id="feed"></div><script>window.__runChurn = () => { const feed = document.getElementById('feed'); for (let i = 0; i < 200; i++) { const el = document.createElement('div'); el.className = 'row'; el.style.color = i % 2 ? '#222222' : '#444444'; el.style.backgroundColor = '#ffffff'; el.textContent = 'Item ' + i; feed.appendChild(el); } };</script></body></html>`,
    },
    'shadow-dom': {
        '/shadow-dom.html': `<!doctype html><html><head><title>Shadow DOM</title><style>body{background:#fff;color:#111}</style></head><body><div id="hosts"></div><script>const root = document.getElementById('hosts'); for (let i = 0; i < 30; i++) { const host = document.createElement('div'); const mode = i % 2 === 0 ? 'open' : 'closed'; const shadow = host.attachShadow({mode}); const sheet = new CSSStyleSheet(); sheet.replaceSync('.box { background: #f9fafb; color: #111827; border: 1px solid #d1d5db; padding: 6px; }'); shadow.adoptedStyleSheets = [sheet]; const inner = document.createElement('div'); inner.className = 'box'; inner.textContent = 'Shadow ' + i + ' (' + mode + ')'; shadow.appendChild(inner); root.appendChild(host); }</script></body></html>`,
    },
    formula: {
        '/formula.html': `<!doctype html><html><head><title>Formula</title><style>body{background:#fff;color:#000;padding:20px}.math{font-family:serif;font-size:18px;margin:8px 0}</style></head><body>${Array.from({length: 80}, (_, i) => `<div class="math">f<sub>${i}</sub>(x) = <svg width="24" height="16" style="vertical-align:middle"><path d="M2 8 L10 2 L18 14 L22 4" stroke="#000" fill="none"/></svg> &sum; x<sup>${i}</sup></div>`).join('')}</body></html>`,
    },
    'native-dark': {
        '/native-dark.html': `<!doctype html><html><head><title>Native Dark</title><meta name="color-scheme" content="dark"><style>:root{color-scheme:dark}body{background:#121212;color:#e0e0e0;font-family:system-ui,sans-serif;padding:24px}</style></head><body><h1>Already Dark</h1>${'<p>Native dark theme content block.</p>'.repeat(40)}</body></html>`,
    },
};

export const FIXTURE_NAMES = Object.keys(FIXTURES);

/**
 * Returns HTTP path map for a given fixture name.
 * @param {string} name
 * @returns {Record<string, string>}
 */
export function getFixturePaths(name) {
    if (!FIXTURES[name]) {
        throw new Error(`Unknown fixture: ${name}`);
    }
    return FIXTURES[name];
}

/**
 * Computes deterministic SHA-256 hash of all fixture contents.
 * @returns {string}
 */
export function getCorpusHash() {
    const hash = createHash('sha256');
    for (const name of FIXTURE_NAMES.slice().sort()) {
        hash.update(name);
        const paths = FIXTURES[name];
        for (const p of Object.keys(paths).sort()) {
            hash.update(p);
            hash.update(paths[p]);
        }
    }
    return hash.digest('hex').slice(0, 12);
}
