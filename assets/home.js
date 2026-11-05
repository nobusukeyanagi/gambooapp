/* Gamboo home: carousel, payout visibility, and demo deadline states. DOM runs after markup. */
// Seven repeating runs provide enough buffer that a fast swipe never
      // collides with the physical end of the track.
      document.querySelectorAll(".bn-carousel").forEach(function (box) {
        var track = box.querySelector(".bn-track");
        var dots = Array.from(box.querySelectorAll(".bn-dots i"));
        var originals = Array.from(track.children);
        var count = originals.length;
        if (count < 2) return;
        var ms = +box.getAttribute("data-interval") || 3500;
        var touching = false;
        var pauseUntil = 0;
        var settleTimer;
        var normalizationPending = false;
        var copiesEachSide = 3;
        var centerIndex = copiesEachSide * count;
        var wheelUntil = 0;

        // Repeat to both sides, and start in the center of the track.
        function copyRun() {
          var fragment = document.createDocumentFragment();
          originals.forEach(function (slide) {
            var clone = slide.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            // Cloned slides retain pointer links, but only original links enter tab navigation.
            clone.tabIndex = -1;
            fragment.appendChild(clone);
          });
          return fragment;
        }
        for (var n = 0; n < copiesEachSide; n++) {
          track.insertBefore(copyRun(), track.firstChild);
          track.appendChild(copyRun());
        }

        function step() {
          return track.children[1].offsetLeft - track.children[0].offsetLeft;
        }
        function logicalIndex() {
          var index = Math.round(track.scrollLeft / step()) - centerIndex;
          return ((index % count) + count) % count;
        }
        function syncDots() {
          var selected = logicalIndex();
          dots.forEach(function (dot, index) {
            dot.classList.toggle("on", index === selected);
          });
        }
        function jumpWithoutAnimation(left) {
          normalizationPending = true;
          var snap = track.style.scrollSnapType;
          var behavior = track.style.scrollBehavior;
          track.style.scrollSnapType = "none";
          track.style.scrollBehavior = "auto";
          track.scrollLeft = left;
          // Re-enable snap after the browser has applied the invisible jump.
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              track.style.scrollSnapType = snap;
              track.style.scrollBehavior = behavior;
              normalizationPending = false;
              syncDots();
            });
          });
        }
        function recenter() {
          if (touching || normalizationPending || Date.now() < wheelUntil) return;
          var stride = step();
          if (!stride) return;
          var position = Math.round(track.scrollLeft / stride);
          var cycles = Math.floor((position - centerIndex) / count);
          if (cycles) {
            // Preserve the fractional offset during the invisible rebase.
            jumpWithoutAnimation(track.scrollLeft - cycles * count * stride);
          }
        }
        function scheduleRecenter() {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(recenter, 350);
        }
        track.addEventListener("scroll", function () {
          syncDots();
          if (!normalizationPending) scheduleRecenter();
        }, { passive: true });
        // scrollend is used when available; the debounce above is the fallback.
        track.addEventListener("scrollend", recenter);
        track.addEventListener("pointerdown", function () {
          touching = true;
          pauseUntil = Date.now() + ms;
        });
        function endTouch() {
          touching = false;
          scheduleRecenter();
        }
        window.addEventListener("pointerup", endTouch);
        window.addEventListener("pointercancel", endTouch);
        track.addEventListener("wheel", function () {
          pauseUntil = Date.now() + ms;
          wheelUntil = Date.now() + 280;
          scheduleRecenter();
        }, { passive: true });

        track.querySelectorAll("img").forEach(function (img) {
          img.addEventListener("error", function () { img.parentElement.classList.add("noimg"); });
          if (img.complete && !img.naturalWidth) img.parentElement.classList.add("noimg");
        });

        // Start from the middle run, so swiping either direction works.
        jumpWithoutAnimation(centerIndex * step());
        window.addEventListener("resize", function () {
          // Read the selected dot, rather than using an old scroll offset
          // with a newly calculated responsive slide width.
          var current = dots.findIndex(function (dot) { return dot.classList.contains("on"); });
          jumpWithoutAnimation((centerIndex + Math.max(0, current)) * step());
        });
        setInterval(function () {
          if (touching || normalizationPending || Date.now() < pauseUntil) return;
          var stride = step();
          if (!stride) return;
          var position = Math.round(track.scrollLeft / stride);
          var cycles = Math.floor((position - centerIndex) / count);
          var next = position + 1;
          if (cycles) {
            jumpWithoutAnimation(track.scrollLeft - cycles * count * stride);
            // Wait for the snap settings to be restored before animating.
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                track.scrollTo({ left: (next - cycles * count) * stride, behavior: "smooth" });
              });
            });
          } else {
            track.scrollTo({ left: next * stride, behavior: "smooth" });
          }
        }, ms);
      });

;



/* Static three-day racing calendar, viewed from 2026-11-03 12:30 JST.
   The first three keirin cards remain intentionally fictional grade samples. */
(function () {
  "use strict";
  var schedule = {"2026-11-02":{"keirin":[{"venue":"防府","grade":"GⅢ","day":"3日目","period":"","girls":false,"race":"","deadline":""},{"venue":"久留米","grade":"FⅠ","day":"2日目","period":"ナイター","girls":false,"race":"","deadline":""},{"venue":"豊橋","grade":"FⅠ","day":"初日","period":"ナイター","girls":true,"race":"","deadline":""},{"venue":"熊本","grade":"FⅡ","day":"最終日","period":"モーニング","girls":false,"race":"","deadline":""},{"venue":"小田原","grade":"FⅡ","day":"2日目","period":"モーニング","girls":true,"race":"","deadline":""},{"venue":"静岡","grade":"FⅡ","day":"初日","period":"ミッドナイト","girls":true,"race":"","deadline":""},{"venue":"奈良","grade":"FⅡ","day":"初日","period":"ミッドナイト","girls":false,"race":"","deadline":""},{"venue":"武雄","grade":"FⅡ","day":"初日","period":"ミッドナイト","girls":true,"race":"","deadline":""}],"autorace":[{"venue":"浜松","grade":"SG","day":"5日目","period":"","girls":false,"race":"","deadline":""},{"venue":"川口","grade":"普通","day":"2日目","period":"ナイター","girls":false,"race":"","deadline":""}]},"2026-11-03":{"keirin":[{"venue":"青森","grade":"FⅠ","day":"初日","period":"","girls":false,"race":"5R","deadline":"12:39"},{"venue":"防府","grade":"GⅢ","day":"最終日","period":"","girls":false,"race":"5R","deadline":"12:52"},{"venue":"豊橋","grade":"FⅠ","day":"2日目","period":"ナイター","girls":true,"race":"1R","deadline":"15:45"},{"venue":"久留米","grade":"FⅠ","day":"最終日","period":"ナイター","girls":false,"race":"1R","deadline":"15:59"},{"venue":"静岡","grade":"FⅡ","day":"2日目","period":"ミッドナイト","girls":true,"race":"1R","deadline":"20:36"},{"venue":"奈良","grade":"FⅡ","day":"2日目","period":"ミッドナイト","girls":false,"race":"1R","deadline":"20:44"},{"venue":"武雄","grade":"FⅡ","day":"2日目","period":"ミッドナイト","girls":true,"race":"1R","deadline":"20:52"},{"venue":"小田原","grade":"FⅡ","day":"最終日","period":"モーニング","girls":true,"race":"","deadline":""}],"autorace":[{"venue":"浜松","grade":"SG","day":"最終日","period":"","girls":false,"race":"6R","deadline":"12:42"},{"venue":"川口","grade":"普通","day":"3日目","period":"ナイター","girls":false,"race":"1R","deadline":"18:48"}]},"2026-11-04":{"keirin":[{"venue":"青森","grade":"FⅠ","day":"2日目","period":"","girls":false,"race":"","deadline":""},{"venue":"取手","grade":"FⅡ","day":"初日","period":"モーニング","girls":false,"race":"","deadline":""},{"venue":"大宮","grade":"FⅠ","day":"初日","period":"","girls":false,"race":"","deadline":""},{"venue":"豊橋","grade":"FⅠ","day":"最終日","period":"ナイター","girls":true,"race":"","deadline":""},{"venue":"静岡","grade":"FⅡ","day":"最終日","period":"ミッドナイト","girls":true,"race":"","deadline":""},{"venue":"奈良","grade":"FⅡ","day":"最終日","period":"ミッドナイト","girls":false,"race":"","deadline":""},{"venue":"武雄","grade":"FⅡ","day":"最終日","period":"ミッドナイト","girls":true,"race":"","deadline":""},{"venue":"別府","grade":"FⅡ","day":"初日","period":"ナイター","girls":true,"race":"","deadline":""}],"autorace":[{"venue":"川口","grade":"普通","day":"最終日","period":"ナイター","girls":false,"race":"","deadline":""},{"venue":"山陽","grade":"普通","day":"初日","period":"","girls":false,"race":"","deadline":""}]}};
  var gradeStyles = {"GP":["g-gp","GP"],"SG":["g-sg","SG"],"GⅠ":["g-g1","GⅠ"],"特GⅠ":["g-g1","特GⅠ"],"GⅡ":["g-g2","GⅡ"],"GⅢ":["g-g3","GⅢ"],"FⅠ":["g-f1","FⅠ"],"FⅡ":["g-f2","FⅡ"],"普通":["g-f2","普通"]};
  // Track numbers define the canonical north-to-south order within a grade.
  var gradePriority = {"GP":0,"SG":1,"GⅠ":2,"特GⅠ":2,"GⅡ":3,"GⅢ":4,"FⅠ":5,"FⅡ":6,"普通":7};
  var venueNumber = {"函館":11,"青森":12,"いわき平":13,"取手":23,"大宮":25,"京王閣":27,"小田原":36,"静岡":38,"豊橋":45,"奈良":53,"玉野":61,"防府":63,"小倉":81,"久留米":82,"武雄":84,"別府":86,"熊本":87,"伊勢崎":1,"川口":2,"浜松":3,"山陽":4,"飯塚":5};
  function byGradeThenVenue(a,b) {
    return (gradePriority[a.grade] ?? 99) - (gradePriority[b.grade] ?? 99) ||
      (venueNumber[a.venue] ?? 999) - (venueNumber[b.venue] ?? 999);
  }
  var girlsHeart = "<span class=\"girls\" role=\"img\" aria-label=\"ガールズ\"><svg class=\"girls-heart-icon\" viewBox=\"0 0 24 24\" preserveAspectRatio=\"none\" aria-hidden=\"true\" focusable=\"false\"><use href=\"./assets/bottom-nav-icons.svg?v=16#girls-heart\"></use></svg></span>";
  var referenceDay = "2026-11-03";
  var referenceMinutes = 12 * 60 + 30;
  var tabs = Array.from(document.querySelectorAll(".scroll-area > .date-tabs [data-date]"));
  var keirinGrid = document.querySelector('[data-home-venues="keirin"]');
  var autoGrid = document.querySelector('[data-home-venues="autorace"]');
  if (tabs.length !== 3 || !keirinGrid || !autoGrid) return;
  function makeTile(data, sport, date) {
    var grade = gradeStyles[data.grade];
    if (!grade) return null;
    var today = date === referenceDay, upcoming = today && Boolean(data.deadline);
    var ended = date < referenceDay || (today && !upcoming);
    var tile = document.createElement("div");
    tile.className = "vcard" + (sport === "autorace" ? " auto" : "") +
      (ended ? " ended" : "") + (date > referenceDay ? " presale" : "");
    tile.dataset.venue = data.venue;
    tile.dataset.scheduleDate = date;
    var tags = (data.period ? '<span class="kubun">' + data.period + '</span>' : '') +
      (data.girls ? girlsHeart : '');
    var status = upcoming
      ? '<span class="vcard-r">' + data.race + '</span><span class="vcard-dl" data-deadline="' +
        data.deadline + '"><span class="deadline-time">' + data.deadline + '</span></span>'
      : '<span class="vcard-dl">' + (ended ? '発売終了' : '発売前') + '</span>';
    tile.innerHTML =
      '<div class="vcard-top"><span class="gbadge ' + grade[0] + '">' + grade[1] +
      '</span><span class="vcard-day">' + data.day + '</span></div>' +
      '<div class="vcard-name">' + data.venue + '</div>' +
      '<div class="vcard-tags">' + tags + '</div>' +
      '<div class="vcard-bottom">' + status + '</div>';
    return tile;
  }
  function markSoon(grid) {
    grid.querySelectorAll(".vcard:not([data-demo]) .vcard-dl[data-deadline]").forEach(function (item) {
      var pieces = item.dataset.deadline.split(":");
      var remain = (+pieces[0] * 60 + +pieces[1]) - referenceMinutes;
      var soon = remain > 0 && remain <= 20;
      item.classList.toggle("soon", soon);
      item.closest(".vcard").classList.toggle("deadline-soon", soon);
      var text = item.querySelector(".deadline-time");
      if (text) text.textContent = soon ? remain + "分前" : item.dataset.deadline;
      if (soon) {
        item.setAttribute("aria-label", "締切" + remain + "分前（" + item.dataset.deadline + "）");
        item.setAttribute("title", "締切まで" + remain + "分");
      } else {
        item.removeAttribute("aria-label");
        item.removeAttribute("title");
      }
    });
  }
  function showDay(date) {
    var data = schedule[date];
    if (!data) return;
    keirinGrid.querySelectorAll('.vcard[data-demo]').forEach(function (tile) {
      tile.hidden = date !== referenceDay;
    });
    [keirinGrid, autoGrid].forEach(function (grid, index) {
      var sport = index === 0 ? "keirin" : "autorace";
      grid.querySelectorAll(".vcard:not([data-demo])").forEach(function (tile) { tile.remove(); });
      var fragment = document.createDocumentFragment();
      data[sport].slice().sort(byGradeThenVenue).forEach(function (entry) {
        var tile = makeTile(entry, sport, date);
        if (tile) fragment.appendChild(tile);
      });
      grid.appendChild(fragment);
      grid.dataset.snapshot = date + "T12:30:00+09:00";
      markSoon(grid);
    });
    tabs.forEach(function (tab) {
      var active = tab.dataset.date === date;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () { showDay(tab.dataset.date); });
    tab.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        tab.click();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        var next = tabs[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3];
        next.click();
        next.focus();
      }
    });
  });
  var mainTab = tabs.find(function (tab) { return tab.dataset.date === referenceDay; });
  if (mainTab) mainTab.title = mainTab.title.replace("12:00時点", "12:30時点");
  showDay(referenceDay);
})();
