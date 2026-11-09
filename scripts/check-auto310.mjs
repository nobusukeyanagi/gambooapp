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
  // Every SCR-310 menu label has the same 13px side clearance.
  // The "選手情報" tab itself retains its baseline 82px.
  const menuSizing=await page.locator('.race-menu-scroll .info-tab').evaluateAll(tabs=>
    tabs.map(tab=>{
      const content=tab.querySelector('span').getBoundingClientRect(),
        outer=tab.getBoundingClientRect(),style=getComputedStyle(tab);
      return {label:tab.textContent.trim(),width:Math.round(outer.width*100)/100,
        left:Math.round((content.left-outer.left)*100)/100,
        right:Math.round((outer.right-content.right)*100)/100,
        textWidth:Math.round(content.width*100)/100,
        paddingLeft:style.paddingLeft,paddingRight:style.paddingRight,
        minWidth:style.minWidth,
        fits:content.width<=outer.width+0.5};
    })
  );
  if(menuSizing.length!==7||menuSizing[0].label!=='選手情報'||
     Math.abs(menuSizing[0].width-82)>1||
     menuSizing.some(m=>m.paddingLeft!=='13px'||m.paddingRight!=='13px'||
       m.minWidth!=='0px'||Math.abs(m.left-13)>0.6||
       Math.abs(m.right-13)>0.6||!m.fits||
       Math.abs(m.width-m.textWidth-26)>0.6))
    errorsNow.push('menu label-based widths / horizontal padding mismatch: '+JSON.stringify(menuSizing));
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
      dashLayoutWidth:getComputedStyle(pair.querySelector('.auto-supercon-dash')).width,
      dashScale:parseFloat(getComputedStyle(pair.querySelector('.auto-supercon-dash')).transform.match(/matrix\(([^,]+)/)?.[1]||'0'),
      carOffsets:[...pair.querySelectorAll('.lineup-car')].map(car=>
        Math.round(car.getBoundingClientRect().left-pair.getBoundingClientRect().left)),
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
     supercon.parts.some((x,i)=>x.hyphen!=='―'||x.dashWidth!==10||x.dashLayoutWidth!=='12px'||
       Math.abs(x.dashScale-0.82)>0.001||JSON.stringify(x.carOffsets)!=='[0,36]'||
       x.dashFont!=='12px'||x.classes.some(y=>!y)||
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
        noOverflow:[...labels,...nums].every(el=>el.scrollWidth<=el.clientWidth+1)&&
          nums.every(el=>el.getBoundingClientRect().right<=cell.getBoundingClientRect().right+0.5),
        rows:[primary,...cell.querySelectorAll('.deviation-line')].map(x=>x.getBoundingClientRect().height)
      };
    });
    const heads=[...table.tHead.rows[0].cells];
    const widths=heads.slice(1,6).map(el=>Math.round(el.getBoundingClientRect().width));
    const bodyOrder=[...table.tBodies[0].rows].map(row=>[...row.cells].slice(3,6)
      .map(cell=>cell.classList.contains('col-deviation')?'試走偏差':
       cell.getAttribute('title')==='当日試走タイム'?'試走T':
       cell.classList.contains('col-t')?'平均ST':'unknown'));
    return {heading:heads[5].textContent.trim(),headerSpan:heads[5].rowSpan,
      headerOrder:heads.slice(1,6).map(el=>el.textContent.trim()),
      widths,bodyOrder,headerCount:heads.length,cells};
  });
  const expectedOfficial=['0.082','0.100','0.095','0.083','0.091','0.111','0.094','0.093'];
  if(deviations.heading!=='試走偏差'||deviations.headerSpan!==2||
     JSON.stringify(deviations.headerOrder)!==JSON.stringify(['選手名','ハンデ','平均ST','試走T','試走偏差'])||
     JSON.stringify(deviations.widths)!==JSON.stringify([120,50,60,60,80])||
     deviations.bodyOrder.some(cols=>JSON.stringify(cols)!==JSON.stringify(['平均ST','試走T','試走偏差']))||
     deviations.headerCount!==33||deviations.cells.length!==8||
     deviations.cells.some((x,i)=>x.text[0]!==expectedOfficial[i]||
       x.text[1]!==['0.09','0.09','0.10','0.08','0.09','0.11','0.09','0.10'][i]||
       x.text[2]!==['0.09','0.08','0.10','0.08','0.10','0.10','0.09','0.10'][i]||
       JSON.stringify(x.labels)!==JSON.stringify(['全R','2連対'])||
       x.primary.font!=='16px'||x.primary.weight!=='400'||x.primary.align!=='center'||
       x.secondary.some(y=>y.font!=='12px'||y.weight!=='400'||y.align!=='left')||
       x.labelStyles.some(y=>y.font!=='12px'||y.weight!=='400'||y.align!=='left')||
       Math.abs(x.starts[0]-x.starts[1])>0.5||!x.noOverflow))
    errorsNow.push('three-line deviation columns/data/alignment failed: '+JSON.stringify(deviations));


  const lastFive=await page.locator('.auto-race-table').evaluate(table=>({
    headings:[...table.tHead.querySelectorAll('th[data-group="last5"]')].map(h=>h.textContent.trim()),
    widths:[...table.tHead.querySelectorAll('th[data-group="last5"]')].map(h=>Math.round(h.getBoundingClientRect().width)),
    headingFonts:[...table.tHead.querySelectorAll('th[data-group="last5"]')].map(h=>getComputedStyle(h).fontSize),
    headerBorders:[...table.tHead.rows[0].cells].map(h=>{
      const cs=getComputedStyle(h);return [cs.borderTopWidth,cs.borderBottomWidth];
    }),
    rows:[...table.tBodies[0].rows].map(row=>[...row.querySelectorAll('td.auto-last5-cell')].map(cell=>{
      const grade=cell.querySelector('.auto-last5-grade'),meta=cell.querySelector('.auto-last5-meta'),
        entry=cell.querySelector('.auto-last5-entry'),rank=cell.querySelector('.auto-last5-rank'),
        note=cell.querySelector('.auto-last5-flag'),
        noteText=note.querySelector('.auto-last5-flag-text'),dateEl=cell.querySelector('.auto-last5-date'),
        detail=cell.querySelector('.auto-last5-detail'),track=cell.querySelector('.auto-last5-track');
      const style=el=>{const x=getComputedStyle(el);return {font:x.fontSize,weight:x.fontWeight,color:x.color}};
      return {
        grade:grade.textContent.trim(),gradeClass:grade.className,gradeFont:style(grade).font,
        venue:cell.querySelector('.auto-last5-venue').textContent.trim(),
        date:cell.querySelector('.auto-last5-date').textContent.trim(),
        metaRows:getComputedStyle(meta).gridTemplateRows,
        metaAlign:getComputedStyle(meta).textAlign,
        metaInset:Math.round(meta.getBoundingClientRect().left-cell.getBoundingClientRect().left),
        metaWidth:Math.round(meta.getBoundingClientRect().width),
        dateTextWidth:(()=>{const range=document.createRange();range.selectNodeContents(dateEl);
          const width=range.getBoundingClientRect().width;range.detach();return width;})(),
        detailInset:Math.round(detail.getBoundingClientRect().left-cell.getBoundingClientRect().left),
        rank:rank.textContent.trim(),rankStyle:style(rank),
        rankRect:{x:Math.round(rank.getBoundingClientRect().left-cell.getBoundingClientRect().left),
          top:Math.round(rank.getBoundingClientRect().top-entry.getBoundingClientRect().top),
          height:Math.round(rank.getBoundingClientRect().height),
          width:Math.round(rank.getBoundingClientRect().width)},
        flag:note.textContent.trim(),noteStyle:{...style(note),align:getComputedStyle(note).textAlign,
          x:Math.round(note.getBoundingClientRect().left-cell.getBoundingClientRect().left),
          noteWidth:Math.round(note.getBoundingClientRect().width),
          textWidth:noteText.getBoundingClientRect().width,
          transform:getComputedStyle(noteText).transform},
        detailRows:[...cell.querySelectorAll('.auto-last5-detail > div')].map(e=>e.textContent.trim()),
        numberStyles:[...cell.querySelectorAll('.auto-last5-number')].map(style),
        labelStyles:[...cell.querySelectorAll('.auto-last5-label')].map(style),
        track:track.textContent.trim(),trackStyle:style(track),
        link:cell.querySelector('a.auto-last5-link')?.href||'',
        width:Math.round(cell.getBoundingClientRect().width)
      };
    }))
  }));
  const expectedGrade=i=>i===0?'GⅡ':i===1?'普通':'SG';
  const expectedClass=i=>i===0?'grade-g2':i===1?'grade-normal':'grade-sg';
  const expectedRed=await page.evaluate(()=>{
    const sample=document.createElement('span');
    sample.style.color='var(--c-red)';
    document.body.appendChild(sample);
    const color=getComputedStyle(sample).color;
    sample.remove();
    return color;
  });
  const standardNumber=r=>r.numberStyles.every(z=>z.font==='12px'&&z.weight==='600'&&z.color==='rgb(48, 54, 59)');
  const standardLabel=r=>r.labelStyles.every(z=>z.font==='12px'&&z.weight==='400'&&z.color==='rgb(96, 107, 118)');
  const invalidLastFiveRows=lastFive.rows.length!==8||lastFive.rows.some((rs,i)=>{
    if(rs.length!==5)return true;
    const badCells=rs.some((r,j)=>{
      if(r.width!==220||!r.link.includes('autorace.jp/netstadium/RaceResult/')||
         !r.venue||!r.date||r.detailRows.length!==3)return true;
      if(r.gradeFont!=='12px'||r.metaAlign!=='left'||r.metaRows!=='16px 12px 12px'||
         r.metaInset!==6||r.metaWidth!==38||r.dateTextWidth>r.metaWidth+0.5||
         r.rankRect.x!==44||r.detailInset!==78||r.rankRect.top!==3||
         r.rankRect.width!==30||r.rankRect.height!==30||
         r.rankStyle.font!=='16px'||r.rankStyle.weight!=='600'||
         r.noteStyle.align!=='left'||r.noteStyle.x!==r.rankRect.x||
         r.noteStyle.noteWidth!==30||r.noteStyle.textWidth>30.5||
         r.noteStyle.color!==expectedRed)return true;
      if(!standardNumber(r)||!standardLabel(r)||
         r.trackStyle.font!=='12px'||r.trackStyle.weight!=='600'||
         r.trackStyle.color!=='rgb(48, 54, 59)'||!r.track)return true;
      if(j>=2&&(r.grade!==expectedGrade(i)||!r.gradeClass.includes(expectedClass(i))))return true;
      return false;
    });
    return badCells||rs[0].date!=='11/8'||rs[1].date!=='11/7'||rs[0].grade!=='普通';
  });
  if(JSON.stringify(lastFive.headings)!==JSON.stringify(['前走','2走前','3走前','4走前','5走前'])||
     lastFive.widths.some(x=>x!==220)||lastFive.headingFonts.some(x=>x!=='12px')||
     lastFive.headerBorders.some(([top,bottom])=>top!=='0px'||bottom!=='1px')||
     invalidLastFiveRows||
     lastFive.rows[0][0].detailRows.join('|')!=='5R予選|試走3.35H20良|競3.439ST0.22'||
     lastFive.rows[2][0].flag!=='戒'||
     lastFive.rows[2][2].rank!=='-'||lastFive.rows[2][2].flag!=='自落'||
     lastFive.rows[5][3].rank!=='-'||lastFive.rows[5][3].flag!=='不成立'||
     lastFive.rows[5][3].detailRows[2]!=='競不成立ST-'||
     lastFive.rows.some(rs=>rs.some(r=>r.labelStyles.length<4)))
    errorsNow.push('recent-five table 210-aligned insets/positions, row styles and abnormal results mismatch: '+JSON.stringify(lastFive));
    const awardState=await page.locator('.auto-race-table').evaluate(table=>{
    const h=table.tHead.rows[0].querySelector('th[data-group="titles"]');
    const cells=[...table.tBodies[0].rows].map(row=>{
      const td=row.querySelector('td.auto-titles-cell');
      const lines=[...td.querySelectorAll('.auto-titles-line')];
      return {contents:lines.map(x=>[...x.querySelectorAll('span')].map(n=>n.textContent.trim())),
        font:lines.map(x=>getComputedStyle(x).fontSize),
        weight:lines.map(x=>getComputedStyle(x).fontWeight),
        labels:lines.map(x=>{const c=getComputedStyle(x.querySelector('.auto-titles-label'));return {font:c.fontSize,color:c.color,weight:c.fontWeight};}),
        values:lines.map(x=>{const c=getComputedStyle(x.querySelector('.auto-titles-count'));return {font:c.fontSize,color:c.color,weight:c.fontWeight};}),
        align:[getComputedStyle(td).textAlign,...lines.map(x=>getComputedStyle(x).textAlign)],
        countAlign:lines.map(x=>getComputedStyle(x.querySelector('.auto-titles-count')).textAlign),
        left:lines.map(x=>x.querySelector('.auto-titles-label').getBoundingClientRect().left),
        numberLeft:lines.map(x=>x.querySelector('.auto-titles-count').getBoundingClientRect().left),
        numberRight:lines.map(x=>x.querySelector('.auto-titles-count').getBoundingClientRect().right),
        labelRight:lines.map(x=>x.querySelector('.auto-titles-label').getBoundingClientRect().right),
        width:Math.round(td.getBoundingClientRect().width),
        overflow:lines.some(x=>x.scrollWidth>x.clientWidth+1)
      };
    });
    return {header:h.textContent.trim(),rowSpan:h.rowSpan,headerWidth:Math.round(h.getBoundingClientRect().width),
      labels:[...document.querySelectorAll('.race-menu-scroll .info-tab')].map(x=>x.textContent.trim()),
      sheetCount:document.querySelectorAll('.sheet,.sheet-overlay,.auto-detail-button').length,
      lastCells:[...table.tBodies[0].rows].map(x=>x.cells.length),
      cells};
  });
  const expectedAwards=[[0,0,10],[3,0,0],[2,0,10],[4,0,20],[1,0,49],[6,1,33],[13,1,57],[10,1,71]];
  if(awardState.header!=='優出・優勝'||awardState.rowSpan!==2||awardState.headerWidth!==100||
     JSON.stringify(awardState.labels)!==JSON.stringify(['選手情報','直近10走','良10走','直近5レース出走表','直近90走','直近180日','優出・優勝'])||
     awardState.sheetCount!==0||awardState.lastCells.some(n=>n!==33)||
     awardState.cells.length!==8||
     awardState.cells.some((r,i)=>{
       const expected=[['今年優出',String(expectedAwards[i][0])],
         ['今年優勝',String(expectedAwards[i][1])],
         ['通算優勝',String(expectedAwards[i][2])]];
       return JSON.stringify(r.contents)!==JSON.stringify(expected)||
        r.font.some(x=>x!=='12px')||r.weight.some(x=>x!=='400')||
        r.labels.some(x=>x.font!=='12px'||x.color!=='rgb(96, 107, 118)'||x.weight!=='400')||
        r.values.some(x=>x.font!=='12px'||x.color!=='rgb(48, 54, 59)'||x.weight!=='400')||
        r.align.some(x=>x!=='left')||r.countAlign.some(x=>x!=='right')||
        r.width!==100||r.overflow||r.labelRight.some((x,k)=>x>r.numberLeft[k]+0.5)||
        Math.max(...r.numberRight)-Math.min(...r.numberRight)>0.5||
        Math.max(...r.left)-Math.min(...r.left)>0.5||
        Math.max(...r.numberLeft)-Math.min(...r.numberLeft)>0.5;
     }))
    errorsNow.push('award consolidation and removed analysis mismatch: '+JSON.stringify(awardState));
  const basicStats=await page.locator('.auto-race-table').evaluate(table=>{
    const head=[...table.tHead.rows[0].cells];
    const groups=['recent','good','last90'].map(k=>table.querySelector('thead th[data-group="'+k+'"]'));
    const second=[...table.tHead.rows[1].cells];
    const css=el=>{const v=getComputedStyle(el);return {font:v.fontSize,weight:v.fontWeight,color:v.color}};
    const result=[...table.tBodies[0].rows].map(row=>{
      const cells=[...row.querySelectorAll('td.auto-stat-cell')];
      return {recent:cells.slice(0,4).map(cell=>[cell.querySelector('.recent4-count')?.textContent,cell.querySelector('.recent4-rate')?.textContent]),
        last90:cells.slice(4,8).map(cell=>[cell.querySelector('.recent4-count')?.textContent,cell.querySelector('.recent4-rate')?.textContent])};
    });
    const first=table.tBodies[0].rows[0].querySelector('td.auto-stat-cell');
    return {
      menu:[...document.querySelectorAll('.race-menu-scroll .info-tab')].slice(0,5).map(el=>el.textContent.trim()),
      upperTitles:head.map(x=>x.textContent.trim()),
      upperSpan:groups.map(x=>x.rowSpan),
      roadHeaders:head.filter(x=>x.dataset.group==='road').map(x=>
       [...x.querySelectorAll('span')].map(y=>y.textContent.trim())),
      roadCells:[...table.tBodies[0].rows].map(row=>[...row.querySelectorAll('td.auto-road-cell')].map(x=>
       [x.querySelector('.recent4-count').textContent.trim(),x.querySelector('.recent4-rate').textContent.trim()])),
      labels:head.slice(8,15).concat(head.slice(20,24)).map(cell=>[...cell.querySelectorAll('span')].map(x=>x.textContent.trim())),
      statWidths:head.slice(8,12).concat(head.slice(20,24)).map(c=>Math.round(c.getBoundingClientRect().width)),
      headerHeight:Math.round(head[8].getBoundingClientRect().height),
      headerCss:css(head[8].querySelector('span')),
      countCss:css(first.querySelector('.recent4-count')),
      rateCss:css(first.querySelector('.recent4-rate')),
      rateGap:getComputedStyle(first.querySelector('.recent4-rate')).marginTop,
      result
    };
  });
  const expectedRoadHeaders=[
    ['良1着','勝率'],['良2着','2連対率'],['良3着','3連対率'],['良着外','着外率'],
    ['湿1着','勝率'],['湿2着','2連対率'],['湿3着','3連対率'],['湿着外','着外率']
  ];
  const expectedGood180=[[6,7,9,27],[4,14,7,26],[7,12,6,37],
    [7,9,13,29],[6,10,13,33],[9,11,3,32],[16,9,13,17],[22,7,6,13]];
  const expectedWet180=[[2,1,1,2],[9,2,5,2],[1,1,1,13],
    [0,2,0,8],[1,3,1,10],[1,3,3,7],[3,6,1,6],[2,3,5,3]];
  const expectedLabels=[
    ['1着','勝率'],['2着','2連対率'],['3着','3連対率'],['着外','着外率'],
    ['平均','試走T'],['平均','競走T'],['最高','競走T'],
    ['1着','勝率'],['2着','2連対率'],['3着','3連対率'],['着外','着外率']
  ];
  const expectedR10=[
    [1,4,1,4],[1,2,3,4],[2,1,0,6],[3,1,2,4],
    [1,2,1,6],[1,3,0,4],[0,1,3,6],[2,2,2,4]
  ],expectedR90=[
    [2,5,4,6],[8,8,9,17],[4,8,3,29],[6,3,5,24],
    [5,9,10,24],[3,5,3,28],[2,8,12,16],[8,6,9,12]
  ];
  const expectedRate=a=>{
    const n=a.reduce((x,v)=>x+v,0);
    const p=v=>n?Math.trunc(v*100/n)+'%':'—';
    return [p(a[0]),p(a[0]+a[1]),p(a[0]+a[1]+a[2]),p(a[3])];
  };
  if(JSON.stringify(basicStats.menu)!==JSON.stringify(['選手情報','直近10走','良10走','直近5レース出走表','直近90走'])||
     basicStats.upperTitles.some(t=>['直近10走','良10走','直近90走'].includes(t))||
     JSON.stringify(basicStats.upperSpan)!==JSON.stringify([2,2,2])||
     JSON.stringify(basicStats.labels)!==JSON.stringify(expectedLabels)||
     JSON.stringify(basicStats.statWidths)!==JSON.stringify(Array(8).fill(60))||
     JSON.stringify(basicStats.roadHeaders)!==JSON.stringify(expectedRoadHeaders)||
     basicStats.upperTitles.includes('近180日成績')||
     basicStats.roadCells.length!==8||
     basicStats.roadCells.some((cells,i)=>{
       const format=counts=>counts.map((n,j)=>[String(n),expectedRate(counts)[j]]);
       return JSON.stringify(cells)!==
         JSON.stringify([...format(expectedGood180[i]),...format(expectedWet180[i])]);
     })||
     basicStats.headerHeight!==48||
     basicStats.headerCss.font!=='12px'||basicStats.headerCss.weight!=='600'||
     basicStats.countCss.font!=='16px'||basicStats.countCss.weight!=='400'||
     basicStats.countCss.color!=='rgb(48, 54, 59)'||
     basicStats.rateCss.font!=='12px'||basicStats.rateCss.weight!=='400'||
     basicStats.rateCss.color!=='rgb(96, 107, 118)'||
     basicStats.rateGap!=='5px'||
     basicStats.result.some((r,i)=>JSON.stringify(r.recent)!==JSON.stringify(expectedR10[i].map((v,j)=>[String(v),expectedRate(expectedR10[i])[j]]))||
       JSON.stringify(r.last90)!==JSON.stringify(expectedR90[i].map((v,j)=>[String(v),expectedRate(expectedR90[i])[j]]))))
    errorsNow.push('recent/good/90-day two-line rows mismatch: '+JSON.stringify(basicStats));
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
        trial:row.querySelector('td.col-t[title="当日試走タイム"]')?.textContent.trim(),
        trialTitle:row.querySelector('td.col-t[title="当日試走タイム"]')?.getAttribute('title'),
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
  const keirinHeaderHeights=await comparison.locator('.mania-table').evaluate(table=>{
    const h=cell=>Math.round(cell.getBoundingClientRect().height);
    return {group:h(table.tHead.rows[0].querySelector('th.box-group')),
      sub:h(table.tHead.rows[1].cells[0]),
      span:h(table.tHead.rows[0].querySelector('th[rowspan="2"]'))};
  });
  await comparison.close();
  const autoHeaderHeights=await page.locator('.auto-race-table').evaluate(table=>{
    const h=cell=>Math.round(cell.getBoundingClientRect().height);
    return {span:h(table.tHead.rows[0].querySelector('th[rowspan="2"]')),
      lastSpan:h(table.tHead.rows[0].querySelector('th[data-group="titles"]')),
      bottomCells:table.tHead.rows[1].cells.length};
  });
  if(Math.abs(autoHeaderHeights.span-keirinHeaderHeights.span)>1||
     autoHeaderHeights.span!==48||autoHeaderHeights.lastSpan!==48||
     autoHeaderHeights.bottomCells!==0)
    errorsNow.push('header heights differ from 210: '+JSON.stringify({autoHeaderHeights,keirinHeaderHeights}));
  if(positions.rows.slice(0,4).some((v,i)=>Math.abs(v-reference[i])>0.6))
    errorsNow.push('first four rows differ from SCR-210: '+JSON.stringify({auto:positions.rows,keirin:reference}));
  if(positions.count!==2||Math.abs(positions.fifthHeight-29)>0.6||
    positions.heights.some(h=>Math.abs(h-14.4)>0.7)||positions.fit.some(x=>x.overflow>1))
    errorsNow.push('fifth-row content overflows/missing: '+JSON.stringify(positions));
  const borderGrid=await page.locator('.auto-race-table').evaluate(table=>{
    const measure=el=>{
      const c=getComputedStyle(el);
      return {top:c.borderTopWidth,right:c.borderRightWidth,bottom:c.borderBottomWidth,
        left:c.borderLeftWidth,topColor:c.borderTopColor,rightColor:c.borderRightColor,
        bottomColor:c.borderBottomColor,leftColor:c.borderLeftColor};
    };
    const invalid=[];
    const first=table.tHead.rows[0];
    for(const row of [...table.tHead.rows,...table.tBodies[0].rows]){
      const firstHead=row===first;
      for(const cell of row.cells){
        const actual=measure(cell);
        const expected={top:'0px',right:'1px',bottom:'1px',
          left:cell===row.cells[0]&&(firstHead||row.parentElement.tagName==='TBODY')?'1px':'0px'};
        for(const side of ['top','right','bottom','left'])
          if(actual[side]!==expected[side]||
            (expected[side]==='1px'&&actual[side+'Color']!=='rgb(210, 214, 218)'))
            if(invalid.length<8)invalid.push({section:row.parentElement.tagName,
              row:row.rowIndex,cell:cell.cellIndex,side,expected:expected[side],actual});
      }
    }
    return {total:table.querySelectorAll('thead th,tbody td').length,
      tableBorder:measure(table),invalid};
  });
  if(borderGrid.total!==297||borderGrid.invalid.length||
      ['top','right','bottom','left'].some(side=>borderGrid.tableBorder[side]!=='0px'))
    errorsNow.push('box-table single 1px grid / no duplicate header-top border mismatch: '+JSON.stringify(borderGrid));
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
  if(!canonical.staticCar||canonical.upperRows.some(x=>x!=='0px')||
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
    const live=document.querySelector('.shared-app-header .header-title-text');
    return {actual,expected,cols,selected:{color:activeCSS.color,background:activeCSS.backgroundColor},
      heading:{color:css.color,size:css.fontSize,weight:css.fontWeight},
      bodyColor:getComputedStyle(rows[0].querySelector('.auto-value')).color,
      bodyFont:getComputedStyle(rows[0].querySelector('.auto-value')).fontSize,
      titleFont:getComputedStyle(live).fontSize,
      legendFont:getComputedStyle(document.querySelector('.rt-legend dl dd')).fontSize,
      analysisButtons:root.querySelectorAll('.auto-detail-button').length};
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
     styles.analysisButtons!==0)
    errorsNow.push('common menu/table/jersey/analysis style mismatch: '+JSON.stringify(styles));
  if(errors.length)errorsNow.push('browser JS errors '+errors);
  await page.screenshot({path:path.join(folder,'SCR-310-'+width+'.png'),fullPage:true,animations:'disabled'});
  // A selected menu item must paint its entire (two-row) header area gold.
  for(const key of ['recent','good','last90','road','titles']){
    await page.locator('.race-menu-scroll .info-tab[data-target="'+key+'"]').click();
    const colors=await page.locator('.auto-race-table').evaluate((table,key)=>{
      const upper=[...table.tHead.rows[0].querySelectorAll('th[data-group="'+key+'"]')];
      const second=[...table.tHead.rows[1].cells];
      let offset=0,lower=[];
      for(const heading of table.tHead.rows[0].querySelectorAll('th.auto-section[data-group]')){
        if(heading.dataset.group===key)lower=second.slice(offset,offset+heading.colSpan);
        offset+=heading.colSpan;
      }
      const selected=[...upper,...lower];
      return {upper:upper.length,lower:lower.length,
        cells:selected.map(el=>({
          bg:getComputedStyle(el).backgroundColor,
          fg:getComputedStyle(el).color,
          selected:el.classList.contains('section-selected'),
          rowspan:el.rowSpan,
          height:Math.round(el.getBoundingClientRect().height)
        })),
        leftover:table.tHead.querySelectorAll('th.section-selected').length-selected.length
      };
    },key);
    const expectUpper={recent:4,good:3,last90:4,road:8,titles:1}[key];
    const expectLower={recent:0,good:0,last90:0,titles:0,road:0}[key];
    if(colors.upper!==expectUpper||colors.lower!==expectLower||colors.leftover!==0||
       colors.cells.some(v=>!v.selected||v.bg!=='rgb(114, 103, 49)'||
         v.fg!=='rgb(255, 255, 255)')||
       (expectLower===0&&colors.cells.some(v=>v.rowspan!==2||v.height!==48)))
      errorsNow.push(key+' both-row gold headers mismatch: '+JSON.stringify(colors));
  }
  // SCR-210 behavior: table scroll changes menu selection and scroll position;
  // menu click moves the table to that section.
  await page.locator('.race-menu-scroll .info-tab[data-target="player"]').click();
  await page.locator('.race-table-wrap').evaluate(el=>el.scrollLeft=0);
  await page.waitForTimeout(150);
  await page.locator('.race-table-wrap').evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
  await page.locator('.race-table-wrap').evaluate(el=>el.scrollLeft=1600);
  await page.waitForTimeout(350);
  const syncStatus=await page.evaluate(()=>{
    const active=document.querySelector('.race-menu-scroll .info-tab.active');
    const tabs=document.querySelector('.race-menu-scroll .hscroll-inner');
    const wrap=document.querySelector('.race-table-wrap');
    const visible=active?.getBoundingClientRect(),viewport=tabs.getBoundingClientRect();
    return {tab:active?.dataset.target,menuLeft:tabs.scrollLeft,menuMax:tabs.scrollWidth-tabs.clientWidth,
      tableLeft:wrap.scrollLeft,activeVisible:!!visible&&visible.left>=viewport.left-2&&visible.right<=viewport.right+2,
      selected:[...document.querySelectorAll('.auto-race-table thead th.section-selected')].length};
  });
  if(syncStatus.tableLeft<1100||!['last5','last90','road','titles'].includes(syncStatus.tab)||
     !syncStatus.activeVisible||syncStatus.selected===0)
    errorsNow.push('table scroll must sync selected menu and horizontal strip: '+JSON.stringify(syncStatus));
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

  await page.locator('.sort-power').click();
  const first=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(first!=='中村雅人')errorsNow.push('power sort failed: '+first);
  const firstTrial=await page.locator('.auto-race-table tbody tr').first().locator('td.col-t[title="当日試走タイム"]').innerText();
  if(firstTrial!=='3.68')errorsNow.push('trial time detached from rider after score sorting: '+firstTrial);
  await page.locator('.sort-power').click();
  const reset=await page.locator('.auto-race-table tbody .rider-name').first().innerText();
  if(reset!=='五十嵐一夫')errorsNow.push('power sort toggle failed to restore vehicle order');
  const resetTrials=await page.locator('.auto-race-table tbody tr').evaluateAll(rows=>rows.map(row=>row.querySelector('td.col-t[title="当日試走タイム"]')?.textContent.trim()));
  if(JSON.stringify(resetTrials)!==JSON.stringify(expectedDayTrials))
    errorsNow.push('trial times in vehicle order not restored: '+JSON.stringify(resetTrials));
  if(await page.locator('.auto-race-table .sort-car').count())
    errorsNow.push('車番 heading must not be a clickable sort control');
  console.log(width+'px result:',JSON.stringify(result),'UI errors:',JSON.stringify(errorsNow));
  problems.push(...errorsNow.map(x=>width+'px '+x));
 }catch(e){problems.push(width+'px exception '+e.message);console.error(e);}
 finally{await page.close();}
}
/* The width policy is managed in racecard-common.css and must match
   in SCR-210 too (including direct text and two-line span labels). */
for (const width of [296,375,768]) {
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 try {
  await page.goto(origin+'/SCR-210_racecardkeirin.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.race-menu-scroll .info-tab[data-target="mania"]',{timeout:8000});
  const measurements=await page.locator('.race-menu-scroll .info-tab').evaluateAll(tabs=>tabs.map(tab=>{
   const element=tab.querySelector('span');
   let rect;
   if(element)rect=element.getBoundingClientRect();
   else {
    const range=document.createRange();
    range.selectNodeContents(tab);
    rect=range.getBoundingClientRect();
   }
   const outer=tab.getBoundingClientRect();
   const styles=getComputedStyle(tab);
   return {
    label:tab.textContent.replace(/\s+/g,'').trim(),
    width:outer.width,
    glyphWidth:rect.width,
    left:rect.left-outer.left,
    right:outer.right-rect.right,
    paddingLeft:styles.paddingLeft,
    paddingRight:styles.paddingRight,
    minWidth:styles.minWidth
   };
  }));
  const expectedLabels=['選手情報','直近4ヵ月基本成績','直近7開催着順・タイム',
   '直近20走並び別成績','マル得ポイント','G指数','マニア分析'];
  const bad=measurements.length!==expectedLabels.length||measurements.some((tab,index)=>
    tab.label!==expectedLabels[index]||
    tab.paddingLeft!=='13px'||tab.paddingRight!=='13px'||tab.minWidth!=='0px'||
    Math.abs(tab.left-13)>0.8||Math.abs(tab.right-13)>0.8||
    Math.abs(tab.width-tab.glyphWidth-26)>1
  );
  if(bad)problems.push(width+'px SCR-210 shared menu width mismatch: '+JSON.stringify(measurements));
  else console.log(width+'px SCR-210 shared menu 13px each side PASSED',
    measurements.map(x=>Math.round(x.width)));
 }catch(e){problems.push(width+'px SCR-210 menu check exception '+e.message);}
 finally {await page.close();}
}
await browser.close();
if(problems.length){console.error('SCR-310 checks failed:',problems);process.exitCode=1;}
else console.log('SCR-310 shared UI / accurate 8 riders / awards / sorting checks PASSED');
