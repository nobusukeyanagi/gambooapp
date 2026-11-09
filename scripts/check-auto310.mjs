import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const origin=process.env.CURRENT_URL || 'http://127.0.0.1:4173';
const folder=process.env.SCREENSHOT_DIR || '/tmp/gamboo-auto310';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
const problems=[];
const expected=['五十嵐一夫','長谷晴久','井村淳一','佐藤裕二','田中茂','森且行','若井友和','中村雅人'];
for(const width of [296,375,768]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(origin+'/SCR-310_racecardautorace.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.auto-race-table tbody tr:nth-child(8)',{timeout:8000});
  const result=await page.evaluate(()=>{
   const box=q=>Math.round(document.querySelector(q).getBoundingClientRect().height);
   const texts=q=>[...document.querySelectorAll(q)].map(x=>x.textContent.trim());
   return {header:box('.shared-app-header'),selector:box('.race-selector'),summary:box('.race-info-bar'),
     menu:box('.race-menu-scroll'),bottom:box('.bottom-tab'),
     activeTitle:document.querySelector('.shared-app-header .header-title-text')?.textContent.trim(),
     selectedRace:document.querySelector('.race-tab.active')?.dataset.race,
     redFrame:getComputedStyle(document.querySelector('.race-tab.active')).borderTopWidth,
     races:document.querySelectorAll('.race-selector .race-tab').length,
     riders:texts('.auto-race-table tbody .rider-name'),
     columns:document.querySelectorAll('.auto-race-table thead tr').length,
     menuCount:document.querySelectorAll('.race-menu-scroll .info-tab').length,
     activeNav:document.querySelector('.bottom-tab .tab-item.active')?.textContent.trim(),
     weather:document.querySelector('.auto-weather-bar')?.textContent.replace(/\s+/g,' ').trim(),
     date:document.querySelector('.ri-date-line')?.textContent.replace(/\s+/g,' ').trim(),
     countdown:document.querySelector('.race-countdown')?.textContent.trim(),
     display:getComputedStyle(document.querySelector('.auto-race-table')).display};
  });
  const errorsNow=[];
  const responsive=await page.evaluate(()=>{
    const actions=[...document.querySelectorAll('.shared-app-header .header-actions :is(.icon-btn,.cta-btn)')].map(x=>Math.round(x.getBoundingClientRect().width));
    const title=document.querySelector('.shared-app-header .header-title-text');
    const text=title.querySelector('.fit-text-inner');
    const extra=text?text.getBoundingClientRect().right-title.getBoundingClientRect().right:0;
    return {actions,compressed:!!text,extra,loaded:!!window.GambooTextFit,
      navLabels:document.querySelectorAll('.bottom-tab .tab-item > .fit-nav-label').length};
  });
  if(responsive.actions.join(',')!=='80,80')errorsNow.push('header action widths differ from SCR-210: '+JSON.stringify(responsive.actions));
  if(!responsive.loaded||responsive.navLabels!==5||responsive.extra>1)
    errorsNow.push('responsive text sizing/visible nav labels failed: '+JSON.stringify(responsive));
  if(width===296&&!responsive.compressed)errorsNow.push('small-screen title not horizontally compressed');
  const synthetic=await page.evaluate(async()=>{
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:0;top:0;width:72px;white-space:nowrap;z-index:-1';
    host.textContent='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    document.body.appendChild(host);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const run=host.querySelector('.fit-text-inner');
    const ok=!!run&&run.getBoundingClientRect().width<=host.clientWidth+1&&host.textContent==='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    host.remove();
    return ok;
  });
  if(!synthetic)errorsNow.push('long line not fully preserved/fit');
  if([result.header,result.selector,result.summary,result.menu,result.bottom].join(',')!=='50,58,120,52,60')
   errorsNow.push('different shared heights '+[result.header,result.selector,result.summary,result.menu,result.bottom]);
  if(result.activeTitle!=='オートレース予想'||result.selectedRace!=='9'||result.races!==12||result.redFrame!=='3px')
   errorsNow.push('header/selected race mismatch');
  if(JSON.stringify(result.riders)!==JSON.stringify(expected)||result.columns!==2||result.menuCount!==7)
   errorsNow.push('rider/table/menu mismatch');
  if(result.activeNav!=='オート予想'||!result.weather.includes('湿走路')||!result.weather.includes('90.0%')||
     !result.date.includes('3100m(6周)')||result.countdown!=='14分前')
   errorsNow.push('context/bottom menu mismatch');
  if(errors.length)errorsNow.push('browser JS errors '+errors);
  await page.screenshot({path:path.join(folder,'SCR-310-'+width+'.png'),fullPage:true,animations:'disabled'});
  const target=page.locator('.race-menu-scroll .info-tab[data-target="road"]');
  await target.click();
  await page.waitForTimeout(450);
  const menuLeft=await page.locator('.race-table-wrap').evaluate(el=>el.scrollLeft);
  if(menuLeft<100)errorsNow.push('horizontal menu failed to scroll table');
  await page.locator('.auto-detail-button[data-report="road"]').first().click();
  if(!(await page.locator('.sheet').isVisible())||(await page.locator('.sheet .detail-table tbody tr').count())!==8)
   errorsNow.push('details sheet does not open with 8 rows');
  await page.locator('.sheet-close').click();
  if(await page.locator('.sheet').isVisible())errorsNow.push('details sheet did not close');
  await page.locator('.sort-power').click();
  const first=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(first!=='中村雅人')errorsNow.push('power sort failed: '+first);
  await page.locator('.sort-car').click();
  const reset=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(reset!=='五十嵐一夫')errorsNow.push('car order restore failed');
  console.log(width+'px result:',JSON.stringify(result),'UI errors:',JSON.stringify(errorsNow));
  problems.push(...errorsNow.map(x=>width+'px '+x));
 }catch(e){problems.push(width+'px exception '+e.message);console.error(e);}
 finally{await page.close();}
}
await browser.close();
if(problems.length){console.error('SCR-310 checks failed:',problems);process.exitCode=1;}
else console.log('SCR-310 shared UI / accurate 8 riders / details / sorting checks PASSED');
