/**
 * Home quality gate.
 * - Parse all CSS as real syntax trees (not regex-based CSS rewriting).
 * - Assert one source of truth for typography and shared values.
 * - Verify key computed styles and JavaScript startup in Chromium.
 * - Optionally compare screenshots to a specified Git baseline.
 *
 * Run: npm run check:home
 * With two local HTTP servers, optionally set BASELINE_URL.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const URL_CURRENT = process.env.CURRENT_URL || 'http://127.0.0.1:4173';
const URL_BASELINE = process.env.BASELINE_URL || '';
const OUTPUT = process.env.SCREENSHOT_DIR || '/tmp/gamboo-home-check';
const PAGE = 'SCR-01_home.html';
const cssNames = [
  'assets/design-tokens.css',
  'assets/home.css',
  'assets/app-base.css',
  'assets/ui-consistency.css',
  'assets/bottom-nav-icons.css',
  'assets/tap-feedback.css'
];
const viewportWidths = [296, 320, 330, 331, 359, 360, 390, 430, 768];
const errors = [];

const fail = (message) => errors.push(message);
const eq = (actual, expected, label) => {
  if (actual !== expected) fail(label + ': ' + JSON.stringify(actual) + ' != ' + JSON.stringify(expected));
};

function getContext(rule) {
  const parents = [];
  let node = rule.parent;
  while (node) {
    if (node.type === 'atrule' && ['media', 'supports', 'container'].includes(node.name)) {
      parents.unshift('@' + node.name + ' ' + node.params);
    }
    node = node.parent;
  }
  return parents.join(' / ');
}

async function auditCss() {
  const parsed = new Map();
  for (const filename of cssNames) {
    const css = await readFile(path.join(ROOT, filename), 'utf8');
    parsed.set(filename, postcss.parse(css, { from: filename }));
  }
  const html = await readFile(path.join(ROOT, PAGE), 'utf8');
  if (/<style\b/i.test(html)) fail('Home HTML still contains inline <style>');
  if (/\sstyle\s*=\s*['\"]/i.test(html)) fail('Home HTML contains inline style attributes');
  if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(html)) fail('Home HTML still contains inline JavaScript');
  if (!html.includes('src="./assets/home.js?v=')) fail('Home JavaScript link missing');
  if (!html.includes('href="./assets/home.css?v=')) fail('Home CSS link missing');
  const tokenNames = new Set();
  parsed.get('assets/design-tokens.css').walkDecls((decl) => {
    if (decl.prop.startsWith('--')) tokenNames.add(decl.prop);
    if (decl.prop.startsWith('--') && /^var\(--[^)]+\)$/.test(decl.value)) {
      fail('Indirect alias token prohibited: ' + decl.prop);
    }
  });
  parsed.get('assets/bottom-nav-icons.css').walkDecls((decl) => {
    if (decl.prop.startsWith('--')) tokenNames.add(decl.prop);
  });

  const sourceOf = new Map();
  for (const [filename, root] of parsed.entries()) {
    const sameRuleAndMedia = new Map();
    root.walkRules((rule) => {
      const key = getContext(rule) + ' :: ' + rule.selector;
      const existing = sameRuleAndMedia.get(key);
      if (existing) {
        fail('Duplicate selector in same media context: ' + filename + ' ' + key);
      }
      sameRuleAndMedia.set(key, rule.source.start.line);

      let fontSize = '';
      let fontWeight = '';
      rule.walkDecls((decl) => {
        for (const ref of decl.value.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
          if (!tokenNames.has(ref[1])) fail('Undefined CSS variable: ' + filename + ':' + decl.source.start.line + ' ' + ref[1]);
        }
        if (filename === 'assets/home.css') {
          if (decl.prop === 'font-size' && /^[0-9.]+px$/.test(decl.value)) fail('Literal font-size: ' + decl.source);
          if (decl.prop === 'font-weight' && /^(normal|bold|[1-9]00)$/.test(decl.value)) fail('Literal font-weight: ' + decl.source);
          if (decl.prop === 'border-radius' && /^[0-9.]+px$/.test(decl.value)) fail('Literal border-radius: ' + decl.source);
          if (decl.important) fail('!important in home CSS: ' + rule.selector);
        }
        if (decl.prop === 'font-size') fontSize = decl.value;
        if (decl.prop === 'font-weight') fontWeight = decl.value;
        if (['color', 'background', 'background-color', 'border-color'].includes(decl.prop) && /#[a-f0-9]{3,8}\b/i.test(decl.value) && filename !== 'assets/design-tokens.css') {
          fail('Raw hex outside tokens: ' + filename + ':' + decl.source.start.line);
        }
        if (filename === 'assets/home.css' || filename === 'assets/ui-consistency.css') {
          if (sourceOf.get(key + ' | ' + decl.prop) && sourceOf.get(key + ' | ' + decl.prop) !== filename && !getContext(rule)) {
            fail('Duplicate property across home/shared: ' + rule.selector + ' ' + decl.prop);
          }
          sourceOf.set(key + ' | ' + decl.prop, filename);
        }
      });
      const size = fontSize.match(/--fs-(12|14|16|18|20|24)/);
      const weight = fontWeight.match(/--fw-(12|14|16|18|20|24)-(normal|strong)/);
      if (size && weight && size[1] !== weight[1]) fail('Font size/weight mismatch: ' + filename + ' ' + rule.selector);
    });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('CSS AST audit passed: ' + cssNames.length + ' files; variables, selectors, font pairing and aliases verified.');
}

const expectedComputedStyles = [
  ['.app-header .logo', 'fontSize', '18px'],
  ['.app-header .logo', 'fontWeight', '700'],
  ['.icon-sprite', 'display', 'none'],
  ['.news-title', 'fontSize', '16px'],
  ['.news-title', 'fontWeight', '600'],
  ['.news-date', 'fontSize', '14px'],
  ['.news-campaign', 'fontSize', '14px'],
  ['.news-new', 'fontSize', '14px'],
  ['.venue-grid.g3 .kubun', 'fontSize', '14px'],
  ['.venue-grid.g3 .kubun', 'fontWeight', '400'],
  ['.venue-grid.g3 .girls', 'fontSize', '14px'],
  ['.venue-grid.g3 .girls', 'fontWeight', '400'],
  ['.date-tabs .date-tab', 'fontSize', '16px'],
  ['.date-tabs .date-tab', 'fontWeight', '600'],
  ['.bottom-tab', 'height', '60px'],
  ['.bottom-tab .tab-item', 'rowGap', '0px'],
  ['.bottom-tab .tab-icon .ic', 'height', '32px'],
  ['.app-header .icon-btn .ic', 'width', '20px'],
  ['.news-item > .news-arrow .ic', 'width', '18px'],
  ['.venue-grid.g3 .vcard', 'height', '106px']
];

async function openPage(browser, url, width) {
  const page = await browser.newPage({
    viewport: { width, height: width <= 359 ? 616 : 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce'
  });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  await page.addInitScript(() => {
    // Freeze automatic demo rotations; the original first frame remains visible.
    window.setInterval = () => 0;
  });
  await page.goto(url + '/' + PAGE, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 3500);
      })
    ));
  });
  if (jsErrors.length) fail(width + 'px JS errors: ' + jsErrors.join('; '));
  return page;
}

async function capture(page, key) {
  if (key === 'bottom') {
    await page.evaluate(() => {
      const el = document.querySelector('.scroll-area');
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
  await page.addStyleTag({ content: '*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; caret-color: transparent !important; }' });
  return page.screenshot({ animations: 'disabled' });
}

async function checkCurrentPage(page, width) {
  const styles = await page.evaluate((selectors) => selectors.map(([selector, prop]) => {
    const el = document.querySelector(selector);
    return el ? { selector, prop, value: getComputedStyle(el)[prop] } : { selector, prop, value: null };
  }), expectedComputedStyles);
  styles.forEach((style, index) => eq(style.value, expectedComputedStyles[index][2], width + 'px ' + style.selector + '.' + style.prop));
  const loaded = await page.evaluate(() => Array.from(document.styleSheets).some((s) => s.href && s.href.includes('assets/home.css')));
  if (!loaded) fail('Stylesheet assets/home.css did not load at ' + width + 'px');
  const scriptLoaded = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('/assets/home.js')));
  if (!scriptLoaded) fail('JavaScript assets/home.js did not load at ' + width + 'px');
}

function comparePNGs(current, baseline, key) {
  const a = PNG.sync.read(current);
  const b = PNG.sync.read(baseline);
  if (a.width !== b.width || a.height !== b.height) {
    fail(key + ' screenshot dimensions differ');
    return;
  }
  const pixels = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.07 });
  const ratio = pixels / (a.width * a.height);
  console.log('Visual compare ' + key + ': ' + pixels + ' pixels (' + (ratio * 100).toFixed(4) + '%)');
  // Extracting an inline CSS stylesheet should be pixel-perfect.
  if (ratio > 0.0005) fail(key + ' visual regression: changed ' + (ratio * 100).toFixed(4) + '%');
}

async function checkInteractions(page, width) {
  const toggle = page.locator('.pay-toggle').first();
  if (await toggle.count() !== 1) {
    fail(width + 'px: pay-toggle is missing');
    return;
  }
  const before = await toggle.getAttribute('aria-pressed');
  await toggle.click();
  eq(await toggle.getAttribute('aria-pressed'), before === 'true' ? 'false' : 'true', width + 'px payout click');
  await toggle.press('Enter');
  eq(await toggle.getAttribute('aria-pressed'), before, width + 'px payout keyboard Enter');
  const mask = await toggle.evaluate((el) => el.classList.contains('masked'));
  eq(mask, before === 'true', width + 'px payout mask restored');
}

async function auditBrowser() {
  await mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of viewportWidths) {
      const current = await openPage(browser, URL_CURRENT, width);
      await checkCurrentPage(current, width);
      const before = URL_BASELINE ? await openPage(browser, URL_BASELINE, width) : null;
      try {
        for (const scene of ['top', 'bottom']) {
          const latest = await capture(current, scene);
          await writeFile(path.join(OUTPUT, String(width) + '-' + scene + '.png'), latest);
          if (before) comparePNGs(latest, await capture(before, scene), String(width) + 'px ' + scene);
        }
        await checkInteractions(current, width);
      } finally {
        await current.close();
        if (before) await before.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Browser verification passed: ' + viewportWidths.length + ' widths, top/bottom views, functional computed styles and payout toggle interactions.');
}

await auditCss();
await auditBrowser();
