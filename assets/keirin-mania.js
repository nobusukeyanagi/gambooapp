/* SCR-03 merged racecard: preserve all eight mania-analysis detail views and sync the menu with the table's horizontal scroll. */
(() => {
  "use strict";
  const inner = document.querySelector(".phone-inner");
  if (!inner) return;
  const ITEMS = [
          { title: "周長別成績", cond: "対象条件：400mバンク（大垣）", grp: ["周長：400mの成績", "周長：すべての成績"], note: "過去3年間の成績。出場選手中順位は3連対率順" },
          { title: "見なし直線別成績", cond: "対象条件：見なし直線 56.0m（標準）", grp: ["見なし直線：56.0mの成績", "見なし直線：すべての成績"], note: "見なし直線距離の区分別成績" },
          { title: "レース種別成績", cond: "対象条件：A級一般", grp: ["レース種別：A級一般の成績", "レース種別：すべての成績"], note: "同一レース種別での成績" },
          { title: "レース日程別成績", cond: "対象条件：最終日", grp: ["レース日程：最終日の成績", "レース日程：すべての成績"], note: "開催日程（初日／2日目／最終日）別の成績" },
          { title: "グレード別成績", cond: "対象条件：GⅢ", grp: ["グレード：GⅢの成績", "グレード：すべての成績"], note: "同一グレード開催での成績" },
          { title: "グレード別勝ち上がり率", cond: "対象条件：GⅢ 開催", grp: ["グレード：GⅢの勝ち上がり率", "グレード：すべての勝ち上がり率"], note: "予選→準決、準決→決勝の勝ち上がり実績", type: "win" },
          { title: "車番別成績", cond: "対象条件：各選手の今回の車番", grp: ["車番：今回の車番の成績", "車番：すべての成績"], note: "今回と同じ車番で出走した際の成績" },
          { title: "同県選手同乗時成績", cond: "対象条件：同県選手と同じレースに出走", grp: ["同県選手：同乗時の成績", "同県選手：すべての成績"], note: "同県選手と同乗した際の成績" },
        ];
        const Q = { "◎": 0.78, "○": 0.66, "△": 0.52, "✕": 0.36, "": 0.42 };
        const MK = { "◎": "mk-dbl", "○": "mk-o", "△": "mk-tri", "✕": "mk-x" };
        const pct1 = (n, d) => (d ? ((n / d) * 100).toFixed(1) : "0.0");
  
        function calc(mark, i, idx, g) {
          const seed = (i + 1) * 7 + idx * 5 + g * 3;
          const n = g ? 30 + ((seed * 11) % 75) : 20 + ((seed * 7) % 30);
          const q = Math.min(0.9, Math.max(0.2, Q[mark] + ((seed % 7) - 3) * 0.03));
          const c3 = Math.round(n * q);
          const c2 = Math.round(c3 * (0.68 + (seed % 3) * 0.06));
          const c1 = Math.round(c2 * (0.55 + (seed % 4) * 0.05));
          return { n, c1, c2, c3, out: n - c3, r3: c3 / n, nat: Math.round(1400 * Math.pow(1 - c3 / n, 1.6)) + (seed % 30) + 1 };
        }
        const rateCell = (c, n, cls = "") =>
          `<td class="rt ${cls}"><span class="rt-v">${pct1(c, n)}%</span><span class="rt-n">(${c}/${n})</span><i class="rt-bar" style="width:${pct1(c, n)}%"></i></td>`;
  
        function renderSheet(inner, idx) {
          const item = ITEMS[idx];
          const win = item.type === "win";
          const rows = [...inner.querySelectorAll(".mania-table tbody tr")];
          inner.querySelector(".sheet-title").textContent = item.title;
          inner.querySelector(".sheet-cond").textContent = item.cond;
          inner.querySelector(".sheet-note").textContent = "※ " + item.note;
  
          const sub = win
            ? "<th>出場選手<br>中順位</th><th>全国<br>順位</th><th>勝ち上がり率</th>"
            : "<th>出場選手<br>中順位</th><th>全国<br>順位</th><th>勝率</th><th>2連対率</th><th>3連対率</th><th>着外率</th>";
          const span = win ? 3 : 6;
          inner.querySelector(".detail-table thead").innerHTML =
            `<tr><th class="dt-fx dt-car" rowspan="2">車</th><th class="dt-fx dt-name" rowspan="2">選手名</th><th rowspan="2">評価</th>` +
            item.grp.map((g) => `<th class="dt-grp" colspan="${span}">${g}</th>`).join("") +
            `</tr><tr>${sub}${sub}</tr>`;
  
          const data = rows.map((tr, i) => {
            const mark = tr.querySelector(`.mania-eval[data-item="${idx}"]`)?.textContent.trim() ?? "";
            return { tr, mark, s: [calc(mark, i, idx, 0), calc(mark, i, idx, 1)] };
          });
          [0, 1].forEach((g) => {
            [...data].sort((a, b) => b.s[g].r3 - a.s[g].r3).forEach((d, k) => (d.s[g].rank = k + 1));
          });
  
          inner.querySelector(".detail-table tbody").innerHTML = data.map(({ tr, mark, s }) => {
            const car = tr.querySelector(".c-sha").innerHTML;
            const name = tr.querySelector(".c-name .rider-name").textContent;
            const markHtml = mark ? `<span class="mk ${MK[mark]}">${mark}</span>` : "－";
            const grp = s.map((x) => {
              const head = `<td class="dt-gs">${x.rank}位</td><td>${x.nat}位</td>`;
              if (win) {
                const w = Math.round(x.c2 * 0.9);
                return head + rateCell(w, x.n);
              }
              return head + rateCell(x.c1, x.n) + rateCell(x.c2, x.n) + rateCell(x.c3, x.n) + rateCell(x.out, x.n, "rt-out");
            }).join("");
            return `<tr><td class="dt-fx dt-car">${car}</td><td class="dt-fx dt-name dn">${name}</td><td>${markHtml}</td>${grp}</tr>`;
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
    const limit = wrap.getBoundingClientRect().right - 12;
    const maniaVisible = wrap.scrollLeft > 0 && maniaHeading.getBoundingClientRect().left <= limit;
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
