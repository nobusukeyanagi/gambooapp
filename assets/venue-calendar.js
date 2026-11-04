/* SCR-02 three-day fixed preset. The 11/3 race data is kept in the
   original HTML; adjacent days have verified meeting/day/grade/race counts.
   Other dates' unverified individual cutoff/rider details are not invented. */
(function () {
  "use strict";
  const referenceDay = "2026-11-03";
  // Gamboo points policy: all keirin finals, all grade-autorace races.
  // Race numbers/types below match published Nov 2 and Nov 4 final lists.
  const rebateRaces={"2026-11-02":{"熊本":[7],"浜松":"all"},"2026-11-04":{"豊橋":[10,11,12],"静岡":[6,7],"奈良":[7],"武雄":[6,7]}};
  const girlsFinals={"2026-11-04":{"豊橋":[11],"静岡":[6],"武雄":[6]}};
  const finalTypes={"2026-11-02":{"熊本":{"7":"A級チャレンジ決勝"}},"2026-11-04":{"豊橋":{"10":"A級決勝","11":"ガールズ決勝","12":"S級決勝"},"静岡":{"6":"ガールズ決勝","7":"A級決勝"},"奈良":{"7":"A級チャレンジ決勝"},"武雄":{"6":"ガールズ決勝","7":"A級チャレンジ決勝"}}};
  const giftIcon='<span class="rchip-bottom-icons"><span class="rchip-bottom-icon rchip-campaign" role="img" aria-label="キャンペーン"><svg class="rchip-campaign-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><use href="./assets/bottom-nav-icons.svg?v=16#nav-campaign"></use></svg></span></span>';
  const rebateBand='<span class="rchip-rebate">5%還元</span>';
  const campaignLogo='<span class="rebate-logo" aria-label="5%還元"><svg class="rebate-campaign-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><use href="./assets/bottom-nav-icons.svg?v=16#nav-campaign"></use></svg><span class="rebate-label">5%還元</span></span>';
  const keirinLogo=campaignLogo.replace('aria-label="5%還元"',
    'aria-label="決勝5%還元"').replace('<span class="rebate-label">5%還元</span>',
    '<span class="rebate-label"><span>決勝</span><span>5%還元</span></span>');
  const girlsRaceIcon='<span class="rchip-bottom-icon rchip-girls" role="img" aria-label="ガールズ">' +
    '<svg class="girls-heart-icon" viewBox="0 0 24 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
    '<use href="./assets/bottom-nav-icons.svg?v=16#girls-heart"></use></svg></span>';

  const kind = location.pathname.includes("autorace") ? "autorace" : "keirin";
  const meetings = {"keirin":{"2026-11-02":[["小田原","FⅡ","2日目","モーニング",7,"08:45",true],["熊本","FⅡ","最終日","モーニング",7,"08:55",false],["防府","GⅢ","3日目","",12,"11:00",false],["豊橋","FⅠ","初日","ナイター",12,"15:44",true],["久留米","FⅠ","2日目","ナイター",12,"15:56",false],["静岡","FⅡ","初日","ミッドナイト",7,"20:36",true],["奈良","FⅡ","初日","ミッドナイト",7,"20:44",false],["武雄","FⅡ","初日","ミッドナイト",7,"20:52",true]],"2026-11-04":[["取手","FⅡ","初日","モーニング",7,"08:45",false],["大宮","FⅠ","初日","",12,"11:00",false],["青森","FⅠ","2日目","",12,"11:12",false],["豊橋","FⅠ","最終日","ナイター",12,"15:40",true],["別府","FⅡ","初日","ナイター",11,"15:54",true],["静岡","FⅡ","最終日","ミッドナイト",7,"20:36",true],["奈良","FⅡ","最終日","ミッドナイト",7,"20:44",false],["武雄","FⅡ","最終日","ミッドナイト",7,"20:52",true]]},"autorace":{"2026-11-02":[["浜松","SG","5日目","",12,"",false],["川口","普通","2日目","ナイター",8,"",false]],"2026-11-04":[["川口","普通","最終日","ナイター",8,"",false],["山陽","普通","初日","",12,"",false]]}};
  const gradeMeta = {"GP":["grade-gp",0],"SG":["grade-sg",0],"GⅠ":["grade-g1",1],"特GⅠ":["grade-g1",1],"GⅡ":["grade-g2",2],"GⅢ":["grade-g3",3],"FⅠ":["grade-f1",5],"FⅡ":["grade-f2",6],"普通":["grade-normal",9]};
  const venueRanks = {"青森":12,"取手":23,"大宮":25,"小田原":36,"静岡":38,"豊橋":45,"奈良":53,"防府":63,"久留米":82,"武雄":84,"別府":86,"熊本":87,"川口":1,"浜松":2,"山陽":3};
  const scrollArea = document.querySelector(".phone-inner > .scroll-area");
  const spacer = scrollArea?.querySelector(":scope > .content-end-spacer");
  const tabs = [...document.querySelectorAll(".phone-inner > .date-tabs [data-date]")];
  if (!scrollArea || !spacer || tabs.length !== 3) return;

  const today = [...scrollArea.querySelectorAll(":scope > .venue-card")];
  const cache = new Map([[referenceDay,today]]);
  const girlSvg = '<span class="venue-girls" role="img" aria-label="ガールズ開催">' +
    '<svg class="girls-heart-icon" viewBox="0 0 24 24" preserveAspectRatio="none" ' +
    'aria-hidden="true" focusable="false"><use href="./assets/bottom-nav-icons.svg?v=16#girls-heart"></use></svg></span>';

  function buildCard(record, date) {
    const [venue,grade,day,period,raceCount,firstClosing,girls] = record;
    const [gradeClass,gradeOrder] = gradeMeta[grade];
    const minutes = firstClosing ? firstClosing.split(":").reduce((h,m)=>Number(h)*60+Number(m)) : 9999;
    const past = date < referenceDay;
    const card = document.createElement("div");
    card.className = "venue-card";
    card.dataset.venue = venue;
    card.dataset.meetingDate = date;
    card.dataset.sortDeadline = String(minutes);
    card.dataset.sortGrade = String(gradeOrder);
    card.dataset.sortVenue = String(venueRanks[venue]);
    card.dataset.snapshot = referenceDay + "T12:00:00+09:00";

    // A past day's R is complete; a future day's is not on sale at the
    // reference snapshot. Use a non-link display to avoid opening the
    // unrelated hardcoded 11/3 racecard data.
    const sport = kind === "autorace" ? "auto" : "keirin";
    const dayState = past ? "確定" : "発売前";
    const eligible=rebateRaces[date]?.[venue];
    const isEligible=race => eligible==='all' || Array.isArray(eligible) && eligible.includes(race);
    const hasCampaign=!!eligible;
    const headerCampaign=hasCampaign ? (kind==='autorace' ? campaignLogo : keirinLogo) : '';
    const heading = '<div class="venue-header"><div class="venue-header-line">' +
      '<span class="grade-badge ' + gradeClass + '">' + grade + '</span>' +
      '<span class="venue-title"><span class="venue-name">' + venue + '</span>' +
      '<span class="venue-meta"><span class="venue-day">' + day + '</span>' +
      (period ? '・' + period : '') + (girls ? girlSvg : '') +
      '</span></span>' + headerCampaign + '</div></div>';
    let chips = "";
    for (let race=1;race<=raceCount;race++) {
      const rebate=isEligible(race);
      const girlsFinal=!!girlsFinals[date]?.[venue]?.includes(race);
      const raceType=finalTypes[date]?.[venue]?.[race] || '';
      const bottomIcons=(rebate||girlsFinal) ?
        '<span class="rchip-bottom-icons">' +
        (girlsFinal ? girlsRaceIcon : '') +
        (rebate ? giftIcon.slice('<span class="rchip-bottom-icons">'.length, -'</span>'.length) : '') +
        '</span>' : '';
      chips += '<div class="rcol"><div class="rchip ' +
        (past ? 'closed' : 'presale-preview') + ' archive-preview" ' +
        'data-race-number="' + race + '"' +
        (raceType ? ' data-race-type="' + raceType + '"' : '') +
        ' role="group" aria-label="' +
        venue + ' ' + race + 'R ' + date + ' ' + dayState +
        (rebate ? ' 5%還元' : '') + '（レース詳細は未収録）">' +
        (rebate ? rebateBand : '') + '<b>' + race + 'R</b><small>' +
        dayState + '</small>' + bottomIcons + '</div></div>';
    }
    card.innerHTML = heading +
      '<div class="hscroll"><button type="button" class="hscroll-cue-l" ' +
      'aria-label="前のレースへスクロール"><svg class="ic" aria-hidden="true">' +
      '<use href="#ic-chevronl"></use></svg></button>' +
      '<div class="hscroll-inner"><div class="rchips">' + chips + '</div></div>' +
      '<button type="button" class="hscroll-cue" ' +
      'aria-label="次のレースへスクロール"><svg class="ic" aria-hidden="true">' +
      '<use href="#ic-chevron"></use></svg></button></div>';
    card.dataset.sport = sport;
    if (firstClosing) card.dataset.firstClosingTime = firstClosing;
    return card;
  }

  function show(date) {
    if (!cache.has(date)) {
      const records=meetings[kind][date];
      if (!records) return;
      cache.set(date,records.map(record=>buildCard(record,date)));
    }
    scrollArea.querySelectorAll(":scope > .venue-card").forEach(card=>card.remove());
    const fragment=document.createDocumentFragment();
    cache.get(date).forEach(card=>fragment.appendChild(card));
    scrollArea.insertBefore(fragment,spacer);
    tabs.forEach(tab=>{
      const active=tab.dataset.date===date;
      tab.classList.toggle("active",active);
      tab.setAttribute("aria-selected",String(active));
      tab.tabIndex=active?0:-1;
    });
    scrollArea.dataset.meetingDate=date;
    scrollArea.scrollTop=0;
    document.dispatchEvent(new CustomEvent("gamboo:venues-changed",{detail:{date,kind}}));
  }

  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>show(tab.dataset.date));
    tab.addEventListener("keydown",event=>{
      if(event.key==="Enter" || event.key===" "){
        event.preventDefault();
        tab.click();
      } else if(event.key==="ArrowLeft" || event.key==="ArrowRight"){
        event.preventDefault();
        const other=tabs[(index+(event.key==="ArrowRight"?1:2))%3];
        other.click();
        other.focus();
      }
    });
  });
  // Fit the complete one-line header at every phone width (including 296px).
  // Natural 12/14/16/20px typography is unchanged; only the horizontal
  // footprint is compressed where the full label row would overflow.
  function fitHeaders() {
    scrollArea.querySelectorAll(':scope > .venue-card .venue-header').forEach(header=>{
      const line=header.querySelector(':scope > .venue-header-line');
      if(!line) return;
      const css=getComputedStyle(header);
      const available=header.clientWidth - parseFloat(css.paddingLeft) -
        parseFloat(css.paddingRight);
      const natural=line.scrollWidth;
      const scale=Math.min(1, available/Math.max(1,natural));
      line.style.transform=scale < 0.999 ? 'scaleX('+scale.toFixed(5)+')' : '';
      header.dataset.fitScale=scale.toFixed(5);
    });
  }
  const observer=typeof ResizeObserver==='function' ?
    new ResizeObserver(fitHeaders) : null;
  observer?.observe(scrollArea);
  window.addEventListener('resize',fitHeaders,{passive:true});
  document.fonts?.ready.then(fitHeaders);
  document.addEventListener('gamboo:venues-changed',fitHeaders);
  fitHeaders();

  // Preserve today's original markup, scroller positions and 11/3 annotations.
  scrollArea.dataset.meetingDate=referenceDay;
})();
