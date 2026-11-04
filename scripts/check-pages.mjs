/**
 * Visual regression for every non-home HTML page, using a fixed Git baseline.
 * Each page is loaded in isolated Chromium contexts, at three widths and two scroll positions.
 * Compare BEFORE any interaction; this guards CSS extraction and stale override removal.
 */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = process.cwd();
const paths = [
  'SCR-02_keirin.html',
  'SCR-02_autorace.html',
  'SCR-03_racecardkeirin.html',
  'SCR-04_racecardautorace.html',
  'SCR-07_mypage.html',
  'SCR-11_campaign.html',
  'index.html'
];
const BASE = process.env.BASELINE_URL || '';
const CURRENT = process.env.CURRENT_URL || 'http://127.0.0.1:4173';
const OUT = process.env.SCREENSHOT_DIR || '/tmp/gamboo-all-pages';
const widths = [296, 390, 768];
const failures=[];
const maxDiff=Number(process.env.MAX_DIFF_RATIO || '0.00005');
function fail(s){failures.push(s);console.error(s);}
async function open(browser,host,file,w){
  const context=await browser.newContext({viewport:{width:w,height:w<=330?616:800}, deviceScaleFactor:1, reducedMotion:'reduce'});
  const page=await context.newPage();
  const errs=[];
  page.on('pageerror', e=>{errs.push(e.message);console.log('PAGE JS ERROR '+file+' '+w+': '+e.message);});
  await page.addInitScript(()=>{
    window.setInterval = () => 0;
    // Preserve animation-frame callbacks for scroll arrow sync and waitForFunction.
  });
  await page.goto(host+'/'+encodeURIComponent(file),{waitUntil:'load',timeout:60000});
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
      img.addEventListener('load',resolve,{once:true});
      img.addEventListener('error',resolve,{once:true});
      setTimeout(resolve,2000);
    })));
  });
  await page.addStyleTag({content:'*,*::before,*::after {transition:none !important;animation:none !important;caret-color:transparent !important;}'});
  if(errs.length) fail(file+' '+w+' JS: '+errs.join(', '));
  return {page,context};
}
async function capture(page,scene){
  if(scene==='bottom') await page.evaluate(()=>{
    const scrollers=[...document.querySelectorAll('.scroll-area,.page-scroll,.content-scroll,main')];
    for(const el of scrollers){ if(el.scrollHeight>el.clientHeight) el.scrollTop=el.scrollHeight; }
    document.scrollingElement.scrollTop=document.scrollingElement.scrollHeight;
  });
  return page.screenshot({animations:'disabled'});
}
function compare(cur,base,key){
 const a=PNG.sync.read(cur),b=PNG.sync.read(base);
 if(a.width!==b.width||a.height!==b.height){fail(key+' dimensions differ');return;}
 const pixels=pixelmatch(a.data,b.data,null,a.width,a.height,{threshold:0.07});
 const ratio=pixels/(a.width*a.height);
 console.log('COMPARE '+key+': '+pixels+' pixels ('+(100*ratio).toFixed(5)+'%)');
 if(ratio>maxDiff)fail(key+' visual difference '+(ratio*100).toFixed(5)+'%');
}
async function checkCampaignPage(page, width) {
  const open = page.locator('#campaign-tab-open');
  const closed = page.locator('#campaign-tab-closed');
  const pagination = page.locator('.campaign-pagination');
  const cards = page.locator('#campaign-list > .cp-card');
  const snapshot = '2026-11-03T12:00:00';
  if (await cards.count() !== 16) fail(width + 'px expected 16 entries from supplied pages 1 and 2');
  if (await page.locator('.filter-chips, .cp-actions, .cp-btn.primary, .cp-btn.done').count())
    fail(width + 'px obsolete campaign controls remain');
  const sourceValues = await cards.evaluateAll(els => els.map(el => ({
    status: el.dataset.status, deadline: el.dataset.deadline,
    href: el.querySelector('.cp-btn')?.getAttribute('href'),
    image: el.querySelector('.cp-banner')?.getAttribute('src'),
    title: el.querySelector('.cp-title')?.textContent?.trim()
  })));
  for (const item of sourceValues) {
    if (item.status !== (item.deadline >= snapshot ? 'open' : 'closed'))
      fail(width + 'px incorrectly classified campaign deadline: ' + JSON.stringify(item));
    if (!item.href?.startsWith('https://gamboo.jp/') || !item.image?.startsWith('https://gamboo.jp/images/%2fcampaign%2f') || !item.title)
      fail(width + 'px missing original campaign image/title/detail URL: '+JSON.stringify(item));
  }
  if (await pagination.isVisible()) fail(width + 'px closed pagination visible before selecting ended');
  if (await open.getAttribute('aria-selected') !== 'true')
    fail(width + 'px ongoing campaign tab should initially be selected');
  const initialVisible = await cards.evaluateAll(els => els.filter(el => !el.hidden).length);
  if (initialVisible !== 8) fail(width + 'px expected eight ongoing campaigns, got ' + initialVisible);
  const layout = await cards.first().evaluate(el => {
    const image = el.querySelector('.cp-banner');
    const body = el.querySelector('.cp-body');
    const title = body.querySelector('.cp-title');
    const period = body.querySelector('.cp-period');
    const button = body.querySelector('.cp-btn');
    const a=image.getBoundingClientRect(), b=body.getBoundingClientRect();
    return {imageWidth:a.width,imageHeight:a.height,bodyWidth:b.width,
      titleSize:getComputedStyle(title).fontSize,periodSize:getComputedStyle(period).fontSize,
      titleWeight:getComputedStyle(title).fontWeight,
      bodyOrder:[...body.children].map(el => el.className),
      periodBottom:period.getBoundingClientRect().bottom,
      buttonTop:button.getBoundingClientRect().top};
  });
  if (Math.abs(layout.imageWidth-layout.imageHeight) > 1 ||
      Math.abs(layout.imageWidth-layout.bodyWidth) > 2 ||
      layout.titleSize !== '14px' || layout.periodSize !== '14px' ||
      layout.periodBottom > layout.buttonTop ||
      layout.bodyOrder.join('|') !== 'cp-title|cp-period|cp-btn')
    fail(width + 'px campaign layout, font or deadline position mismatch: '+JSON.stringify(layout));
  const detailAppearance = await page.locator('#campaign-list > .cp-card .cp-btn').evaluateAll(els =>
    els.map(el => ({
      border: getComputedStyle(el).borderTopColor,
      borderWidth: getComputedStyle(el).borderTopWidth,
      background: getComputedStyle(el).backgroundColor,
      shadow: getComputedStyle(el).boxShadow,
      radius: getComputedStyle(el).borderRadius
    })));
  if (detailAppearance.length !== 16 || detailAppearance.some(a =>
      a.border !== 'rgb(156, 164, 168)' || a.borderWidth !== '1px' ||
      a.background !== 'rgb(255, 255, 255)' || a.shadow === 'none' || a.radius !== '8px'))
    fail(width+'px campaign detail buttons must use white background with a shared control border: '+
      JSON.stringify(detailAppearance));
  const tabAppearance = await page.locator('.campaign-tabs.date-tabs > .date-tab').evaluateAll(els =>
    els.map(el => {
      const st=getComputedStyle(el);
      return {font:st.fontSize,weight:st.fontWeight,height:el.getBoundingClientRect().height,
        bottomWidth:st.borderBottomWidth,bottomColor:st.borderBottomColor,color:st.color,
        background:st.backgroundColor,shadow:st.boxShadow,
        radius:st.borderRadius};
    }));
  if (tabAppearance.length !== 2 || tabAppearance.some(a =>
      a.font !== '16px' || a.weight !== '600' || a.height !== 50 ||
      a.bottomWidth !== '3px' || a.background !== 'rgba(0, 0, 0, 0)' ||
      a.shadow !== 'none' || a.radius !== '0px') ||
      tabAppearance[0].color !== 'rgb(134, 115, 58)' ||
      tabAppearance[0].bottomColor !== 'rgb(134, 115, 58)' ||
      tabAppearance[1].color !== 'rgb(43, 49, 53)' ||
      tabAppearance[1].bottomColor !== 'rgba(0, 0, 0, 0)')
    fail(width + 'px campaign status tabs must look like the canonical date tabs: '+
      JSON.stringify(tabAppearance));
  const links = await cards.evaluateAll(els => els.map(el => {
    const imageAnchor=el.querySelector('.cp-banner-link');
    const image=el.querySelector('.cp-banner');
    const detail=el.querySelector('.cp-btn');
    const title=el.querySelector('.cp-title'), period=el.querySelector('.cp-period');
    return {count:el.querySelectorAll('a').length,
      bannerTarget:imageAnchor?.getAttribute('href'),
      detailTarget:detail?.getAttribute('href'),
      bannerOpens:imageAnchor?.getAttribute('target'),
      bannerRel:imageAnchor?.getAttribute('rel'),
      bannerChild:image?.parentElement===imageAnchor,
      titlePlain:!title.closest('a'),periodPlain:!period.closest('a')};
  }));
  if (links.length !== 16 || links.some(l =>
      l.count !== 2 || !l.bannerTarget || l.bannerTarget!==l.detailTarget ||
      l.bannerOpens !== '_blank' || !l.bannerRel.includes('noopener') ||
      !l.bannerChild || !l.titlePlain || !l.periodPlain))
    fail(width + 'px only the campaign banner and detail button should navigate: '+
      JSON.stringify(links));
  // The global press handler must never darken the entire campaign card.
  const feedbackState = await cards.first().evaluate(card => {
    const test = (target) => {
      target.dispatchEvent(new PointerEvent('pointerdown',{
        bubbles:true,pointerType:'touch',pointerId:102
      }));
      const result = {
        card:card.classList.contains('tap-pressed'),
        pressed:target.closest('a')?.classList.contains('tap-pressed') || false
      };
      document.dispatchEvent(new Event('pointercancel'));
      return result;
    };
    return {
      title:test(card.querySelector('.cp-title')),
      deadline:test(card.querySelector('.cp-period')),
      blank:test(card),
      banner:test(card.querySelector('.cp-banner')),
      button:test(card.querySelector('.cp-btn'))
    };
  });
  if (feedbackState.title.card || feedbackState.title.pressed ||
      feedbackState.deadline.card || feedbackState.blank.card ||
      feedbackState.banner.card || !feedbackState.banner.pressed ||
      feedbackState.button.card || !feedbackState.button.pressed)
    fail(width + 'px campaign card should never darken, only its interactive links: '+
      JSON.stringify(feedbackState));
  const titleChecks = await cards.evaluateAll(els => els.map(el => {
    const title = el.querySelector('.cp-title');
    const style = getComputedStyle(title);
    const image=el.querySelector('.cp-banner');
    const img=image.getBoundingClientRect();
    return {title:title.textContent.trim(),display:style.display,clamp:style.webkitLineClamp,
      titleOverflow:title.scrollHeight > title.clientHeight + 1,
      imageSquare:Math.abs(img.width-img.height) < 1};
  }));
  if (titleChecks.some(c => c.titleOverflow || c.clamp !== 'none' || !c.imageSquare))
    fail(width + 'px full campaign title or square banner layout failed: ' + JSON.stringify(titleChecks));
  const deadlineStyles = await cards.evaluateAll(els => els.map(el => {
    const period=el.querySelector('.cp-period'),cs=getComputedStyle(period);
    const p=period.getBoundingClientRect(),b=el.querySelector('.cp-body').getBoundingClientRect();
    return {font:cs.fontSize,weight:cs.fontWeight,color:cs.color,align:cs.textAlign,
      centerOffset:Math.abs((p.left+p.right-b.left-b.right)/2)};
  }));
  if (deadlineStyles.some(s => s.font !== '14px' || s.weight !== '600' ||
       s.color !== 'rgb(165, 55, 76)' || s.align !== 'center' || s.centerOffset > 1))
    fail(width + 'px deadline must be centered, red and bold: ' + JSON.stringify(deadlineStyles));
  const icon=await page.locator('.page-header .header-page-icon use').getAttribute('href');
  if (!icon?.endsWith('#nav-campaign')) fail(width + 'px campaign header SVG mismatch');
  await closed.click();
  if (!await pagination.isVisible() || await closed.getAttribute('aria-selected') !== 'true')
    fail(width + 'px archive pagination did not open');
  const closedTab=await closed.evaluate(el => ({
    color:getComputedStyle(el).color,border:getComputedStyle(el).borderBottomColor
  }));
  if (closedTab.color !== 'rgb(134, 115, 58)' ||
      closedTab.border !== 'rgb(134, 115, 58)')
    fail(width + 'px ended campaign date tab must have gold active underline: '+JSON.stringify(closedTab));
  const archiveValues = await cards.evaluateAll(els => els.filter(el => !el.hidden).map(el => el.dataset.status));
  if (archiveValues.length !== 8 || archiveValues.some(status => status !== 'closed'))
    fail(width + 'px expected eight ended campaigns');
  const previous=page.locator('.campaign-page-arrow[data-page="prev"]');
  const next=page.locator('.campaign-page-arrow[data-page="next"]');
  if (!await previous.isDisabled() || !await next.isDisabled())
    fail(width + 'px archive arrows should be disabled with eight items');

  // Exercise two pages by adding synthetic fixture clones; never persist them in HTML.
  await page.evaluate(() => {
    const list=document.getElementById('campaign-list');
    const sample=list.querySelector('.cp-card[data-status="closed"]');
    for(let i=0;i<20;i++){
      const clone=sample.cloneNode(true);
      clone.dataset.testFixture='true';
      list.insertBefore(clone,list.querySelector('.campaign-empty'));
    }
  });
  await open.click();
  await closed.click(); // Forces render to read 28 archived entries.
  const firstCount=await cards.evaluateAll(els => els.filter(el => !el.hidden).length);
  if (firstCount !== 20 || await next.isDisabled() || !await previous.isDisabled())
    fail(width + 'px archive page one should show 20 items');
  await next.click();
  const secondCount=await cards.evaluateAll(els => els.filter(el => !el.hidden).length);
  if (secondCount !== 8 || !await next.isDisabled() || await previous.isDisabled() ||
      (await page.locator('.campaign-page-info').innerText()).trim() !== '2 / 2')
    fail(width + 'px archive page two should show eight items');
  await previous.click();
  if ((await page.locator('.campaign-page-info').innerText()).trim() !== '1 / 2')
    fail(width + 'px previous arrow did not restore page one');
  console.log('CAMPAIGN PAGE OK ' + width + 'px (16 source entries, deadline state, 20-per-page)');
}

async function checkCompactSectionHeader(page, width, file) {
  if(!['SCR-11_campaign.html','SCR-07_mypage.html'].includes(file)) return;
  const name=file==='SCR-11_campaign.html'?'キャンペーン':'マイページ';
  const header=page.locator('.phone-inner > .page-header.page-header-simple');
  if(await header.count()!==1) return fail(file+' '+width+'px missing shared section header');
  if((await header.locator('.page-header-title').innerText()).trim()!==name)
    fail(file+' '+width+'px header name mismatch');
  if(await header.locator('.header-page-icon').count()!==1 ||
     await header.locator('.header-actions, .page-header-action, .icon-btn').count())
    fail(file+' '+width+'px obsolete header actions or missing icon');
  const st=await header.evaluate(el=>{
    const title=el.querySelector('.page-header-title'),icon=el.querySelector('.header-page-icon');
    const r=el.getBoundingClientRect(),t=title.getBoundingClientRect(),i=icon.getBoundingClientRect();
    return {h:r.height,bg:getComputedStyle(el).backgroundColor,
      border:getComputedStyle(el).borderBottomColor,
      size:getComputedStyle(title).fontSize,weight:getComputedStyle(title).fontWeight,
      titleColor:getComputedStyle(title).color,iconColor:getComputedStyle(icon).color,
      iconW:i.width,iconH:i.height,
      offset:Math.abs((r.left+r.right-t.left-t.right)/2)};
  });
  if(st.h!==50 || st.bg!=='rgb(255, 255, 255)' ||
     st.border!=='rgb(208, 212, 214)' || st.size!=='18px' ||
     st.weight!=='600' || st.titleColor!=='rgb(43, 49, 53)' ||
     st.iconColor!=='rgb(134, 115, 58)' ||
     st.iconW!==32 || st.iconH!==32 || st.offset>1)
    fail(file+' '+width+'px header mismatch: '+JSON.stringify(st));
}

async function checkNavPredictionLinks(page, width, file) {
  const navs = page.locator(".bottom-tab");
  const count = await navs.count();
  if (!count) {
    fail(file + " " + width + "px missing bottom navigation");
    return;
  }
  for (let i = 0; i < count; i++) {
    const nav = navs.nth(i);
    const keirin = nav.locator('a.tab-item[href="./SCR-02_keirin.html"]');
    const auto = nav.locator('a.tab-item[href="./SCR-02_autorace.html"]');
    if (await keirin.count() !== 1 || await auto.count() !== 1) {
      fail(file + " " + width + "px missing prediction tab link");
      continue;
    }
    if ((await keirin.innerText()).trim() !== "競輪予想") fail(file + " keirin tab label mismatch");
    if ((await auto.innerText()).trim() !== "オート予想") fail(file + " autorace tab label mismatch");
  }
  if (width !== 296) return;
  const keirinLink = navs.first().locator('a.tab-item[href="./SCR-02_keirin.html"]');
  await keirinLink.click();
  if (new URL(page.url()).pathname.split("/").pop() !== "SCR-02_keirin.html")
    fail(file + " keirin tab did not navigate");
  const autoLink = page.locator(".bottom-tab").first().locator('a.tab-item[href="./SCR-02_autorace.html"]');
  await autoLink.click();
  if (new URL(page.url()).pathname.split("/").pop() !== "SCR-02_autorace.html")
    fail(file + " autorace tab did not navigate");
  console.log("BOTTOM NAV OK " + file + " " + width + "px");
}

async function checkKeirinMania(page, width) {
  const wrap = page.locator(".race-table-wrap");
  const table = wrap.locator("table.mania-table");
  const raceTab = page.locator('.info-tab[data-target="racecard"]');
  const maniaTab = page.locator('.info-tab[data-target="mania"]');
  const sheet = page.locator(".phone-inner > .sheet");
  const overlay = page.locator(".phone-inner > .sheet-overlay");
  const allRiders = table.locator("tbody tr");
  if (await allRiders.count() !== 9) fail(width + "px nine riders not retained");
  if (await table.locator(".mania-section-start").count() !== 1) fail(width + "px appended mania section missing");
  if (await table.locator(".item-btn").count() !== 8) fail(width + "px mania item buttons missing");
  if (await table.locator(".mania-eval").count() !== 81) fail(width + "px all evaluation cells not present");
  if (await sheet.isVisible()) fail(width + "px detail sheet initially open");
  await maniaTab.click();
  await page.waitForFunction(() => document.querySelector(".race-table-wrap").scrollLeft > 100, null, { timeout: 6000 });
  if (!await maniaTab.evaluate(el => el.classList.contains("active"))) fail(width + "px mania tab did not activate when scrolled");
  for (let i = 0; i < 8; i++) {
    await table.locator('.item-btn[data-item="' + i + '"]').click();
    if (!await sheet.isVisible()) fail(width + "px detail sheet " + i + " did not open");
    if (!await overlay.isVisible()) fail(width + "px detail overlay " + i + " did not open");
    if (await sheet.locator(".detail-table tbody tr").count() !== 9) fail(width + "px detail data count wrong in item " + i);
    if (!(await sheet.locator(".sheet-title").innerText()).trim()) fail(width + "px missing detail title " + i);
    await sheet.locator(".sheet-close").click();
    if (await sheet.isVisible()) fail(width + "px detail sheet " + i + " did not close");
  }
  await raceTab.click();
  await page.waitForFunction(() => document.querySelector(".race-table-wrap").scrollLeft === 0);
  if (!await raceTab.evaluate(el => el.classList.contains("active"))) fail(width + "px racecard menu did not return to active");
  const scroll = await wrap.evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft; });
  await wrap.dispatchEvent("scroll");
  if (scroll <= 100) fail(width + "px table did not scroll right");
  await page.waitForFunction(() => document.querySelector('.info-tab[data-target="mania"]').classList.contains('active'));
  console.log("KEIRIN MANIA OK " + width + "px (8 detail views, 9 riders, 2-way navigation)");
}

async function checkAutoraceLabMerged(page, width) {
  const entry = page.locator('.at-wrap[data-panel="entry"]');
  const table = entry.locator('table.auto-merged');
  const labTab = page.locator('.info-tab[data-tab="lab"]');
  const entryTab = page.locator('.info-tab[data-tab="entry"]');
  const sheet = page.locator(".lsheet");
  if (await page.locator(".screen-wrap").count() !== 1)
    fail(width + "px autorace merged screen duplication");
  if (await page.locator('.at-wrap[data-panel="lab"]').count() !== 0)
    fail(width + "px redundant lab panel present");
  if (await table.locator("tbody tr").count() !== 8)
    fail(width + "px autorace entry did not retain eight drivers");
  if (await table.locator(".lb-btn").count() !== 9)
    fail(width + "px lab detail buttons not preserved");
  if (await table.locator(".lb-v").count() !== 72 || await table.locator(".lb-tot").count() !== 8)
    fail(width + "px lab evaluation data missing");
  if (await sheet.isVisible()) fail(width + "px lab detail sheet initially open");

  await labTab.click();
  await page.waitForFunction(() =>
    document.querySelector('.at-wrap[data-panel="entry"]').scrollLeft > 100);
  if (!await labTab.evaluate(el=>el.classList.contains("active")))
    fail(width + "px lab tab not active after tap");
  for (let i = 0; i < 9; i++) {
    await table.locator('.lb-btn[data-item="' + i + '"]').click();
    if (!await sheet.isVisible()) fail(width + "px detail " + i + " did not open");
    if (await sheet.locator(".ldt tbody tr").count() !== 8)
      fail(width + "px lab detail " + i + " lost eight drivers");
    if (!(await sheet.locator(".lsheet-title").innerText()).trim())
      fail(width + "px lab detail title missing " + i);
    await sheet.locator(".lsheet-close").click();
    if (await sheet.isVisible()) fail(width + "px lab detail " + i + " did not close");
  }
  await entry.locator(".rd-sw").click();
  if (await entry.locator(".rd-sw").getAttribute("aria-checked") !== "true")
    fail(width + "px wet track switch failed");
  const wet = await entry.locator(".lb-tot").first().getAttribute("data-w");
  const actual = (await entry.locator(".lb-tot").first().innerText()).trim();
  if (wet !== actual) fail(width + "px wet track evaluations failed");
  await entry.locator('.rd-lab[data-side="g"]').click();
  if (await entry.locator(".rd-sw").getAttribute("aria-checked") !== "false")
    fail(width + "px good track switch failed");

  await page.locator('.info-tab[data-tab="past"]').click();
  if (!await page.locator('.at-wrap[data-panel="past"]').isVisible())
    fail(width + "px past-ten-races panel missing");
  if (await page.locator('.at-wrap[data-panel="past"] tbody tr').count() !== 8)
    fail(width + "px past-ten-races driver data missing");
  await page.locator('.at-wrap[data-panel="past"] .dt-bar .sw').click();
  if (!await page.locator('.at-wrap[data-panel="past"]').evaluate(el=>el.classList.contains("detail")))
    fail(width + "px past-ten-races detail switch failed");

  await page.locator('.info-tab[data-tab="vs"]').click();
  if (!await page.locator('.at-wrap[data-panel="vs"]').isVisible())
    fail(width + "px head-to-head panel missing");
  if (await page.locator('.at-wrap[data-panel="vs"] tbody tr').count() !== 8)
    fail(width + "px head-to-head driver data missing");

  await entryTab.click();
  if (!await entry.isVisible() || await entry.evaluate(el=>el.scrollLeft)!==0)
    fail(width + "px entry menu did not return to first column");
  if (!await entryTab.evaluate(el=>el.classList.contains("active")))
    fail(width + "px entry tab did not reactivate");
  await entry.evaluate(el=>{
    el.scrollLeft=el.scrollWidth;
    el.dispatchEvent(new Event("scroll",{bubbles:true}));
  });
  await page.waitForFunction(() =>
    document.querySelector('.info-tab[data-tab="lab"]').classList.contains("active"));
  console.log("AUTORACE LAB OK " + width + "px (9 detail views, 8 drivers, wet/dry, past/vs, 2-way scroll)");
}

async function checkPredictionSort(page, width, isAutorace) {
  const buttons = page.locator('.venue-sort-options .chip');
  if (await buttons.count() !== 3)
    fail(width + 'px unexpected inline sort button count');
  if (await page.locator('.sort-sheet, .sheet-scrim, .sort-btn').count())
    fail(width + 'px obsolete sheet sorting controls remain');
  const cards = page.locator('.scroll-area > .venue-card');
  if (!await cards.count()) fail(width + 'px prediction cards missing');

  // Fix geometry across all selection states, including when the arrow is visible.
  const readSortGeometry = async () => page.locator('.venue-sort-options .chip').evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return {left:r.left,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
    }));
  const initialGeometry = await readSortGeometry();
  if (Math.max(...initialGeometry.map(r=>r.width)) -
      Math.min(...initialGeometry.map(r=>r.width)) > 0.5)
    fail(width + 'px prediction sort controls must have equal width: '+JSON.stringify(initialGeometry));
  const checkFixedSortGeometry = async (state) => {
    const next = await readSortGeometry();
    if (next.some((r,i) => Math.abs(r.width - initialGeometry[i].width) > 0.5 ||
          Math.abs(r.left - initialGeometry[i].left) > 0.5 ||
          r.scrollWidth > r.clientWidth + 1))
      fail(width + 'px prediction sort control geometry changed at '+state+': '+JSON.stringify(next));
  };
  const checkVenueTextCentered = async (glyph) => {
    const offset = await page.locator('.venue-sort-options [data-sort="venue"]').evaluate(button => {
      const range = document.createRange();
      range.selectNodeContents(button.firstChild);
      const a = range.getBoundingClientRect();
      const b = button.querySelector('.sort-direction').getBoundingClientRect();
      const r = button.getBoundingClientRect();
      return Math.abs((Math.min(a.left,b.left) + Math.max(a.right,b.right) - r.left - r.right) / 2);
    });
    if (offset > 1) fail(width + 'px venue sorting label and '+glyph+' not centered: '+offset);
  };
  await checkFixedSortGeometry('initial');

  {
    const grade = page.locator('.venue-sort-options [data-sort="grade"]');
    await grade.click();
    if (await grade.getAttribute('aria-pressed') !== 'true')
      fail(width + 'px grade sort was not selected');
    await checkFixedSortGeometry('grade');
    const gradeValues = await cards.evaluateAll(els => els.map(e => Number(e.dataset.sortGrade)));
    if (gradeValues.some((v, i) => i && v < gradeValues[i-1]))
      fail(width + 'px grade sorting did not reorder cards');

    const venue = page.locator('.venue-sort-options [data-sort="venue"]');
    await venue.click();
    if (await venue.getAttribute('aria-pressed') !== 'true')
      fail(width + 'px venue sort was not selected');
    const venueValues = await cards.evaluateAll(els => els.map(e => Number(e.dataset.sortVenue)));
    if (venueValues.some((v, i) => i && v < venueValues[i-1]))
      fail(width + 'px north-to-south venue sorting did not reorder cards');
    if ((await venue.locator('.sort-direction').textContent())?.trim() !== '↓')
      fail(width + 'px first venue tap should show ↓');
    await checkFixedSortGeometry('venue down');
    await checkVenueTextCentered('↓');
    await venue.click();
    const southValues = await cards.evaluateAll(els => els.map(e => Number(e.dataset.sortVenue)));
    if (southValues.some((v, i) => i && v > southValues[i-1]))
      fail(width + 'px south-to-north venue sorting did not reorder cards');
    if ((await venue.locator('.sort-direction').textContent())?.trim() !== '↑')
      fail(width + 'px second venue tap should show ↑');
    await checkFixedSortGeometry('venue up');
    await checkVenueTextCentered('↑');
    await venue.click();
    const northValues = await cards.evaluateAll(els => els.map(e => Number(e.dataset.sortVenue)));
    if (northValues.some((v, i) => i && v < northValues[i-1]))
      fail(width + 'px third venue tap should restore north-to-south');
    await checkFixedSortGeometry('venue down again');
    await checkVenueTextCentered('↓');
  }
  // Guard the canonical 600-weight for race numbers, times and statuses.
  const dayColors = await page.locator('.date-tabs .date-tab').evaluateAll(nodes =>
    nodes.map(node => ({active: node.classList.contains('active'),
      color: getComputedStyle(node).color})));
  if (dayColors.some(item => item.color !== (item.active ? 'rgb(134, 115, 58)' : 'rgb(43, 49, 53)')))
    fail(width + 'px date tabs must use dark unselected text and gold active text');
  const raceWeights = await page.locator('.venue-card .rchip:not(.canceled) > b, .venue-card .rchip > small')
    .evaluateAll(nodes => [...new Set(nodes.map(n => getComputedStyle(n).fontWeight))]);
  if (raceWeights.some(weight => weight !== '600'))
    fail(width + 'px race button fonts must be 600: ' + raceWeights.join(','));
  // Action buttons use the visible control boundary; cards use the lighter
  // passive border. Urgent/canceled states retain their semantic exceptions.
  // Every race button retains the canonical subtle shadow.
  const raceStyles = await page.locator('.venue-card .rchip').evaluateAll(nodes =>
    nodes.map(n => ({classes: n.className, background: getComputedStyle(n).backgroundColor,
      border: getComputedStyle(n).borderTopColor, shadow: getComputedStyle(n).boxShadow})));
  if (!raceStyles.length) fail(width + 'px race button styles missing');
  for (const st of raceStyles) {
    if (st.shadow === 'none') fail(width + 'px race button missing shadow: ' + st.classes);
    if (!st.classes.includes('canceled') && !st.classes.includes('soon') &&
        st.border !== 'rgb(156, 164, 168)')
      fail(width + 'px race buttons must have a control border unless in a special state: ' +
        JSON.stringify(st));
  }
  const sortBorders = await page.locator('.venue-sort-options .chip:not(.active)')
    .evaluateAll(nodes => nodes.map(n => getComputedStyle(n).borderTopColor));
  if (sortBorders.some(c => c !== 'rgb(156, 164, 168)'))
    fail(width + 'px inactive sort buttons must use the control border');
  // Regression of 3px urgent border, 44px arrow target and 14px sort label.
  const warningLabels = await page.locator('.venue-card .rchip.next.soon .rchip-warning').allTextContents();
  if (warningLabels.length !== 1 || warningLabels[0].trim() !== '締切13分前')
    fail(width + 'px 12:00 snapshot must show 13 minutes remaining on the 12:13 race');
  const urgent = await page.locator('.venue-card .rchip.next.soon').evaluateAll(nodes =>
    nodes.map(el => ({width:getComputedStyle(el).borderTopWidth,color:getComputedStyle(el).borderTopColor})));
  if (urgent.some(s => s.width !== '3px' || s.color !== 'rgb(165, 55, 76)'))
    fail(width + 'px urgent border mismatch: ' + JSON.stringify(urgent));
  const arrowWidths = await page.locator('.venue-card .hscroll > .hscroll-cue, .venue-card .hscroll > .hscroll-cue-l')
    .evaluateAll(nodes => nodes.map(el => getComputedStyle(el).width));
  if (arrowWidths.some(v => v !== '44px'))
    fail(width + 'px scroll arrows must be 44px wide: ' + JSON.stringify(arrowWidths));
  const sortSizes = await buttons.evaluateAll(nodes => nodes.map(el => getComputedStyle(el).fontSize));
  if (sortSizes.some(v => v !== '14px'))
    fail(width + 'px sort buttons must be 14px: ' + JSON.stringify(sortSizes));
  if (isAutorace && await page.locator('.grade-badge.grade-f2').filter({hasText:'普通'}).count())
    fail(width + 'px normal grade incorrectly classified as F2');
  if (isAutorace) {
    const sg=await page.locator('.venue-card .grade-badge.grade-sg').evaluateAll(nodes=>
      nodes.map(el=>({name:el.textContent.trim(),color:getComputedStyle(el).backgroundColor})));
    if(sg.length!==1 || sg[0].name!=='SG' || sg[0].color!=='rgb(43, 49, 53)')
      fail(width+'px auto SG grade badge must be black: '+JSON.stringify(sg));
  }
  const raceLinks = page.locator('.venue-card a.rchip');
  if (!await raceLinks.count()) fail(width + 'px linked race buttons missing');
  if (!/SCR-0[34]_racecard/.test(await raceLinks.first().getAttribute('href')))
    fail(width + 'px race button destination invalid');
  // Every genuine final (keirin 決勝 or auto 優勝戦) has the exact shared
  // bottom-navigation campaign symbol, including races already completed.
  // Semifinals must not inherit that icon.
  const finalIcons = await page.locator('.venue-card .rchip[data-race-type]').evaluateAll(nodes =>
    nodes.map(chip => {
      const type=chip.dataset.raceType;
      const isFinal=(type.endsWith('決勝') && !type.includes('準決勝')) || type==='優勝戦';
      const row=chip.querySelector('.rchip-bottom-icons');
      const icons=[...(row?.querySelectorAll(':scope > .rchip-bottom-icon') || [])];
      const campaigns=icons.filter(icon=>icon.classList.contains('rchip-campaign'));
      const svg=campaigns[0]?.querySelector('svg.rchip-campaign-icon');
      const svgStyle=svg ? getComputedStyle(svg) : null;
      const rowBox=row?.getBoundingClientRect();
      return {type,isFinal,count:campaigns.length,
        iconOrder:icons.map(icon=>icon.classList.contains('rchip-girls')?'girls':
          icon.classList.contains('rchip-campaign')?'campaign':
          icon.classList.contains('rchip-featured')?'featured':'unknown'),
        source:svg?.querySelector('use')?.getAttribute('href'),
        color:svgStyle?.color,width:svgStyle?.width,height:svgStyle?.height,
        centered: rowBox ? Math.abs((rowBox.left+rowBox.right) / 2 -
          (chip.getBoundingClientRect().left+chip.getBoundingClientRect().right) / 2) : null,
        fits: row ? row.scrollWidth <= chip.clientWidth : null
      };
    }));
  const topRebates=await page.locator('.venue-card .rchip[data-race-type]').evaluateAll(nodes=>
    nodes.map(chip=>{
      const hasCampaign=!!chip.querySelector('.rchip-campaign');
      const label=chip.querySelector(':scope > .rchip-rebate');
      const style=label?getComputedStyle(label):null;
      const rect=label?.getBoundingClientRect();
      const button=chip.getBoundingClientRect();
      return {hasCampaign,count:chip.querySelectorAll(':scope > .rchip-rebate').length,
        text:label?.textContent.trim(),color:style?.color,font:style?.fontSize,
        row:style?.gridRowStart,display:style?.display,
        aligned:rect?Math.abs((rect.left+rect.right-button.left-button.right)/2):null,
        countdown:!!chip.querySelector(':scope > .rchip-warning')};
    }));
  if(topRebates.some(v=>v.count!==(v.hasCampaign?1:0) ||
      (v.hasCampaign && (v.text!=='5%還元' ||
        v.color!=='rgb(134, 115, 58)' || v.font!=='12px' || v.row!=='1' ||
        v.aligned>1 || (v.countdown && v.display!=='none')))))
    fail(width+'px first-row 5% rebate missing or misstyled: '+
      JSON.stringify(topRebates.filter(v=>v.hasCampaign||v.count)));
  // Temporary DOM-only warning fixture: urgent text must hide the 5% rebate.
  const countdownPriority=await page.locator('.rchip:has(.rchip-campaign)').first().evaluate(chip=>{
    const rebate=chip.querySelector('.rchip-rebate');
    const warning=document.createElement('span');
    warning.className='rchip-warning';
    warning.textContent='締切5分前';
    chip.prepend(warning);
    const hidden=getComputedStyle(rebate).display==='none';
    const shown=getComputedStyle(warning).display!=='none';
    warning.remove();
    return {hidden,shown,restored:getComputedStyle(rebate).display!=='none'};
  });
  if(!countdownPriority.hidden || !countdownPriority.shown || !countdownPriority.restored)
    fail(width+'px countdown must override final-race rebate: '+
      JSON.stringify(countdownPriority));
  const expectedFinals=isAutorace?1:5;
  if (finalIcons.filter(r=>r.isFinal).length !== expectedFinals ||
      finalIcons.some(r=>r.count !== (r.isFinal?1:0)) ||
      finalIcons.filter(r=>r.isFinal).some(r=>
        !r.source?.endsWith('#nav-campaign') ||
        r.color !== 'rgb(134, 115, 58)' || r.width !== '16px' || r.height !== '16px' ||
        !r.fits || r.centered > 1 ||
        r.iconOrder.join('|') !== r.iconOrder.slice().sort(
          (a,b)=>['girls','campaign','featured'].indexOf(a)-
            ['girls','campaign','featured'].indexOf(b)).join('|')))
    fail(width + 'px final race campaign icon, placement, or ordering is invalid: '+
      JSON.stringify(finalIcons.filter(r=>r.isFinal || r.count)));
  if (!isAutorace && !finalIcons.some(r=>r.type==='ガールズ決勝' &&
      r.iconOrder.join('|')==='girls|campaign|featured'))
    fail(width + 'px girls final must show girls, campaign, featured in that order');

  if (await page.locator('.rpred').count()) fail(width + 'px old prediction buttons remain');
  // Current race sits beside the left-arrow strip; completed races start left
  // of the visible region rather than obscuring the active R.
  const initialCurrent = await page.locator('.venue-card .hscroll.has-past').first().evaluate(row => {
    const current = row.querySelector('.rchip.next');
    const scroller = row.querySelector('.hscroll-inner');
    const arrow = row.querySelector('.hscroll-cue-l');
    const rightEdge = arrow.getBoundingClientRect().right;
    return {
      found: !!current,
      currentLeft: current?.getBoundingClientRect().left,
      clearance: arrow.hidden ? scroller.getBoundingClientRect().left : rightEdge,
      canScroll: scroller.scrollWidth > scroller.clientWidth + 1,
      pastHidden: scroller.scrollLeft > 1
    };
  });
  if (!initialCurrent.found ||
      (initialCurrent.canScroll &&
        (initialCurrent.currentLeft < initialCurrent.clearance - 2 || !initialCurrent.pastHidden)))
    fail(width + 'px current race must start right of left arrow: ' + JSON.stringify(initialCurrent));
  if (!isAutorace) {
    const rebate = await page.locator('.venue-card .venue-header').evaluateAll(headers =>
      headers.map(header => {
        const venue = header.closest('.venue-card').dataset.venue;
        const mark = header.querySelector(':scope > .rebate-logo');
        const rect = header.getBoundingClientRect();
        const logoRect = mark?.getBoundingClientRect();
        const nameRect = header.querySelector('.venue-name').getBoundingClientRect();
        return {venue, hasMark:!!mark, label:mark?.textContent?.trim(),
          symbol:mark?.querySelector('use')?.getAttribute('href'),
          color:mark?getComputedStyle(mark).color:null,
          within:!mark || logoRect.left >= nameRect.right - 1 &&
            logoRect.right <= rect.right + 1};
      }));
    const expected=new Set(['防府','久留米','小田原']);
    if (rebate.length !== 8 || rebate.some(r => expected.has(r.venue)
       ? !r.hasMark || r.label !== '決勝5%還元' ||
         !r.symbol?.endsWith('#nav-campaign') ||
         r.color !== 'rgb(134, 115, 58)' || !r.within
       : r.hasMark))
      fail(width+'px final 5% rebate must appear in the header right of only the three venues: '+
        JSON.stringify(rebate));
    const wins = page.locator('.comment-row .cr-streak');
    const labels = await wins.allTextContents();
    if (labels.length !== 5 ||
        labels.slice().sort().join('|') !== ['3連勝','3連勝','3連勝','4連勝','5連勝'].sort().join('|'))
      fail(width + 'px all five consecutive-win labels must be visible: ' + labels.join(','));
    const featuredRows = await page.locator('.venue-card .comment-row').evaluateAll(nodes =>
      nodes.map(node => ({venue:node.closest('.venue-card').dataset.venue,
        count:Number(node.dataset.featuredCount),
        race:Number(node.dataset.featuredRace)})));
    if (featuredRows.length !== 29 ||
        featuredRows.reduce((n,row) => n + row.count, 0) !== 30 ||
        featuredRows.filter(row => row.count === 2).length !== 1)
      fail(width + 'px all 30 featured riders in 29 races must be shown: ' + JSON.stringify(featuredRows));
    const expectedByVenue = {青森:5,小田原:4,静岡:2,豊橋:7,奈良:1,防府:6,久留米:3,武雄:1};
    const actualByVenue = Object.fromEntries(Object.keys(expectedByVenue).map(venue =>
      [venue, featuredRows.filter(row => row.venue === venue).length]));
    if (Object.keys(expectedByVenue).some(venue => expectedByVenue[venue] !== actualByVenue[venue]))
      fail(width + 'px featured race coverage differs from official list: ' + JSON.stringify(actualByVenue));
    // All car numbers, including the second rider in a multi-rider race,
    // must align horizontally with the 11R row's car number.
    const carPositions = await page.locator('.venue-card > .comment-row').evaluateAll(rows =>
      rows.flatMap(row => Array.from(row.querySelectorAll('.carno')).map(number => ({
        race: row.dataset.featuredRace,
        x: number.getBoundingClientRect().left,
        labelWidth: row.querySelector('.cr-r').getBoundingClientRect().width,
        labelAlign: getComputedStyle(row.querySelector('.cr-r')).textAlign
      }))));
    const reference11 = carPositions.find(row => row.race === '11');
    if (!reference11 || !carPositions.length ||
        carPositions.some(row => Math.abs(row.x - reference11.x) > 1 ||
          Math.abs(row.labelWidth - reference11.labelWidth) > 0.5 ||
          row.labelAlign !== 'right'))
      fail(width + 'px featured rider car numbers must match the 11R position: ' + JSON.stringify(carPositions));
    if (await page.locator('.venue-card[data-venue="小田原"] .comment-row[data-featured-race="2"] .cr-kun').count() !== 2)
      fail(width + 'px Odawara 2R must retain both special rider titles');
    if (await page.locator('.venue-card[data-venue="防府"] .comment-row[data-featured-race="10"] .cr-name').count() !== 2)
      fail(width + 'px Hofu 10R must retain both featured riders');
    const allStreaks = await page.locator('.venue-card .rchip[data-streak]').evaluateAll(
      nodes => nodes.map(node => node.dataset.streak).sort());
    if (allStreaks.join('|') !== ['3連勝','3連勝','3連勝','4連勝','5連勝'].sort().join('|'))
      fail(width + 'px missing 2026-11-03 featured-race streak data: ' + allStreaks.join(','));
  }


  // Regression: one arrow tap reaches the final / first race without
  // empty viewport beyond the last R, even after sorting.
  const scrollRowIndex = await page.locator('.venue-card .hscroll').evaluateAll(rows =>
    rows.findIndex(row => {
      const scroller = row.querySelector('.hscroll-inner');
      return scroller && scroller.scrollWidth > scroller.clientWidth + 1;
    }));
  if (scrollRowIndex >= 0) {
    const row = page.locator('.venue-card .hscroll').nth(scrollRowIndex);
    const scroller = row.locator('.hscroll-inner');
    await scroller.evaluate(el => {
      el.scrollLeft = 0;
      el.dispatchEvent(new Event('scroll'));
    });
    await row.locator('.hscroll-cue').evaluate(button => button.click());
    await page.waitForFunction(index => {
      const row = document.querySelectorAll('.venue-card .hscroll')[index];
      const el = row.querySelector('.hscroll-inner');
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      return el.scrollLeft >= max - 1;
    }, scrollRowIndex, { timeout: 6000 });
    const endState = await scroller.evaluate(el => {
      const last = el.querySelector('.rchips > .rcol:last-child');
      return {
        gap: el.getBoundingClientRect().right - last.getBoundingClientRect().right,
        max: Math.max(0, el.scrollWidth - el.clientWidth),
        current: el.scrollLeft
      };
    });
    if (endState.gap > 16 || endState.current > endState.max + 1)
      fail(width + 'px race scroller leaves trailing blank space: ' + JSON.stringify(endState));
    await row.locator('.hscroll-cue-l').evaluate(button => button.click());
    await page.waitForFunction(index => {
      const row = document.querySelectorAll('.venue-card .hscroll')[index];
      return row.querySelector('.hscroll-inner').scrollLeft <= 1;
    }, scrollRowIndex, { timeout: 6000 });
  }
  console.log('PREDICTION SORT OK ' + width + 'px');
}

async function checkSharedReferences(){
 const expected=['design-tokens.css?v=58','tap-feedback.css?v=3'];
 const tokens=await readFile(path.join(ROOT,'assets','design-tokens.css'),'utf8');
 if(!/--fw-normal:\s*400\s*;/.test(tokens)||!/--fw-strong:\s*600\s*;/.test(tokens))
   fail('Canonical typography weights must be 400 and 600');
 if(/--fw-\d{2}-(normal|strong)/.test(tokens))
   fail('Legacy size-specific weight token found');
 const all=['SCR-01_bet.html',...paths];
 const pagesWithPrunedIcons=new Set(['SCR-01_bet.html','SCR-02_keirin.html','SCR-02_autorace.html']);
 for(const page of all){
  const html=await readFile(path.join(ROOT,page),'utf8');
  if(pagesWithPrunedIcons.has(page)){
   const declared=[...html.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
   const used=[...html.matchAll(/<use\b[^>]*\bhref="#([^"]+)"/g)].map(m=>m[1]);
   if(declared.some(id=>!used.includes(id)) || used.some(id=>!declared.includes(id)))
    fail(page+': unused or missing local SVG symbol');
  }
  if(/<style\b/i.test(html))fail(page+': old inline <style> block detected');
  const css=[...html.matchAll(/<link\b[^>]*href=["']\.\/assets\/([^"']+\.css\?v=\d+)["']/g)].map(m=>m[1]);
  for(const name of expected)if(!css.includes(name))fail(page+': shared CSS direct reference missing '+name);
  if(css.length!==new Set(css).size)fail(page+': duplicated stylesheet reference');
  const commonRefs=css.filter(name=>/^ui-consistency\.css\?v=\d+$/.test(name));
  if(commonRefs.length!==1)fail(page+': shared UI stylesheet must be directly referenced exactly once');
  const commonLast=css.findIndex(name=>/^ui-consistency\.css\?v=\d+$/.test(name));
  if(commonLast!==css.length-1)fail(page+': shared UI stylesheet must load last');
  for(const href of css){
   const pathname=href.split('?')[0];
   try{await readFile(path.join(ROOT,'assets',pathname));}
   catch(e){fail(page+': dangling stylesheet reference '+href);}
  }
 }
 console.log('Direct shared CSS references verified for '+all.length+' HTML files.');
}
await checkSharedReferences();

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const file of paths){
  let checked=0;
  for(const w of widths){
   const a=await open(browser,CURRENT,file,w);
   const b=BASE?await open(browser,BASE,file,w):null;
   try{
    for(const scene of ['top','bottom']){
      const name=path.basename(file,'.html').replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]/g,'_')+'-'+w+'-'+scene;
      const cur=await capture(a.page,scene);
      await writeFile(path.join(OUT,name+'.png'),cur);
      if(b)compare(cur,await capture(b.page,scene),name);
      checked++;
    }
    await checkCompactSectionHeader(a.page,w,file);
    if (file === 'SCR-02_keirin.html' || file === 'SCR-02_autorace.html') {
      const h = await a.page.locator('.phone-inner > .page-header .page-header-title')
        .evaluate(el => ({size:getComputedStyle(el).fontSize,weight:getComputedStyle(el).fontWeight}));
      if (h.size !== '18px' || h.weight !== '600')
        fail(file + ' ' + w + 'px shared header title must be 18px/600: '+JSON.stringify(h));
    }
    if (file === 'SCR-11_campaign.html') await checkCampaignPage(a.page,w);
    if (file === 'SCR-02_keirin.html' || file === 'SCR-02_autorace.html') await checkPredictionSort(a.page,w,file === 'SCR-02_autorace.html');
    if (file === 'SCR-03_racecardkeirin.html') await checkKeirinMania(a.page,w);
    if (file === "SCR-04_racecardautorace.html") await checkAutoraceLabMerged(a.page,w);
    if (file !== "index.html") await checkNavPredictionLinks(a.page,w,file);
   }finally {await a.context.close();if(b)await b.context.close();}
  }
  console.log('PAGE OK '+file+' ('+checked+' scenes)');
 }
} finally {await browser.close();}
if(failures.length)throw new Error('Visual/functional regression: '+failures.length+' differences');
console.log('All non-home pages checked: '+paths.length+' files; '+widths.length+' viewport widths; 2 scroll positions.');
