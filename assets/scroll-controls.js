/* Canonical initialization for horizontal tabs; preserve each screen's original scroll mode. */
(function () {
  "use strict";
  var script = document.currentScript;
  var mode = script && script.getAttribute("data-scroll-mode") || "standard";
  if (mode === "keirin-detail") {
    document.querySelectorAll(".race-table-wrap").forEach(function (wrap) {
      function sync() { wrap.classList.toggle("scrolled", wrap.scrollLeft > 24); }
      wrap.addEventListener("scroll", sync, { passive: true });
      sync();
    });
  }
  document.querySelectorAll(".hscroll-inner").forEach(function (box) {
    var active = mode === "venue-list"
      ? box.querySelector(".rchip.live") || box.querySelector(".rchip.next, .race-tab.active, .active")
      : box.querySelector(".active");
    if (!active) return;
    var outer = box.parentElement;
    if (mode === "venue-list" && outer && outer.classList.contains("has-past")) {
      box.scrollLeft = Math.max(0, active.offsetLeft - box.offsetLeft - 34);
    } else {
      var right = active.offsetLeft + active.offsetWidth;
      if (right > box.clientWidth - 26) box.scrollLeft = right - box.clientWidth + 34;
    }
  });
  /* SCR-02 race rows: arrows are full-height, keyboard accessible scroll controls. */
  if (mode === "venue-list") {
    document.querySelectorAll(".venue-card .hscroll").forEach(function (outer) {
      var box = outer.querySelector(".hscroll-inner");
      var left = outer.querySelector(".hscroll-cue-l");
      var right = outer.querySelector(".hscroll-cue");
      if (!box || !left || !right) return;

      // Scroll in R-column increments rather than one almost-full viewport.
      // The last target is capped at the actual content end: no empty tail.
      var requestedLeft = box.scrollLeft;
      var isButtonScrolling = false;
      function maxLeft() {
        return Math.max(0, box.scrollWidth - box.clientWidth);
      }
      function sync() {
        var max = maxLeft();
        var current = Math.max(0, Math.min(max, box.scrollLeft));
        left.hidden = current <= 1;
        right.hidden = current >= max - 1;
        if (isButtonScrolling && Math.abs(current - requestedLeft) <= 1) {
          isButtonScrolling = false;
        }
        if (!isButtonScrolling) requestedLeft = current;
      }
      function scroll(direction) {
        var columns = Array.from(box.querySelectorAll(".rchips > .rcol"));
        if (!columns.length) return;
        var max = maxLeft();
        var base = Math.max(0, Math.min(max, isButtonScrolling ? requestedLeft : box.scrollLeft));
        var firstLeft = columns[0].getBoundingClientRect().left;
        var offsets = columns.map(function (col) {
          return col.getBoundingClientRect().left - firstLeft;
        });
        var index = 0;
        offsets.forEach(function (offset, i) {
          if (offset <= base + 1) index = i;
        });
        // Two race buttons per tap, including variable-width active races.
        var nextIndex = Math.max(0, Math.min(columns.length - 1, index + direction * 2));
        var target = Math.max(0, Math.min(max, offsets[nextIndex]));
        if (Math.abs(target - base) < 1) return;
        requestedLeft = target;
        isButtonScrolling = true;
        box.scrollTo({ left: target, behavior: "smooth" });
      }
      left.addEventListener("click", function () { scroll(-1); });
      right.addEventListener("click", function () { scroll(1); });
      // Direct finger/trackpad movement takes priority over button targets.
      box.addEventListener("pointerdown", function () {
        isButtonScrolling = false;
        requestedLeft = box.scrollLeft;
      }, { passive: true });
      box.addEventListener("wheel", function () {
        isButtonScrolling = false;
      }, { passive: true });
      box.addEventListener("scroll", sync, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(sync).observe(box);
      }
      requestAnimationFrame(sync);
    });
  }
})();
