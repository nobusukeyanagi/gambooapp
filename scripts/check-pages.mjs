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
    return {status:el.dataset.status,font:cs.fontSize,weight:cs.fontWeight,
      color:cs.color,align:cs.textAlign,
      childColors:[...period.children].map(child=>getComputedStyle(child).color),
      centerOffset:Math.abs((p.left+p.right-b.left-b.right)/2)};
  }));
  if (deadlineStyles.length!==16 || deadlineStyles.some(s =>
       s.font !== '14px' || s.weight !== '600' ||
       s.color !== (s.status==='closed'?'rgb(101, 109, 113)':'rgb(165, 55, 76)') ||
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
  if (closedTab.color !== 'rgb(134, 115, 58)' ||
      closedTab.border !== 'rgb(134, 115, 58)')
    fail(width + 'px ended campaign date tab must have gold active underline: '+JSON.stringify(closedTab));
  const archiveValues = await cards.evaluateAll(els => els.filter(el => !el.hidden).map(el => ({
    status:el.dataset.status,color:getComputedStyle(el.querySelector('.cp-period')).color
  })));
  if (archiveValues.length !== 8 || archiveValues.some(item =>
      item.status !== 'closed' || item.color !== 'rgb(101, 109, 113)'))
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

async function checkMyPage(page, width) {
  const headings=await page.locator('.scroll-area > .section-header > .section-title').allTextContents();
  if (headings.length!==3 ||
      headings.map(x=>x.trim()).join('|')!==
        '激推しメン・推しメン|マイ成績|設定')
    fail(width+'px mypage section headings changed: '+headings);
  const headingStyle=await page.locator('.scroll-area > .section-header > .section-title').first()
    .evaluate(el=>{
      const text=getComputedStyle(el),bar=getComputedStyle(el,'::before');
      return {font:text.fontSize,weight:text.fontWeight,
        accent:bar.backgroundColor,barW:bar.width,barH:bar.height};
    });
  if (headingStyle.font!=='20px' || headingStyle.weight!=='600' ||
      headingStyle.accent!=='rgb(228, 202, 124)' ||
      headingStyle.barW!=='4px' || headingStyle.barH!=='22px')
    fail(width+'px mypage section headings must match SCR-100: '+JSON.stringify(headingStyle));
  const icons=await page.locator('.scroll-area .profile-race-icon use').evaluateAll(nodes=>
    nodes.map(n=>n.getAttribute('href')?.split('#')[1]));
  if (icons.filter(x=>x==='nav-keirin').length!==1 ||
      icons.filter(x=>x==='nav-auto').length!==1)
    fail(width+'px mypage racing icons must use canonical SVG: '+JSON.stringify(icons));
  const avatar=page.locator('.user-avatar > img.user-avatar-photo');
  if (await avatar.count()!==1 || await avatar.getAttribute('src')!=='./assets/images/buta.png?v=2')
    fail(width+'px mypage avatar image reference must be buta.png');
  const avatarRadius=await page.locator('.user-avatar').evaluate(el=>getComputedStyle(el).borderRadius);
  if(avatarRadius!=='12px')fail(width+'px avatar must use canonical --r-md (12px): '+avatarRadius);
  const hero=await page.locator('.user-card-top').evaluate(el=>{
    const card=el.getBoundingClientRect(),image=el.querySelector('.user-avatar').getBoundingClientRect(),
      name=el.querySelector('.user-name').getBoundingClientRect(),
      links=[...el.querySelectorAll('.user-card-actions a')].map(a=>{
        const r=a.getBoundingClientRect(),style=getComputedStyle(a);
        return {title:a.textContent.trim(),href:a.getAttribute('href'),
          x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
          font:style.fontSize,weight:style.fontWeight,bg:style.backgroundColor,
          radius:style.borderRadius};
      }),style=getComputedStyle(el);
    return {height:card.height,left:card.left,right:card.right,
      background:style.backgroundColor,gold:style.borderTopColor,
      goldWidth:style.borderTopWidth,
      imageWidth:image.width,imageHeight:image.height,imageInset:image.x-card.x,
      imageBottom:image.bottom,nameBottom:name.bottom,
      nameX:name.x,nameRight:name.right,links};
  });
  const [memberAction,profileAction]=hero.links;
  if(hero.height<110||hero.height>145||hero.background!=='rgb(255, 255, 255)'||
     hero.gold!=='rgb(228, 202, 124)'||hero.goldWidth!=='3px'||
     hero.imageWidth!==54||hero.imageHeight!==54||hero.imageInset<8||
     hero.links.length!==2||
     memberAction.title!=='会員情報'||memberAction.href!=='#mypage-member'||
     profileAction.title!=='プロフィール'||profileAction.href!=='#mypage-profile'||
     memberAction.x>=profileAction.x||memberAction.right>profileAction.x||
     Math.abs(memberAction.y-profileAction.y)>1||
     Math.abs(memberAction.height-profileAction.height)>1||
     memberAction.y<Math.max(hero.nameBottom,hero.imageBottom)||
     hero.links.some(btn=>btn.height<44||btn.font!=='14px'||btn.weight!=='600'||
       btn.bg!=='rgb(255, 255, 255)'||btn.radius!=='8px'||btn.right>hero.right+1)||
     await page.locator('#mypage-member .favorite-route-card h2').textContent()!=='会員情報'||
     await page.locator('#mypage-profile .favorite-route-card h2').textContent()!=='プロフィール')
    fail(width+'px dual member/profile buttons must align below the name: '+JSON.stringify(hero));
  const avatarImage=await avatar.evaluate(el=>({complete:el.complete,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,visible:el.getBoundingClientRect().width>0}));
  if (!avatarImage.complete || avatarImage.naturalWidth!==130 || avatarImage.naturalHeight!==130 || !avatarImage.visible)
    fail(width+'px uploaded buta.png must load as the original 130x130 image: '+JSON.stringify(avatarImage));
  if (await page.locator('.phone-inner > .status-bar').count())
    fail(width+'px SCR-500 must not show simulated 9:33/5G status bar');
  // DELCA and refund use the exact SCR-100 markup and directly shared styles.
  const balanceBar=page.locator('.phone-inner > .payout-bar.pt-h');
  const bar=await balanceBar.evaluate(el=>{
    const s=getComputedStyle(el),a=el.querySelectorAll('.pt-item');
    return {height:el.getBoundingClientRect().height,bg:s.backgroundColor,
      border:s.borderBottomColor,items:a.length,
      names:[...el.querySelectorAll('.payout-label')].map(x=>x.textContent.trim()),
      fonts:[...el.querySelectorAll('.payout-value.pay-shown,.delca-entry .payout-value')].map(x=>getComputedStyle(x).fontSize),
      preceding:el.previousElementSibling?.classList.contains('page-header'),
      following:el.nextElementSibling?.classList.contains('scroll-area')};
  });
  const home=await page.context().newPage();
  let homeBar;
  try {
    await home.goto(new URL('./SCR-100_bet.html',page.url()).href,{waitUntil:'load'});
    homeBar=await home.locator('.phone-inner > .payout-bar.pt-h').evaluate(el=>{
      const s=getComputedStyle(el);
      return {height:el.getBoundingClientRect().height,bg:s.backgroundColor,
        border:s.borderBottomColor,items:el.querySelectorAll('.pt-item').length,
        names:[...el.querySelectorAll('.payout-label')].map(x=>x.textContent.trim()),
        fonts:[...el.querySelectorAll('.payout-value.pay-shown,.delca-entry .payout-value')].map(x=>getComputedStyle(x).fontSize)};
    });
  } finally {await home.close();}
  if(Math.abs(bar.height-homeBar.height)>0.5 ||
     bar.bg!==homeBar.bg || bar.border!==homeBar.border ||
     bar.items!==homeBar.items ||
     bar.names.join('|')!==homeBar.names.join('|') ||
     bar.fonts.join('|')!==homeBar.fonts.join('|') ||
     !bar.preceding || !bar.following)
    fail(width+'px SCR-500 payout bar must match SCR-100 actual layout: '+
      JSON.stringify({mypage:bar,home:homeBar}));
  const toggle=balanceBar.locator('.pay-toggle');
  if(await toggle.count()!==1||await toggle.getAttribute('aria-pressed')!=='true')
    fail(width+'px refund initial masked state missing');
  await toggle.click();
  if(await toggle.getAttribute('aria-pressed')!=='false')
    fail(width+'px refund click must reveal amount');
  await toggle.press('Enter');
  if(await toggle.getAttribute('aria-pressed')!=='true')
    fail(width+'px refund keyboard toggle must restore mask');
  if((await page.locator('.user-name').innerText()).trim()!=='ユーザー さん')
    fail(width+'px profile username must be ユーザー さん');
  const values=await page.evaluate(()=>{
    const read=selector=>{
      const s=getComputedStyle(document.querySelector(selector));
      return [s.fontSize,s.fontWeight,s.color].join('/');
    };
    return ['.payout-label','.payout-value','.unit'].map(c=>
      [read('.user-points '+c),read('.payout-bar '+c)]);
  });
  if(values.some(pair=>pair[0]!==pair[1]))
    fail(width+'px Gamboo points must match balance bar text: '+JSON.stringify(values));
  const expiryStyles=await page.locator('.user-card .pt3-row').evaluateAll(rows=>
    rows.map(row=>['.point-label','.point-value','.unit'].map(selector=>{
      const s=getComputedStyle(row.querySelector(selector));
      return [s.fontSize,s.fontWeight,s.color,s.fontFamily].join('|');
    })));
  if(expiryStyles.length!==2||expiryStyles[0].some((s,i)=>s!==expiryStyles[1][i]))
    fail(width+'px expiring balance typography must exactly match Gamboo points: '+
      JSON.stringify(expiryStyles));
  if(await page.locator('.user-card .favorite-intro, .favorite-group-heading small').count()||
     (await page.locator('.scroll-area').innerText()).includes('競技を選んで、') ||
     (await page.locator('.scroll-area').innerText()).includes('1名登録・') ||
     (await page.locator('.scroll-area').innerText()).includes('登録中'))
    fail(width+'px favourites description text should be removed');
  const menuText=await page.locator('.scroll-area').innerText();
  if(['デルカ・投票口座','コンテンツ','ウイン履歴','成績・履歴','サポート',
      'マイ成績（競輪）','マイ成績（オートレース）','投稿ブログ管理','デルカチャージ',
      'KEIRIN.JP 口座登録'].some(label=>menuText.includes(label)))
    fail(width+'px removed sections/entries still displayed');
  const settings=await page.locator('.scroll-area > .menu-item .menu-text').allTextContents();
  const expectedSettings=[
    '競輪・オートレース表示順変更','友達を探す','パスワード変更','メールアドレス変更',
    'メールマガジン変更','ログイン通知設定','外部アカウント連携'
  ];
  if(settings.length!==7||settings.some((label,i)=>label.trim()!==expectedSettings[i]))
    fail(width+'px settings must contain exactly seven ordered entries: '+JSON.stringify(settings));
  const firstSetting=await page.locator('.scroll-area > .settings-first').evaluate(el=>{
    const style=getComputedStyle(el);return {label:el.querySelector('.menu-text')?.textContent.trim(),
      topWidth:style.borderTopWidth,topColor:style.borderTopColor,
      bottomWidth:style.borderBottomWidth};
  });
  if(firstSetting.label!=='競輪・オートレース表示順変更'||
     firstSetting.topWidth!=='1px'||
     firstSetting.topColor!=='rgb(208, 212, 214)'||
     firstSetting.bottomWidth!=='1px')
    fail(width+'px first setting needs top rule and new label: '+JSON.stringify(firstSetting));
  const results=await page.locator('.mypage-result-actions > a').evaluateAll(links=>links.map(el=>{
    const r=el.getBoundingClientRect(),cs=getComputedStyle(el),icon=el.querySelector('.mypage-result-icon');
    return {name:el.textContent.trim(),href:el.getAttribute('href'),
      width:r.width,height:r.height,x:r.x,y:r.y,icon:icon.querySelector('use')?.getAttribute('href'),
      iconColor:getComputedStyle(icon).color,font:cs.fontSize,weight:cs.fontWeight,
      bg:cs.backgroundColor,border:cs.borderTopWidth,radius:cs.borderRadius,shadow:cs.boxShadow};
  }));
  if(results.length!==2 || results[0].name!=='競輪'||results[1].name!=='オートレース'||
     results[0].href!=='https://gamboo.jp/member/achievement/keirin'||
     results[1].href!=='https://gamboo.jp/member/achievement/autorace'||
     !results[0].icon?.endsWith('#nav-keirin')||!results[1].icon?.endsWith('#nav-auto')||
     results[0].iconColor!=='rgb(71, 122, 148)'||
     results[1].iconColor!=='rgb(172, 96, 90)'||
     results.some(btn=>btn.width<70||btn.height<40||btn.font!=='14px'||
       btn.weight!=='600'||btn.bg!=='rgb(255, 255, 255)'||
       btn.border!=='1px'||btn.radius!=='8px'||btn.shadow==='none')||
     Math.abs(results[0].y-results[1].y)>1 ||results[0].x>=results[1].x)
    fail(width+'px My Results needs two canonical Keirin/Auto buttons: '+JSON.stringify(results));
  for(const id of ['mypage-member','mypage-profile']) {
    const link=page.locator('.user-card-actions a[href="#'+id+'"]');
    if(await link.count()!==1) {
      fail(width+'px user/result shortcut missing '+id);
      continue;
    }
    await link.click();
    const route=page.locator('.favorite-route:target');
    if(await route.count()!==1 || await route.getAttribute('id')!==id)
      fail(width+'px shortcut must open its independent mock '+id);
    else {
      await route.locator('.favorite-route-card a').click();
      if(await page.locator('.favorite-route:target').count())
        fail(width+'px shortcut return should close '+id);
    }
  }

  const pointPositions=await page.locator('.user-card').evaluate(el=>{
    const rows=[...el.querySelectorAll('.pt3-row')],
      rects=rows.map(x=>x.getBoundingClientRect()),
      first=el.querySelector('.point-action').getBoundingClientRect(),
      actions=el.querySelector('.point-actions'),
      expiry=rows[1];
    return {heights:rects.map(r=>r.height),gap:first.y-rects.at(-1).bottom,
      topPadding:getComputedStyle(actions).paddingTop,
      labels:rows.map(row=>row.querySelector('.point-label').textContent.trim()),
      amounts:rows.map(row=>row.querySelector('.point-value').textContent.trim()),
      expiryColor:getComputedStyle(expiry.querySelector('.point-value')).color};
  });
  if(pointPositions.heights.length!==2||pointPositions.heights[0]!==40||
     pointPositions.heights[1]!==40||pointPositions.gap>9||pointPositions.gap<4||
     pointPositions.topPadding!=='6px'||
     pointPositions.labels.join('|')!=='Gambooポイント|今月失効予定のポイント'||
     pointPositions.amounts.map(x=>x.replace(/\\s/g,'')).join('|')!=='9,999,999pt|123,456pt'||
     pointPositions.expiryColor!=='rgb(43, 49, 53)')
    fail(width+'px points and expiry must have identical 40px row style: '+JSON.stringify(pointPositions));
  if(await page.locator('.user-card .pt3-row').count()!==2)
    fail(width+'px both Gamboo points and expiring points must be shown');
  if(await page.locator('.user-card .point-value.maxcase,.user-card .point-item,.user-card .point-use').count())
    fail(width+'px legacy point boxes or the single old button still remain');
  const pointStyle=await page.locator('.user-card .point-value').first().evaluate(el=>{
    const x=getComputedStyle(el);return {outline:x.outlineStyle,border:x.borderStyle};
  });
  if(pointStyle.outline!=='none'||pointStyle.border!=='none')
    fail(width+'px Gamboo point value must have no individual border: '+JSON.stringify(pointStyle));
  const pointActions=await page.locator('.point-actions > a.point-action').evaluateAll(nodes=>
    nodes.map(el=>{
      const a=el.getBoundingClientRect(),cs=getComputedStyle(el);
      return {name:el.textContent.trim(),href:el.getAttribute('href'),
        x:a.x,y:a.y,w:a.width,h:a.height,display:cs.display,
        font:cs.fontSize, border:cs.borderTopWidth,
        lines:el.querySelectorAll(':scope > span').length,
        lineTexts:[...el.querySelectorAll(':scope > span')].map(x=>x.textContent.trim()),
        fits:[...el.querySelectorAll(':scope > span')].every(x=>{
          const r=x.getBoundingClientRect();return r.left>=a.left-1&&r.right<=a.right+1;
        })};
    }));
  const expectedActions=[
    ['Gambooポイント履歴','https://gamboo.jp/point/history'],
    ['現金に交換','https://gamboo.jp/point/exchange/'],
    ['デルカに交換','https://gamboo.jp/point/exchange/deruca/'],
    ['景品に交換','https://gamboo.jp/point/topics/?tid=goods-exchange'],
    ['ウインに交換','https://gamboo.jp/point/exchange/winpoint/'],
    ['Pexポイントに交換','https://gamboo.jp/point/exchange/pex/']
  ];
  if(pointActions.length!==6 ||
     pointActions.some((a,i)=>a.name!==expectedActions[i][0]||
       a.href!==expectedActions[i][1]||a.h<68||a.w<60||
       a.font!=='14px'||a.border!=='1px'||a.lines!==2||!a.fits ||
       a.lineTexts.join('/')!==[
         'Gamboo/ポイント履歴','現金/に交換','デルカ/に交換',
         '景品/に交換','ウイン/に交換','Pexポイント/に交換'
       ][i]) ||
     Math.abs(pointActions[0]?.y-pointActions[1]?.y)>1 ||
     Math.abs(pointActions[1]?.y-pointActions[2]?.y)>1 ||
     Math.abs(pointActions[3]?.y-pointActions[4]?.y)>1 ||
     Math.abs(pointActions[4]?.y-pointActions[5]?.y)>1 ||
     !(pointActions[3]?.y>pointActions[0]?.y+20) ||
     !(pointActions[2]?.x>pointActions[1]?.x && pointActions[1]?.x>pointActions[0]?.x))
    fail(width+'px points shortcuts must form exactly two rows of three linked buttons: '+JSON.stringify(pointActions));

  // The two competition sections are always visible, top to bottom; no tabs.
  const sports=await page.locator('.favorites-stack > .favorite-sport').evaluateAll(nodes=>
    nodes.map(el=>{
      const icon=el.querySelector('.favorite-sport-icon');
      const cards=[...el.querySelectorAll('.favorite-player-card')].map(a=>{
        const r=a.getBoundingClientRect(),style=getComputedStyle(a),
          nameEl=a.querySelector('.favorite-player-name'),
          affEl=a.querySelector('.favorite-player-affiliation'),
          title=nameEl?.textContent.trim(),aff=affEl?.textContent.trim();
        return {name:title,affiliation:aff,href:a.getAttribute('href'),
          storedName:a.dataset.playerName,storedAffiliation:a.dataset.playerAffiliation,
          width:r.width,height:r.height,display:style.display,
          border:style.borderTopWidth,radius:style.borderRadius,
          color:style.color,background:style.backgroundColor,
          nameFits:nameEl?.scrollWidth<=nameEl?.clientWidth+1,
          affiliationFits:affEl?.scrollWidth<=affEl?.clientWidth+1};
      });
      const r=el.getBoundingClientRect();
      return {
        sport:el.dataset.sport,y:r.y,height:r.height,display:getComputedStyle(el).display,
        heading:el.querySelector('.favorite-sport-heading').textContent.trim(),
        icon:icon.querySelector('use')?.getAttribute('href'),
        iconColor:getComputedStyle(icon).color,
        labels:[...el.querySelectorAll('.favorite-group-heading')].map(x=>x.textContent.trim()),
        super:el.querySelectorAll('.favorite-group--super .favorite-player-card').length,
        regular:el.querySelectorAll('.favorite-group--regular .favorite-player-card').length,
        oldActions:el.querySelectorAll('.os-tab,.oshi-act,.os-btn,.os-chip,.os-seg').length,
        cards
      };
    }));
  if(sports.length!==2||sports[0]?.sport!=='keirin'||sports[1]?.sport!=='auto'||
     sports[0].heading!=='競輪'||sports[1].heading!=='オートレース'||
     !(sports[1].y>sports[0].y+sports[0].height-1)||
     sports[0].iconColor!=='rgb(71, 122, 148)'||
     sports[1].iconColor!=='rgb(172, 96, 90)'||
     !sports[0].icon?.endsWith('#nav-keirin')||
     !sports[1].icon?.endsWith('#nav-auto')||
     sports.some(x=>x.display==='none'||x.labels.join('|')!=='激推しメン|推しメン'||
       x.super!==1||x.oldActions!==0)||
     sports[0].regular!==10||sports[1].regular!==5)
    fail(width+'px both sports must show Keirin then Auto with sport-color icons, no tabs/actions: '+JSON.stringify(sports));
  if(await page.locator('.favorites-stack .favorite-player-card').count()!==17||
     await page.locator('.favorites-stack .os-tab,.favorites-stack .os-panel,.favorites-stack .os-actions').count())
    fail(width+'px favourites must be linked player cards, not sport tabs/buttons');
  for(const section of sports) {
    for(const card of section.cards) {
      const kind=card.href?.includes('-super-')?'super':'list';
      if(!card.name||!card.affiliation||!card.name.includes('　')||card.name.includes(' ')||
         card.storedName!==card.name||
         card.storedAffiliation!==card.affiliation||
         card.href!=='#favorite-'+kind+'-'+section.sport||
         card.width<=0||card.height!==44||!card.nameFits||!card.affiliationFits||
         card.border!=='1px'||
         card.radius!=='8px'||card.background!=='rgb(255, 255, 255)')
        fail(width+'px selected athlete cards need affiliation and correct editor route: '+
          JSON.stringify({sport:section.sport,card}));
    }
  }
  // Verify all 17 riders and their affiliations against the supplied image.
  const rosters={
    keirin:{
      super:[['南　修二','大阪府・88期']],
      list:[
        ['吉田　惠理','北海道・130期'],['小原　乃亜','岩手県・130期'],
        ['川上　いちご','千葉県・130期'],['栗山　百花','神奈川県・130期'],
        ['古山　稀絵','静岡県・130期'],['鈴木　媛子','愛知県・130期'],
        ['仲井　リコ','岐阜県・130期'],['アニー　紗世子','和歌山県・130期'],
        ['露谷　菜々花','高知県・130期'],['齊藤　萌','福岡県・130期']
      ]
    },
    auto:{
      super:[['山田　達也','川口・28期']],
      list:[['篠崎　実','川口・09期'],['宍戸　幸雄','伊勢崎・14期'],
            ['鈴木　章夫','浜松・02期'],['花元　初美','飯塚・08期'],
            ['別府　末彦','山陽・09期']]
    }
  };
  for(const section of sports) {
    const expected=[...rosters[section.sport].super,...rosters[section.sport].list];
    const actual=section.cards.map(card=>[card.name,card.affiliation]);
    if(JSON.stringify(actual)!==JSON.stringify(expected))
      fail(width+'px player names/affiliations must match reference image: '+JSON.stringify({sport:section.sport,actual,expected}));
  }
  const threeCol=await page.locator('.favorite-sport--keirin .favorite-group--regular .favorite-player-card').evaluateAll(nodes=>
    nodes.slice(0,6).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
  if(threeCol.length!==6||
     !(threeCol[0].x<threeCol[1].x&&threeCol[1].x<threeCol[2].x)||
     Math.abs(threeCol[0].y-threeCol[2].y)>1||
     Math.abs(threeCol[3].y-threeCol[5].y)>1||
     !(threeCol[3].y>threeCol[0].y+20))
    fail(width+'px favorites must use a 3-column layout: '+JSON.stringify(threeCol));
  const superAccent=await page.locator('.favorite-sport').evaluateAll(nodes=>nodes.map(el=>{
    const a=el.querySelector('.favorite-group--super .favorite-player-card');
    const style=getComputedStyle(a);
    return {color:style.borderLeftColor,width:style.borderLeftWidth};
  }));
  if(superAccent.length!==2||superAccent[0].color!=='rgb(71, 122, 148)'||
     superAccent[1].color!=='rgb(172, 96, 90)'||
     superAccent.some(x=>x.width!=='3px'))
    fail(width+'px featured athlete left band must use each competition color: '+JSON.stringify(superAccent));
  if((await page.locator('.favorites-stack').innerText()).includes('ほか12名'))
    fail(width+'px legacy count placeholder must be removed');

  // Every selected player opens their own correct Keirin/Auto × Super/Regular editor.
  for(const [sport,kind] of [
    ['keirin','super'],['keirin','list'],['auto','super'],['auto','list']]) {
    const selector='.favorite-sport[data-sport="'+sport+'"] .favorite-group--'+
      (kind==='super'?'super':'regular')+' .favorite-player-card';
    const card=page.locator(selector).first();
    const details=await card.evaluate(el=>({name:el.dataset.playerName,
      affiliation:el.dataset.playerAffiliation}));
    await card.click();
    const target=page.locator('.favorite-route:target');
    const expectedId='favorite-'+kind+'-'+sport;
    if(await target.count()!==1||await target.getAttribute('id')!==expectedId)
      fail(width+'px player card must open '+expectedId);
    else {
      const selected=await target.locator('.favorite-route-selected').innerText();
      if(selected!==details.name+'　'+details.affiliation)
        fail(width+'px editor must show selected player and affiliation: '+selected);
      await target.locator('a[href="#favorites-section"]').first().click();
      if(await page.locator('.favorite-route:target').count())
        fail(width+'px edit route must close on return');
    }
  }
  const cmp=await page.locator('.point-action, .user-card-action').evaluateAll(nodes=>
    nodes.map(el=>{const st=getComputedStyle(el);
      return {name:el.textContent.trim(),color:st.color,font:st.fontSize,
        weight:st.fontWeight,border:st.borderTopColor,radius:st.borderRadius,
        shadow:st.boxShadow,bg:st.backgroundColor};
    }));
  if(cmp.length!==8||cmp.some(item=>
      item.color!=='rgb(43, 49, 53)'||
      item.font!=='14px'||item.weight!=='600'||
      item.border!=='rgb(156, 164, 168)'||
      item.radius!=='8px'||item.bg!=='rgb(255, 255, 255)'||
      item.shadow==='none'))
    fail(width+'px remaining SCR-500 action buttons must match campaign style: '+JSON.stringify(cmp));

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
    'SCR-210_racecardkeirin.html':['大垣 最終日',null],
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
     bell.borderWidth!=='1px'||bell.borderColor!=='rgb(208, 212, 214)'||
     bell.paddingLeft!=='8px'||deposit.paddingLeft!=='10px' ||
     deposit.borderWidth!=='0px'||deposit.bg!=='rgb(71, 122, 148)' ||
     Math.abs(data.titleTextX-53)>1 ||
     bell.iconColor!=='rgb(101, 109, 113)' ||
     labelColor!=='rgb(101, 109, 113)' ||
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
    const expectedBorder=st.hasRebate?'rgb(134, 115, 58)':'rgb(156, 164, 168)';
    const expectedWidth=st.hasRebate?'3px':'1px';
    if(st.border!==expectedBorder || st.borderWidth!==expectedWidth)
      fail(width + 'px rebate buttons need gold 3px borders; other actions use grey 1px: '+
        JSON.stringify(st));
  }
  const sortBorders = await page.locator('.venue-sort-options .chip:not(.active)')
    .evaluateAll(nodes => nodes.map(n => getComputedStyle(n).borderTopColor));
  if (sortBorders.some(c => c !== 'rgb(156, 164, 168)'))
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
  if (warningLabels.length !== 1 || warningLabels.some(w =>
    w.text !== '13分前' || w.aria !== '締切13分前' ||
    w.row !== 'auto' || w.font !== '12px' || w.weight !== '600' ||
    w.color !== 'rgb(255, 255, 255)' || w.background !== 'rgb(165, 55, 76)' ||
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
  if (urgent.some(s => s.width !== '3px' || s.color !== 'rgb(165, 55, 76)' ||
     s.boxWidth !== 90))
    fail(width + 'px urgent button border or canonical width mismatch: ' + JSON.stringify(urgent));
  if (!isAutorace) {
    const canceled=await page.locator('.venue-card[data-venue="青森"] .rchip[data-demo-canceled]')
      .evaluateAll(nodes=>nodes.map(chip=>({
        race:chip.querySelector('b')?.textContent, status:chip.querySelector('small')?.textContent,
        tag:chip.tagName, noLink:!chip.hasAttribute('href'),
        color:getComputedStyle(chip).color,
        bg:getComputedStyle(chip).backgroundColor,
        border:getComputedStyle(chip).borderTopColor
      })));
    if(canceled.length!==1 || canceled[0].race!=='6R' ||
       canceled[0].status!=='中止' || canceled[0].tag!=='SPAN' ||
       !canceled[0].noLink || canceled[0].bg==='rgb(255, 255, 255)' ||
       canceled[0].bg!==canceled[0].border)
      fail(width+'px Nov 3 Aomori 6R must be a non-clickable canceled demo: '+
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
          (x.display!=='none' || x.border!=='rgb(165, 55, 76)') :
          (x.background!=='rgb(134, 115, 58)' || x.color!=='rgb(255, 255, 255)' ||
           x.font!=='12px' || x.weight!=='600' || x.position!=='absolute' ||
           x.height!==18 || x.border!=='rgb(134, 115, 58)' ||
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
    const shown=styles.display!=='none' && styles.backgroundColor==='rgb(165, 55, 76)' &&
      styles.color==='rgb(255, 255, 255)' && styles.position==='absolute';
    const redBorder=getComputedStyle(chip).borderTopColor;
    const giftVisible=getComputedStyle(gift).display!=='none' &&
      getComputedStyle(gift.parentElement).gridRowStart==='4';
    warning.remove();
    chip.classList.remove('next','soon');
    return {goldBorder,redBorder,hidden,shown,giftVisible,
      restored:getComputedStyle(rebate).display!=='none'};
  });
  if(countdownPriority.goldBorder!=='rgb(134, 115, 58)' ||
      countdownPriority.redBorder!=='rgb(165, 55, 76)' ||
      !countdownPriority.giftVisible ||
      !countdownPriority.hidden || !countdownPriority.shown || !countdownPriority.restored)
    fail(width+'px urgent countdown must replace gold frame/band while retaining gift: '+
      JSON.stringify(countdownPriority));
  const expectedPromotions=isAutorace?12:5;
  if (finalIcons.filter(r=>r.eligible).length !== expectedPromotions ||
      finalIcons.some(r=>r.count !== (r.eligible?1:0)) ||
      finalIcons.filter(r=>r.eligible).some(r=>
        !r.source?.endsWith('#nav-campaign') ||
        r.color !== 'rgb(134, 115, 58)' || r.width !== '16px' || r.height !== '16px' ||
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
      !h.allOneLine||!h.nowrap||!h.fits||!h.rightAligned||
      !h.logoSingle||!h.scaleOk))
    fail(width+'px heading must fit grade, venue, day, session, Girls and right rebate in one line: '+
      JSON.stringify(headers));
  if (!isAutorace) {
    const eligible=new Set(['防府','久留米','小田原']);
    if(headers.some(h=>eligible.has(h.venue)
       ? !h.hasLogo||h.label!=='決勝5%還元'||
         !h.symbol?.endsWith('#nav-campaign')||
         h.logoColor!=='rgb(134, 115, 58)'||h.day!=='最終日'
       : h.hasLogo))
      fail(width+'px keirin three rebate venues must have right-aligned icon: '+
        JSON.stringify(headers));
  } else {
    if(headers.some(h=>h.venue==='浜松'
       ? !h.hasLogo||h.label!=='5%還元'||
         !h.symbol?.endsWith('#nav-campaign')||
         h.logoColor!=='rgb(134, 115, 58)'
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
    if (file === 'SCR-200_keirin.html' || file === 'SCR-300_autorace.html') {
      const h = await a.page.locator('.phone-inner > .page-header .page-header-title')
        .evaluate(el => ({size:getComputedStyle(el).fontSize,weight:getComputedStyle(el).fontWeight}));
      if (h.size !== '18px' || h.weight !== '600')
        fail(file + ' ' + w + 'px shared header title must be 18px/600: '+JSON.stringify(h));
    }
    if (file === 'SCR-400_campaign.html') await checkCampaignPage(a.page,w);
    if (file === 'SCR-500_mypage.html') await checkMyPage(a.page,w);
    if (file === 'SCR-200_keirin.html' || file === 'SCR-300_autorace.html') await checkPredictionSort(a.page,w,file === 'SCR-300_autorace.html');
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
