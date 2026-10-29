/* One direct implementation for the initial racing scroll positions across all screens. */
(function () {
  "use strict";
  document.querySelectorAll(".race-table-wrap").forEach(function (wrap) {
    function sync() { wrap.classList.toggle("scrolled", wrap.scrollLeft > 24); }
    wrap.addEventListener("scroll", sync, {passive: true});
    sync();
  });
  document.querySelectorAll(".hscroll-inner").forEach(function (box) {
    var active = box.querySelector(".rchip.live") || box.querySelector(".rchip.next, .race-tab.active, .active");
    if (!active) return;
    var outer = box.parentElement;
    if (outer && outer.classList.contains("has-past")) {
      box.scrollLeft = Math.max(0, active.offsetLeft - box.offsetLeft - 34);
    } else {
      var right = active.offsetLeft + active.offsetWidth;
      if (right > box.clientWidth - 26) box.scrollLeft = right - box.clientWidth + 34;
    }
  });
})();
