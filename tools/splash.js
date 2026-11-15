// Genera las imágenes de arranque del iPhone (apple-touch-startup-image) a partir de la propia
// pantalla de carga de la app, para que el paso de una a otra no se note.
// Uso: con la app servida en http://localhost:8765 →  node tools/splash.js
const { chromium } = require('playwright');
// ancho y alto en puntos, densidad y alto de la barra de estado
const DEVICES = [
  [402, 874, 3, 62],  // iPhone 16 Pro, 17, 17 Pro
  [440, 956, 3, 62],  // iPhone 16 Pro Max, 17 Pro Max
  [420, 912, 3, 62],  // iPhone Air
  [393, 852, 3, 59],  // iPhone 14 Pro, 15, 15 Pro, 16
  [430, 932, 3, 59],  // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [390, 844, 3, 47],  // iPhone 12, 13, 14, 16e
  [428, 926, 3, 47],  // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  [375, 812, 3, 50],  // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 3, 48],  // iPhone XS Max, 11 Pro Max
  [414, 896, 2, 48],  // iPhone XR, 11
  [375, 667, 2, 20],  // iPhone SE, 8
];
(async () => {
  const b = await chromium.launch();
  const tags = [];
  for (const [w, h, r, sb] of DEVICES) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: r })).newPage();
    await p.goto('http://localhost:8765/');
    await p.evaluate(async (sb) => {
      const html = (await (await fetch('index.html')).text()).match(/<div id="splash"[\s\S]*?<\/div>\s*<\/div>/)[0];
      document.body.innerHTML = html;
      const sp = document.getElementById('splash');
      sp.style.top = sb + 'px';                       // la app empieza debajo de la barra de estado
      sp.querySelector('.splash-bar i').style.animation = 'none';
      sp.querySelector('.splash-bar i').style.transform = 'translateX(-100%)';
      await document.fonts.ready; await new Promise((ok) => { const im = sp.querySelector('img'); im.complete ? ok() : (im.onload = ok); });
    }, sb);
    const name = `icons/splash/splash-${w * r}x${h * r}.png`;
    await p.screenshot({ path: name });
    tags.push(`  <link rel="apple-touch-startup-image" href="${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)">`);
    await p.context().close();
  }
  await b.close();
  console.log(tags.join('\n'));
})();
