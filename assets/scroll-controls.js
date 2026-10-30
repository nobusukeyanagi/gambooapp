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
    if (mode === "venue-list" && box.closest(".venue-card")) {
      // Show the next purchasable race at the left of the visible R bar.
      // Closed/confirmed and already-closed "live" races stay off-screen
      // to the left. Reserve the left arrow strip so it never hides this R.
      var current = box.querySelector(".rchip.next") ||
        box.querySelector(".rchip:not(.closed):not(.live):not(.canceled)");
      if (!current) return;
      var arrow = box.parentElement.querySelector(".hscroll-cue-l");
      var clearance = arrow ? arrow.getBoundingClientRect().width + 8 : 0;
      var offset = current.getBoundingClientRect().left - box.getBoundingClientRect().left;
      var max = Math.max(0, box.scrollWidth - box.clientWidth);
      box.scrollLeft = Math.max(0, Math.min(max, box.scrollLeft + offset - clearance));
      return;
    }
    var active = box.querySelector(".active");
    if (!active) return;
    var right = active.offsetLeft + active.offsetWidth;
    if (right > box.clientWidth - 26) box.scrollLeft = right - box.clientWidth + 34;
  });
  /* SCR-02 race rows: arrows are full-height, keyboard accessible scroll controls. */
  if (mode === "venue-list") {
    document.querySelectorAll(".venue-card .hscroll").forEach(function (outer) {
      var box = outer.querySelector(".hscroll-inner");
      var left = outer.querySelector(".hscroll-cue-l");
      var right = outer.querySelector(".hscroll-cue");
      if (!box || !left || !right) return;

      // A single arrow tap jumps all the way to the first / last R.
      // Use the scroll container's real maximum, never an oversized offset.
      function maxLeft() {
        return Math.max(0, box.scrollWidth - box.clientWidth);
      }
      function sync() {
        var current = Math.max(0, Math.min(maxLeft(), box.scrollLeft));
        left.hidden = current <= 1;
        right.hidden = current >= maxLeft() - 1;
      }
      left.addEventListener("click", function () {
        box.scrollTo({ left: 0, behavior: "smooth" });
      });
      right.addEventListener("click", function () {
        box.scrollTo({ left: maxLeft(), behavior: "smooth" });
      });
      box.addEventListener("scroll", sync, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(sync).observe(box);
      }
      requestAnimationFrame(sync);
    });
  }
})();
