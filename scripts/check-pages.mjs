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

  {
    const grade = page.locator('.venue-sort-options [data-sort="grade"]');
    await grade.click();
    if (await grade.getAttribute('aria-pressed') !== 'true')
      fail(width + 'px grade sort was not selected');
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
    await venue.click();
    const southValues = await cards.evaluateAll(els => els.map(e => Number(e.dataset.sortVenue)));
    if (southValues.some((v, i) => i && v > southValues[i-1]))
      fail(width + 'px south-to-north venue sorting did not reorder cards');
    if ((await venue.locator('.sort-direction').textContent())?.trim() !== '↑')
      fail(width + 'px second venue tap should show ↑');
    await venue.click();
    const northValues = await cards.evaluateAll(els => els.map(e => Number(e.dataset.sortVenue)));
    if (northValues.some((v, i) => i && v < northValues[i-1]))
      fail(width + 'px third venue tap should restore north-to-south');
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
  // Normal white race buttons share the home venue card's light border and
  // every race button has the canonical subtle shadow, including urgent/canceled.
  const raceStyles = await page.locator('.venue-card .rchip').evaluateAll(nodes =>
    nodes.map(n => ({classes: n.className, background: getComputedStyle(n).backgroundColor,
      border: getComputedStyle(n).borderTopColor, shadow: getComputedStyle(n).boxShadow})));
  if (!raceStyles.length) fail(width + 'px race button styles missing');
  for (const st of raceStyles) {
    if (st.shadow === 'none') fail(width + 'px race button missing shadow: ' + st.classes);
    if (st.background === 'rgb(255, 255, 255)' && !st.classes.includes('soon') &&
        st.border !== 'rgb(208, 212, 214)')
      fail(width + 'px white race button border should match home venue: ' + JSON.stringify(st));
  }
  const sortBorders = await page.locator('.venue-sort-options .chip:not(.active)')
    .evaluateAll(nodes => nodes.map(n => getComputedStyle(n).borderTopColor));
  if (sortBorders.some(c => c !== 'rgb(208, 212, 214)'))
    fail(width + 'px white sort button border mismatches home venue');
  const raceLinks = page.locator('.venue-card a.rchip');
  if (!await raceLinks.count()) fail(width + 'px linked race buttons missing');
  if (!/SCR-0[34]_racecard/.test(await raceLinks.first().getAttribute('href')))
    fail(width + 'px race button destination invalid');
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
    const wins = page.locator('.comment-row .cr-streak');
    if (await wins.count() !== 1 || await wins.first().innerText() !== '3連勝')
      fail(width + 'px consecutive wins must be shown separately');
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
