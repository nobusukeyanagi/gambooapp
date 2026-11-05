/* SCR-03 merged racecard: preserve all eight mania-analysis detail views and sync the menu with the table's horizontal scroll. */
(() => {
  "use strict";
  const inner = document.querySelector(".phone-inner");
  if (!inner) return;
  const DATA = window.GambooKeirinHofu5Data;
  if (!DATA || DATA.basics.length !== 9 || DATA.details.length !== 8) return;
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
  const maniaHeading = wrap?.querySelector(".mania-section-start");
  const table = wrap?.querySelector("table.mania-table");
  const menuScroller = inner.querySelector(".info-tabs")?.closest(".hscroll-inner");
  const raceTab = inner.querySelector('.info-tab[data-target="racecard"]');
  const maniaTab = inner.querySelector('.info-tab[data-target="mania"]');
  if (!wrap || !table || !maniaHeading || !raceTab || !maniaTab) return;

  let current = "";
  function selectTab(name) {
    if (name === current) return;
    current = name;
    raceTab.classList.toggle("active", name === "racecard");
    maniaTab.classList.toggle("active", name === "mania");
    if (name === "mania" && menuScroller) {
      menuScroller.scrollTo({ left: maniaTab.offsetLeft - menuScroller.offsetLeft - 12, behavior: "instant" });
    }
    if (name === "racecard" && menuScroller) {
      menuScroller.scrollTo({ left: 0, behavior: "instant" });
    }
  }

  function syncTab() {
    const atRightEdge = wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft <= 12;
    const maniaVisible = wrap.scrollLeft > 0 &&
      (atRightEdge || wrap.scrollLeft + wrap.clientWidth >= maniaHeading.offsetLeft + 12);
    selectTab(maniaVisible ? "mania" : "racecard");
  }

  raceTab.addEventListener("click", () => {
    wrap.scrollTo({ left: 0, behavior: "instant" });
    selectTab("racecard");
  });
  maniaTab.addEventListener("click", () => {
    const offset = maniaHeading.getBoundingClientRect().left - table.getBoundingClientRect().left;
    wrap.scrollTo({ left: Math.max(0, offset - Math.min(90, wrap.clientWidth / 4)), behavior: "instant" });
    selectTab("mania");
  });
  wrap.addEventListener("scroll", syncTab, { passive: true });
  window.addEventListener("resize", syncTab);
  syncTab();
})();
