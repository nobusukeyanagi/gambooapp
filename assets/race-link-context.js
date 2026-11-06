/* Display the selected meeting and race when opening a prediction detail.
   Underlying race tables are intentionally shared prototype sample data. */
(() => {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const venue = params.get("venue")?.trim() || "";
  const day = params.get("day")?.trim() || "";
  const race = Number(params.get("race"));
  if (!venue || !day || !Number.isInteger(race) || race < 1 || race > 12) return;

  // SCR-210 currently displays the verified Hofu 5R sample only. Do not
  // overwrite its purchase link or select a different race with 5R statistics.
  if (document.querySelector(".ri-race-purchase")) return;

  const header = document.querySelector(".page-header-title");
  if (header && !header.hasAttribute("data-static-title")) header.textContent = venue + " " + day;

  const heading = document.querySelector(".ri-race");
  if (heading) {
    const label = [...heading.childNodes].find((node) => node.nodeType === 3);
    if (label) label.textContent = race + "R";
  }

  const bar = document.querySelector(".race-tabs");
  if (!bar) return;
  let selected = null;
  [...bar.querySelectorAll(".race-tab")].forEach((tab) => {
    const n = Number(tab.querySelector("b")?.textContent.replace("R", ""));
    tab.classList.remove("active");
    if (!bar.closest(".keirin-race-selector")) tab.classList.remove("soon");
    if (n === race) selected = tab;
  });

  // The prototype has eight sample tabs; supply neutral placeholders for 9-12R.
  const last = Math.max(0, ...[...bar.querySelectorAll(".race-tab b")]
    .map((node) => Number(node.textContent.replace("R", "")) || 0));
  for (let n = last + 1; n <= race; n++) {
    const tab = document.createElement("div");
    tab.className = "race-tab";
    const label = document.createElement("b");
    label.textContent = n + "R";
    const status = document.createElement("small");
    status.textContent = "—";
    tab.append(label, status);
    bar.append(tab);
    if (n === race) selected = tab;
  }
  if (selected) {
    if (!bar.closest(".keirin-race-selector")) selected.classList.remove("past", "canceled");
    selected.classList.add("active");
    const status = selected.querySelector("small");
    if (status && !bar.closest(".keirin-race-selector")) status.textContent = "選択中";
    const scroller = bar.closest(".hscroll-inner");
    if (scroller) {
      requestAnimationFrame(() => {
        const selectedCenter = selected.offsetLeft + selected.offsetWidth / 2;
        scroller.scrollLeft = Math.max(0, selectedCenter - scroller.clientWidth / 2);
      });
    }
  }
})();
