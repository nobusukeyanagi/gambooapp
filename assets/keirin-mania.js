/* SCR-03 merged racecard: preserve all eight mania-analysis detail views and sync the menu with the table's horizontal scroll. */
(() => {
  "use strict";
  const inner = document.querySelector(".phone-inner");
  if (!inner) return;
  const ITEMS = [
          { title: "周長別成績", cond: "対象条件：防府バンク", grp: ["周長：防府バンクの成績", "周長：すべての成績"], note: "過去3年間の成績。出場選手中順位は3連対率順" },
          { title: "見なし直線別成績", cond: "対象条件：防府バンクの見なし直線", grp: ["見なし直線：防府バンクの成績", "見なし直線：すべての成績"], note: "見なし直線距離の区分別成績" },
          { title: "レース種別成績", cond: "対象条件：S級決勝", grp: ["レース種別：S級決勝の成績", "レース種別：すべての成績"], note: "同一レース種別での成績" },
          { title: "レース日程別成績", cond: "対象条件：最終日", grp: ["レース日程：最終日の成績", "レース日程：すべての成績"], note: "開催日程（初日／2日目／最終日）別の成績" },
          { title: "グレード別成績", cond: "対象条件：GⅢ", grp: ["グレード：GⅢの成績", "グレード：すべての成績"], note: "同一グレード開催での成績" },
          { title: "グレード別勝ち上がり率", cond: "対象条件：GⅢ 開催", grp: ["グレード：GⅢの勝ち上がり率", "グレード：すべての勝ち上がり率"], note: "予選→準決、準決→決勝の勝ち上がり実績", type: "win" },
          { title: "車番別成績", cond: "対象条件：各選手の今回の車番", grp: ["車番：今回の車番の成績", "車番：すべての成績"], note: "今回と同じ車番で出走した際の成績" },
          { title: "同県選手同乗時成績", cond: "対象条件：同県選手と同じレースに出走", grp: ["同県選手：同乗時の成績", "同県選手：すべての成績"], note: "同県選手と同乗した際の成績" },
        ];
        // マニア分析の実評価値は、今回共有された2つの資料に含まれていません。
        // 以前の架空サンプルを別レースに流用せず、項目と詳細表示の構造だけ維持します。
        function renderSheet(inner, idx) {
          const item = ITEMS[idx];
          const win = item.type === "win";
          const rows = [...inner.querySelectorAll(".mania-table tbody tr")];
          inner.querySelector(".sheet-title").textContent = item.title;
          inner.querySelector(".sheet-cond").textContent = item.cond;
          inner.querySelector(".sheet-note").textContent =
            "※ 本レースのマニア分析データは未取得です。" + item.note;

          const sub = win
            ? "<th>出場選手<br>中順位</th><th>全国<br>順位</th><th>勝ち上がり率</th>"
            : "<th>出場選手<br>中順位</th><th>全国<br>順位</th><th>勝率</th><th>2連対率</th><th>3連対率</th><th>着外率</th>";
          const span = win ? 3 : 6;
          inner.querySelector(".detail-table thead").innerHTML =
            '<tr><th class="dt-fx dt-car" rowspan="2">車</th><th class="dt-fx dt-name" rowspan="2">選手名</th><th rowspan="2">評価</th>' +
            item.grp.map((g) => `<th class="dt-grp" colspan="${span}">${g}</th>`).join("") +
            `</tr><tr>${sub}${sub}</tr>`;

          const emptyValue = '<td class="rt"><span class="rt-v">—</span></td>';
          inner.querySelector(".detail-table tbody").innerHTML = rows.map((tr) => {
            const car = tr.querySelector(".c-sha").innerHTML;
            const name = tr.querySelector(".c-name .rider-name").textContent;
            const group = emptyValue.repeat(span);
            return `<tr><td class="dt-fx dt-car">${car}</td><td class="dt-fx dt-name dn">${name}</td><td>—</td>${group}${group}</tr>`;
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
