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
  const supercon=await page.evaluate(()=>{
    const bar=document.querySelector('.auto-supercon-bar');
    const parts=[...bar.querySelectorAll('.auto-supercon-pair')].map(pair=>({
      nums:[...pair.querySelectorAll('.lineup-car')].map(c=>c.textContent.trim()),
      classes:[...pair.querySelectorAll('.lineup-car')].map(c=>c.classList.contains('f'+c.textContent.trim())),
      sizes:[...pair.querySelectorAll('.lineup-car')].map(c=>{
        const r=c.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];
      }),
      hyphen:pair.querySelector('.auto-supercon-dash')?.textContent.trim(),
      dashWidth:Math.round(pair.querySelector('.auto-supercon-dash')?.getBoundingClientRect().width||0),
      dashFont:getComputedStyle(pair.querySelector('.auto-supercon-dash')).fontSize,
      marginLeft:getComputedStyle(pair).marginLeft
    }));
    const row=bar.querySelector('.lineup-row');
    const style=e=>{const s=getComputedStyle(e);return {
      font:s.fontSize,color:s.color,bg:s.backgroundColor,padding:s.padding,
      gap:s.gap,borderBottom:s.borderBottomWidth,display:s.display
    }};
    const rect=e=>e.getBoundingClientRect();
    const menu=document.querySelector('.race-menu-scroll'),table=document.querySelector('.rt-area');
    return {
      first:bar.querySelector('.lineup-title')?.textContent.trim(),
      kind:bar.querySelector('.auto-supercon-kind')?.textContent.trim(),
      kindSize:getComputedStyle(bar.querySelector('.auto-supercon-kind')).fontSize,
      starsText:bar.querySelector('.auto-supercon-gold-stars')?.textContent,
      starsColor:getComputedStyle(bar.querySelector('.auto-supercon-gold-stars')).color,
      goldToken:(()=>{const tester=document.createElement('span');tester.style.color='var(--c-gold)';bar.appendChild(tester);const color=getComputedStyle(tester).color;tester.remove();return color;})(),
      parts,bar:style(bar),title:style(bar.querySelector('.lineup-title')),
      row:style(row),hasRightButton:!!bar.querySelector('button,a,.aokei-paper-btn'),
      placement:Math.abs(rect(bar).top-rect(menu).bottom)<1&&
        Math.abs(rect(table).top-rect(bar).bottom)<1,
      rowOverflow:row.scrollWidth-row.clientWidth,
      rowScrollStyle:getComputedStyle(row).overflowX
    };
  });
  if(supercon.first!=='スパコン直前予想　自信度：★★★☆☆'||
     supercon.kind!=='2連単'||supercon.kindSize!==supercon.title.font||
     supercon.starsText!=='★★★'||supercon.starsColor!==supercon.goldToken||
     supercon.parts.length!==3||
     supercon.parts.map(x=>x.nums.join('-')).join('|')!=='1-8|8-1|1-5'||
     supercon.parts.some((x,i)=>x.hyphen!=='―'||x.dashWidth!==12||x.dashFont!=='12px'||x.classes.some(y=>!y)||
       x.sizes.some(size=>size[0]!==22||size[1]!==22)||
       (i===0?parseFloat(x.marginLeft)!==0:Math.abs(parseFloat(x.marginLeft)+parseFloat(supercon.row.gap)-22)>0.1))||
     supercon.hasRightButton||!supercon.placement||
     supercon.rowScrollStyle!=='auto'||supercon.rowOverflow<0)
    errorsNow.push('SCR-310 supercomputer prediction structure/fit mismatch: '+JSON.stringify(supercon));
  const referenceLineup=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  await referenceLineup.goto(origin+'/SCR-210_racecardkeirin.html',{waitUntil:'load'});
  const style210=await referenceLineup.evaluate(()=>{
    const bar=document.querySelector('.lineup-bar'),title=bar.querySelector('.lineup-title'),
      row=bar.querySelector('.lineup-row');
    const style=e=>{const s=getComputedStyle(e);return {
      font:s.fontSize,color:s.color,bg:s.backgroundColor,padding:s.padding,
      gap:s.gap,borderBottom:s.borderBottomWidth,display:s.display
    }};
    return {bar:style(bar),title:style(title),row:style(row)};
  });
  await referenceLineup.close();
  if(JSON.stringify(supercon.bar)!==JSON.stringify(style210.bar)||
     JSON.stringify(supercon.title)!==JSON.stringify(style210.title)||
     JSON.stringify(supercon.row)!==JSON.stringify(style210.row))
    errorsNow.push('prediction bar should share SCR-210 lineup styles: '+JSON.stringify({supercon,style210}));
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
  const deviations=await page.locator('.auto-race-table').evaluate(table=>{
    const styles=e=>{const c=getComputedStyle(e);return {font:c.fontSize,color:c.color,weight:c.fontWeight,align:c.textAlign}};
    const cells=[...table.tBodies[0].rows].map(row=>{
      const cell=row.querySelector('td.col-deviation');
      const primary=cell.querySelector('.deviation-primary');
      const labels=[...cell.querySelectorAll('.deviation-label')],nums=[...cell.querySelectorAll('.deviation-number')];
      return {text:[primary.textContent,...nums.map(n=>n.textContent)],
        labels:labels.map(x=>x.textContent),primary:styles(primary),
        secondary:nums.map(styles),labelStyles:labels.map(styles),
        starts:nums.map(x=>x.getBoundingClientRect().left),
        rows:[primary,...cell.querySelectorAll('.deviation-line')].map(x=>x.getBoundingClientRect().height)
      };
    });
    return {heading:table.tHead.rows[0].cells[4].textContent.trim(),
      headerSpan:table.tHead.rows[0].cells[4].rowSpan,
      headerCount:table.tHead.rows[0].cells.length,cells};
  });
  const expectedOfficial=['0.082','0.100','0.095','0.083','0.091','0.111','0.094','0.093'];
  if(deviations.heading!=='試走偏差'||deviations.headerSpan!==2||
     deviations.headerCount!==14||deviations.cells.length!==8||
     deviations.cells.some((x,i)=>x.text[0]!==expectedOfficial[i]||
       x.text[1]!== (i===0?'0.09':'—')||x.text[2]!== (i===0?'0.09':'—')||
       JSON.stringify(x.labels)!==JSON.stringify(['全R','2連対'])||
       x.primary.font!=='16px'||x.primary.weight!=='400'||x.primary.align!=='center'||
       x.secondary.some(y=>y.font!=='12px'||y.weight!=='400'||y.align!=='left')||
       x.labelStyles.some(y=>y.font!=='12px'||y.weight!=='400'||y.align!=='left')||
       Math.abs(x.starts[0]-x.starts[1])>0.5))
    errorsNow.push('three-line deviation columns/data/alignment failed: '+JSON.stringify(deviations));
  const riderCells=await page.evaluate(()=>{
    const table=document.querySelector('.auto-race-table');
    const header=[...table.tHead.rows[0].cells].map(c=>c.textContent.trim());
    const active=[...table.tHead.rows[0].cells].map((c,i)=>c.classList.contains('section-selected')?i:-1).filter(x=>x>=0);
    const entries=[...table.tBodies[0].rows].map(row=>{
      const rider=row.querySelector('.col-name'),machine=row.querySelector('.col-machine');
      const texts=(q,root)=>root.querySelector(q)?.textContent.trim();
      const style=sel=>{const c=getComputedStyle(machine.querySelector(sel));return {color:c.color,size:c.fontSize,weight:c.fontWeight};};
      return {name:texts('.rider-name',rider),home:texts('.rider-home',rider),
        age:texts('.rider-age',rider),car:texts('.machine-name',machine),
        grade:texts('.machine-grade',machine),carStyle:style('.machine-name'),
        gradeStyle:style('.machine-grade'),
        machineAlign:getComputedStyle(machine).textAlign,
        carAlign:getComputedStyle(machine.querySelector('.machine-name')).textAlign,
        gradeAlign:getComputedStyle(machine.querySelector('.machine-grade')).textAlign,
        trial:row.querySelector('td.col-t')?.textContent.trim(),
        trialTitle:row.querySelector('td.col-t')?.getAttribute('title'),
        deviationTitle:row.querySelector('td.col-deviation')?.getAttribute('title'),
        trialWeight:getComputedStyle(row.querySelector('td.col-t[title="当日試走タイム"]')).fontWeight,
        otherTimingWeights:[...row.querySelectorAll('td.col-t:not([title="当日試走タイム"])')]
          .map(td=>getComputedStyle(td).fontWeight),
        handicap:row.querySelector('.col-h')?.textContent.trim(),
        handicapWeight:getComputedStyle(row.querySelector('.col-h')).fontWeight,
        rank:[...row.querySelector('.col-rank').children].map(el=>el.textContent.trim()),
        rankStyles:[...row.querySelector('.col-rank').children].map(el=>{
          const cs=getComputedStyle(el);
          return {size:cs.fontSize,weight:cs.fontWeight,color:cs.color,
            lineHeight:cs.lineHeight,marginBottom:cs.marginBottom};
        }),
        riderStyles:[...rider.children].map(el=>{
          const cs=getComputedStyle(el);
          return {size:cs.fontSize,weight:cs.fontWeight,color:cs.color,
            lineHeight:cs.lineHeight,marginBottom:cs.marginBottom};
        }),
        height:Math.round(row.getBoundingClientRect().height)};
    });
    const primary=getComputedStyle(document.querySelector('.ri-meeting')).color;
    const secondary=getComputedStyle(document.querySelector('.race-menu-scroll .info-tab:not(.active)')).color;
    return {header,active,entries,primary,secondary};
  });
  const expectedDayTrials=['3.69','3.70','3.69','3.69','3.65','3.76','3.69','3.68'];
  const expectedHome=['川口','浜松','飯塚','川口','飯塚','川口','川口','川口'];
  const expectedCar=['ボーリバージュ','フィールミー','シャーロット','ライキリ',
    'レイリー','Ｍニジュウサン','モエルトウコン','ＫＯモンソン'];
  const expectedCohort=['21期 60歳','23期 56歳','28期 43歳','24期 52歳',
    '26期 49歳','25期 52歳','25期 52歳','28期 45歳'];
  if(riderCells.header[0]!=='車番'||riderCells.header[1]!=='選手名'||
    riderCells.header[2]!=='ハンデ'||riderCells.header[6]!=='ランク審査P'||
    riderCells.header[7]!=='競走車名'||riderCells.header.some(x=>x==='審査P')||
    JSON.stringify(riderCells.active)!==JSON.stringify([1,2,3,4,5,6,7])||
    riderCells.entries.length!==8||
    riderCells.entries.some((r,i)=>r.name!==expected[i]||r.home!==expectedHome[i]||
      r.age!==expectedCohort[i]||r.car!==expectedCar[i]||r.grade!=='1級'||
      r.carStyle.size!=='12px'||r.gradeStyle.size!=='12px'||
      r.carStyle.color!==riderCells.primary||
      r.gradeStyle.color!==riderCells.secondary||
      r.carStyle.weight!=='400'||r.gradeStyle.weight!=='400'||
      r.machineAlign!=='left'||r.carAlign!=='left'||r.gradeAlign!=='left'||
      r.trial!==expectedDayTrials[i]||r.trialTitle!=='当日試走タイム'||
      r.deviationTitle!=='試走偏差（公式／Gamboo全R／Gamboo2連対）'||
      r.trialWeight!=='600'||r.otherTimingWeights.length!==2||
      r.otherTimingWeights.some(w=>w!=='400')||
      r.handicap!==String([0,10,10,20,20,20,20,20][i])||r.handicapWeight!=='600'||
      JSON.stringify(r.rank)!==JSON.stringify([
        ['A-194','前A-73','63.758'],['A-90','前A-126','71.853'],
        ['A-103','前A-6','71.279'],['A-17','前S-43','84.634'],
        ['A-84','前A-23','73.386'],['S-35','前S-27','93.124'],
        ['S-17','前S-18','112.716'],['S-11','前S-11','117.010']
      ][i])||
      r.rankStyles.length!==3||r.rankStyles.some((x,j)=>x.size!==r.riderStyles[j].size||
       x.weight!=='400'||x.lineHeight!==r.riderStyles[j].lineHeight||
       x.marginBottom!==r.riderStyles[j].marginBottom)||r.height!==56))
    errorsNow.push('three-line rider / vehicle name & grade / initial gold selection mismatch: '+JSON.stringify(riderCells));
  // SCR-210 uses the first three characters of the complete name, not surname.
  const fullPrefix=expected.map(name=>Array.from(name).slice(0,3).join(''));
  const shortNames=await page.locator('.auto-race-table tbody .sha-nm').allTextContents();
  if(JSON.stringify(shortNames)!==JSON.stringify(fullPrefix))
    errorsNow.push('fixed vehicle column names must be first 3 chars: '+JSON.stringify(shortNames));
  if(result.activeNav!=='オート予想'||!result.weather.includes('湿走路 12.0℃')||!result.weather.includes('90.0%')||
     !result.date.includes('3100m(6周)')||result.fourth.includes('天候')||
     !result.weatherTop.endsWith('天候 小雨')||result.weather.includes('天候')||
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
     conditionText.topLast!=='天候 小雨'||conditionText.values.length!==5||
     conditionText.values.map(x=>x.text).join('|')!=='小雨|湿走路|12.0℃|9.0℃|90.0%'||
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
  // SCR-210 row 2 (home) and row 3 (cohort and age) must be
  // left-aligned like the first rider name despite shared centered table cells.
  const keirinNames=await comparison.evaluate(()=>[...document.querySelectorAll('.mania-table tbody .c-name')]
    .map(td=>{
      const name=td.querySelector('.rider-name');
      const home=td.querySelector('.rider-home');
      const age=td.querySelector('.rider-age');
      return {
        content:[name?.textContent.trim(),home?.textContent.trim(),age?.textContent.trim()],
        alignment:[name,home,age].map(el=>el?getComputedStyle(el).textAlign:null)
      };
    }));
  if(keirinNames.length!==9||keirinNames.some(r=>r.alignment.some(a=>a!=='left')))
    errorsNow.push('SCR-210 rider name / home / age must all align left '+JSON.stringify(keirinNames));
  await comparison.close();
  if(positions.rows.slice(0,4).some((v,i)=>Math.abs(v-reference[i])>0.6))
    errorsNow.push('first four rows differ from SCR-210: '+JSON.stringify({auto:positions.rows,keirin:reference}));
  if(positions.count!==2||Math.abs(positions.fifthHeight-29)>0.6||
    positions.heights.some(h=>Math.abs(h-14.4)>0.7)||positions.fit.some(x=>x.overflow>1))
    errorsNow.push('fifth-row content overflows/missing: '+JSON.stringify(positions));
  const canonical=await page.evaluate(()=>{
    const table=document.querySelector('.auto-race-table');
    const head=table.tHead.rows[0].cells[0];
    const th=table.tHead.querySelector('th[data-group="recent"]:not(.section-selected)');
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
  const highlight=await page.locator('.auto-race-table').evaluate(table=>({
    playerName:table.tHead.rows[0].cells[1].classList.contains('section-selected'),
    carName:table.tHead.rows[0].cells[7].classList.contains('section-selected'),
    road:table.tHead.querySelector('th[data-group="road"]').classList.contains('section-selected')
  }));
  if(highlight.playerName||highlight.carName||!highlight.road)
    errorsNow.push('selection range must change when other menu tabs are active: '+JSON.stringify(highlight));
  const menuLeft=await page.locator('.race-table-wrap').evaluate(el=>el.scrollLeft);
  if(menuLeft<100)errorsNow.push('horizontal menu failed to scroll table');
  const scrollState=await page.locator('.race-table-wrap').evaluate(el=>({
    active:el.classList.contains('scrolled'),
    labels:[...el.querySelectorAll('tbody .sha-nm')].map(x=>getComputedStyle(x).display)
  }));
  if(!scrollState.active||scrollState.labels.some(x=>x==='none'))
    errorsNow.push('fixed rider names not visible during horizontal scroll '+JSON.stringify(scrollState));
  await page.locator('.auto-detail-button[data-report="road"]').first().click();
  if(!(await page.locator('.sheet').isVisible())||(await page.locator('.sheet .detail-table tbody tr').count())!==8)
   errorsNow.push('details sheet does not open with 8 rows');
  const detailNames=await page.locator('.sheet .detail-table tbody .dt-vehicle-short').allTextContents();
  if(JSON.stringify(detailNames)!==JSON.stringify(fullPrefix))
    errorsNow.push('detail panel short names must be first 3 chars: '+JSON.stringify(detailNames));
  await page.locator('.sheet-close').click();
  if(await page.locator('.sheet').isVisible())errorsNow.push('details sheet did not close');
  await page.locator('.sort-power').click();
  const first=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(first!=='中村雅人')errorsNow.push('power sort failed: '+first);
  const firstTrial=await page.locator('.auto-race-table tbody tr').first().locator('td.col-t').first().innerText();
  if(firstTrial!=='3.68')errorsNow.push('trial time detached from rider after score sorting: '+firstTrial);
  await page.locator('.sort-power').click();
  const reset=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(reset!=='五十嵐一夫')errorsNow.push('power sort toggle failed to restore vehicle order');
  const resetTrials=await page.locator('.auto-race-table tbody tr').evaluateAll(rows=>rows.map(row=>row.querySelector('td.col-t')?.textContent.trim()));
  if(JSON.stringify(resetTrials)!==JSON.stringify(expectedDayTrials))
    errorsNow.push('trial times in vehicle order not restored: '+JSON.stringify(resetTrials));
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
