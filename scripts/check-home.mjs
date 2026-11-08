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
  ['.venue-grid.g3 .kubun', 'fontSize', '14px'],
  ['.venue-grid.g3 .kubun', 'fontWeight', '400'],
  ['.venue-grid.g3 .girls .girls-heart-icon', 'height', '14px'],
  ['.date-tabs .date-tab', 'fontSize', '16px'],
  ['.date-tabs .date-tab', 'fontWeight', '600'],
  ['.date-tabs .date-tab:not(.active)', 'color', 'rgb(48, 54, 60)'],
  ['.date-tabs .date-tab.active', 'color', 'rgb(114, 109, 49)'],
  ['.venue-grid.g3 .vcard-r', 'fontWeight', '600'],
  ['.venue-grid.g3 .vcard-dl', 'fontWeight', '600'],
  ['.venue-grid.g3 .vcard', 'borderTopColor', 'rgb(201, 207, 213)'],
  ['.app-header .header-actions .icon-btn', 'borderTopColor', 'rgb(156, 164, 168)'],
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
  // The two venue-section pictograms are slightly reduced without affecting headers.
  const raceHeadingIcons=await page.evaluate(() => [
    document.querySelector('.vgroup-name.race-heading:not(.auto) .race-heading-icon'),
    document.querySelector('.vgroup-name.race-heading.auto .race-heading-icon')
  ].map(el=>el?{width:getComputedStyle(el).width,height:getComputedStyle(el).height}:null));
  if(raceHeadingIcons.length!==2 || !raceHeadingIcons[0] || !raceHeadingIcons[1] ||
      raceHeadingIcons[0].width!=='42px' || raceHeadingIcons[0].height!=='34px' ||
      raceHeadingIcons[1].width!=='37px' || raceHeadingIcons[1].height!=='34px')
    fail(width+'px venue heading icons must have reduced dimensions: '+
      JSON.stringify(raceHeadingIcons));
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
  // All venue buttons are native outbound links to the supplied betting consoles.
  const keirinBet='https://gamboo.jp/bet/xt_keirin.aspx?rmac=console_device-checker&it=1';
  const autoraceBet='https://gamboo.jp/bet/xt_autorace.aspx?mac=Console_Index&it=1&rno=';
  const venueLinks=await page.locator('[data-home-venues] > .vcard, .mori-venue-grid > .vcard.auto').evaluateAll(cards=>
    cards.map(card=>({
      element:card.tagName,
      kind:card.closest('[data-home-venues]')?.dataset.homeVenues ||
        (card.closest('.mori-venue-grid')?'autorace':'unknown'),
      href:card.getAttribute('href'),
      venue:card.querySelector('.vcard-name')?.textContent.trim(),
      underline:getComputedStyle(card).textDecorationLine
    })));
  if(venueLinks.length!==16 || venueLinks.some(card=>
    card.element!=='A'||
    card.href!==(card.kind==='keirin'?keirinBet:autoraceBet)||
    card.underline!=='none') ||
    await page.locator('.mori-photo-tile a, a.mori-photo-tile').count()!==0)
    fail(width+'px all keirin/autorace venue buttons must link to their consoles: '+
      JSON.stringify(venueLinks));
  const keirinNames=['京王閣','小倉','玉野','防府','青森','豊橋','久留米','小田原','静岡','奈良','武雄'];
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
    gp:'rgb(170, 70, 162)',sg:'rgb(170, 70, 162)',gi:'rgb(170, 70, 162)',
    gii:'rgb(72, 107, 177)',giii:'rgb(50, 123, 68)'
  };
  for(const [grade,color] of Object.entries(expectedColors))
    if(gradeColors[grade]!==color)
      fail(width+'px grade '+grade+' palette mismatch: '+JSON.stringify(gradeColors));
  // Venue cards use light standard borders and 3px sport-color left accent.
  const cardBorders=await page.locator('[data-home-venues] > .vcard:not([data-demo])')
    .evaluateAll(nodes=>nodes.map(el=>{
      const st=getComputedStyle(el);
      return {border:st.borderTopColor,width:st.borderTopWidth,leftWidth:st.borderLeftWidth};
    }));
  if(cardBorders.length!==10 || cardBorders.some(x=>
      x.border!=='rgb(201, 207, 213)' || x.width!=='1px' || x.leftWidth!=='3px'))
    fail(width+'px venue card line-normal / sport accent border wrong: '+JSON.stringify(cardBorders));

  // Measure the actual text width of 特GⅠ in a 36×20px badge at this viewport.
  const specialBadge=await page.locator('[data-home-venues="keirin"] .vcard[data-demo] .vcard-top').first().evaluate(top=>{
    const badge=document.createElement('span');
    badge.className='gbadge g-g1';
    badge.textContent='特GⅠ';
    top.append(badge);
    const box=badge.getBoundingClientRect();
    const range=document.createRange();
    range.selectNodeContents(badge);
    const glyph=range.getBoundingClientRect();
    const style=getComputedStyle(badge);
    const result={width:box.width,height:box.height,whiteSpace:style.whiteSpace,
      font:style.fontSize,fits:glyph.left>=box.left-0.5 && glyph.right<=box.right+0.5 &&
        glyph.top>=box.top-0.5 && glyph.bottom<=box.bottom+0.5};
    badge.remove();
    return result;
  });
  if(specialBadge.width!==36 || specialBadge.height!==20 ||
     specialBadge.whiteSpace!=='nowrap' || specialBadge.font!=='12px' ||
     !specialBadge.fits)
    fail(width+'px special GⅠ text outside badge: '+JSON.stringify(specialBadge));

  // SCR-100 featured riders: center the name area beneath the description,
  // while venue/race/deadline remains fixed to the lower-right edge.
  const featuredAlignment=await page.locator('.pickup-card.pk3').evaluateAll(cards =>
    cards.map(card=>{
      const body=card.querySelector('.pickup-body').getBoundingClientRect();
      const description=card.querySelector('.pk-explain').getBoundingClientRect();
      const player=(card.querySelector('.pk-two-rider-stack') ||
        card.querySelector('.pk-player')).getBoundingClientRect();
      const time=card.querySelector('.pk-race-time').getBoundingClientRect();
      return {
        riderCenterDelta:Math.abs((player.top+player.bottom-description.bottom-body.bottom)/2),
        timeBottomDelta:Math.abs(time.bottom-body.bottom),
        horizontalGap:time.left-player.right,
        riderInBounds:player.top>=description.bottom-2 && player.bottom<=body.bottom+2,
        timeInBounds:time.bottom<=body.bottom+2
      };
    }));
  if(featuredAlignment.length!==4 || featuredAlignment.some(a=>
    a.riderCenterDelta>2 || a.timeBottomDelta>2 || a.horizontalGap < -1 ||
    !a.riderInBounds || !a.timeInBounds))
    fail(width+'px featured rider center or fixed bottom-right venue/time mismatch: '+
      JSON.stringify(featuredAlignment));

  // Static SCR-100 featured riders: no left/right arrows or pager state.
  const featured=page.locator('.pickup-card.pk3');
  const compactHeights=await featured.evaluateAll(cards=>cards.map(card=>({
    height:card.getBoundingClientRect().height,
    count:card.querySelectorAll('.pk-player').length,
    arrows:card.querySelectorAll('button.pk-next,button.pk-prev,.pk-nav,.pk-player-panel').length,
    pagerState:card.hasAttribute('data-featured-index')
  })));
  const originalHeight=width<=330?80:86;
  if(compactHeights.length!==4 || compactHeights.some(x=>
      Math.abs(x.height-originalHeight)>1 || x.count<1 || x.count>2 ||
      x.arrows!==0 || x.pagerState))
    fail(width+'px featured rider cards must be compact and have no pager: '+
      JSON.stringify(compactHeights));
  const growth=await featured.first().evaluate(card=>{
    const clone=card.cloneNode(true);
    clone.classList.add('pk-two-riders');
    const row=clone.querySelector('.pk-compact-row');
    const race=row.querySelector('.pk-race-time');
    const rider=row.querySelector('.pk-player');
    const stack=document.createElement('div');
    stack.className='pk-two-rider-stack';
    for(let i=0;i<3;i++)stack.appendChild(rider.cloneNode(true));
    row.replaceChildren(stack,race);
    card.after(clone);
    const body=clone.querySelector('.pickup-body').getBoundingClientRect();
    const description=clone.querySelector('.pk-explain').getBoundingClientRect();
    const riderBox=stack.getBoundingClientRect();
    const raceBox=race.getBoundingClientRect();
    const result={height:clone.getBoundingClientRect().height,
      firstRiderBelowDescription:riderBox.top>=description.bottom-2,
      ridersInBounds:riderBox.bottom<=body.bottom+2,
      timeAtBottom:Math.abs(raceBox.bottom-body.bottom)<2};
    clone.remove();
    return result;
  });
  if(growth.height<=originalHeight+5 || !growth.firstRiderBelowDescription ||
      !growth.ridersInBounds || !growth.timeAtBottom)
    fail(width+'px featured card must grow only for 3+ riders: '+JSON.stringify(growth));

  // SCR-100 announcement list: exactly nine notices from the supplied
  // Gamboo source page. No campaign entries, headings or campaign markers.
  const homeNews=await page.locator('.news-item').evaluateAll(items=>items.map(el=>{
    const title=el.querySelector('.news-title');
    const arrow=el.querySelector('.news-arrow');
    const head=el.querySelector('.news-head');
    const cardRect=el.getBoundingClientRect();
    const arrowRect=arrow.getBoundingClientRect();
    const titleStyle=getComputedStyle(title);
    const badgeStyle=getComputedStyle(el.querySelector('.news-badge'));
    return {
      date:el.querySelector('.news-date')?.textContent.trim(),
      title:title.textContent.trim(),
      href:el.getAttribute('href'),
      kind:el.dataset.newsKind,
      category:el.querySelector('.news-badge')?.textContent.trim(),
      badgeWidth:el.querySelector('.news-badge')?.getBoundingClientRect().width,
      badgeBackground:badgeStyle.backgroundColor,
      titleWeight:titleStyle.fontWeight,
      isCampaign:Boolean(el.querySelector('.news-campaign')),
      titleFullyVisible:titleStyle.overflow!=='hidden' &&
        titleStyle.webkitLineClamp==='none' &&
        title.scrollHeight<=title.clientHeight+1,
      arrowCenteredToCard:Math.abs((cardRect.top+cardRect.bottom-arrowRect.top-arrowRect.bottom)/2)<=1.5 &&
        arrowRect.right<=cardRect.right &&
        arrowRect.left>=head.getBoundingClientRect().right-1
    };
  }));
  const expectedNews=[
    ['2026.11.06','競輪','【ブース出展のお知らせ】豪華景品が当たるチャンス！11/7(土)～8(日)四日市GIIIにてGambooブース出展決定！','03633'],
    ['2026.11.02','競輪＆オート','【重要】GambooBETの一時発売停止を伴うメンテナンス実施について(11月分)','03631'],
    ['2026.11.02','競輪＆オート','【重要】d払いのメンテナンスについて','03630'],
    ['2026.11.01','その他','【重要】ログインパスワードは定期的に変更してください！','03612'],
    ['2026.10.30','ポイント','「景品に交換」「景品を当てる」に四日市GIIIオリジナルクオカードが登場！','03627'],
    ['2026.10.15','コミュニティ','Gambooブログの2026年9月月間賞発表！！','03616'],
    ['2026.10.01','その他','【重要】ログインパスワードは定期的に変更してください！','03603'],
    ['2026.09.28','ポイント','※10/19追記【Gポイント交換停止中】「Gポイント」サイトメンテナンスとポイント交換サービス一時停止のお知らせ','03610'],
    ['2026.09.24','競輪','【復旧】「KEIRIN.JP」ライブ映像の視聴不具合について(Androidスマートフォン)','03617']
  ];
  if(homeNews.length!==9 || homeNews.some((n,i)=>{
    const [date,category,title,tid]=expectedNews[i]||[];
    return n.date!==date||n.category!==category||n.title!==title||
      n.kind!=='notice'||n.isCampaign||
      n.href!==('https://gamboo.jp/news/?tid=info&tsid='+tid)||
      !n.titleFullyVisible||!n.arrowCenteredToCard||n.titleWeight!=='400'||
      Math.abs(n.badgeWidth-88)>1||
      (['ポイント','コミュニティ','その他'].includes(n.category) &&
        n.badgeBackground!=='rgb(98, 108, 118)');
  }))
    fail(width+'px SCR-100 must display nine regular-weight notices with centered arrows and grey non-race badges: '+
      JSON.stringify(homeNews));
  const criticalAlert=await page.locator('.news-item').last().evaluate(el=>{
    const date=el.querySelector('.news-date');
    const icon=el.querySelector('.news-alert-icon');
    const style=icon?getComputedStyle(icon):null;
    return {
      date:date?.textContent.trim(),
      immediatelyAfterDate:date?.nextElementSibling===icon,
      count:document.querySelectorAll('.news-alert-icon').length,
      text:icon?.textContent.trim(),
      label:icon?.getAttribute('aria-label'),
      width:style?.width,height:style?.height,
      background:style?.backgroundColor,color:style?.color
    };
  });
  if(criticalAlert.date!=='2026.09.24' ||
      !criticalAlert.immediatelyAfterDate || criticalAlert.count!==1 ||
      criticalAlert.text!=='！' || criticalAlert.label!=='重要' ||
      criticalAlert.width!=='20px' || criticalAlert.height!=='20px' ||
      criticalAlert.background!=='rgb(184, 71, 99)' ||
      criticalAlert.color!=='rgb(255, 255, 255)')
    fail(width+'px Sept 24 critical notice icon must be red with white ! after date: '+
      JSON.stringify(criticalAlert));
  const mori=await page.locator('.mori-venue-grid > .vcard').evaluateAll(cards=>
    cards.map(card=>({
      race:card.dataset.moriRace||'',
      venue:card.querySelector('.vcard-name')?.textContent?.trim(),
      grade:card.querySelector('.gbadge')?.textContent?.trim(),
      number:card.querySelector('.vcard-r')?.textContent?.trim(),
      deadline:card.querySelector('.vcard-dl')?.dataset.deadline||'',
      state:card.querySelector('.vcard-dl')?.textContent?.trim(),
      next:card.dataset.moriNext||'',
      day:card.querySelector('.vcard-day')?.textContent?.trim(),
      photo:card.classList.contains('mori-photo-tile')
    })));
  if(mori.length!==5 || !mori[0].photo || !mori[3].photo ||
     mori[1].race!=='2' || mori[1].venue!=='浜松' || mori[1].grade!=='SG' ||
     mori[1].number!=='2R' || mori[1].state!=='確定' ||
     mori[2].race!=='10' || mori[2].venue!=='浜松' || mori[2].grade!=='SG' ||
     mori[2].number!=='10R' || mori[2].deadline!=='14:45' ||
     mori[4].next!=='2026-11-07' || mori[4].venue!=='川口' ||
     mori[4].day!=='初日' || mori[4].state!=='11/7')
    fail(width+'px Mori 11/3 demo / 11/7 next entry changed: '+JSON.stringify(mori));

  const noon={青森:['5R','12:39'],防府:['5R','12:52'],
    豊橋:['1R','15:45'],久留米:['1R','15:59'],静岡:['1R','20:36'],
    奈良:['1R','20:44'],武雄:['1R','20:52'],浜松:['6R','12:42'],
    川口:['1R','18:48']};
  for (const [name,[race,time]] of Object.entries(noon)) {
    const card=[...initial.keirin,...initial.auto].find(x=>x.name===name);
    if (!card || card.race!==race || card.time!==time ||
        (card.soon !== ['青森','防府','浜松'].includes(name)))
      fail(width+'px Nov 3 12:00 current race mismatch for '+name+': '+JSON.stringify(card));
  }
  if (!initial.keirin.find(x=>x.name==='小田原')?.ended)
    fail(width+'px Odawara must be complete at noon');
  // SCR-100 warning palette matches SCR-200／SCR-300: caution red background, white text.
  // The 20-minute cutoff is handled by the existing home.js scheduler.
  const urgentPaint=await page.evaluate(()=>{
    const read=selector=>[...document.querySelectorAll(selector)].map(el=>{
      const st=getComputedStyle(el), rect=el.getBoundingClientRect();
      const parent=el.closest('.vcard-bottom, .pk-race-time');
      return {
        text:el.textContent.trim(), fg:st.color,bg:st.backgroundColor,
        bgParent:parent?getComputedStyle(parent).backgroundColor:'',
        width:rect.width
      };
    });
    return {
      venues:read('.venue-grid.g3 .vcard.deadline-soon .vcard-dl.soon'),
      featured:read('.pk3 .pk-deadline.soon'),
      regular:read('.venue-grid.g3 .vcard:not(.deadline-soon) .vcard-dl[data-deadline]'),
      numbers:[...document.querySelectorAll('.venue-grid.g3 .vcard.deadline-soon .vcard-r')]
        .map(el=>getComputedStyle(el).color)
    };
  });
  const expectedAlertColor='rgb(184, 71, 99)';
  const expectedAlertText='rgb(255, 255, 255)';
  if (urgentPaint.venues.length!==3 || urgentPaint.featured.length!==1 ||
      [...urgentPaint.venues,...urgentPaint.featured].some(p=>
        p.bg!==expectedAlertColor || p.fg!==expectedAlertText || p.width<=0))
    fail(width+'px SCR-100 venue/featured deadline badges must be solid caution red with white text: '+
      JSON.stringify(urgentPaint));
  if (urgentPaint.regular.some(p=>p.bg===expectedAlertColor || p.fg===expectedAlertText) ||
      urgentPaint.numbers.some(color=>color===expectedAlertText) ||
      urgentPaint.venues.some(p=>p.bgParent===expectedAlertColor))
    fail(width+'px SCR-100 urgency must not color regular deadlines, R numbers or whole rows: '+
      JSON.stringify(urgentPaint));

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
  if (girlsColors.some(color => color !== 'rgb(184, 71, 99)'))
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
  const oldButtons=await page.locator('.app-header.shared-app-header .header-actions > *').evaluateAll(nodes=>
    nodes.map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {width:r.width,height:r.height,padding:s.paddingLeft,
        gap:s.columnGap,font:s.fontSize,icon:el.querySelector('svg')?.getBoundingClientRect().width};
    }));
  if(oldButtons.length!==2 ||
     oldButtons.some(el=>el.width<80||el.height!==40||el.font!=='14px') ||
     oldButtons[0].padding!=='8px' ||oldButtons[1].padding!=='10px' ||
     oldButtons[0].icon!==20 ||oldButtons[1].icon!==18)
    fail(width+'px restored original SCR-100 notification/deposit geometry mismatch: '+JSON.stringify(oldButtons));
  const header=page.locator('.app-header.shared-app-header');
  if(await header.count()!==1 ||
     (await header.locator('.header-title-text').innerText()).trim()!=='車券購入' ||
     !(await header.locator('.header-page-icon use').getAttribute('href')).endsWith('#nav-ticket') ||
     await header.locator('.header-notification').count()!==1 ||
     await header.locator('.header-deposit').count()!==1)
    fail(width+'px SCR-100 must show the ticket icon/title and both header actions');

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
  const keirin = nav.locator('a.tab-item[href="./SCR-200_keirin.html"]');
  const auto = nav.locator('a.tab-item[href="./SCR-300_autorace.html"]');
  if (await keirin.count() !== 1 || (await keirin.innerText()).trim() !== "競輪予想") {
    fail(width + "px home keirin prediction link missing");
  }
  if (await auto.count() !== 1 || (await auto.innerText()).trim() !== "オート予想") {
    fail(width + "px home autorace prediction link missing");
  }
  const dateTabs=page.locator('.scroll-area > .date-tabs [data-date]');
  const readNames=async (kind) => page.locator('[data-home-venues="'+kind+'"] > .vcard:not([data-demo]) .vcard-name').allTextContents();
  async function checkLinksForDay(day) {
    const links=await page.locator('[data-home-venues] > .vcard').evaluateAll(cards=>
      cards.map(card=>({
        sport:card.closest('[data-home-venues]')?.dataset.homeVenues,
        tag:card.tagName,
        href:card.getAttribute('href')
      })));
    const keirinUrl='https://gamboo.jp/bet/xt_keirin.aspx?rmac=console_device-checker&it=1';
    const autoUrl='https://gamboo.jp/bet/xt_autorace.aspx?mac=Console_Index&it=1&rno=';
    if(links.some(card=>card.tag!=='A'||card.href!==
        (card.sport==='keirin'?keirinUrl:autoUrl)) ||
       links.filter(card=>card.sport==='keirin').length!==11 ||
       links.filter(card=>card.sport==='autorace').length!==2)
      fail(width+'px '+day+' venue links incorrect: '+JSON.stringify(links));
  }
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
  await checkLinksForDay('Nov 3');
  await dateTabs.nth(0).click();
  await checkDummyVisibility(false,'Nov 2');
  await checkLinksForDay('Nov 2');
  eq((await readNames('keirin')).join('|'),
    '防府|豊橋|久留米|小田原|静岡|奈良|武雄|熊本',width+'px Nov 2 grade and track-number order');
  eq((await readNames('autorace')).join('|'),'浜松|川口',width+'px Nov 2 real autorace');
  if (await page.locator('[data-home-venues] > .vcard:not([data-demo]) .vcard-dl[data-deadline]').count())
    fail(width+'px yesterday must not have next-race cutoffs');
  await dateTabs.nth(2).click();
  await checkDummyVisibility(false,'Nov 4');
  await checkLinksForDay('Nov 4');
  eq((await readNames('keirin')).join('|'),
    '青森|大宮|豊橋|取手|静岡|奈良|武雄|別府',width+'px Nov 4 grade and track-number order');
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
  await checkLinksForDay('Nov 3');
  eq((await readNames('keirin')).join('|'),
    '防府|青森|豊橋|久留米|小田原|静岡|奈良|武雄',width+'px Nov 3 grade and track-number order');
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
