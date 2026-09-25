// SkyKart entry point.
import '@fontsource/lilita-one/400.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './ui/styles.css';
import { loadClientData } from './data/load.js';
import { App } from './core/app.js';

loadClientData();
const app = new App(document.getElementById('game'), document.getElementById('ui'));
window.__skykart = app; // handy for debugging and automated tests
app.start().catch((e) => {
  console.error(e);
  document.getElementById('boot').innerHTML = `<div class="boot-logo">Oops!</div><pre style="max-width:80vw;white-space:pre-wrap">${String(e?.stack || e)}</pre>`;
});
