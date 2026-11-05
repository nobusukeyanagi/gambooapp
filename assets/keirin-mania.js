/* SCR-03 merged racecard: preserve all eight mania-analysis detail views and sync the menu with the table's horizontal scroll. */
(() => {
  "use strict";
  function initializeHofu5() {
  const inner = document.querySelector(".phone-inner");
  if (!inner) return;
  const DATA = window.GambooKeirinHofu5Data;
  if (!DATA || DATA.basics.length !== 9 || DATA.details.length !== 8 || DATA.marutoku?.length !== 9) return;
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
    const race = inner.querySelector(".ri-race");
    if (race) {
      const number = [...race.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      if (number) number.textContent = "5R";
      const grade = race.querySelector("span");
      if (grade) grade.textContent = DATA.stage;
    }
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
        ).join('<span class="lineup-sep">•</span>');
      lineup.title = "情報元：アオケイ";
    }
    const tbody = inner.querySelector(".mania-table tbody");
    if (!tbody) return;
    const waku = [1, 2, 3, 4, 4, 5, 5, 6, 6];
    const family = ["松尾", "貴志", "小林", "岡田", "森川", "浮島", "西村", "佐藤", "山口"];
    const legClasses = {"追":"leg-chase","逃":"leg-escape","両":"leg-both"};
    const card = ([rank,time,note]) => {
      const n = note ? '<span class="res-note">' + escapeHTML(note).replace(/^B /, "B<br />") + '</span>' : "";
      return '<div class="res"><div class="res-main"><span class="res-rank">' + escapeHTML(rank) +
        '</span>' + (time ? '<span class="res-time">' + escapeHTML(time) + '</span>' : "") +
        '</div>' + n + '</div>';
    };
    tbody.innerHTML = DATA.basics.map((rider,i) => {
      const grade = rider.grade.split("/");
      const group = waku[i];
      const number = (i === 0 || waku[i - 1] !== group) ?
        '<td class="c-waku"' + ([3,5,7].includes(i) ? ' rowspan="2"' : "") + '>' + group + '</td>' : "";
      const cells = [
        number,
        '<td class="fx c-sha"><div class="frame-cell f' + rider.car + '">' + rider.car +
          '</div><span class="sha-nm">' + family[i] + '</span></td>',
        '<td class="c-name"><div class="rider-name">' + escapeHTML(rider.name) +
          '</div><div class="rider-meta">' + escapeHTML(rider.meta) + '</div></td>',
        '<td><span class="g-val">' + escapeHTML(rider.g) + '</span></td>',
        '<td class="bl cls">' + escapeHTML(grade[0]) + '<small>/' + escapeHTML(grade[1]) + '</small></td>',
        '<td class="bl"><span class="leg-tag ' + (legClasses[rider.leg] || "leg-both") +
          '">' + escapeHTML(rider.leg) + '</span></td>',
        '<td class="bl score">' + escapeHTML(rider.score) + '</td>',
        ...rider.stats.map((v,n) => '<td' +
          (n === 0 || n === 1 || n === 5 ? ' class="bl"' :
            n >= 6 ? ' class="' + (n === 6 ? "bl " : "") + 'rate"' : "") + '>' + escapeHTML(v) + '</td>'),
        '<td class="bl res-cell"><div class="res-wrap">' + rider.current.map(card).join("") + '</div></td>',
        '<td class="bl res-cell"><div class="res-wrap"><div class="res-date">' +
          escapeHTML(rider.prevDate).replace(" ", "<br />") + '</div>' +
          rider.previous.map(card).join("") + '</div></td>',
        ...DATA.marutoku[i].points.map((value, col) =>
          '<td class="' + (col === 0 ? "bl " : "") + 'marutoku-value' +
          (DATA.marutoku[i].emphasis[col] ? ' marutoku-point-' + DATA.marutoku[i].emphasis[col] : "") +
          '">' + escapeHTML(value) + '</td>'
        ),
        '<td class="marutoku-mark">' +
          (DATA.marutoku[i].mark ? rating(DATA.marutoku[i].mark) : "") + '</td>',
        '<td class="bl marutoku-comment">' + escapeHTML(DATA.marutoku[i].comment) + '</td>',
        '<td class="mania-eval bl">' + rating(rider.ratings.overall) + '</td>',
        ...rider.ratings.items.map((value,n) =>
          '<td class="mania-eval' + (n === 0 ? " bl" : "") + '" data-item="' + n + '">' +
          rating(value) + '</td>')
      ];
      return '<tr>' + cells.join("") + '</tr>';
    }).join("");
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
  const pointHeading = wrap?.querySelector(".marutoku-section-start");
  const commentHeading = wrap?.querySelector(".marutoku-comment-heading");
  const maniaHeading = wrap?.querySelector(".mania-section-start");
  const menuScroller = inner.querySelector(".info-tabs")?.closest(".hscroll-inner");
  const raceTab = inner.querySelector('.info-tab[data-target="racecard"]');
  const pointTab = inner.querySelector('.info-tab[data-target="marutoku"]');
  const commentTab = inner.querySelector('.info-tab[data-target="comment"]');
  const maniaTab = inner.querySelector('.info-tab[data-target="mania"]');
  if (!wrap || !table || !pointHeading || !commentHeading ||
      !maniaHeading || !raceTab || !pointTab || !commentTab || !maniaTab) return;

  const tabsByName = {
    racecard: raceTab, marutoku: pointTab,
    comment: commentTab, mania: maniaTab
  };
  const headingsByName = {
    marutoku: pointHeading, comment: commentHeading, mania: maniaHeading
  };
  let current = "";
  function selectTab(name) {
    if (name === current) return;
    current = name;
    Object.entries(tabsByName).forEach(([key, tab]) =>
      tab.classList.toggle("active", key === name)
    );
    if (!menuScroller) return;
    const active = tabsByName[name];
    const scrollLeft = name === "racecard" ? 0 :
      Math.max(0, active.offsetLeft - menuScroller.offsetLeft -
        Math.min(40, menuScroller.clientWidth / 6));
    menuScroller.scrollTo({ left: scrollLeft, behavior: "instant" });
  }
  function scrollTableTo(name) {
    if (name === "racecard") {
      wrap.scrollTo({ left: 0, behavior: "instant" });
    } else {
      const heading = headingsByName[name];
      const offset = heading.getBoundingClientRect().left -
        table.getBoundingClientRect().left;
      wrap.scrollTo({
        left: Math.max(0, offset - Math.min(70, wrap.clientWidth / 4)),
        behavior: "instant"
      });
    }
    selectTab(name);
  }
  function syncTab() {
    const atRightEdge = wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft <= 12;
    const threshold = wrap.scrollLeft + Math.min(70, wrap.clientWidth / 4) + 12;
    let name = "racecard";
    if (atRightEdge || threshold >= maniaHeading.offsetLeft) name = "mania";
    else if (threshold >= commentHeading.offsetLeft) name = "comment";
    else if (threshold >= pointHeading.offsetLeft) name = "marutoku";
    selectTab(name);
  }
  Object.entries(tabsByName).forEach(([name, tab]) => {
    tab.addEventListener("click", () => scrollTableTo(name));
  });
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
    loader.src = "./assets/keirin-hofu5-data.js?v=2";
    loader.onload = initializeHofu5;
    loader.onerror = () => {
      // Preserve the original page structure if the data asset cannot load.
      console.error("防府5Rのレースデータを読み込めませんでした。");
    };
    document.head.appendChild(loader);
  }
})();
