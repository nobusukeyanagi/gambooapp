/* Shared auto race detail screen interactions. */
function stickHead(root) {
        root.querySelectorAll("table.at thead").forEach(function (th) {
          var rows = th.querySelectorAll("tr");
          var top = 0;
          rows.forEach(function (tr, i) {
            tr.querySelectorAll("th").forEach(function (c) { if (!c.hasAttribute("rowspan") || i > 0) c.style.top = top + "px"; else c.style.top = "0px"; });
            top += tr.getBoundingClientRect().height;
          });
        });
      }
      stickHead(document);
      document.addEventListener("scroll", function (e) {
        var w = e.target;
        if (w.classList && w.classList.contains("at-wrap")) w.classList.toggle("scrolled", w.scrollLeft > 24);
      }, true);
      document.querySelectorAll(".info-tabs .info-tab[data-tab]").forEach(function (t) {
        t.addEventListener("click", function () { setTimeout(function () { stickHead(t.closest(".phone-inner")); }, 0); });
      });
;
document.querySelectorAll(".info-tabs .info-tab[data-tab]").forEach(function (t) {
        t.addEventListener("click", function () {
          var inner = t.closest(".phone-inner");
          inner.querySelectorAll(".info-tab[data-tab]").forEach(function (x) { x.classList.toggle("active", x === t); });
          inner.querySelectorAll(".at-wrap").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-panel") === t.getAttribute("data-tab")); });
        });
      });
      document.querySelectorAll(".dt-bar .sw").forEach(function (sw) {
        sw.addEventListener("click", function () {
          var on = sw.getAttribute("aria-checked") !== "true";
          sw.setAttribute("aria-checked", on ? "true" : "false");
          sw.closest(".at-wrap").classList.toggle("detail", on);
        });
      });
;
(function () {
        var MK = { "◎": "dbl", "○": "o", "△": "tri", "✕": "x" };
        function mk(m) { return MK[m] ? '<span class="mark ' + MK[m] + '">' + m + "</span>" : ""; }
        var ITEMS = [
          { t: "走路状況別成績", c: function (w) { return "対象条件：" + (w ? "湿走路" : "良走路"); }, n: "同じ走路状況で走った過去1年の成績" },
          { t: "走路温度別成績", c: function () { return "対象条件：走路温度 20℃未満"; }, n: "走路温度の区分（20℃未満／20〜40℃／40℃以上）別の成績" },
          { t: "試走タイム別成績", c: function () { return "対象条件：今回の試走T順位"; }, n: "試走タイムの順位が今回と同じだったときの成績" },
          { t: "ハンデ別成績", c: function () { return "対象条件：今回のハンデ位置"; }, n: "今回と同じハンデ位置から走ったときの成績" },
          { t: "レース場別成績", c: function () { return "対象条件：川口オートレース場"; }, n: "川口で走った過去1年の成績" },
          { t: "競走車別成績", c: function () { return "対象条件：今回の競走車"; }, n: "今回と同じ競走車で走ったときの成績" },
          { t: "レース種別成績", c: function () { return "対象条件：予選"; }, n: "同じレース種別（予選）での成績" },
          { t: "レース日程別成績", c: function () { return "対象条件：2日目"; }, n: "開催日程（初日／2日目／最終日 等）別の成績" },
          { t: "勝ち上がり率", c: function () { return "対象条件：予選→準決勝"; }, n: "予選から準決勝へ勝ち上がった割合" }
        ];
        var BASE = { "◎": [20, 8, 5, 3], "○": [18, 5, 4, 3], "△": [16, 3, 3, 3], "✕": [14, 1, 2, 2], "": [12, 1, 1, 2] };
        function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

        function isWet(inner) { return inner.querySelector('.at-wrap[data-panel="lab"]').classList.contains("wet"); }

        function render(inner, idx) {
          var it = ITEMS[idx], wet = isWet(inner);
          inner.querySelector(".lsheet-title").textContent = it.t;
          inner.querySelector(".lsheet-cond").textContent = it.c(wet) + (idx === 0 ? "" : "（" + (wet ? "湿走路" : "良走路") + "）");
          inner.querySelector(".lsheet-note").textContent = "※ " + it.n;
          inner.querySelector(".ldt thead").innerHTML = "<tr><th>車</th><th>選手名</th><th>評価</th><th>出走</th><th>1着</th><th>2着</th><th>3着</th><th>勝率</th><th>2連対率</th><th>3連対率</th></tr>";
          var rows = inner.querySelectorAll('.at-wrap[data-panel="lab"] tbody tr');
          var html = "";
          rows.forEach(function (tr, i) {
            var v = tr.querySelectorAll(".lb-v")[idx];
            var m = v.getAttribute(wet ? "data-w" : "data-g");
            var b = BASE[m] || BASE[""];
            var n = b[0] + (i % 3), a = b[1], c = b[2], d = b[3];
            var r1 = pct(a, n), r2 = pct(a + c, n), r3 = pct(a + c + d, n);
            html += "<tr><td>" + tr.querySelector(".wk").outerHTML + '</td><td class="dn">' + tr.querySelector(".rn b").textContent +
              "</td><td>" + (mk(m) || "－") + "</td><td>" + n + "</td><td>" + a + "</td><td>" + c + "</td><td>" + d +
              '</td><td class="rate2' + (r1 >= 30 ? " hi" : "") + '"><b>' + r1 + '%</b><small>' + a + '/' + n + '</small></td><td class="rate2' + (r2 >= 50 ? " hi" : "") + '"><b>' + r2 + '%</b><small>' + (a + c) + '/' + n + '</small></td><td class="rate2' + (r3 >= 60 ? " hi" : "") + '"><b>' + r3 + '%</b><small>' + (a + c + d) + '/' + n + "</small></td></tr>";
          });
          inner.querySelector(".ldt tbody").innerHTML = html;
        }
        function open(inner, idx) {
          render(inner, idx);
          inner.querySelectorAll(".lb-btn").forEach(function (b) { b.classList.toggle("active", +b.getAttribute("data-item") === idx); });
          inner.querySelector(".lsheet").hidden = false;
          inner.querySelector(".lsheet-overlay").hidden = false;
        }
        function close(inner) {
          inner.querySelector(".lsheet").hidden = true;
          inner.querySelector(".lsheet-overlay").hidden = true;
          inner.querySelectorAll(".lb-btn").forEach(function (b) { b.classList.remove("active"); });
        }
        function setWet(inner, wet) {
          var wrap = inner.querySelector('.at-wrap[data-panel="lab"]');
          wrap.classList.toggle("wet", wet);
          var sw = wrap.querySelector(".rd-sw");
          sw.setAttribute("aria-checked", wet ? "true" : "false");
          wrap.querySelectorAll(".rd-lab").forEach(function (l) { l.classList.toggle("on", (l.getAttribute("data-side") === "w") === wet); });
          wrap.querySelectorAll(".lb-v, .lb-tot, .lb-cap").forEach(function (c) {
            var v = c.getAttribute(wet ? "data-w" : "data-g");
            if (c.classList.contains("lb-cap")) c.textContent = v; else c.innerHTML = mk(v);
          });
        }
        function bind(inner) {
          var wrap = inner.querySelector('.at-wrap[data-panel="lab"]');
          wrap.querySelector(".rd-sw").addEventListener("click", function () { setWet(inner, !wrap.classList.contains("wet")); });
          wrap.querySelectorAll(".rd-lab").forEach(function (l) {
            l.addEventListener("click", function () { setWet(inner, l.getAttribute("data-side") === "w"); });
          });
          inner.querySelectorAll(".lb-btn").forEach(function (b) {
            b.addEventListener("click", function () { open(inner, +b.getAttribute("data-item")); });
          });
          inner.querySelector(".lsheet-close").addEventListener("click", function () { close(inner); });
          inner.querySelector(".lsheet-overlay").addEventListener("click", function () { close(inner); });
        }
        var first = document.querySelector(".screen-wrap");
        bind(first.querySelector(".phone-inner"));
        if (document.body.hasAttribute("data-demo-sheet")) {
          var second = first.cloneNode(true);
          second.querySelector(".screen-label").textContent = "SCR-04 データ解析ラボ 詳細（「走路状況」タップ時）";
          first.parentNode.appendChild(second);
          var inner2 = second.querySelector(".phone-inner");
          inner2.querySelectorAll(".info-tab[data-tab]").forEach(function (t) {
            t.addEventListener("click", function () {
              inner2.querySelectorAll(".info-tab[data-tab]").forEach(function (x) { x.classList.toggle("active", x === t); });
              inner2.querySelectorAll(".at-wrap").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-panel") === t.getAttribute("data-tab")); });
            });
          });
          bind(inner2);
          open(inner2, 0);
        }
      })();
