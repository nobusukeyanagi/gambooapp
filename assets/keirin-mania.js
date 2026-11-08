/* SCR-210: original eight-item mania analysis with tabbed detail sheets and synchronized racecard navigation. */
(() => {
  "use strict";
  function initializeHofu5() {
  const inner = document.querySelector(".phone-inner");
  if (!inner) return;
  const DATA = window.GambooKeirinHofu5Data;
  if (!DATA || DATA.basics.length !== 9 || DATA.marutoku?.length !== 9 || DATA.positionStats?.rows?.length !== 9) return;
  function renderRace5(inner) {
    // Populate SCR-210's existing racecard rows and real analysis detail tables.
    // The structured race header, menu and lineup controls remain intact.
    const raceNumber = inner.querySelector(".ri-meeting .ri-race-label");
    if (raceNumber) raceNumber.textContent = DATA.race + "R";
    const raceLink = inner.querySelector(".ri-race");
    if (raceLink) raceLink.setAttribute("aria-label", DATA.race + "Rの車券購入画面へ");
    const raceKind = inner.querySelector(".ri-kind > span:first-child");
    if (raceKind) raceKind.textContent = "Ｓ級 選抜";
    // Update only the values, retaining the five-row SCR-210 summary layout.
    const deadline = inner.querySelector(".race-info-meta .race-deadline");
    const startTime = inner.querySelector(".race-info-meta .race-start");
    if (deadline) {
      deadline.textContent = DATA.deadline;
      deadline.setAttribute("datetime", DATA.deadline);
    }
    if (startTime) {
      startTime.textContent = DATA.start;
      startTime.setAttribute("datetime", DATA.start);
    }
    // This page uses a historical 2026-11-03 12:30 mock snapshot, not the
    // visitor's live clock. Derive the notice from that same reference time.
    const countdown = inner.querySelector(".ri-kind .race-countdown");
    const snapshot = inner.querySelector(".race-info-bar")?.dataset.snapshot;
    if (countdown && snapshot && DATA.date && DATA.deadline) {
      const remainingMs = Date.parse(DATA.date + "T" + DATA.deadline + ":00+09:00") -
        Date.parse(snapshot);
      if (Number.isFinite(remainingMs)) {
        const minutes = Math.ceil(remainingMs / 60000);
        countdown.textContent = minutes > 0 ? "締切" + minutes + "分前" : "締切";
        countdown.setAttribute("aria-label", minutes > 0 ?
          "BET締切まで" + minutes + "分" : "BET締切済");
      }
    }
    inner.querySelectorAll(".race-tabs .race-tab").forEach((tab, index) => {
      tab.classList.toggle("active", index === DATA.race - 1);
      // Race times are sourced from SCR-200; do not overwrite 1–12R with placeholders.
    });
    const lineup = inner.querySelector(".lineup-row");
    if (lineup) {
      lineup.innerHTML = '<span class="lineup-dir">←</span>' +
        DATA.lineup.map((part) =>
          part.map((car) => '<div class="lineup-car f' + car + '">' + car + '</div>').join("")
        ).join('<span class="lineup-sep" aria-label="ラインの区切り">・</span>');
      lineup.title = "情報元：アオケイ";
    }
    const racecard = inner.querySelector("table.mania-table");
    if (!racecard || !window.GambooKeirinRacecardColumns) return;
    window.GambooKeirinRacecardColumns.render(racecard, DATA);
  }

  renderRace5(inner);

  /* Restored original mania-analysis bottom sheet. The first level shows
     evaluation symbols; each category tab displays source race statistics
     in the same compact count / percentage / ranking design. */
  const analyzer = window.GambooKeirinAnalyzerSample || {};
  const renderers = window.GambooKeirinRacecardColumns;
  const categories = [
    {key:"distance",title:"周長別成績",condition:"周長400m・過去1年",race:"四日市12R"},
    {key:"line",title:"見なし直線別成績",condition:"見なし直線60m以上",race:"四日市6R"},
    {key:"race",title:"レース種別成績",condition:"選抜",race:"四日市6R"},
    {key:"day",title:"日程別成績",condition:"最終日",race:"四日市6R"},
    {key:"grade",title:"グレード別成績",condition:"G3",race:"四日市12R"},
    {key:"advance",title:"グレード別勝ち上がり率",condition:"G3・準決勝／決勝／優勝",race:"四日市12R"},
    {key:"car",title:"車番別成績",condition:"各選手の当該車番",race:"四日市12R"},
    {key:"pref",title:"同県選手同乗時成績",condition:"同県選手同乗レース",race:"四日市12R"}
  ];
  const escapeHTML = x => String(x ?? "").replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const mark = value => renderers.marker(value);
  const statCombo = (symbol,value) => renderers.statCombo(symbol,value);
  const rankCell = rank => {
    const n=Number(rank)||0;
    const markValue=["","◎","○","△","×"][n]||"";
    const numberText=n>=1&&n<=4
      ? '<span class="rank-number rank-tint-'+n+'">'+n+'位</span>'
      : escapeHTML(n?n+"位":"—");
    return '<td class="rt sheet-rank-cell">'+
      statCombo(mark(markValue),numberText)+'</td>';
  };
  const rateCell=(count,rate,rank=0) =>
    '<td class="rt"><span class="recent4-count">'+escapeHTML(count)+'</span>'+
    '<span class="recent4-rate'+(rank>=1&&rank<=3?' recent4-rank-'+rank:'')+'">'+
      escapeHTML(rate)+'%</span></td>';
  const detailedRows=(spec) => Array.from({length:9},(_,i)=>{
    const car=i+1;
    if(spec.key==="distance") {
      const d=renderers.distance400Sample[car];
      return d ? {car,name:d.name,rank:d.rank,
        counts:[d.cum[0],d.cum[1]-d.cum[0],d.cum[2]-d.cum[1],d.total-d.cum[2]],
        rates:d.rates} : null;
    }
    const row=analyzer[spec.key]?.[i];
    if(!row)return null;
    if(spec.key==="advance")return {car,name:row[0],stages:row.slice(1)};
    if(spec.key==="pref")return {car,name:row[0],counts:row[1],rates:row[2]};
    return {car,name:row[0],rank:row[1],counts:row[2],rates:row[3]};
  });
  const rankingForRates=records=>{
    return [0,1,2].map(k=>{
      const values=records.map((r,i)=>({car:i+1,value:Number(r?.rates?.[k])}))
        .filter(x=>Number.isFinite(x.value))
        .sort((a,b)=>b.value-a.value||a.car-b.car);
      const result={};
      values.forEach((x,i)=>{
        result[x.car]=i&&values[i-1].value===x.value
          ?result[values[i-1].car] : i+1;
      });
      return result;
    });
  };
  const sheet=inner.querySelector(".sheet");
  const overlay=inner.querySelector(".sheet-overlay");
  const sheetTabs=sheet?.querySelector(".sheet-categories");
  let selectedItem=0;
  if(sheet && overlay && sheetTabs && renderers) {
    sheetTabs.innerHTML=categories.map((spec,i)=>
      '<button type="button" role="tab" class="sheet-category" data-item="'+i+
      '" aria-selected="false">'+escapeHTML(spec.title)+'</button>').join("");
    const renderSheet=(idx)=>{
      const spec=categories[idx];
      if(!spec)return;
      selectedItem=idx;
      const records=detailedRows(spec);
      const isAdvance=spec.key==="advance";
      const isPref=spec.key==="pref";
      const labels=isAdvance
        ? ["準決勝順位","準決勝進出率","決勝順位","決勝進出率","優勝順位","優勝率"]
        : isPref ? ["1着","2着","3着","着外"]
        : ["順位","1着","2着","3着","着外"];
      sheet.querySelector(".sheet-title").textContent=spec.title;
      sheet.querySelector(".sheet-cond").textContent=
        "対象条件："+spec.condition+" ／ "+spec.race;
      sheet.querySelector(".sheet-note").textContent=
        "参考データ：2026年11月8日 "+spec.race+"（車番順）。"+
        "この出走表の防府5Rとは異なるレースです。";
      sheet.querySelector(".detail-table thead").innerHTML=
        '<tr><th class="dt-fx dt-car" rowspan="2">車</th>'+
        '<th class="dt-fx dt-name" rowspan="2">選手名</th>'+
        '<th class="dt-grp" colspan="'+labels.length+'">'+escapeHTML(spec.title)+'</th></tr>'+
        '<tr>'+labels.map(x=>'<th>'+escapeHTML(x)+'</th>').join("")+'</tr>';
      const rateRanks=isAdvance?[]:rankingForRates(records);
      sheet.querySelector(".detail-table tbody").innerHTML=records.map((record,i)=>{
        if(!record)return "";
        const cells=isAdvance
          ? record.stages.map(stage=>
              rankCell(stage[0])+rateCell(stage[1],stage[3],Number(stage[0]))).join("")
          : (isPref?"":rankCell(record.rank))+
            record.counts.map((count,k)=>
              rateCell(count,record.rates[k],k===3?0:rateRanks[k][i+1])
            ).join("");
        return '<tr><td class="dt-fx dt-car"><div class="frame-cell f'+record.car+
          '">'+record.car+'</div></td><td class="dt-fx dt-name dn">'+
          escapeHTML(record.name)+'</td>'+cells+'</tr>';
      }).join("");
      sheetTabs.querySelectorAll(".sheet-category").forEach((btn,i)=>{
        const active=i===idx;
        btn.setAttribute("aria-selected",String(active));
        btn.classList.toggle("active",active);
      });
      inner.querySelectorAll(".mania-table .item-btn").forEach(btn=>
        btn.classList.toggle("active",Number(btn.dataset.item)===idx));
      sheet.querySelector(".sheet-body").scrollTop=0;
    };
    const openSheet=(idx)=>{
      sheet.hidden=false;
      overlay.hidden=false;
      renderSheet(idx);
    };
    const closeSheet=()=>{
      sheet.hidden=true;
      overlay.hidden=true;
      inner.querySelectorAll(".mania-table .item-btn").forEach(btn=>
        btn.classList.remove("active"));
    };
    inner.querySelectorAll(".mania-table .item-btn").forEach(btn=>
      btn.addEventListener("click",()=>openSheet(Number(btn.dataset.item))));
    sheetTabs.addEventListener("click",event=>{
      const btn=event.target.closest(".sheet-category");
      if(btn)renderSheet(Number(btn.dataset.item));
    });
    sheet.querySelector(".sheet-close").addEventListener("click",closeSheet);
    overlay.addEventListener("click",closeSheet);
    window.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&!sheet.hidden)closeSheet();
    });
  }

  const wrap = inner.querySelector(".race-table-wrap");
  const table = wrap?.querySelector("table.mania-table");
  // Navigation order follows the first row of the racecard table.
  const playerHeading = wrap?.querySelector(".player-section-start");
  const pointHeading = wrap?.querySelector(".marutoku-section-start");
  const recentHeading = wrap?.querySelector(".recent-section-start");
  const meetingHeading = wrap?.querySelector(".meeting-section-start");
  const positionHeading = wrap?.querySelector(".position-section-start");
  const gindexHeading = wrap?.querySelector(".gindex-section-start");
  const maniaHeading = wrap?.querySelector(".mania-section-start");
  const menuScroller = inner.querySelector(".info-tabs")?.closest(".hscroll-inner");
  const playerTab = inner.querySelector('.info-tab[data-target="player"]');
  const pointTab = inner.querySelector('.info-tab[data-target="marutoku"]');
  const recentTab = inner.querySelector('.info-tab[data-target="recent"]');
  const meetingTab = inner.querySelector('.info-tab[data-target="meeting"]');
  const positionTab = inner.querySelector('.info-tab[data-target="position"]');
  const gindexTab = inner.querySelector('.info-tab[data-target="gindex"]');
  const maniaTab = inner.querySelector('.info-tab[data-target="mania"]');
  if (!wrap || !table || !playerHeading || !pointHeading ||
      !recentHeading || !meetingHeading || !positionHeading || !gindexHeading ||
      !maniaHeading || !playerTab || !pointTab || !recentTab ||
      !meetingTab || !positionTab || !gindexTab || !maniaTab) return;

  const tabsByName = {
    player: playerTab, recent: recentTab,
    meeting: meetingTab, position: positionTab, marutoku: pointTab,
    gindex: gindexTab, mania: maniaTab
  };
  const headingsByName = {
    player: playerHeading, recent: recentHeading,
    meeting: meetingHeading, position: positionHeading, marutoku: pointHeading,
    gindex: gindexHeading, mania: maniaHeading
  };
  // Map both header rows to their logical column indices, including rowspans.
  // The final マニア分析 tab scrolls to 周長別 and covers every analyzer group.
  const grid = [];
  const headerCells = [];
  Array.from(table.tHead?.rows || []).forEach((row, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = [];
    let column = 0;
    Array.from(row.cells).forEach((cell) => {
      while (grid[rowIndex][column]) column++;
      const span = cell.colSpan || 1;
      const rowSpan = cell.rowSpan || 1;
      headerCells.push({ cell, from: column, until: column + span });
      for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
        if (!grid[r]) grid[r] = [];
        for (let c = column; c < column + span; c++) grid[r][c] = true;
      }
      column += span;
    });
  });
  const headerBounds = Object.keys(headingsByName).map((key) => ({
    key, start: headerCells.find((item) => item.cell === headingsByName[key])?.from ?? -1
  }));
  if (headerBounds.some((entry) => entry.start < 0)) return;
  const columnCount = Math.max(0, ...headerCells.map(entry=>entry.until));
  function highlightHeader(name) {
    const index = headerBounds.findIndex((entry) => entry.key === name);
    if (index < 0) return;
    const from = headerBounds[index].start;
    const until = index + 1 < headerBounds.length
      ? headerBounds[index + 1].start : columnCount;
    // Group cells illuminate whenever their span overlaps the active section.
    // Frame and vehicle-number headers always retain their normal color.
    headerCells.forEach(({cell, from: start, until: end}) =>
      cell.classList.toggle("section-selected",
        start >= 2 && start < until && end > from)
    );
  }
  let current = "";
  let navigationTarget = null;
  let selectedByUser = null;
  const scrollBehavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "instant" : "smooth";
  // The vehicle-number column remains sticky at the left edge. Align the
  // selected section's first data column immediately after that fixed column.
  const stickyColumnWidth = () =>
    table.querySelector("thead th.c-sha")?.getBoundingClientRect().width || 0;
  const columnOffset = (heading) =>
    wrap.scrollLeft + heading.getBoundingClientRect().left -
    wrap.getBoundingClientRect().left;
  function selectTab(name, animate = false) {
    if (name === current) return;
    current = name;
    Object.entries(tabsByName).forEach(([key, tab]) =>
      tab.classList.toggle("active", key === name)
    );
    highlightHeader(name);
    if (!menuScroller) return;
    const active = tabsByName[name];
    const scrollLeft = name === "player" ? 0 :
      Math.max(0, active.offsetLeft - menuScroller.offsetLeft -
        Math.min(44, menuScroller.clientWidth / 5));
    menuScroller.scrollTo({
      left: scrollLeft,
      behavior: animate ? scrollBehavior : "instant"
    });
  }
  function scrollTableTo(name) {
    const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const offset = name === "player" ? 0 :
      columnOffset(headingsByName[name]) - stickyColumnWidth();
    const left = Math.max(0, Math.min(maxLeft, offset));
    navigationTarget = left;
    selectedByUser = name;
    selectTab(name, true);
    wrap.scrollTo({ left, behavior: scrollBehavior });
    if (Math.abs(wrap.scrollLeft - left) <= 2) navigationTarget = null;
  }
  function syncTab() {
    // Keep the tapped section selected while the table scrolls smoothly.
    // Manual selection stays active until scrolling is resumed by the user.
    if (selectedByUser !== null) return;
    if (navigationTarget !== null) {
      if (Math.abs(wrap.scrollLeft - navigationTarget) > 2) return;
      navigationTarget = null;
    }
    const atRightEdge = wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft <= 12;
    const threshold = wrap.scrollLeft + stickyColumnWidth() + 2;
    let name = "player";
    if (atRightEdge || threshold >= columnOffset(maniaHeading)) name = "mania";
    else if (threshold >= columnOffset(gindexHeading)) name = "gindex";
    else if (threshold >= columnOffset(pointHeading)) name = "marutoku";
    else if (threshold >= columnOffset(positionHeading)) name = "position";
    else if (threshold >= columnOffset(meetingHeading)) name = "meeting";
    else if (threshold >= columnOffset(recentHeading)) name = "recent";
    selectTab(name);
  }
  Object.entries(tabsByName).forEach(([name, tab]) => {
    tab.addEventListener("click", () => scrollTableTo(name));
  });
  // Manual gestures cancel the selection hold and resume automatic tab sync.
  function clearManualSelection() {
    navigationTarget = null;
    selectedByUser = null;
  }
  wrap.addEventListener("pointerdown", clearManualSelection, { passive: true });
  wrap.addEventListener("wheel", clearManualSelection, { passive: true });
  wrap.addEventListener("scroll", syncTab, { passive: true });
  window.addEventListener("resize", syncTab);
  syncTab();
  }
  if (window.GambooKeirinHofu5Data) {
    initializeHofu5();
  } else {
    // The existing page links to this script without a separate data import.
    // Load the dataset before initializing the view and detail interactions.
    const loader = document.createElement("script");
    loader.src = "./assets/keirin-hofu5-data.js?v=8";
    loader.onload = initializeHofu5;
    loader.onerror = () => {
      // Preserve the original page structure if the data asset cannot load.
      console.error("防府5Rのレースデータを読み込めませんでした。");
    };
    document.head.appendChild(loader);
  }
})();
