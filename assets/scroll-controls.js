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
})();
