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
     weather:document.querySelector('.race-info-bar .ri-auto-detail-line:last-child')?.textContent.replace(/\s+/g,' ').trim(),
     weatherTop:document.querySelector('.race-info-bar .ri-auto-detail-line:first-child')?.textContent.replace(/\s+/g,' ').trim(),
     fourth:document.querySelector('.race-info-bar .race-info-row')?.textContent.replace(/\s+/g,' ').trim(),
     standaloneWeather:document.querySelectorAll('.auto-weather-bar').length,
     liveUnderline:getComputedStyle(document.querySelector('.race-info-bar .ri-btn.live')).textDecorationLine,
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
  if(result.activeNav!=='オート予想'||!result.weather.includes('湿走路 11.0℃')||!result.weather.includes('90.0%')||
     !result.date.includes('3100m(6周)')||result.fourth.includes('天候')||
     !result.weatherTop.endsWith('天候 晴')||result.weather.includes('天候')||
     result.standaloneWeather!==0||result.liveUnderline!=='none'||result.countdown!=='14分前')
   errorsNow.push('summary/weather/LIVE mismatch: '+JSON.stringify(result));
  const conditionText=await page.evaluate(()=>{
    const root=document.querySelector('.race-info-bar');
    const red=getComputedStyle(root.querySelector('.race-countdown')).color;
    const indicators=[
      root.querySelector('.ri-auto-weather strong'),
      ...root.querySelectorAll('.ri-auto-detail-line:last-child strong')
    ];
    const values=indicators.map(e=>({text:e.textContent.trim(),
      color:getComputedStyle(e).color,weight:getComputedStyle(e).fontWeight}));
    return {red,values,
      topLast:root.querySelector('.ri-auto-detail-line:first-child .ri-auto-inline').lastElementChild?.textContent.trim(),
      primary:getComputedStyle(root.querySelector('.ri-meeting')).color};
  });
  if(conditionText.red!=='rgb(184, 71, 99)'||
     conditionText.topLast!=='天候 晴'||conditionText.values.length!==5||
     conditionText.values.map(x=>x.text).join('|')!=='晴|湿走路|11.0℃|9.0℃|90.0%'||
     conditionText.values.some(x=>x.weight!=='600'||x.color!==conditionText.primary))
    errorsNow.push('weather/countdown color/weight mismatch '+JSON.stringify(conditionText));
  const positions=await page.evaluate(()=>{
    const root=document.querySelector('.race-info-bar');
    const relative=sel=>Math.round((root.querySelector(sel).getBoundingClientRect().top-root.getBoundingClientRect().top)*10)/10;
    const fifth=root.querySelector('.ri-date-line');
    const lines=[...fifth.querySelectorAll('.ri-auto-detail-line')];
    const fit=[...root.querySelectorAll('.ri-auto-fit-row')].map(el=>{
      const a=el.querySelector('.ri-auto-inline').getBoundingClientRect();
      const b=el.getBoundingClientRect();
      return {overflow:Math.max(0,a.right-b.right),transform:getComputedStyle(el.querySelector('.ri-auto-inline')).transform};
    });
    return {rows:['.ri-meeting','.ri-event','.ri-kind','.race-info-row','.ri-date-line'].map(relative),
      count:lines.length,heights:lines.map(x=>x.getBoundingClientRect().height),
      fifthHeight:fifth.getBoundingClientRect().height,fit};
  });
  const comparison=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  await comparison.goto(origin+'/SCR-210_racecardkeirin.html',{waitUntil:'load'});
  const reference=await comparison.evaluate(()=>{
    const root=document.querySelector('.race-info-bar');
    return ['.ri-meeting','.ri-event','.ri-kind','.race-info-row','.ri-date-line']
      .map(q=>Math.round((root.querySelector(q).getBoundingClientRect().top-root.getBoundingClientRect().top)*10)/10);
  });
  await comparison.close();
  if(positions.rows.slice(0,4).some((v,i)=>Math.abs(v-reference[i])>0.6))
    errorsNow.push('first four rows differ from SCR-210: '+JSON.stringify({auto:positions.rows,keirin:reference}));
  if(positions.count!==2||Math.abs(positions.fifthHeight-29)>0.6||
    positions.heights.some(h=>Math.abs(h-14.4)>0.7)||positions.fit.some(x=>x.overflow>1))
    errorsNow.push('fifth-row content overflows/missing: '+JSON.stringify(positions));
  const canonical=await page.evaluate(()=>{
    const table=document.querySelector('.auto-race-table');
    const head=table.tHead.rows[0].cells[0];
    const th=[...table.tHead.querySelectorAll('th')].find(el=>el.textContent.includes('ハンデ'));
    const nonselectedMenu=document.querySelector('.race-menu-scroll .info-tab:not(.active)');
    const sample=el=>({color:getComputedStyle(el).color,
      weight:getComputedStyle(el).fontWeight,size:getComputedStyle(el).fontSize});
    return {topBorder:getComputedStyle(head).borderTopWidth,
      topColor:getComputedStyle(head).borderTopColor,
      column:sample(th),menu:sample(nonselectedMenu),
      staticCar:head.textContent.trim()==='車番'&&head.querySelectorAll('button,a').length===0,
      upperRows:[...table.tHead.rows[0].cells].map(th=>getComputedStyle(th).borderTopWidth)};
  });
  const referencePage=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  await referencePage.goto(origin+'/SCR-210_racecardkeirin.html',{waitUntil:'load'});
  const referenceColors=await referencePage.evaluate(()=>{
    const th=document.querySelector('.mania-table thead th:not(.section-selected)');
    const menu=document.querySelector('.race-menu-scroll .info-tab:not(.active)');
    const sample=el=>({color:getComputedStyle(el).color,
      weight:getComputedStyle(el).fontWeight,size:getComputedStyle(el).fontSize});
    return {column:sample(th),menu:sample(menu)};
  });
  await referencePage.close();
  if(!canonical.staticCar||canonical.upperRows.some(x=>x!=='1px')||
     canonical.column.color!==referenceColors.column.color||
     canonical.column.weight!==referenceColors.column.weight||
     canonical.column.size!==referenceColors.column.size||
     canonical.menu.color!==referenceColors.menu.color||
     canonical.menu.weight!==referenceColors.menu.weight||
     canonical.menu.size!==referenceColors.menu.size)
    errorsNow.push('upper border/static 車番/inactive colors mismatch '+JSON.stringify({canonical,referenceColors}));
  const styles=await page.evaluate(()=>{
    const root=document.querySelector('.auto-race-table');
    const head=root.tHead.querySelector('th[data-group="recent"]');
    const selected=root.tHead.querySelector('th.section-selected');
    const rows=[...root.tBodies[0].rows];
    const badges=rows.map(el=>el.querySelector('.frame-cell'));
    const expected=[];
    for(let i=1;i<=8;i++){
      const reference=document.createElement('span');
      reference.className='frame-cell f'+i;
      document.body.appendChild(reference);
      const css=getComputedStyle(reference);
      expected.push({bg:css.backgroundColor,fg:css.color,border:css.borderColor});
      reference.remove();
    }
    const actual=badges.map(el=>{
      const css=getComputedStyle(el);
      return {bg:css.backgroundColor,fg:css.color,border:css.borderColor,
        size:Math.round(el.getBoundingClientRect().width),font:css.fontSize};
    });
    const cols=[rows[0].cells[0],rows[0].cells[1]].map(el=>{
      const css=getComputedStyle(el);return {left:css.borderLeftWidth,right:css.borderRightWidth};
    });
    const css=getComputedStyle(head);
    const activeCSS=getComputedStyle(selected);
    const button=root.querySelector('.auto-detail-button');
    const btn=getComputedStyle(button);
    const live=document.querySelector('.shared-app-header .header-title-text');
    return {actual,expected,cols,selected:{color:activeCSS.color,background:activeCSS.backgroundColor},
      heading:{color:css.color,size:css.fontSize,weight:css.fontWeight},
      bodyColor:getComputedStyle(rows[0].querySelector('.auto-value')).color,
      bodyFont:getComputedStyle(rows[0].querySelector('.auto-value')).fontSize,
      titleFont:getComputedStyle(live).fontSize,
      legendFont:getComputedStyle(document.querySelector('.rt-legend dl dd')).fontSize,
      buttons:root.querySelectorAll('.item-btn.auto-detail-button').length,
      buttonWidth:Math.round(button.getBoundingClientRect().width),
      buttonHeight:Math.round(button.getBoundingClientRect().height),
      buttonBorder:btn.borderTopWidth};
  });
  if(styles.titleFont!=='18px'||styles.legendFont!=='14px'||
     styles.heading.color!=='rgb(48, 54, 59)'||
     styles.heading.size!=='12px'||styles.heading.weight!=='600'||
     styles.selected.color!=='rgb(255, 255, 255)'||
     styles.selected.background!=='rgb(114, 103, 49)'||
     styles.bodyColor!=='rgb(48, 54, 59)'||styles.bodyFont!=='16px'||
     styles.cols[0].left!=='1px'||styles.cols[1].left!=='0px'||
     styles.actual.some((x,i)=>x.size!==22||x.font!=='16px'||
       x.fg!==styles.expected[i].fg||x.bg!==styles.expected[i].bg||
       x.border!==styles.expected[i].border)||
     styles.buttons!==24||styles.buttonWidth!==54||styles.buttonHeight!==36||
     styles.buttonBorder!=='1px')
    errorsNow.push('common menu/table/jersey/analysis style mismatch: '+JSON.stringify(styles));
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
  await page.locator('.sort-power').click();
  const reset=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(reset!=='五十嵐一夫')errorsNow.push('power sort toggle failed to restore vehicle order');
  if(await page.locator('.auto-race-table .sort-car').count())
    errorsNow.push('車番 heading must not be a clickable sort control');
  console.log(width+'px result:',JSON.stringify(result),'UI errors:',JSON.stringify(errorsNow));
  problems.push(...errorsNow.map(x=>width+'px '+x));
 }catch(e){problems.push(width+'px exception '+e.message);console.error(e);}
 finally{await page.close();}
}
await browser.close();
if(problems.length){console.error('SCR-310 checks failed:',problems);process.exitCode=1;}
else console.log('SCR-310 shared UI / accurate 8 riders / details / sorting checks PASSED');
