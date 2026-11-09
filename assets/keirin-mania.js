/* SCR-210: original eight-item mania analysis with full source-group detail sheets. */
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

  /* Detail-sheet UI: one category is opened from the matching button
     in the racecard. The source's complete groups are visible side by side;
     no extra category menu, condition strap, national ranking, or prediction
     marks appear in the detail sheet. */
  const detailSource = window.GambooKeirinAnalyzerFull || {};
  const categories = [
    ["distance","周長別成績","四日市12R"],
    ["line","見なし直線別成績","四日市6R"],
    ["race","レース種別成績","四日市6R"],
    ["day","日程別成績","四日市6R"],
    ["grade","グレード別成績","四日市12R"],
    ["advance","グレード別勝ち上がり率","四日市12R"],
    ["car","車番別成績","四日市12R"],
    ["pref","同県選手同乗時成績","四日市12R"]
  ];
  const escapeHTML = x => String(x ?? "").replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const rankCell = rank => {
    const n=Number(rank);
    const label=Number.isInteger(n)&&n>0?n+"位":"—";
    const value=n>=1&&n<=4
      ? '<span class="rank-number rank-tint-'+n+'">'+escapeHTML(label)+'</span>'
      : escapeHTML(label);
    return '<td class="dt-rank">'+value+'</td>';
  };
  // Source counts are cumulative: 1st, top-2, top-3, outside.
  // Display exact finishes above the source's cumulative percentages.
  const placingCount=(stats,index)=>{
    const count=Number(stats?.[index]?.[1]);
    if(!Number.isFinite(count))return "—";
    if(index===1||index===2){
      const prev=Number(stats?.[index-1]?.[1]);
      return Number.isFinite(prev)?count-prev:"—";
    }
    return count;
  };
  const rateCell = (stat, rateRank, actualCount) => {
    if (!stat) return '<td class="dt-rate">—</td>';
    const [rate,count]=stat;
    const rankClass=rateRank>=1&&rateRank<=3?" recent4-rank-"+rateRank:"";
    return '<td class="dt-rate">'+
      '<span class="recent4-count">'+escapeHTML(actualCount??count)+'</span>'+
      '<span class="recent4-rate'+rankClass+'">'+escapeHTML(rate)+'%</span></td>';
  };
  // Only the advancement stats show "number of successes / number of starts".
  // Other conditions keep their simple, per-placing count in the top line.
  const advanceRateCell=stat=>{
    if(!stat)return '<td class="dt-rate">—</td>';
    const [rate,count,total]=stat;
    return '<td class="dt-rate">'+
      '<span class="recent4-count">'+escapeHTML(count)+
        '<span class="recent4-total">/'+escapeHTML(total)+'</span></span>'+
      '<span class="recent4-rate">'+escapeHTML(rate)+'%</span></td>';
  };
  const differenceCell=txt=>
    '<td class="dt-rate dt-difference-cell"><span class="dt-difference">'+
      escapeHTML(txt||"—")+'</span></td>';
  const ranksByRate = (rows, groupIndex, metricIndex, isPref) => {
    const indexes=rows.map((entry,i)=>{
      const numeric=Number(isPref?entry?.[2]?.[groupIndex]?.[metricIndex]?.[0]:
        entry?.[2]?.[groupIndex]?.[1]?.[metricIndex]?.[0]);
      return {car:i+1,rate:numeric};
    }).filter(x=>Number.isFinite(x.rate)).sort((a,b)=>b.rate-a.rate||a.car-b.car);
    const result={};
    indexes.forEach((entry,i)=>{
      result[entry.car]=i&&indexes[i-1].rate===entry.rate
        ?result[indexes[i-1].car]:i+1;
    });
    return result;
  };
  const sheet=inner.querySelector(".sheet");
  const overlay=inner.querySelector(".sheet-overlay");
  const sheetBody=sheet?.querySelector(".sheet-body");
  if (sheet && overlay && sheetBody) {
    // Match the main racecard's 車番/並び順 toggle, including line breaks.
    // The panel uses its own original data; sort only existing rider rows.
    const bindDetailLineupSort=()=>{
      const table=sheet.querySelector(".detail-table");
      const button=table?.querySelector(".dt-car-sort");
      const tbody=table?.tBodies[0];
      const lines=Array.isArray(DATA.lineup)?DATA.lineup:[];
      if(!button||!tbody||!lines.length)return;
      const rows=Array.from(tbody.rows);
      const carOf=row=>Number(row.querySelector("td.dt-vehicle .frame-cell")?.textContent?.trim());
      const byCar=new Map(rows.map(row=>[carOf(row),row]));
      const carOrder=[...byCar.keys()].sort((a,b)=>a-b);
      const lineupCars=lines.flat().map(Number);
      if(byCar.size!==rows.length||lineupCars.length!==rows.length||
         lineupCars.some(car=>!byCar.has(car))||
         new Set(lineupCars).size!==rows.length)return;
      let mode="car";
      button.addEventListener("click",()=>{
        mode=mode==="lineup"?"car":"lineup";
        const order=mode==="lineup"?lineupCars:carOrder;
        order.forEach(car=>tbody.appendChild(byCar.get(car)));
        rows.forEach(row=>row.classList.remove("line-group-start"));
        if(mode==="lineup"){
          lines.slice(1).forEach(line=>{
            byCar.get(Number(line[0]))?.classList.add("line-group-start");
          });
        }
        const active=mode==="lineup";
        button.setAttribute("aria-pressed",String(active));
        button.setAttribute("aria-label",
          active?"車番順に戻す":"ライン順に並べ替え");
      });
    };
    const renderSheet=idx=>{
      const meta=categories[idx], src=meta&&detailSource[meta[0]];
      if (!src || !src.rows || src.rows.length!==9) return;
      const [,title]=meta;
      sheet.querySelector(".sheet-title").textContent=title;
      const placingHeaders=[["1着","勝率"],["2着","2連対率"],
        ["3着","3連対率"],["着外","着外率"]];
      const stackedHeading=([top,bottom],isDifference=false)=>
        '<th class="dt-stat-heading'+(isDifference?" dt-difference-heading":"")+'">'+
        '<span class="recent4-heading-main">'+escapeHTML(top)+'</span>'+
        '<span class="recent4-heading-rate">'+escapeHTML(bottom)+'</span></th>';
      const groupHeaders=src.type==="advance"
        ? src.headers.map((text,i)=>'<th class="dt-grp" colspan="2">'+escapeHTML(text)+'</th>')
        : src.headers.map((text,i)=>'<th class="dt-grp" colspan="'+(src.type==="pref"?4:5)+'">'+
            escapeHTML(text)+'</th>');
      const fields=src.headers.map((_,groupIndex)=>{
        if(src.type==="advance")
          return '<th>順位</th><th>'+
            escapeHTML(groupIndex===2?"優勝率":"進出率")+'</th>';
        return (src.type==="pref"?"":'<th>順位</th>')+
          placingHeaders.map(label=>
            stackedHeading(label,src.type==="pref"&&groupIndex===2)).join("");
      }).join("");
      sheet.querySelector(".detail-table thead").innerHTML=
        '<tr><th class="dt-vehicle" rowspan="2">'+
          '<button type="button" class="dt-car-sort" aria-pressed="false" aria-label="ライン順に並べ替え">'+
            '<span>車番</span><span class="sort-mode-label" aria-hidden="true">並び順</span>'+
          '</button></th>'+
        groupHeaders.join("")+'</tr><tr>'+fields+'</tr>';
      const ranking=src.headers.map((_,k)=>src.type==="advance"?null:
        [0,1,2].map(metric=>ranksByRate(src.rows,k,metric,src.type==="pref")));
      const html=src.rows.map((record,index)=>{
        const [name,,groups]=record;
        const cells=groups.map((group,k)=>{
          if(src.type==="advance"){
            return rankCell(group[0])+advanceRateCell(group[1]);
          }
          if(src.type==="pref") {
            return k===2
              ? group.map(differenceCell).join("")
              : group.map((rate,j)=>rateCell(rate,j===3?0:ranking[k][j][index+1],placingCount(src.type==="pref"?group:group[1],j))).join("");
          }
          return rankCell(group[0])+
            group[1].map((rate,j)=>rateCell(rate,j===3?0:ranking[k][j][index+1],placingCount(src.type==="pref"?group:group[1],j))).join("");
        }).join("");
        return '<tr><td class="dt-vehicle" title="'+escapeHTML(name)+'">'+
          '<span class="dt-vehicle-content">'+
            '<span class="frame-cell f'+(index+1)+'">'+(index+1)+'</span>'+
            '<span class="dt-vehicle-short">'+escapeHTML(Array.from(name).slice(0,3).join(""))+'</span>'+
          '</span></td>'+cells+'</tr>';
      }).join("");
      sheet.querySelector(".detail-table tbody").innerHTML=html;
      bindDetailLineupSort();
      sheetBody.scrollTop=0;
      sheetBody.scrollLeft=0;
      inner.querySelectorAll(".mania-table .item-btn").forEach(btn=>
        btn.classList.toggle("active",Number(btn.dataset.item)===idx));
    };
    const openSheet=idx=>{
      if(!categories[idx])return;
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
    sheet.querySelector(".sheet-close").addEventListener("click",closeSheet);
    const dragHandle=sheet.querySelector(".sheet-handle");
    // Keep the handle tap action, but accept a downward swipe started anywhere
    // inside the panel (title, header, table or sticky rider column).
    dragHandle?.addEventListener("click",closeSheet);
    let swipeStart=null;
    sheet.addEventListener("pointerdown",event=>{
      if(sheet.hidden || !event.isPrimary ||
        (event.pointerType==="mouse"&&event.button!==0))return;
      swipeStart={id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    window.addEventListener("pointerup",event=>{
      if(!swipeStart || event.pointerId!==swipeStart.id)return;
      const dy=event.clientY-swipeStart.y;
      const dx=event.clientX-swipeStart.x;
      swipeStart=null;
      if(!sheet.hidden && dy>=48 && dy>Math.abs(dx)*1.3)closeSheet();
    });
    window.addEventListener("pointercancel",event=>{
      if(swipeStart?.id===event.pointerId)swipeStart=null;
    });
    // A downward wheel/trackpad scroll also dismisses the non-scrollable sheet.
    // Horizontal gestures continue to scroll the wide stat table normally.
    sheet.addEventListener("wheel",event=>{
      if(sheet.hidden || event.deltaY<=0 ||
        event.deltaY<=Math.abs(event.deltaX)*1.3)return;
      event.preventDefault();
      closeSheet();
    },{passive:false});
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
  // The final マニア分析 tab scrolls to the leading 総合 column and covers every analyzer group.
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
    loader.src = "./assets/keirin-hofu5-data.js?v=9";
    loader.onload = initializeHofu5;
    loader.onerror = () => {
      // Preserve the original page structure if the data asset cannot load.
      console.error("防府5Rのレースデータを読み込めませんでした。");
    };
    document.head.appendChild(loader);
  }
})();
