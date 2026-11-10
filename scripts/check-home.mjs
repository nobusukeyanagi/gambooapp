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
const PAGE = 'SCR-100_bet.html';
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
      if (fontWeight && /var\(--fw-/.test(fontWeight) &&
          !/var\(--fw-(normal|strong)\)/.test(fontWeight))
        fail('Non-canonical font weight token: ' + filename + ' ' + rule.selector);
    });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('CSS AST audit passed: ' + cssNames.length + ' files; variables, selectors, font pairing and aliases verified.');
}

const expectedComputedStyles = [
  ['.app-header .page-header-title', 'fontSize', '18px'],
  ['.app-header .page-header-title', 'fontWeight', '600'],
  ['.icon-sprite', 'display', 'none'],
  ['.news-title', 'fontSize', '16px'],
  ['.news-title', 'fontWeight', '400'],
  ['.news-date', 'fontSize', '14px'],
  ['.news-new', 'fontSize', '14px'],
  ['.venue-grid.g3 .vcard-day', 'fontSize', '14px'],
  ['.venue-grid.g3 .vcard-day', 'color', 'rgb(96, 107, 118)'],
  ['.venue-grid.g3 .kubun', 'color', 'rgb(96, 107, 118)'],
  ['.venue-grid.g3 .kubun', 'fontSize', '14px'],
  ['.venue-grid.g3 .kubun', 'fontWeight', '400'],
  ['.venue-grid.g3 .girls .girls-heart-icon', 'height', '14px'],
  ['.date-tabs .date-tab', 'fontSize', '16px'],
  ['.date-tabs .date-tab', 'fontWeight', '600'],
  ['.date-tabs .date-tab:not(.active)', 'color', 'rgb(48, 54, 59)'],
  ['.date-tabs .date-tab.active', 'color', 'rgb(114, 103, 49)'],
  ['.venue-grid.g3 .vcard-r', 'fontWeight', '600'],
  ['.venue-grid.g3 .vcard-dl', 'fontWeight', '600'],
  ['.venue-grid.g3 .vcard', 'borderTopColor', 'rgb(210, 214, 218)'],
  ['.app-header .header-actions .icon-btn', 'borderTopColor', 'rgb(151, 161, 170)'],
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
    return el ? {selector,prop,value:getComputedStyle(el)[prop]} : {selector,prop,value:null};
  }), expectedComputedStyles);
  styles.forEach((style,i)=>eq(style.value,expectedComputedStyles[i][2],
    width+'px '+style.selector+'.'+style.prop));

  // Current fixed Nov 3 sample: eight keirin venues, two autorace venues.
  const state = await page.evaluate(()=>{
    const bySport=sport=>[...document.querySelectorAll('[data-home-venues="'+sport+'"] > .vcard')].map(card=>({
      venue:card.dataset.venue,
      href:card.getAttribute('href'),
      type:card.tagName,
      deadline:card.querySelector('.vcard-dl')?.textContent.trim()
    }));
    const cards=[...document.querySelectorAll('.bn-track .bn')];
    const notices=[...document.querySelectorAll('.news-item')];
    const nav=[...document.querySelectorAll('.bottom-tab > a.tab-item')];
    return {
      keirin:bySport('keirin'),autorace:bySport('autorace'),
      snapshot:document.querySelector('[data-home-venues="keirin"]')?.dataset.snapshot,
      selected:document.querySelector('.date-tab.active')?.dataset.date,
      tabs:[...document.querySelectorAll('.date-tabs .date-tab')].map(t=>t.dataset.date),
      bannerSources:[...new Set(cards.map(x=>x.querySelector('img')?.getAttribute('src')).filter(Boolean))],
      notices:notices.length,noticeKinds:notices.map(n=>n.dataset.newsKind),
      nav:nav.map(n=>n.getAttribute('href')),
      activeNav:nav.filter(n=>n.classList.contains('active')).length,
      payout:!!document.querySelector('.pay-toggle[role="button"]'),
      headingLinks:document.querySelectorAll('.vgroup-head a, .section-header a').length,
      headerHeight:Math.round(document.querySelector('.app-header')?.getBoundingClientRect().height||0),
      footerHeight:Math.round(document.querySelector('.bottom-tab')?.getBoundingClientRect().height||0)
    };
  });
  const keirinBet='https://gamboo.jp/bet/xt_keirin.aspx?rmac=console_device-checker&it=1';
  const autoBet='https://gamboo.jp/bet/xt_autorace.aspx?mac=Console_Index&it=1&rno=';
  if(state.keirin.map(x=>x.venue).join('|')!=='防府|青森|豊橋|久留米|小田原|静岡|奈良|武雄'||
     state.autorace.map(x=>x.venue).join('|')!=='浜松|川口'||
     state.keirin.some(x=>x.type!=='A'||x.href!==keirinBet)||
     state.autorace.some(x=>x.type!=='A'||x.href!==autoBet))
    fail(width+'px home venue data/console links differ: '+JSON.stringify(state));
  if(state.snapshot!=='2026-11-03T12:30:00+09:00'||state.selected!=='2026-11-03'||
     state.tabs.join('|')!=='2026-11-02|2026-11-03|2026-11-04'||
     state.bannerSources.length!==14||state.notices!==9||
     state.noticeKinds.some(x=>x!=='notice')||state.nav.length!==5||
     state.activeNav!==1||!state.payout||state.headerHeight!==50||
     state.footerHeight!==60)
    fail(width+'px home layout/content baseline differs: '+JSON.stringify(state));
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


async function checkInteractions(page,width) {
  const tabs=page.locator('.date-tabs .date-tab');
  const toggle=page.locator('.pay-toggle');
  const initialPressed=await toggle.getAttribute('aria-pressed');
  await toggle.click();
  const pressed=await toggle.getAttribute('aria-pressed');
  if(initialPressed===pressed)fail(width+'px payout visibility toggle did not change');
  await toggle.click();
  if(await toggle.getAttribute('aria-pressed')!==initialPressed)
    fail(width+'px payout visibility did not restore');

  const checks=[
    {index:0,date:'2026-11-02',mori:3},
    {index:2,date:'2026-11-04',mori:0},
    {index:1,date:'2026-11-03',mori:2}
  ];
  for(const item of checks){
    await tabs.nth(item.index).click();
    const state=await page.evaluate(()=>{
      const date=document.querySelector('.date-tab.active')?.dataset.date;
      return {date,
        snapshot:document.querySelector('[data-home-venues="keirin"]')?.dataset.snapshot,
        keirin:document.querySelectorAll('[data-home-venues="keirin"] > .vcard').length,
        auto:document.querySelectorAll('[data-home-venues="autorace"] > .vcard').length,
        mori:[...document.querySelectorAll('.mori-venue-grid .vcard[data-mori-row]')]
          .filter(x=>!x.hidden).length
      };
    });
    if(state.date!==item.date||state.snapshot!==item.date+'T12:30:00+09:00'||
       state.keirin===0||state.auto===0||state.mori!==item.mori)
      fail(width+'px date selection and Mori fixtures differ: '+JSON.stringify(state));
  }
  const bottom=()=>page.locator('.bottom-tab > a.tab-item').evaluateAll(items=>
    items.map(el=>el.getAttribute('href')).join('|'));
  const expectedNav=['./SCR-100_bet.html','./SCR-200_keirin.html',
    './SCR-300_autorace.html','./SCR-400_campaign.html',
    './SCR-500_mypage.html'].join('|');
  if(await bottom()!==expectedNav)fail(width+'px initial bottom navigation changed');
  await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{
    key:'gamboo.sport-display-order',newValue:'auto'
  })));
  if(await page.locator('[data-home-venues]').first().getAttribute('data-home-venues')!=='autorace'||
     await bottom()!==expectedNav)
    fail(width+'px sport order preference changed bottom navigation');
  await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{
    key:'gamboo.sport-display-order',newValue:'keirin'
  })));
  if(await page.locator('[data-home-venues]').first().getAttribute('data-home-venues')!=='keirin'||
     await bottom()!==expectedNav)
    fail(width+'px sport order preference did not restore');
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
