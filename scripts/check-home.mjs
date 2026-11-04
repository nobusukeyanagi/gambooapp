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
const PAGE = 'SCR-01_bet.html';
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
  ['.app-header .logo', 'fontSize', '18px'],
  ['.app-header .logo', 'fontWeight', '600'],
  ['.icon-sprite', 'display', 'none'],
  ['.news-title', 'fontSize', '16px'],
  ['.news-title', 'fontWeight', '600'],
  ['.news-date', 'fontSize', '14px'],
  ['.news-campaign', 'fontSize', '14px'],
  ['.news-new', 'fontSize', '14px'],
  ['.venue-grid.g3 .kubun', 'fontSize', '14px'],
  ['.venue-grid.g3 .kubun', 'fontWeight', '400'],
  ['.venue-grid.g3 .girls .girls-heart-icon', 'height', '14px'],
  ['.date-tabs .date-tab', 'fontSize', '16px'],
  ['.date-tabs .date-tab', 'fontWeight', '600'],
  ['.date-tabs .date-tab:not(.active)', 'color', 'rgb(43, 49, 53)'],
  ['.date-tabs .date-tab.active', 'color', 'rgb(134, 115, 58)'],
  ['.venue-grid.g3 .vcard-r', 'fontWeight', '600'],
  ['.venue-grid.g3 .vcard-dl', 'fontWeight', '600'],
  ['.venue-grid.g3 .vcard', 'borderTopColor', 'rgb(208, 212, 214)'],
  ['.app-header .header-actions .icon-btn', 'borderTopColor', 'rgb(208, 212, 214)'],
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
  // Regression: the sport heading must immediately precede the autorace grid.
  const autoHeading=await page.locator('[data-home-venues="autorace"]').evaluate(grid => {
    const previous=grid.previousElementSibling;
    const heading=previous?.querySelector('.vgroup-name.auto.race-heading');
    return {
      adjacent:previous?.classList.contains('vgroup-head') || false,
      text:heading?.textContent?.trim() || '',
      icon:heading?.querySelector('use')?.getAttribute('href') || ''
    };
  });
  if (!autoHeading.adjacent || autoHeading.text!=='オートレース' ||
      !autoHeading.icon.endsWith('#nav-auto'))
    fail(width+'px autorace section heading and bottom-nav icon were lost: '+JSON.stringify(autoHeading));
  const initial = await page.evaluate(() => {
    const read = sport => [...document.querySelectorAll('[data-home-venues="'+sport+'"] > .vcard')]
      .map(card => ({
        name:card.dataset.venue || card.querySelector('.vcard-name').textContent.trim(),
        grade:card.querySelector('.gbadge').textContent.trim(),
        dummy:card.dataset.demo === 'true',
        race:card.querySelector('.vcard-r')?.textContent.trim(),
        time:card.querySelector('.vcard-dl')?.dataset.deadline,
        ended:card.classList.contains('ended'),
        soon:card.classList.contains('deadline-soon')
      }));
    return {keirin:read('keirin'),auto:read('autorace')};
  });
  const keirinNames=['京王閣','小倉','玉野','青森','防府','豊橋','久留米','静岡','奈良','武雄','小田原'];
  const autoNames=['浜松','川口'];
  if (initial.keirin.map(x=>x.name).join('|')!==keirinNames.join('|') ||
      initial.auto.map(x=>x.name).join('|')!==autoNames.join('|') ||
      initial.keirin.slice(0,3).some((x,i)=>!x.dummy || x.grade!==['GP','GⅠ','GⅡ'][i]) ||
      initial.keirin.slice(3).some(x=>x.dummy))
    fail(width+'px actual Nov 3 venues and top three grade demo cards invalid: '+JSON.stringify(initial));
  const gradeColors=await page.evaluate(()=>{
    const paint=sel=>getComputedStyle(document.querySelector(sel)).backgroundColor;
    return {
      gp:paint('[data-home-venues="keirin"] .g-gp'),
      sg:paint('[data-home-venues="autorace"] .g-sg'),
      gi:paint('[data-home-venues="keirin"] .g-g1'),
      gii:paint('[data-home-venues="keirin"] .g-g2'),
      giii:paint('[data-home-venues="keirin"] .g-g3')
    };
  });
  const expectedColors={
    gp:'rgb(68, 73, 77)',sg:'rgb(43, 49, 53)',gi:'rgb(157, 63, 71)',
    gii:'rgb(70, 110, 152)',giii:'rgb(79, 120, 76)'
  };
  for(const [grade,color] of Object.entries(expectedColors))
    if(gradeColors[grade]!==color)
      fail(width+'px grade '+grade+' palette mismatch: '+JSON.stringify(gradeColors));
  const noon={青森:['4R','12:13'],防府:['4R','12:26'],
    豊橋:['1R','15:45'],久留米:['1R','15:59'],静岡:['1R','20:36'],
    奈良:['1R','20:44'],武雄:['1R','20:52'],浜松:['5R','12:13'],
    川口:['1R','18:48']};
  for (const [name,[race,time]] of Object.entries(noon)) {
    const card=[...initial.keirin,...initial.auto].find(x=>x.name===name);
    if (!card || card.race!==race || card.time!==time ||
        (card.soon !== (time==='12:13')))
      fail(width+'px Nov 3 12:00 current race mismatch for '+name+': '+JSON.stringify(card));
  }
  if (!initial.keirin.find(x=>x.name==='小田原')?.ended)
    fail(width+'px Odawara must be complete at noon');
  const loaded = await page.evaluate(() => Array.from(document.styleSheets).some((s) => s.href && s.href.includes('assets/home.css')));
  if (!loaded) fail('Stylesheet assets/home.css did not load at ' + width + 'px');
  const brokenImages = await page.evaluate(() => Array.from(document.querySelectorAll('img[src*="assets/images/"]'))
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map((img) => img.getAttribute('src')));
  if (brokenImages.length) fail(width + 'px broken asset images: ' + brokenImages.join(', '));
  const girlsIcons = await page.locator('.venue-grid.g3 .girls .girls-heart-icon use[href$="#girls-heart"]').count();
  if (girlsIcons !== 5) fail(width + 'px expected one dummy and four active Girls icons, found ' + girlsIcons);
  const girlsColors = await page.locator('.venue-grid.g3 .girls .girls-heart-icon').evaluateAll(
    nodes => nodes.map(el => getComputedStyle(el).color));
  if (girlsColors.some(color => color !== 'rgb(165, 55, 76)'))
    fail(width + 'px Girls icon must use canonical error color: ' + girlsColors.join(', '));


  // The live banner gallery must follow the filenames and omit deleted assets.
  const banners = await page.locator('.bn-carousel .bn-track > .bn').evaluateAll(nodes =>
    nodes.map(n => ({src: n.querySelector('img')?.getAttribute('src'),
      href: n.getAttribute('href'), tag: n.tagName, label: n.getAttribute('aria-label'),
      tabIndex: n.tabIndex,
      hasStatus: n.querySelector('.bn-status')?.textContent.trim() === '本日実施中'})));
  const expectedBannerLinks = [
    // 01: provisional verified historical 1,000-yen registration detail;
    // replace with the matching Nov 2026 campaign once its exact URL is confirmed.
    'https://gamboo.jp/topics/?tid=20260811_registration_nfe',
    'https://gamboo.jp/topics/?tid=20261029_hamamatsuSG_vkr',
    'https://gamboo.jp/topics/?tid=20261029_hamamatsu_xrh',
    'https://gamboo.jp/topics/?tid=20261029_hamamatsu_tlf',
    'https://gamboo.jp/topics/?tid=202610_keirinmonthly_emx',
    'https://gamboo.jp/topics/?tid=20261031_hofu_xrh',
    'https://gamboo.jp/topics/?tid=20261101_hard1st_wlx',
    'https://gamboo.jp/topics/?tid=20261101_keirinauto1st_qsk',
    'https://gamboo.jp/topics/?tid=202611_keirinmonthly_srl',
    'https://gamboo.jp/topics/?tid=20261105_yokkaichi_wdz',
    'https://gamboo.jp/about/gamboobet/dokanto',
    'https://gamboo.jp/keirin/topics/?tid=aokei_yosou',
    'https://gamboo.jp/topics/?tid=mori_point2015',
    'https://gamboo.jp/point/topics/?tid=hiroba-game'
  ];
  if (banners.some((banner,i) =>
    banner.tag !== 'A' || banner.href !== expectedBannerLinks[i % 14] || !banner.label ||
    (i % 14 < 10 && (banner.href.includes('/campaign/') || banner.label.includes('キャンペーン一覧')))))
    fail(width + 'px banner links must target individual campaign details, never the listing');
  if (banners.some((banner,i) => (i < 3 * 14 || i >= 4 * 14) && banner.tabIndex !== -1))
    fail(width + 'px cloned banners must be removed from keyboard tab order');
  const statusSize = await page.locator('.bn-carousel .bn-status').first()
    .evaluate(el => getComputedStyle(el).fontSize);
  if (statusSize !== '16px')
    fail(width + 'px banner status text should be 16px: ' + statusSize);
  const expectedBanners = Array.from({length:14}, (_,i) =>
    './assets/images/' + String(i+1).padStart(2,'0') + '.webp');
  // The carousel clones entire 14-slide sets on both sides for infinite scrolling.
  // Validate every logical cycle without mistaking clones for additional assets.
  if(banners.length < expectedBanners.length ||
     banners.length % expectedBanners.length !== 0 ||
     banners.some((banner,i) => banner.src !== expectedBanners[i % 14] ||
                              banner.hasStatus !== ((i % 14) < 5)))
    fail(width + 'px banner order or 01-05 active labels mismatch: ' +
      JSON.stringify({count:banners.length,firstCycle:banners.slice(0,14)}));
  const dotCount = await page.locator('.bn-carousel .bn-dots i').count();
  if(dotCount !== expectedBanners.length) fail(width + 'px banner dot count: ' + dotCount);
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
  const nav = page.locator(".bottom-tab");
  const keirin = nav.locator('a.tab-item[href="./SCR-02_keirin.html"]');
  const auto = nav.locator('a.tab-item[href="./SCR-02_autorace.html"]');
  if (await keirin.count() !== 1 || (await keirin.innerText()).trim() !== "競輪予想") {
    fail(width + "px home keirin prediction link missing");
  }
  if (await auto.count() !== 1 || (await auto.innerText()).trim() !== "オート予想") {
    fail(width + "px home autorace prediction link missing");
  }
  const dateTabs=page.locator('.scroll-area > .date-tabs [data-date]');
  const readNames=async (kind) => page.locator('[data-home-venues="'+kind+'"] > .vcard:not([data-demo]) .vcard-name').allTextContents();
  const demos=page.locator('[data-home-venues="keirin"] > .vcard[data-demo]');
  async function checkDummyVisibility(visible,day) {
    const state=await demos.evaluateAll(nodes=>nodes.map(el=>({
      hidden:el.hidden,display:getComputedStyle(el).display
    })));
    if (state.length!==3 || state.some(x=>x.hidden===visible ||
        (visible ? x.display==='none':x.display!=='none')))
      fail(width+'px '+day+' dummy cards visibility: '+JSON.stringify(state));
    const count=await page.locator('[data-home-venues="keirin"] > .vcard:visible').count();
    if (count!==(visible?11:8))
      fail(width+'px '+day+' should have '+(visible?11:8)+' keirin cards; got '+count);
  }
  await checkDummyVisibility(true,'Nov 3 initially');
  await dateTabs.nth(0).click();
  await checkDummyVisibility(false,'Nov 2');
  eq((await readNames('keirin')).join('|'),
    '防府|久留米|豊橋|熊本|小田原|静岡|奈良|武雄',width+'px Nov 2 real keirin');
  eq((await readNames('autorace')).join('|'),'浜松|川口',width+'px Nov 2 real autorace');
  if (await page.locator('[data-home-venues] > .vcard:not([data-demo]) .vcard-dl[data-deadline]').count())
    fail(width+'px yesterday must not have next-race cutoffs');
  await dateTabs.nth(2).click();
  await checkDummyVisibility(false,'Nov 4');
  eq((await readNames('keirin')).join('|'),
    '青森|取手|大宮|豊橋|静岡|奈良|武雄|別府',width+'px Nov 4 real keirin');
  eq((await readNames('autorace')).join('|'),'川口|山陽',width+'px Nov 4 real autorace');
  if (await page.locator('[data-home-venues="keirin"] > .vcard:not([data-demo]) .vcard-dl').filter({hasText:'発売前'}).count()!==8)
    fail(width+'px tomorrow entries should display not yet on sale in Nov 3 snapshot');
  const presales=await page.locator('[data-home-venues] > .vcard.presale').evaluateAll(nodes=>
    nodes.map(el=>{
      const bottom=el.querySelector('.vcard-bottom');
      const bounds=bottom.getBoundingClientRect();
      const label=el.querySelector('.vcard-dl').getBoundingClientRect();
      return {justify:getComputedStyle(bottom).justifyContent,
        diff:Math.abs(bounds.right-label.right)};
    }));
  if (presales.length!==10 ||
      presales.some(x=>x.justify!=='flex-end' || x.diff>1))
    fail(width+'px presale must align right like ended: '+JSON.stringify(presales));
  await dateTabs.nth(1).click();
  await checkDummyVisibility(true,'Nov 3 restored');
  eq((await readNames('keirin')).join('|'),
    '青森|防府|豊橋|久留米|静岡|奈良|武雄|小田原',width+'px Nov 3 restored');
  eq(await dateTabs.nth(1).getAttribute('aria-selected'),'true',width+'px today selected');
  eq(await page.locator('[data-home-venues="keirin"] > .vcard[data-demo]').count(),3,
    width+'px fixed demo cards remain after date switching');
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
