/* SCR-03 merged racecard: preserve all eight mania-analysis detail views and sync the menu with the table's horizontal scroll. */
(() => {
  "use strict";
  function initializeHofu5() {
  const inner = document.querySelector(".phone-inner");
  if (!inner) return;
  const DATA = window.GambooKeirinHofu5Data;
  if (!DATA || DATA.basics.length !== 9 || DATA.details.length !== 8 || DATA.marutoku?.length !== 9 || DATA.positionStats?.rows?.length !== 9) return;
  const ITEMS = DATA.details;
  const headingsFor = (item, groupIndex) => {
    if (item.type === "win") return ["出場選手中順位", "全国順位", groupIndex === 2 ? "優勝率" : "進出率"];
    if (item.type === "ken") return ["勝率", "2連対率", "3連対率", "着外率"];
    return ["出場選手中順位", "全国順位", "勝率", "2連対率", "3連対率", "着外率"];
  };
  const escapeHTML = (x) => String(x ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rating = (symbol) => {
    if (!symbol) return "—";
    const kind = {"◎":"mk-dbl", "○":"mk-o", "△":"mk-tri", "×":"mk-x"}[symbol] || "";
    return '<span class="mk ' + kind + '">' + escapeHTML(symbol) + '</span>';
  };
  const detailCell = (value, index, type) => {
    const str = String(value || "—");
    const rate = type === "ken" || (type === "win" && index % 3 === 2) ||
      (type === "six" && index % 6 >= 2);
    const match = rate && str.match(/^([\d.]+)[%％]\s*(.*)$/);
    if (!match) return '<td class="rt"><span class="rt-v">' + escapeHTML(str) + '</span></td>';
    const percent = Math.min(100, Math.max(0, Number(match[1])));
    return '<td class="rt"><span class="rt-v">' + escapeHTML(match[1] + "％") +
      '</span>' + (match[2] ? '<span class="rt-n">' + escapeHTML(match[2]) + '</span>' : "") +
      '<span class="rt-bar" style="width:' + percent + '%"></span></td>';
  };

  function renderRace5(inner) {
    // Populate SCR-03's existing racecard rows and real analysis detail tables.
    // The structured race header, menu and lineup controls remain intact.
    const raceNumber = inner.querySelector(".ri-race-number");
    if (raceNumber) raceNumber.textContent = DATA.race + "R";
    const raceLink = inner.querySelector(".ri-race");
    if (raceLink) raceLink.setAttribute("aria-label", DATA.race + "Rの車券購入画面へ");
    const raceKind = inner.querySelector(".ri-kind");
    if (raceKind) raceKind.textContent = "Ｓ級 選抜";
    // Update only the values, retaining the five-row SCR-03 summary layout.
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
    inner.querySelectorAll(".race-tabs .race-tab").forEach((tab, index) => {
      tab.classList.toggle("active", index === DATA.race - 1);
      // Race times are sourced from SCR-02; do not overwrite 1–12R with placeholders.
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
    const description = [...inner.querySelectorAll("dt")].find((el) => el.textContent.trim() === "マニア分析");
    if (description?.nextElementSibling?.tagName === "DD") {
      description.nextElementSibling.textContent =
        "防府5Rの実データに基づく評価。項目名をタップすると条件別の詳細成績を表示";
    }
  }

  renderRace5(inner);

  function renderSheet(inner, idx) {
    const item = ITEMS[idx];
    if (!item) return;
    inner.querySelector(".sheet-title").textContent = item.title;
    inner.querySelector(".sheet-cond").textContent = "対象条件：" + item.groups[0].title;
    inner.querySelector(".sheet-note").textContent =
      "2026年11月3日・防府5Rの提供資料に基づく成績。順位・率・実績件数は元資料の値を使用。";

    inner.querySelector(".detail-table thead").innerHTML =
      '<tr><th class="dt-fx dt-car" rowspan="2">車</th>' +
      '<th class="dt-fx dt-name" rowspan="2">選手名</th>' +
      '<th rowspan="2">評価</th>' +
      item.groups.map((group) =>
        '<th class="dt-grp" colspan="' + group.count + '">' + escapeHTML(group.title) + '</th>'
      ).join("") +
      '</tr><tr>' +
      item.groups.map((group, i) =>
        headingsFor(item, i).map((heading) =>
          '<th>' + escapeHTML(heading) + '</th>'
        ).join("")
      ).join("") + '</tr>';

    inner.querySelector(".detail-table tbody").innerHTML = item.rows.map((record, i) => {
      const rider = DATA.basics[i];
      const cells = record.values.map((val, j) => detailCell(val, j, item.type)).join("");
      const mark = rider.ratings.items[idx];
      return '<tr><td class="dt-fx dt-car"><div class="frame-cell f' + rider.car +
        '">' + rider.car + '</div></td><td class="dt-fx dt-name dn">' +
        escapeHTML(rider.name) + '</td><td>' + rating(mark) + '</td>' + cells + '</tr>';
    }).join("");
  }

        function openSheet(inner, idx) {
          renderSheet(inner, idx);
          inner.querySelectorAll(".item-btn").forEach((b) => b.classList.toggle("active", +b.dataset.item === idx));
          inner.querySelector(".sheet").hidden = false;
          inner.querySelector(".sheet-overlay").hidden = false;
        }
  
        function closeSheet(inner) {
          inner.querySelector(".sheet").hidden = true;
          inner.querySelector(".sheet-overlay").hidden = true;
          inner.querySelectorAll(".item-btn").forEach((b) => b.classList.remove("active"));
        }
  
        function bind(inner) {
          inner.querySelectorAll(".item-btn").forEach((btn) =>
            btn.addEventListener("click", () => openSheet(inner, +btn.dataset.item))
          );
          inner.querySelector(".sheet-close").addEventListener("click", () => closeSheet(inner));
          inner.querySelector(".sheet-overlay").addEventListener("click", () => closeSheet(inner));
        }
  bind(inner);

  const wrap = inner.querySelector(".race-table-wrap");
  const table = wrap?.querySelector("table.mania-table");
  // Navigation order follows the first row of the racecard table.
  const playerHeading = wrap?.querySelector(".player-section-start");
  const pointHeading = wrap?.querySelector(".marutoku-section-start");
  const commentHeading = wrap?.querySelector(".marutoku-comment-heading");
  const recentHeading = wrap?.querySelector(".recent-section-start");
  const meetingHeading = wrap?.querySelector(".meeting-section-start");
  const positionHeading = wrap?.querySelector(".position-section-start");
  const maniaHeading = wrap?.querySelector(".mania-section-heading");
  const menuScroller = inner.querySelector(".info-tabs")?.closest(".hscroll-inner");
  const playerTab = inner.querySelector('.info-tab[data-target="player"]');
  const pointTab = inner.querySelector('.info-tab[data-target="marutoku"]');
  const commentTab = inner.querySelector('.info-tab[data-target="comment"]');
  const recentTab = inner.querySelector('.info-tab[data-target="recent"]');
  const meetingTab = inner.querySelector('.info-tab[data-target="meeting"]');
  const positionTab = inner.querySelector('.info-tab[data-target="position"]');
  const maniaTab = inner.querySelector('.info-tab[data-target="mania"]');
  if (!wrap || !table || !playerHeading || !pointHeading || !commentHeading ||
      !recentHeading || !meetingHeading || !positionHeading || !maniaHeading ||
      !playerTab || !pointTab || !commentTab || !recentTab || !meetingTab ||
      !positionTab || !maniaTab) return;

  const tabsByName = {
    player: playerTab, marutoku: pointTab, comment: commentTab,
    recent: recentTab, meeting: meetingTab,
    position: positionTab, mania: maniaTab
  };
  const headingsByName = {
    player: playerHeading, marutoku: pointHeading, comment: commentHeading,
    recent: recentHeading, meeting: meetingHeading,
    position: positionHeading, mania: maniaHeading
  };
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
    // All menu items now follow the physical order of the table columns.
    if (selectedByUser !== null) return;
    if (navigationTarget !== null) {
      if (Math.abs(wrap.scrollLeft - navigationTarget) > 2) return;
      navigationTarget = null;
    }
    const atRightEdge = wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft <= 12;
    const threshold = wrap.scrollLeft + stickyColumnWidth() + 2;
    let name = "player";
    if (atRightEdge || threshold >= columnOffset(maniaHeading)) name = "mania";
    else if (threshold >= columnOffset(positionHeading)) name = "position";
    else if (threshold >= columnOffset(meetingHeading)) name = "meeting";
    else if (threshold >= columnOffset(recentHeading)) name = "recent";
    else if (threshold >= columnOffset(commentHeading)) name = "comment";
    else if (threshold >= columnOffset(pointHeading)) name = "marutoku";
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
    loader.src = "./assets/keirin-hofu5-data.js?v=4";
    loader.onload = initializeHofu5;
    loader.onerror = () => {
      // Preserve the original page structure if the data asset cannot load.
      console.error("防府5Rのレースデータを読み込めませんでした。");
    };
    document.head.appendChild(loader);
  }
})();
