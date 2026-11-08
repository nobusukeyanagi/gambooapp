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
  'SCR-200_keirin.html',
  'SCR-300_autorace.html',
  'SCR-210_racecardkeirin.html',
  'SCR-310_racecardautorace.html',
  'SCR-500_mypage.html',
  'SCR-400_campaign.html',
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
      a.border !== 'rgb(151, 161, 170)' || a.borderWidth !== '1px' ||
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
      tabAppearance[0].color !== 'rgb(114, 109, 49)' ||
      tabAppearance[0].bottomColor !== 'rgb(114, 109, 49)' ||
      tabAppearance[1].color !== 'rgb(48, 54, 59)' ||
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
    return {status:el.dataset.status,font:cs.fontSize,weight:cs.fontWeight,
      color:cs.color,align:cs.textAlign,
      childColors:[...period.children].map(child=>getComputedStyle(child).color),
      centerOffset:Math.abs((p.left+p.right-b.left-b.right)/2)};
  }));
  if (deadlineStyles.length!==16 || deadlineStyles.some(s =>
       s.font !== '14px' || s.weight !== '600' ||
       s.color !== (s.status==='closed'?'rgb(96, 107, 118)':'rgb(184, 71, 99)') ||
       s.childColors.some(color=>color!==s.color) ||
       s.align !== 'center' || s.centerOffset > 1))
    fail(width + 'px active deadlines must be red and ended deadlines grey: '+
      JSON.stringify(deadlineStyles));
  const icon=await page.locator('.page-header .header-page-icon use').getAttribute('href');
  if (!icon?.endsWith('#nav-campaign')) fail(width + 'px campaign header SVG mismatch');
  await closed.click();
  if (!await pagination.isVisible() || await closed.getAttribute('aria-selected') !== 'true')
    fail(width + 'px archive pagination did not open');
  const closedTab=await closed.evaluate(el => ({
    color:getComputedStyle(el).color,border:getComputedStyle(el).borderBottomColor
  }));
  if (closedTab.color !== 'rgb(114, 109, 49)' ||
      closedTab.border !== 'rgb(114, 109, 49)')
    fail(width + 'px ended campaign date tab must have gold active underline: '+JSON.stringify(closedTab));
  const archiveValues = await cards.evaluateAll(els => els.filter(el => !el.hidden).map(el => ({
    status:el.dataset.status,color:getComputedStyle(el.querySelector('.cp-period')).color
  })));
  if (archiveValues.length !== 8 || archiveValues.some(item =>
      item.status !== 'closed' || item.color !== 'rgb(96, 107, 118)'))
    fail(width + 'px expected eight ended campaigns with grey deadlines: '+
      JSON.stringify(archiveValues));
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

// Bottom navigation is fixed even when sport content is reordered.
const fixedBottomNavHrefs=[
  './SCR-100_bet.html',
  './SCR-200_keirin.html',
  './SCR-300_autorace.html',
  './SCR-400_campaign.html',
  './SCR-500_mypage.html'
];
async function checkFixedBottomNav(page, context) {
  const navs=await page.locator('.bottom-tab').evaluateAll(items=>items.map(nav=>
    [...nav.querySelectorAll(':scope > a.tab-item')].map(a=>a.getAttribute('href'))));
  if(!navs.length || navs.some(links=>links.join('|')!==fixedBottomNavHrefs.join('|')))
    fail(context+' bottom navigation must stay in the fixed order: '+JSON.stringify(navs));
  const navColors=await page.locator('.bottom-tab a.tab-item').evaluateAll(items=>
    items.map(a=>({active:a.classList.contains('active'),
      label:getComputedStyle(a).color,
      icon:getComputedStyle(a.querySelector('.tab-icon .ic')).color})));
  if(navColors.length!==5 || navColors.some(x=>{
    const expected=x.active?'rgb(114, 109, 49)':'rgb(151, 161, 170)';
    return x.label!==expected||x.icon!==expected;
  }))
    fail(context+' inactive footer labels and icons must use lighter neutral: '+
      JSON.stringify(navColors));
}

async function checkMyPage(page, width) {
  // SCR-500 is a static prototype: athlete tiles display names; separate
  // "変更する" links open the editors. Do not require obsolete card links.
  const headings = await page.locator('.scroll-area .section-header > .section-title')
    .allTextContents();
  if (headings.map(v=>v.trim()).join('|') !==
      'マイ成績|推しメン登録|設定')
    fail(width+'px mypage section headings or order changed: '+headings);
  const sectionOrder=await page.locator('#mypage-results, #favorites-section')
    .evaluateAll(items=>items.map(el=>el.id));
  if(sectionOrder.join('|')!=='mypage-results|favorites-section' ||
      (await page.locator('.favorites-stack').getAttribute('aria-label'))!==
        '推しメン登録：競輪とオートレース')
    fail(width+'px mypage results must precede per-sport favorite headings: '+
      JSON.stringify(sectionOrder));
  // SCR-500 headings use natural spacing instead of decorative gold bars.
  const sectionSpacing=await page.locator('.scroll-area .section-header > .section-title')
    .evaluateAll(items=>items.map(label=>({
      pseudo:getComputedStyle(label,'::before').content,
      marginTop:getComputedStyle(label.parentElement).marginTop,
      fontSize:getComputedStyle(label).fontSize,
      fontWeight:getComputedStyle(label).fontWeight
    })));
  if(sectionSpacing.length!==3 || sectionSpacing.some(x=>
      !['none','normal'].includes(x.pseudo) || x.marginTop!=='8px' ||
      x.fontSize!=='20px' || x.fontWeight!=='600'))
    fail(width+'px SCR-500 headings should be bar-free with 8px leading separation: '+
      JSON.stringify(sectionSpacing));

  const userCardAccent=await page.locator('.user-card-top').evaluate(el=>{
    const st=getComputedStyle(el);
    return {color:st.borderTopColor,width:st.borderTopWidth};
  });
  if(userCardAccent.color!=='rgb(114, 109, 49)'||userCardAccent.width!=='3px')
    fail(width+'px user card top band must match solid gold accents: '+JSON.stringify(userCardAccent));
  const sportOrderIcon=await page.locator('.sport-order-toggle .menu-icon .ic use')
    .getAttribute('href');
  if(sportOrderIcon!=='#ic-swap-order' ||
      await page.locator('#ic-swap-order path[fill="none"][stroke="currentColor"]').count()!==1 ||
      await page.locator('#ic-edit').count()!==0)
    fail(width+'px sport display-order setting must use two-way swap arrows: '+sportOrderIcon);
  await checkFixedBottomNav(page,width+'px initial SCR-500');

  const avatar = page.locator('.user-avatar-photo');
  const loaded = await avatar.evaluate(el=>el.complete && el.naturalWidth===130 &&
    el.naturalHeight===130);
  if (!loaded) fail(width+'px user avatar not loaded');

  const profile = await page.locator('.user-card-actions a').evaluateAll(items =>
    items.map(el=>({name:el.textContent.trim(),href:el.getAttribute('href'),
      height:el.getBoundingClientRect().height})));
  if (profile.length!==2 || profile[0].name!=='会員情報' ||
      profile[0].href!=='https://gamboo.jp/member/' ||
      profile[1].name!=='プロフィール' ||
      profile[1].href!=='https://gamboo.jp/member/profile' ||
      profile.some(x=>x.height<44))
    fail(width+'px member/profile controls changed: '+JSON.stringify(profile));

  const points = await page.locator('.point-actions > a.point-action').evaluateAll(items =>
    items.map(el=>({href:el.getAttribute('href'),
      x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,
      width:el.getBoundingClientRect().width,
      height:el.getBoundingClientRect().height})));
  if (points.length!==7 || points.some(p=>!p.href?.startsWith('https://') || p.height<44) ||
      !(points[0].width > points[1].width*2) ||
      !(points[1].y===points[2].y && points[2].y===points[3].y) ||
      !(points[4].y===points[5].y && points[5].y===points[6].y))
    fail(width+'px point shortcuts must have one full-width and two three-column rows: '+
      JSON.stringify(points));

  const favoriteCard=await page.locator('.favorites-stack').evaluate(card=>{
    const style=getComputedStyle(card);
    return {bg:style.backgroundColor,border:style.borderTopWidth,radius:style.borderTopLeftRadius,
      sportBorders:[...card.querySelectorAll('.favorite-sport')].map(sport=>
        getComputedStyle(sport).borderTopWidth)};
  });
  if(favoriteCard.bg!=='rgb(255, 255, 255)'||favoriteCard.border!=='1px'||
     favoriteCard.radius!=='12px'||favoriteCard.sportBorders.join('|')!=='0px|1px')
    fail(width+'px favorites must be a single card with four sport groups: '+JSON.stringify(favoriteCard));

  const sports=await page.locator('.favorites-stack > .favorite-sport').evaluateAll(items=>
    items.map(sport=>({
      sport:sport.dataset.sport,
      headings:[...sport.querySelectorAll('.favorite-group-title')].map(label=>{
        const svg=label.querySelector('svg');
        const style=getComputedStyle(svg);
        const titleText=label.querySelector(':scope > span');
        const titleBox=label.getBoundingClientRect();
        const textBox=titleText?.getBoundingClientRect();
        const linkBox=label.closest('.favorite-group-heading')?.querySelector('.favorite-group-change')?.getBoundingClientRect();
        return {title:label.textContent.trim(),width:style.width,height:style.height,
          href:svg.querySelector('use')?.getAttribute('href'),color:style.color,
          noWrap:getComputedStyle(titleText).whiteSpace==='nowrap' &&
            textBox.height<=parseFloat(getComputedStyle(titleText).fontSize)*1.6 &&
            (linkBox?.left??0)>=titleBox.right-1};
      }),
      superCount:sport.querySelectorAll('.favorite-group--super .favorite-player-card').length,
      regularCount:sport.querySelectorAll('.favorite-group--regular .favorite-player-card').length,
      editors:[...sport.querySelectorAll('.favorite-group-change')].map(a=>a.getAttribute('href')),
      names:[...sport.querySelectorAll('.favorite-player-card')].map(card=>({
        name:card.querySelector('.favorite-player-name')?.textContent.trim(),
        affiliation:card.querySelector('.favorite-player-affiliation')?.textContent.trim(),
        tag:card.tagName,
        height:card.getBoundingClientRect().height
      }))
    })));
  if (sports.length!==2 || sports[0].sport!=='keirin'||sports[1].sport!=='auto'||
      sports[0].headings.map(h=>h.title).join('|')!=='競輪 激推しメン|競輪 推しメン'||
      sports[1].headings.map(h=>h.title).join('|')!=='オートレース 激推しメン|オートレース 推しメン'||
      sports[0].headings.some(h=>h.width!=='30px'||h.height!=='24px'||!h.noWrap||
        !h.href.endsWith('#nav-keirin')||h.color!=='rgb(71, 122, 148)')||
      sports[1].headings.some(h=>h.width!=='26px'||h.height!=='24px'||
        !h.href.endsWith('#nav-auto')||h.color!=='rgb(172, 96, 90)')||
      sports[0].superCount!==1||sports[0].regularCount!==10||
      sports[1].superCount!==1||sports[1].regularCount!==5||
      sports.some(s=>s.editors.length!==2 || s.editors.some(u=>!u?.startsWith('https://gamboo.jp/')) ||
        s.names.some(n=>n.tag!=='DIV'||!n.name||!n.affiliation||n.height<44)))
    fail(width+'px favorite-athlete groups or editor links changed: '+JSON.stringify(sports));
  const grids=await page.locator('.favorite-player-grid').evaluateAll(items=>items.map(el=>
    getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length));
  if(grids.some(n=>n!==3))fail(width+'px athlete tiles must use three columns: '+grids);

  const results=await page.locator('.mypage-result-actions a').evaluateAll(items=>
    items.map(el=>{
      const svg=el.querySelector('.mypage-result-icon');
      const style=getComputedStyle(svg);
      return {text:el.textContent.trim(),href:el.getAttribute('href'),
        height:el.getBoundingClientRect().height,
        iconWidth:style.width,iconHeight:style.height,
        iconColor:style.color,iconHref:svg.querySelector('use')?.getAttribute('href')};
    }));
  if(results.length!==2 || results[0].text!=='競輪'||
      results[0].href!=='https://gamboo.jp/member/achievement/keirin'||
      results[1].text!=='オートレース'||
      results[1].href!=='https://gamboo.jp/member/achievement/autorace'||
      results[0].iconWidth!=='30px'||results[0].iconHeight!=='24px'||
      results[1].iconWidth!=='26px'||results[1].iconHeight!=='24px'||
      !results[0].iconHref.endsWith('#nav-keirin')||
      !results[1].iconHref.endsWith('#nav-auto')||
      results.some(x=>x.height<44))
    fail(width+'px mypage race result links changed: '+JSON.stringify(results));

  const settings=await page.locator('.scroll-area > .menu-item')
    .evaluateAll(items=>items.map(el=>el.querySelector('.menu-text')?.textContent.trim()));
  if(settings.join('|')!=='競輪・オート表示順|メールアドレス変更|メールマガジン設定|パスワード変更|ログイン通知設定')
    fail(width+'px settings entries changed: '+JSON.stringify(settings));

  const toggle=page.locator('.sport-order-toggle');
  if(await toggle.getAttribute('aria-pressed')!=='false')
    fail(width+'px default sport order must prioritize keirin');
  await toggle.click();
  if(await toggle.getAttribute('aria-pressed')!=='true' ||
     (await page.locator('.favorites-stack > .favorite-sport').first().getAttribute('data-sport'))!=='auto' ||
     (await page.locator('.favorites-stack > .favorite-sport').first()
       .locator('.favorite-group-title').first().innerText()).trim()!=='オートレース 激推しメン')
    fail(width+'px sport-order toggle did not move auto heading together with its players');
  await checkFixedBottomNav(page,width+'px SCR-500 after auto-first toggle');
  await toggle.click();
  if(await toggle.getAttribute('aria-pressed')!=='false' ||
     (await page.locator('.favorites-stack > .favorite-sport').first().getAttribute('data-sport'))!=='keirin' ||
     (await page.locator('.favorites-stack > .favorite-sport').first()
       .locator('.favorite-group-title').first().innerText()).trim()!=='競輪 激推しメン')
    fail(width+'px sport-order toggle did not restore keirin heading with its players');
  await checkFixedBottomNav(page,width+'px SCR-500 after keirin-first toggle');

  if (await page.locator('.phone-inner > .status-bar').count())
    fail(width+'px simulated status bar remains');
  if (await page.locator('.phone-inner > .payout-bar.pt-h').count()!==1)
    fail(width+'px mypage payout controls missing');
  console.log('MYPAGE OK '+width+'px (7 points, 2 sports, 3-column favorites, 2 results, settings)');
}

async function checkCompactSectionHeader(page,width,file) {
  if(file==='index.html')return;
  const header=page.locator('.phone-inner > .shared-app-header');
  if(await header.count()!==1)
    return fail(file+' '+width+'px must use canonical shared header');
  const names={
    'SCR-100_bet.html':['車券購入','nav-ticket'],
    'SCR-200_keirin.html':['競輪予想','nav-keirin'],
    'SCR-300_autorace.html':['オートレース予想','nav-auto'],
    'SCR-210_racecardkeirin.html':['競輪予想',null],
    'SCR-310_racecardautorace.html':['川口 2日目',null],
    'SCR-500_mypage.html':['マイページ','nav-mypage'],
    'SCR-400_campaign.html':['キャンペーン','nav-campaign']
  };
  const expected=names[file];
  if(!expected)return;
  const data=await header.evaluate(el=>{
    const headerRect=el.getBoundingClientRect();
    const label=el.querySelector('.header-title-text').getBoundingClientRect();
    const title=el.querySelector('.page-header-title'), rect=title.getBoundingClientRect();
    const controls=[...el.querySelectorAll('.header-actions > *')].map(btn=>{
      const r=btn.getBoundingClientRect(),s=getComputedStyle(btn);
      return {name:btn.textContent.trim(),x:r.left,right:r.right,w:r.width,h:r.height,
        font:s.fontSize,weight:s.fontWeight,icon:btn.querySelector('use')?.getAttribute('href'),
        iconWidth:btn.querySelector('svg')?.getBoundingClientRect().width,
        iconColor:getComputedStyle(btn.querySelector('svg')).color,
        borderWidth:s.borderTopWidth,borderColor:s.borderTopColor,
        bg:s.backgroundColor,paddingLeft:s.paddingLeft};
    });
    return {height:headerRect.height,left:headerRect.left,right:headerRect.right,
      title:title.textContent.trim(),titleX:rect.left,titleRight:rect.right,titleTextX:label.x,
      font:getComputedStyle(title).fontSize,weight:getComputedStyle(title).fontWeight,
      titleIcon:title.querySelector('use')?.getAttribute('href')||null,
      back:!!el.querySelector('.back-btn'),controls};
  });
  const [bell,deposit]=data.controls;
  const labelColor=await header.locator('.header-notification').evaluate(el=>getComputedStyle(el).color);
  if(data.height!==50 || data.title!==expected[0] || data.font!=='18px' ||
     data.weight!=='600' || data.back!==!expected[1] ||
     (expected[1] ? !data.titleIcon?.endsWith('#'+expected[1]) : !!data.titleIcon) ||
     data.controls.length!==2 || bell.name!=='通知' || deposit.name!=='入金' ||
     !bell.icon?.endsWith('#header-bell') || !deposit.icon?.endsWith('#header-card') ||
     data.controls.some(x=>x.h!==40||x.w<80||x.font!=='14px'||x.weight!=='600') ||
     bell.iconWidth!==20 || deposit.iconWidth!==18 ||
     bell.borderWidth!=='1px'||bell.borderColor!=='rgb(151, 161, 170)'||
     bell.paddingLeft!=='8px'||deposit.paddingLeft!=='10px' ||
     deposit.borderWidth!=='0px'||deposit.bg!=='rgb(49, 119, 114)' ||
     Math.abs(data.titleTextX-53)>1 ||
     bell.iconColor!=='rgb(48, 54, 59)' ||
     labelColor!=='rgb(48, 54, 59)' ||
     data.titleX<data.left-1 || data.titleRight>bell.x+1 ||
     bell.right>deposit.x || deposit.right>data.right+1)
    fail(file+' '+width+'px canonical header title/buttons differ: '+JSON.stringify(data));
  if(await page.locator('.phone-inner > .status-bar').count())
    fail(file+' '+width+'px simulated status bar remains');
  const navFonts=await page.locator('.bottom-tab a.tab-item').evaluateAll(nodes=>
    nodes.map(el=>getComputedStyle(el).fontWeight));
  if(navFonts.length!==5 ||navFonts.some(x=>x!=='600'))
    fail(file+' '+width+'px bottom nav must use shared 600 weight on every page: '+navFonts);

}

async function checkNavPredictionLinks(page, width, file) {
  const navs = page.locator(".bottom-tab");
  const count = await navs.count();
  if (!count) {
    fail(file + " " + width + "px missing bottom navigation");
    return;
  }
  await checkFixedBottomNav(page,file+' '+width+'px');
  for (let i = 0; i < count; i++) {
    const nav = navs.nth(i);
    const keirin = nav.locator('a.tab-item[href="./SCR-200_keirin.html"]');
    const auto = nav.locator('a.tab-item[href="./SCR-300_autorace.html"]');
    if (await keirin.count() !== 1 || await auto.count() !== 1) {
      fail(file + " " + width + "px missing prediction tab link");
      continue;
    }
    if ((await keirin.innerText()).trim() !== "競輪予想") fail(file + " keirin tab label mismatch");
    if ((await auto.innerText()).trim() !== "オート予想") fail(file + " autorace tab label mismatch");
  }
  if (width !== 296) return;
  const keirinLink = navs.first().locator('a.tab-item[href="./SCR-200_keirin.html"]');
  await keirinLink.click();
  if (new URL(page.url()).pathname.split("/").pop() !== "SCR-200_keirin.html")
    fail(file + " keirin tab did not navigate");
  const autoLink = page.locator(".bottom-tab").first().locator('a.tab-item[href="./SCR-300_autorace.html"]');
  await autoLink.click();
  if (new URL(page.url()).pathname.split("/").pop() !== "SCR-300_autorace.html")
    fail(file + " autorace tab did not navigate");
  console.log("BOTTOM NAV OK " + file + " " + width + "px");
}

/* SCR-210/310 share exactly the same race selection component and arrows. */
async function checkSharedRaceSelector(page, width, isAuto) {
  const selector=page.locator('.phone-inner .race-selector');
  if(await selector.count()!==1)
    fail(width+'px shared race selector missing or duplicated');
  const detail=await selector.evaluate(bar=>{
    const selected=bar.querySelector('.race-tab.active');
    const first=bar.querySelector('.race-tab');
    const past=bar.querySelector('.race-tab.past');
    const canceled=bar.querySelector('.race-tab.canceled');
    const get=(el)=>el?getComputedStyle(el):null;
    const scroll=bar.querySelector('.hscroll-inner');
    return {
      height:bar.getBoundingClientRect().height,
      tabWidth:first?.getBoundingClientRect().width,
      tabHeight:first?.getBoundingClientRect().height,
      font:get(first?.querySelector('b'))?.fontSize,
      smallFont:get(first?.querySelector('small'))?.fontSize,
      tabs:bar.querySelectorAll('.race-tab').length,
      selected: selected?.dataset.race,
      activeBackground:get(selected)?.backgroundColor,
      activeNumber:get(selected?.querySelector('b'))?.color,
      activeSmall:get(selected?.querySelector('small'))?.color,
      activeBorder:get(selected)?.borderTopColor,
      pastBg:get(past)?.backgroundColor,
      pastSmall:get(past?.querySelector('small'))?.color,
      canceledBg:get(canceled)?.backgroundColor,
      canceledNumber:get(canceled?.querySelector('b'))?.color,
      arrows:[...bar.querySelectorAll(':scope > .hscroll-cue-l, :scope > .hscroll-cue')].map(a=>({
        tag:a.tagName,width:get(a)?.width,enabled:!a.disabled
      })),
      hasOverflow:scroll.scrollWidth>scroll.clientWidth+2,
      races:[...bar.querySelectorAll('.race-tab')].map(el=>({
        number:Number(el.querySelector('b')?.textContent.replace('R','')),
        id:Number(el.dataset.race)
      }))
    };
  });
  const expected=isAuto?8:12;
  if(detail.height!==58 || detail.tabWidth!==62 || detail.tabHeight!==46 ||
     detail.font!=='16px'||detail.smallFont!=='12px'||
     detail.tabs!==expected || detail.selected!==(isAuto?'3':'5') ||
     detail.activeBackground!=='rgb(114, 109, 49)' ||
     detail.activeNumber!=='rgb(255, 255, 255)' ||
     detail.activeSmall!=='rgb(255, 255, 255)' ||
     detail.activeBorder!=='rgb(184, 71, 99)' ||
     detail.pastBg!=='rgb(248, 247, 244)' ||
     detail.pastSmall!=='rgb(48, 54, 59)' ||
     detail.arrows.length!==2||detail.arrows.some(a=>a.tag!=='BUTTON'||a.width!=='44px')||
     (width<768 && !detail.hasOverflow) ||
     detail.races.some((r,i)=>r.number!==i+1||r.id!==i+1) ||
     (isAuto && (detail.canceledBg!=='rgb(210, 214, 218)' ||
      detail.canceledNumber!=='rgb(48, 54, 59)')))
    fail(width+'px SCR-210/310 race selection designs must match: '+JSON.stringify(detail));
  const scroll=selector.locator('.hscroll-inner');
  if(detail.hasOverflow) {
    await scroll.evaluate(el=>{el.scrollLeft=0;el.dispatchEvent(new Event('scroll'));});
    await page.waitForFunction(()=>!document.querySelector('.race-selector > .hscroll-cue-l:not([hidden])'));
    await selector.locator(':scope > .hscroll-cue').click();
    await page.waitForFunction(()=>{
      const el=document.querySelector('.race-selector > .hscroll-inner');
      return el.scrollLeft>=el.scrollWidth-el.clientWidth-2;
    },null,{timeout:6000});
    await selector.locator(':scope > .hscroll-cue-l').click();
    await page.waitForFunction(()=>{
      const el=document.querySelector('.race-selector > .hscroll-inner');
      return el.scrollLeft<=2;
    },null,{timeout:6000});
  } else {
    const hidden=await selector.locator(':scope > .hscroll-cue-l, :scope > .hscroll-cue')
      .evaluateAll(arrows=>arrows.map(a=>a.hidden));
    if(hidden.length!==2 || hidden.some(v=>!v))
      fail(width+'px no-overflow selector must hide both arrows: '+JSON.stringify(hidden));
  }
}

async function checkKeirinRaceInformation(page, width) {
  const result=await page.locator('.race-detail-scroll .race-info-bar.ri-has-act').evaluate(bar=>{
    const grid=bar.querySelector('.ri-main');
    const fourth=bar.querySelector('.race-info-meta');
    const countdown=fourth.querySelector('.race-countdown');
    const date=bar.querySelector('.ri-date-line');
    const purchase=bar.querySelector('.ri-race-purchase');
    const live=bar.querySelector('.ri-btn.live');
    const day=bar.querySelector('.ri-day');
    const actions=bar.querySelector('.ri-actions');
    const rect=el=>el.getBoundingClientRect();
    const gridStyle=getComputedStyle(grid);
    return {
      height:rect(bar).height,
      gap:gridStyle.rowGap,
      rows:gridStyle.gridTemplateRows.split(' ').length,
      padding:getComputedStyle(bar).paddingTop,
      purchaseHeight:rect(purchase).height,
      actionGap:getComputedStyle(actions).gap,
      buttonGap:rect(live).top-rect(purchase).bottom,
      dayFont:getComputedStyle(day).fontSize,
      dayWeight:getComputedStyle(day).fontWeight,
      third:bar.querySelector('.ri-kind')?.textContent.trim(),
      fourth:[...fourth.children].map(x=>x.textContent.trim()),
      countdownText:countdown?.textContent.trim(),
      deadlineFullwidthSpace:fourth.children[1]?.textContent.startsWith('　'),
      countdownFullwidthSpace:countdown?.textContent.startsWith('　'),
      countdownLast:countdown===fourth.lastElementChild,
      countdownColor:getComputedStyle(countdown).color,
      fourthFits:fourth.scrollWidth<=fourth.clientWidth+1,
      date:date.querySelector('.ri-date')?.textContent,
      distance:date.querySelector('.ri-sub')?.textContent,
      dateGap:getComputedStyle(date).gap
    };
  });
  if(result.height>132 || result.height<100 ||
     result.gap!=='2px'||result.rows!==5||
     result.padding!=='6px'||result.purchaseHeight!==52||
     result.actionGap!=='8px'||Math.abs(result.buttonGap-8)>0.5||
     result.dayFont!=='12px'||result.dayWeight!=='400'||
     result.third!=='Ｓ級 選抜'||
     result.fourth.join('|')!=='発走 12:57|BET締切 12:52|22分前'||
     !result.countdownLast || result.countdownText!=='22分前'||
     !result.deadlineFullwidthSpace || !result.countdownFullwidthSpace ||
     result.countdownColor!=='rgb(184, 71, 99)'||
     !result.fourthFits ||
     result.date!=='2026/11/03' ||
     result.distance!=='2015m(6周)' || result.dateGap!=='12px')
    fail(width+'px SCR-210 condensed 5-line race information mismatch: '+JSON.stringify(result));
}

async function checkKeirinMania(page, width) {
  const wrap = page.locator(".race-table-wrap");
  const table = wrap.locator("table.mania-table");
  const raceTab = page.locator('.info-tab[data-target="player"]');
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
  // Manual gestures release the held menu selection before scroll-sync resumes.
  await wrap.dispatchEvent('pointerdown');
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
  if (dayColors.some(item => item.color !== (item.active ? 'rgb(114, 109, 49)' : 'rgb(48, 54, 59)')))
    fail(width + 'px date tabs must use dark unselected text and gold active text');
  const raceWeights = await page.locator('.venue-card .rchip:not(.canceled) > b, .venue-card .rchip > small')
    .evaluateAll(nodes => [...new Set(nodes.map(n => getComputedStyle(n).fontWeight))]);
  if (raceWeights.some(weight => weight !== '600'))
    fail(width + 'px race button fonts must be 600: ' + raceWeights.join(','));
  const canceledStyles=await page.locator('.venue-card .rchip.canceled').evaluateAll(items=>
    items.map(chip=>({bg:getComputedStyle(chip).backgroundColor,
      border:getComputedStyle(chip).borderTopColor,
      number:getComputedStyle(chip.querySelector('b')).color,
      status:getComputedStyle(chip.querySelector('small')).color})));
  if(canceledStyles.some(x=>x.bg!=='rgb(210, 214, 218)' ||
      x.border!=='rgb(210, 214, 218)' ||
      x.number!=='rgb(48, 54, 59)' ||
      x.status!=='rgb(48, 54, 59)'))
    fail(width+'px canceled race button colors must be consistent: '+JSON.stringify(canceledStyles));
  // Action buttons use the visible control boundary; cards use the lighter
  // passive border. Urgent/canceled states retain their semantic exceptions.
  // Every race button retains the canonical subtle shadow.
  const raceStyles = await page.locator('.venue-card .rchip').evaluateAll(nodes =>
    nodes.map(n => ({
      classes:n.className,
      hasRebate:!!n.querySelector(':scope > .rchip-rebate'),
      background:getComputedStyle(n).backgroundColor,
      border:getComputedStyle(n).borderTopColor,
      borderWidth:getComputedStyle(n).borderTopWidth,
      shadow:getComputedStyle(n).boxShadow
    })));
  if (!raceStyles.length) fail(width + 'px race button styles missing');
  for (const st of raceStyles) {
    if (st.shadow === 'none') fail(width + 'px race button missing shadow: ' + st.classes);
    if (st.classes.includes('canceled') || st.classes.includes('soon')) continue;
    const expectedBorder=st.hasRebate?'rgb(114, 109, 49)':'rgb(151, 161, 170)';
    const expectedWidth=st.hasRebate?'3px':'1px';
    if(st.border!==expectedBorder || st.borderWidth!==expectedWidth)
      fail(width + 'px rebate buttons need gold 3px borders; other actions use grey 1px: '+
        JSON.stringify(st));
  }
  const sortBorders = await page.locator('.venue-sort-options .chip:not(.active)')
    .evaluateAll(nodes => nodes.map(n => getComputedStyle(n).borderTopColor));
  if (sortBorders.some(c => c !== 'rgb(151, 161, 170)'))
    fail(width + 'px inactive sort buttons must use the control border');
  // Regression of 3px urgent border, 44px arrow target and 14px sort label.
  const warningLabels = await page.locator('.venue-card .rchip.next.soon .rchip-warning')
    .evaluateAll(nodes => nodes.map(label => {
      const chip=label.closest('.rchip');
      const style=getComputedStyle(label);
      const box=label.getBoundingClientRect();
      const bounds=chip.getBoundingClientRect();
      return {
        text:label.textContent.trim(),
        aria:label.getAttribute('aria-label'),
        row:style.gridRowStart,
        width:box.width,
        height:box.height,
        font:style.fontSize,
        weight:style.fontWeight,
        color:style.color,
        background:style.backgroundColor,
        square:style.borderRadius,
        centerOffset:Math.abs((box.left+box.right-bounds.left-bounds.right)/2),
        topInset:box.top-bounds.top,
        leftInset:box.left-bounds.left,
        rightInset:bounds.right-box.right,
        border:getComputedStyle(chip).borderTopWidth
      };
    }));
  if (!warningLabels.length || warningLabels.some(w =>
    !/^[0-9]+分前$/.test(w.text) || w.aria !== '締切'+w.text ||
    w.row !== 'auto' || w.font !== '12px' || w.weight !== '600' ||
    w.color !== 'rgb(255, 255, 255)' || w.background !== 'rgb(184, 71, 99)' ||
    w.height !== 18 || w.width >= 90 || w.width < 80 ||
    Math.abs(w.topInset-parseFloat(w.border)) > 1 ||
    Math.abs(w.leftInset-parseFloat(w.border)) > 1 ||
    Math.abs(w.rightInset-parseFloat(w.border)) > 1 ||
    w.centerOffset > 1))
    fail(width + 'px urgent first-row red band must display white 13分前: '+
      JSON.stringify(warningLabels));
  const urgent = await page.locator('.venue-card .rchip.next.soon').evaluateAll(nodes =>
    nodes.map(el => ({width:getComputedStyle(el).borderTopWidth,color:getComputedStyle(el).borderTopColor,
      boxWidth:el.getBoundingClientRect().width})));
  if (urgent.some(s => s.width !== '3px' || s.color !== 'rgb(184, 71, 99)' ||
     s.boxWidth !== 90))
    fail(width + 'px urgent button border or canonical width mismatch: ' + JSON.stringify(urgent));
  if (!isAutorace) {
    const canceled=await page.locator('.venue-card[data-venue="青森"] .rchip[data-demo-canceled]')
      .evaluateAll(nodes=>nodes.map(chip=>({
        race:chip.querySelector('b')?.textContent, status:chip.querySelector('small')?.textContent,
        tag:chip.tagName, noLink:!chip.hasAttribute('href'),
        color:getComputedStyle(chip).color,
        raceColor:getComputedStyle(chip.querySelector('b')).color,
        statusColor:getComputedStyle(chip.querySelector('small')).color,
        bg:getComputedStyle(chip).backgroundColor,
        border:getComputedStyle(chip).borderTopColor
      })));
    if(canceled.length!==1 || canceled[0].race!=='6R' ||
       canceled[0].status!=='中止' || canceled[0].tag!=='A' ||
       canceled[0].noLink ||
       canceled[0].bg!=='rgb(210, 214, 218)'||
       canceled[0].border!=='rgb(210, 214, 218)'||
       canceled[0].color!=='rgb(48, 54, 59)'||
       canceled[0].raceColor!=='rgb(48, 54, 59)'||
       canceled[0].statusColor!=='rgb(48, 54, 59)')
      fail(width+'px Nov 3 Aomori 6R must use light grey fill and primary race/status text: '+
        JSON.stringify(canceled));
  }
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
    if(sg.length!==1 || sg[0].name!=='SG' || sg[0].color!=='rgb(170, 70, 162)')
      fail(width+'px auto SG grade badge must be black: '+JSON.stringify(sg));
  }
  const raceLinks = page.locator('.venue-card a.rchip');
  if (!await raceLinks.count()) fail(width + 'px linked race buttons missing');
  if (!/SCR-(210|310)_racecard/.test(await raceLinks.first().getAttribute('href')))
    fail(width + 'px race button destination invalid');
  // Every genuine final (keirin 決勝 or auto 優勝戦) has the exact shared
  // bottom-navigation campaign symbol, including races already completed.
  // Semifinals must not inherit that icon.
  const finalIcons = await page.locator('.venue-card .rchip[data-race-type]').evaluateAll(nodes =>
    nodes.map(chip => {
      const type=chip.dataset.raceType;
      const isFinal=(type.endsWith('決勝') && !type.includes('準決勝')) || type==='優勝戦';
       const eligible=location.pathname.includes('autorace') ?
         chip.closest('.venue-card')?.dataset.venue==='浜松' : isFinal;
      const row=chip.querySelector('.rchip-bottom-icons');
      const icons=[...(row?.querySelectorAll(':scope > .rchip-bottom-icon') || [])];
      const campaigns=icons.filter(icon=>icon.classList.contains('rchip-campaign'));
      const svg=campaigns[0]?.querySelector('svg.rchip-campaign-icon');
      const svgStyle=svg ? getComputedStyle(svg) : null;
      const rowBox=row?.getBoundingClientRect();
      return {type,isFinal,eligible,count:campaigns.length,
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
      const gift=!!chip.querySelector('.rchip-campaign');
      const band=chip.querySelector(':scope > .rchip-rebate');
      const st=band?getComputedStyle(band):null;
      const border=getComputedStyle(chip);
      const rect=band?.getBoundingClientRect();
      const box=chip.getBoundingClientRect();
      return {gift,count:chip.querySelectorAll(':scope > .rchip-rebate').length,
        text:band?.textContent.trim(),background:st?.backgroundColor,color:st?.color,
        font:st?.fontSize,weight:st?.fontWeight,position:st?.position,
        height:rect?.height,display:st?.display,warning:!!chip.querySelector('.rchip-warning'),
        border:border.borderTopColor,
        borderWidth:border.borderTopWidth,
        inset:rect?{top:rect.top-box.top,left:rect.left-box.left,
          right:box.right-rect.right}:null,
        centered:rect?Math.abs(rect.left+rect.right-box.left-box.right)/2:null};
    }));
  if(topRebates.some(x=>x.count!==(x.gift?1:0) ||
      (x.gift && (x.text!=='5%還元' ||
        (x.warning ?
          (x.display!=='none' || x.border!=='rgb(184, 71, 99)') :
          (x.background!=='rgb(114, 109, 49)' || x.color!=='rgb(255, 255, 255)' ||
           x.font!=='12px' || x.weight!=='600' || x.position!=='absolute' ||
           x.height!==18 || x.border!=='rgb(114, 109, 49)' ||
           x.borderWidth!=='3px' || x.centered>1 ||
           Math.abs(x.inset.top-3)>1 || Math.abs(x.inset.left-3)>1 ||
           Math.abs(x.inset.right-3)>1))))))
    fail(width+'px Gamboo promotional band priority/geometry invalid: '+
      JSON.stringify(topRebates.filter(x=>x.gift||x.count)));
  // Temporary DOM-only warning fixture: urgent text must hide the 5% rebate.
  const countdownPriority=await page.locator('.rchip:has(.rchip-campaign)').first().evaluate(chip=>{
    const rebate=chip.querySelector('.rchip-rebate');
    const gift=chip.querySelector('.rchip-campaign');
    const goldBorder=getComputedStyle(chip).borderTopColor;
    const warning=document.createElement('span');
    warning.className='rchip-warning';
    warning.textContent='5分前';
    chip.classList.add('next','soon');
    chip.prepend(warning);
    const hidden=getComputedStyle(rebate).display==='none';
    const styles=getComputedStyle(warning);
    const shown=styles.display!=='none' && styles.backgroundColor==='rgb(184, 71, 99)' &&
      styles.color==='rgb(255, 255, 255)' && styles.position==='absolute';
    const redBorder=getComputedStyle(chip).borderTopColor;
    const giftVisible=getComputedStyle(gift).display!=='none' &&
      getComputedStyle(gift.parentElement).gridRowStart==='4';
    warning.remove();
    chip.classList.remove('next','soon');
    return {goldBorder,redBorder,hidden,shown,giftVisible,
      restored:getComputedStyle(rebate).display!=='none'};
  });
  if(countdownPriority.goldBorder!=='rgb(114, 109, 49)' ||
      countdownPriority.redBorder!=='rgb(184, 71, 99)' ||
      !countdownPriority.giftVisible ||
      !countdownPriority.hidden || !countdownPriority.shown || !countdownPriority.restored)
    fail(width+'px urgent countdown must replace gold frame/band while retaining gift: '+
      JSON.stringify(countdownPriority));
  const expectedPromotions=isAutorace?12:5;
  if (finalIcons.filter(r=>r.eligible).length !== expectedPromotions ||
      finalIcons.some(r=>r.count !== (r.eligible?1:0)) ||
      finalIcons.filter(r=>r.eligible).some(r=>
        !r.source?.endsWith('#nav-campaign') ||
        r.color !== 'rgb(114, 109, 49)' || r.width !== '16px' || r.height !== '16px' ||
        !r.fits || r.centered > 1 ||
        r.iconOrder.join('|') !== r.iconOrder.slice().sort(
          (a,b)=>['girls','campaign','featured'].indexOf(a)-
            ['girls','campaign','featured'].indexOf(b)).join('|')))
    fail(width+'px Gamboo SG races and keirin finals need gift icons: '+
      JSON.stringify(finalIcons.filter(r=>r.eligible || r.count)));
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
  // All heading fields occupy one line. The rebate must sit at the right edge.
  const headers=await page.locator('.venue-card .venue-header').evaluateAll(nodes=>
    nodes.map(header=>{
      const line=header.querySelector(':scope > .venue-header-line');
      const title=line?.querySelector(':scope > .venue-title');
      const badge=line?.querySelector(':scope > .grade-badge');
      const name=title?.querySelector('.venue-name');
      const meta=title?.querySelector('.venue-meta');
      const day=meta?.querySelector('.venue-day');
      const heart=meta?.querySelector('.venue-girls');
      const logo=line?.querySelector(':scope > .rebate-logo');
      const label=logo?.querySelector('.rebate-label');
      const hb=header.getBoundingClientRect();
      const lb=line?.getBoundingClientRect();
      const nb=name?.getBoundingClientRect();
      const mb=meta?.getBoundingClientRect();
      const db=day?.getBoundingClientRect();
      const rb=logo?.getBoundingClientRect();
      const boxes=[badge,name,meta,day,heart,logo].filter(Boolean)
        .map(el=>el.getBoundingClientRect());
      const style=getComputedStyle(header);
      const paddingRight=parseFloat(style.paddingRight);
      const available=header.clientWidth-parseFloat(style.paddingLeft)-paddingRight;
      const scale=Number(header.dataset.fitScale);
      return {venue:header.closest('.venue-card').dataset.venue,
        title:!!title,badge:!!badge,name:!!name,
        day:day?.textContent?.trim(),
        dayColor:day?getComputedStyle(day).color:null,
        sessionColor:meta?getComputedStyle(meta).color:null,
        label:logo?.textContent?.trim(),hasLogo:!!logo,
        symbol:logo?.querySelector('use')?.getAttribute('href'),
        logoColor:logo?getComputedStyle(logo).color:null,
        logoSingle:!label||getComputedStyle(label).flexDirection==='row',
        dayRight:!!db&&!!nb&&db.left>=nb.right-1,
        allOneLine:!!nb&&boxes.every(box=>
          Math.abs((box.top+box.bottom-nb.top-nb.bottom)/2)<=6),
        nowrap:meta?getComputedStyle(meta).whiteSpace==='nowrap':false,
        fits:!!lb&&lb.left>=hb.left-1&&lb.right<=hb.right-1 &&
          (!mb||mb.right<=lb.right+1),
        rightAligned:!rb||Math.abs(rb.right-(hb.right-paddingRight))<=2,
        scaleOk:!!line&&Number.isFinite(scale)&&scale>0&&scale<=1.001&&
          line.scrollWidth*scale<=available+2
      };
    }));
  if(headers.length!==(isAutorace?2:8)||headers.some(h=>
      !h.title||!h.badge||!h.name||!h.day||!h.dayRight||
      h.dayColor!=='rgb(94, 105, 115)' ||
      h.sessionColor!=='rgb(48, 54, 59)' ||
      !h.allOneLine||!h.nowrap||!h.fits||!h.rightAligned||
      !h.logoSingle||!h.scaleOk))
    fail(width+'px heading must fit grade, venue, day, session, Girls and right rebate in one line: '+
      JSON.stringify(headers));
  if (!isAutorace) {
    const eligible=new Set(['防府','久留米','小田原']);
    if(headers.some(h=>eligible.has(h.venue)
       ? !h.hasLogo||h.label!=='決勝5%還元'||
         !h.symbol?.endsWith('#nav-campaign')||
         h.logoColor!=='rgb(114, 109, 49)'||h.day!=='最終日'
       : h.hasLogo))
      fail(width+'px keirin three rebate venues must have right-aligned icon: '+
        JSON.stringify(headers));
  } else {
    if(headers.some(h=>h.venue==='浜松'
       ? !h.hasLogo||h.label!=='5%還元'||
         !h.symbol?.endsWith('#nav-campaign')||
         h.logoColor!=='rgb(114, 109, 49)'
       : h.hasLogo))
      fail(width+'px autorace SG venue refund must be right-aligned: '+
        JSON.stringify(headers));
  }
  if (!isAutorace) {
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
  // 11/2 and 11/4: verified venues, grades, race counts and one-direction
  // tab switching. No speculative riders, race start times or detail links.
  const dateTabs=page.locator('.phone-inner > .date-tabs [data-date]');
  const expectedSchedules=isAutorace?{
    '2026-11-02':{
      '浜松':['SG','5日目',12],'川口':['普通','2日目',8]
    },
    '2026-11-04':{
      '川口':['普通','最終日',8],'山陽':['普通','初日',12]
    }
  }:{
    '2026-11-02':{
      '小田原':['FⅡ','2日目',7],'熊本':['FⅡ','最終日',7],
      '防府':['GⅢ','3日目',12],'豊橋':['FⅠ','初日',12],
      '久留米':['FⅠ','2日目',12],'静岡':['FⅡ','初日',7],
      '奈良':['FⅡ','初日',7],'武雄':['FⅡ','初日',7]
    },
    '2026-11-04':{
      '取手':['FⅡ','初日',7],'大宮':['FⅠ','初日',12],
      '青森':['FⅠ','2日目',12],'豊橋':['FⅠ','最終日',12],
      '別府':['FⅡ','初日',11],'静岡':['FⅡ','最終日',7],
      '奈良':['FⅡ','最終日',7],'武雄':['FⅡ','最終日',7]
    }
  };
  if(await dateTabs.count()!==3)fail(width+'px prediction date tabs must be interactive');
  for(const date of ['2026-11-02','2026-11-04']){
    await page.locator('.phone-inner > .date-tabs [data-date="'+date+'"]').click();
    const actual=await page.locator('.scroll-area > .venue-card').evaluateAll(cards=>cards.map(card=>({
      venue:card.dataset.venue,
      grade:card.querySelector('.grade-badge')?.textContent?.trim(),
      day:card.querySelector('.venue-day')?.textContent?.trim(),
      dayRight:card.querySelector('.venue-day')?.getBoundingClientRect().left >=
        card.querySelector('.venue-name')?.getBoundingClientRect().right - 1,
      headerFit:(()=>{
        const header=card.querySelector('.venue-header');
        const line=header?.querySelector('.venue-header-line');
        return !!line&&line.getBoundingClientRect().right<=header.getBoundingClientRect().right-1;
      })(),
      refundLabel:card.querySelector('.venue-header .rebate-logo')?.textContent?.trim()||'',
      refundRight:(()=>{
        const header=card.querySelector('.venue-header');
        const logo=header.querySelector('.rebate-logo');
        return !logo||Math.abs(logo.getBoundingClientRect().right-
          (header.getBoundingClientRect().right-
            parseFloat(getComputedStyle(header).paddingRight)))<=2;
      })(),
      rebateRaces:[...card.querySelectorAll('.rchip:has(> .rchip-rebate)')].map(chip=>
        Number(chip.dataset.raceNumber)),
      campaignRaces:[...card.querySelectorAll('.rchip:has(.rchip-campaign)')].map(chip=>
        Number(chip.dataset.raceNumber)),
      girlsRaces:[...card.querySelectorAll('.rchip:has(.rchip-girls)')].map(chip=>
        Number(chip.dataset.raceNumber)),
      girlsTypes:[...card.querySelectorAll('.rchip:has(.rchip-girls)')].map(chip=>
        chip.dataset.raceType),
      venueGirls:!!card.querySelector('.venue-meta .venue-girls'),
      girlsIconValid:[...card.querySelectorAll('.rchip-girls')].every(icon=>
        icon.getAttribute('aria-label')==='ガールズ' &&
        icon.querySelector('.girls-heart-icon use')?.getAttribute('href')?.endsWith('#girls-heart')),
      races:card.querySelectorAll('.rchip').length,
      statuses:[...new Set([...card.querySelectorAll('.rchip small')].map(el=>el.textContent.trim()))],
      forecastRows:card.querySelectorAll('.comment-row').length,
      featuredIcons:card.querySelectorAll('.rchip-featured').length,
      speculativeLinks:card.querySelectorAll('.rchips a.rchip').length,
      arrowsReady:card.querySelector('.hscroll')?.dataset.arrowsReady
    })));
    const expected=expectedSchedules[date];
    const promoByDay=isAutorace?{
      '2026-11-02':{'浜松':Array.from({length:12},(_,i)=>i+1)},
      '2026-11-04':{}
    }:{
      '2026-11-02':{'熊本':[7]},
      '2026-11-04':{'豊橋':[10,11,12],'静岡':[6,7],'奈良':[7],'武雄':[6,7]}
    };
    const girlsByDay=isAutorace?{}:{
      '2026-11-02':{
        '小田原':{races:[6,7],types:['ガールズ予選２','ガールズ予選２']},
        '豊橋':{races:[6,7],types:['ガールズ予選１','ガールズ予選１']},
        '静岡':{races:[1,2],types:['ガールズ予選１','ガールズ予選１']},
        '武雄':{races:[1,2],types:['ガールズ予選１','ガールズ予選１']}
      },
      '2026-11-04':{
        '豊橋':{races:[5,11],types:['ガールズ一般','ガールズ決勝']},
        '別府':{races:[5,6],types:['ガールズ予選１','ガールズ予選１']},
        '静岡':{races:[1,6],types:['ガールズ一般','ガールズ決勝']},
        '武雄':{races:[1,6],types:['ガールズ一般','ガールズ決勝']}
      }
    };
    const expectedGirlsForDay=girlsByDay[date]||{};
    if(actual.some(v=>{
      const expectedGirlsForVenue=expectedGirlsForDay[v.venue];
      const races=expectedGirlsForVenue?.races||[];
      const types=expectedGirlsForVenue?.types||[];
      return v.girlsRaces.join('|')!==races.join('|') ||
        v.girlsTypes.join('|')!==types.join('|') ||
        v.venueGirls!==!!races.length || !v.girlsIconValid;
    }))
      fail(width+'px '+date+' Girls icon placement/types missing or extra: '+
        JSON.stringify(actual.map(v=>({venue:v.venue,girls:v.girlsRaces,types:v.girlsTypes,
          header:v.venueGirls,valid:v.girlsIconValid}))));
    const names=actual.map(x=>x.venue).sort().join('|');
    if(names!==Object.keys(expected).sort().join('|')||
       actual.some(v=>
         v.grade!==expected[v.venue]?.[0] ||
         !v.day?.startsWith(expected[v.venue]?.[1]) || !v.dayRight ||
         !v.headerFit || !v.refundRight ||
         v.rebateRaces.join('|')!==(promoByDay[date][v.venue]||[]).join('|') ||
         v.campaignRaces.join('|')!==(promoByDay[date][v.venue]||[]).join('|') ||
         v.refundLabel!==(promoByDay[date][v.venue]?.length?
           (isAutorace?'5%還元':'決勝5%還元'):'') ||
         v.races!==expected[v.venue]?.[2] ||
         v.statuses.join('|')!==(date<'2026-11-03'?'確定':'発売前') ||
         v.forecastRows!==0 || v.featuredIcons!==0 ||
         v.speculativeLinks!==0 || v.arrowsReady!=='true'))
      fail(width+'px '+date+' must show actual meetings with no featured-rider data: '+
        JSON.stringify(actual));
    if(await page.locator('.phone-inner > .date-tabs [data-date="'+date+'"]').getAttribute('aria-selected')!=='true')
      fail(width+'px '+date+' did not activate');
    if(await page.locator('.venue-card [data-demo-canceled="true"]').count())
      fail(width+'px '+date+' must not inherit the Nov 3 Aomori cancellation demo');
    const sorted=await cards.evaluateAll(nodes=>nodes.map(card=>Number(card.dataset.sortVenue)));
    if(sorted.some((v,i)=>i>0 && v<sorted[i-1]))
      fail(width+'px '+date+' must preserve north-to-south sort on selected venue tab');
  }
  await page.locator('.phone-inner > .date-tabs [data-date="2026-11-03"]').click();
  if(await page.locator('.scroll-area > .venue-card').count()!==(isAutorace?2:8))
    fail(width+'px Nov 3 original venues did not return');
  if(!isAutorace && (
      await page.locator('.venue-card .comment-row').count()!==29 ||
      await page.locator('.venue-card[data-venue="青森"] .rchip[data-demo-canceled]').count()!==1))
    fail(width+'px original featured riders or cancellation demo not restored after date changes');
  if(await page.locator('.phone-inner > .date-tabs [data-date="2026-11-03"]').getAttribute('aria-selected')!=='true')
    fail(width+'px restored today tab is not active');
  console.log('PREDICTION SORT OK ' + width + 'px');
}

async function checkSharedReferences(){
 const expected=['design-tokens.css','tap-feedback.css'];
 const tokens=await readFile(path.join(ROOT,'assets','design-tokens.css'),'utf8');
 const icons=await readFile(path.join(ROOT,'assets','bottom-nav-icons.svg'),'utf8');
 const gift=icons.split('<symbol id="nav-campaign"')[1]?.split('</symbol>')[0];
 if(!gift || !gift.includes('<rect x="5.5" y="17" width="15.5" height="7" rx="1.7"/>') ||
    !gift.includes('<rect x="27" y="17" width="15.5" height="7" rx="1.7"/>'))
   fail('Shared gift icon lid must be symmetric and only 1px wider than gift body on each side');
 if(!/--fw-normal:\s*400\s*;/.test(tokens)||!/--fw-strong:\s*600\s*;/.test(tokens))
   fail('Canonical typography weights must be 400 and 600');
 if(!/--c-text-primary:\s*#30363B\s*;/.test(tokens) ||
    !/--c-text-secondary:\s*#606B76\s*;/.test(tokens) ||
    !/--c-border-control:\s*#97A1AA\s*;/.test(tokens) ||
    !/--c-border:\s*#D2D6DA\s*;/.test(tokens) ||
    /--c-charcoal\b/.test(tokens) ||
    /--c-silver(?:-light)?\b/.test(tokens))
   fail('Canonical H210/S10 core colors or retired tokens are inconsistent');
 // No CSS may still reference the removed silver or silver-light variables.
 const {readdir}=await import('node:fs/promises');
 for(const filename of await readdir(path.join(ROOT,'assets'))){
   if(!filename.endsWith('.css'))continue;
   const contents=await readFile(path.join(ROOT,'assets',filename),'utf8');
   if(/--c-(?:charcoal|silver(?:-light)?)\b/.test(contents))
     fail(filename+': retired grayscale variable reference remains');
 }
 if(/--fw-\d{2}-(normal|strong)/.test(tokens))
   fail('Legacy size-specific weight token found');
 const all=['SCR-100_bet.html',...paths];
 const pagesWithPrunedIcons=new Set(['SCR-100_bet.html','SCR-200_keirin.html','SCR-300_autorace.html']);
 for(const page of all){
  const html=await readFile(path.join(ROOT,page),'utf8');
  if(page!=='index.html' && (html.includes('bottom-nav-icons.svg?v=15') ||
     !html.includes('bottom-nav-icons.svg?v=16')))
    fail(page+': stale shared campaign gift icon cache reference');
  if(page!=='index.html' &&
    (!/ui-consistency\.css\?v=\d+/.test(html) ||
     !html.includes('header-icons.svg?v=1#header-bell') ||
     !html.includes('header-icons.svg?v=1#header-card') ||
     !html.includes('shared-app-header')))
    fail(page+': canonical header references missing');
  if(pagesWithPrunedIcons.has(page)){
   const declared=[...html.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
   const used=[...html.matchAll(/<use\b[^>]*\bhref="#([^"]+)"/g)].map(m=>m[1]);
   if(declared.some(id=>!used.includes(id)) || used.some(id=>!declared.includes(id)))
    fail(page+': unused or missing local SVG symbol');
  }
  if(/<style\b/i.test(html))fail(page+': old inline <style> block detected');
  const css=[...html.matchAll(/<link\b[^>]*href=["']\.\/assets\/([^"']+\.css\?v=\d+)["']/g)].map(m=>m[1]);
  for(const name of expected)if(!css.some(href=>href.split('?')[0]===name))fail(page+': shared CSS direct reference missing '+name);
  if(css.length!==new Set(css).size)fail(page+': duplicated stylesheet reference');
  const commonRefs=css.filter(name=>/^ui-consistency\.css\?v=\d+$/.test(name));
  if(commonRefs.length!==1)fail(page+': shared UI stylesheet must be directly referenced exactly once');
  const commonLast=css.findIndex(name=>/^ui-consistency\.css\?v=\d+$/.test(name));
  // Both detail pages share the final race-picker stylesheet, after their local styles.
  const detailPage=['SCR-210_racecardkeirin.html','SCR-310_racecardautorace.html'].includes(page);
  const sharedSelectors=css.filter(name=>/^race-selector-shared\.css\?v=\d+$/.test(name));
  if(detailPage && (sharedSelectors.length!==1 ||
     !/^race-selector-shared\.css\?v=\d+$/.test(css.at(-1))))
    fail(page+': detail race selectors must load the same stylesheet last');
  if(!detailPage && (commonLast!==css.length-1 || sharedSelectors.length!==0))
    fail(page+': shared UI stylesheet must load last');
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
    if (file === 'SCR-200_keirin.html' || file === 'SCR-300_autorace.html') {
      const h = await a.page.locator('.phone-inner > .page-header .page-header-title')
        .evaluate(el => ({size:getComputedStyle(el).fontSize,weight:getComputedStyle(el).fontWeight}));
      if (h.size !== '18px' || h.weight !== '600')
        fail(file + ' ' + w + 'px shared header title must be 18px/600: '+JSON.stringify(h));
    }
    if (file === 'SCR-400_campaign.html') await checkCampaignPage(a.page,w);
    if (file === 'SCR-500_mypage.html') await checkMyPage(a.page,w);
    if (file === 'SCR-200_keirin.html' || file === 'SCR-300_autorace.html') await checkPredictionSort(a.page,w,file === 'SCR-300_autorace.html');
    if (file === 'SCR-210_racecardkeirin.html'||file === 'SCR-310_racecardautorace.html')
      await checkSharedRaceSelector(a.page,w,file === 'SCR-310_racecardautorace.html');
    if (file === 'SCR-210_racecardkeirin.html') await checkKeirinRaceInformation(a.page,w);
    if (file === 'SCR-210_racecardkeirin.html') await checkKeirinMania(a.page,w);
    if (file === "SCR-310_racecardautorace.html") await checkAutoraceLabMerged(a.page,w);
    if (file !== "index.html") await checkNavPredictionLinks(a.page,w,file);
   }finally {await a.context.close();if(b)await b.context.close();}
  }
  console.log('PAGE OK '+file+' ('+checked+' scenes)');
 }
} finally {await browser.close();}
if(failures.length)throw new Error('Visual/functional regression: '+failures.length+' differences');
console.log('All non-home pages checked: '+paths.length+' files; '+widths.length+' viewport widths; 2 scroll positions.');
