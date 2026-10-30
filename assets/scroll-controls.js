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

      function sync() {
        var max = Math.max(0, box.scrollWidth - box.clientWidth);
        left.hidden = box.scrollLeft <= 1;
        right.hidden = box.scrollLeft >= max - 1;
      }
      function scroll(direction) {
        var distance = Math.max(0, box.clientWidth - 2 * 36);
        box.scrollBy({ left: direction * distance, behavior: "smooth" });
      }
      left.addEventListener("click", function () { scroll(-1); });
      right.addEventListener("click", function () { scroll(1); });
      box.addEventListener("scroll", sync, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(sync).observe(box);
      }
      requestAnimationFrame(sync);
    });
  }
})();
