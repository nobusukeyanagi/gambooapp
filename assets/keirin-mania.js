/* SCR-210: render one integrated racecard and synchronize the six navigation tabs with horizontal scrolling. The 400m sample columns are always visible, without a mania sheet. */
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

  const wrap = inner.querySelector(".race-table-wrap");
  const table = wrap?.querySelector("table.mania-table");
  // Navigation order follows the first row of the racecard table.
  const playerHeading = wrap?.querySelector(".player-section-start");
  const pointHeading = wrap?.querySelector(".marutoku-section-start");
  const recentHeading = wrap?.querySelector(".recent-section-start");
  const meetingHeading = wrap?.querySelector(".meeting-section-start");
  const positionHeading = wrap?.querySelector(".position-section-start");
  const gindexHeading = wrap?.querySelector(".gindex-section-start");
  const distanceHeading = wrap?.querySelector(".distance-section-start");
  const menuScroller = inner.querySelector(".info-tabs")?.closest(".hscroll-inner");
  const playerTab = inner.querySelector('.info-tab[data-target="player"]');
  const pointTab = inner.querySelector('.info-tab[data-target="marutoku"]');
  const recentTab = inner.querySelector('.info-tab[data-target="recent"]');
  const meetingTab = inner.querySelector('.info-tab[data-target="meeting"]');
  const positionTab = inner.querySelector('.info-tab[data-target="position"]');
  const gindexTab = inner.querySelector('.info-tab[data-target="gindex"]');
  if (!wrap || !table || !playerHeading || !pointHeading ||
      !recentHeading || !meetingHeading || !positionHeading || !gindexHeading ||
      !distanceHeading || !playerTab || !pointTab || !recentTab ||
      !meetingTab || !positionTab || !gindexTab) return;

  const tabsByName = {
    player: playerTab, recent: recentTab,
    meeting: meetingTab, position: positionTab, marutoku: pointTab,
    gindex: gindexTab
  };
  const headingsByName = {
    player: playerHeading, recent: recentHeading,
    meeting: meetingHeading, position: positionHeading, marutoku: pointHeading,
    gindex: gindexHeading
  };
  // Map both header rows to their logical column indices. Rowspans and
  // The six visible navigation sections align with the physical table columns.
  // The final 周長別 group has no tab and remains visible at the right edge.
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
  const distanceStart = headerCells.find((entry) =>
    entry.cell === distanceHeading)?.from ?? -1;
  if (distanceStart < 0) return;
  function highlightHeader(name) {
    const index = headerBounds.findIndex((entry) => entry.key === name);
    if (index < 0) return;
    const from = headerBounds[index].start;
    const until = index + 1 < headerBounds.length
      ? headerBounds[index + 1].start : distanceStart;
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
    // Keep the last G-index tab active while the un-tabbed 周長別 area is viewed.
    if (selectedByUser !== null) return;
    if (navigationTarget !== null) {
      if (Math.abs(wrap.scrollLeft - navigationTarget) > 2) return;
      navigationTarget = null;
    }
    const atRightEdge = wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft <= 12;
    const threshold = wrap.scrollLeft + stickyColumnWidth() + 2;
    let name = "player";
    if (atRightEdge || threshold >= columnOffset(gindexHeading)) name = "gindex";
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
