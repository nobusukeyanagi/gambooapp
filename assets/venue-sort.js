/* Shared inline venue sorting for SCR-02 prediction pages. */
(() => {
  "use strict";

  const scrollArea = document.querySelector(".phone-inner > .scroll-area");
  const options = [...document.querySelectorAll(".venue-sort-options [data-sort]")];
  let cards = [...(scrollArea?.querySelectorAll(":scope > .venue-card") || [])];
  if (!scrollArea || options.length < 2 || options.length > 3 || !cards.length) return;


  /* SCR-02 preset: simulate the published 2026-11-03 12:30 JST snapshot.
     Calculate race states and venue sort keys from the existing cutoff times,
     rather than freezing stale 12:00 status, 5%-rebate bands, and "next" flags. */
  const snapshotDay = "2026-11-03";
  const snapshotMinutes = 12 * 60 + 30;
  const imminentWindowMinutes = 30;
  const snapshotISO = snapshotDay + "T12:30:00+09:00";
  const tab = document.querySelector('.date-tab[data-date="' + snapshotDay + '"]');
  if (tab) tab.title = tab.title.replace("12:00時点", "12:30時点");
  const clockMinutes = (clock) => {
    const time = /^(\d{1,2}):(\d{2})$/.exec(clock || "");
    return time ? Number(time[1]) * 60 + Number(time[2]) : NaN;
  };
  function applySnapshotToCard(card) {
    const racers = [...card.querySelectorAll(".rchip[data-closing-time]")];
    if (!racers.length) return;
    card.dataset.snapshot = snapshotISO;
    let firstPending = null;
    let remainingMin = Infinity;
    racers.forEach((chip) => {
      // A canceled race stays canceled regardless of its scheduled cutoff.
      if (chip.classList.contains("canceled")) return;
      const minutes = clockMinutes(chip.dataset.closingTime);
      if (!Number.isFinite(minutes)) return;
      const remaining = minutes - snapshotMinutes;
      const cutoff = chip.dataset.closingTime;
      const label = chip.getAttribute("aria-label") || "";
      const cleanLabel = label
        .replace(/\s(?:確定|締切)(?=\s|$)/g, "")
        .replace(/\s締切\d+分前(?=\s|$)/g, "");
      const oldWarning = chip.querySelector(".rchip-warning");
      oldWarning?.remove();
      chip.classList.remove("closed", "next", "soon");
      const rebate = chip.querySelector(".rchip-rebate");
      if (rebate) rebate.style.display = "";
      const status = chip.querySelector(":scope > small");
      if (remaining <= 0) {
        const display = remaining >= -15 ? "締切" : "確定";
        chip.classList.add("closed");
        if (status) {
          status.textContent = display;
          status.classList.remove("rchip-time");
        }
        chip.setAttribute("aria-label", cleanLabel.replace("締切" + cutoff, "締切" + cutoff + " " + display));
      } else {
        if (remaining < remainingMin) {
          remainingMin = remaining;
          firstPending = chip;
        }
        const urgent = remaining <= imminentWindowMinutes;
        if (status) {
          status.textContent = cutoff;
          status.classList.add("rchip-time");
        }
        if (urgent) {
          chip.classList.add("soon");
          if (rebate) rebate.style.display = "none";
          const warning = document.createElement("span");
          warning.className = "rchip-warning";
          warning.setAttribute("aria-label", "締切" + remaining + "分前");
          warning.textContent = remaining + "分前";
          chip.insertBefore(warning, chip.firstChild);
        }
        chip.setAttribute("aria-label", cleanLabel.replace("締切" + cutoff,
          "締切" + cutoff + (urgent ? " 締切" + remaining + "分前" : "")));
      }
    });
    if (firstPending) firstPending.classList.add("next");
    card.dataset.sortDeadline = String(Number.isFinite(remainingMin) ? remainingMin : 9999);
  }

  cards.forEach(applySnapshotToCard);
  // Scroll to the next available race once initial sorting has completed.
  function scrollToNextRaces() {
    cards.forEach((card) => {
      const bar = card.querySelector(".hscroll-inner");
      const next = bar?.querySelector(".rchip.next");
      if (!bar || !next) return;
      const arrow = bar.parentElement.querySelector(".hscroll-cue-l");
      const clearance = (arrow?.getBoundingClientRect().width || 0) + 8;
      const offset = next.getBoundingClientRect().left - bar.getBoundingClientRect().left;
      const max = Math.max(0, bar.scrollWidth - bar.clientWidth);
      bar.scrollLeft = Math.max(0, Math.min(max, bar.scrollLeft + offset - clearance));
    });
  }

  let originalPosition = new Map(cards.map((card, index) => [card, index]));
  const sortKey = {
    deadline: "sortDeadline",
    grade: "sortGrade",
    venue: "sortVenue", // Geographic north-to-south rank (not track ID).
  };
  const venueButton = options.find((option) => option.dataset.sort === "venue");
  const directionLabel = venueButton?.querySelector(".sort-direction");
  let currentSort = options.find((option) => option.classList.contains("active"))?.dataset.sort;
  let southFirst = false;

  function applySort(option, fromClick = false, preserveDirection = false) {
    const sort = option.dataset.sort;
    const field = sortKey[sort];
    if (!field) return;

    // First venue tap sorts north-to-south (↓); subsequent taps toggle (↑).
    southFirst = preserveDirection && sort === "venue" ? southFirst
      : sort === "venue" && fromClick && currentSort === "venue"
        ? !southFirst : false;
    currentSort = sort;
    if (directionLabel) directionLabel.textContent =
      sort === "venue" ? (southFirst ? "↑" : "↓") : "";
    if (venueButton) {
      if (sort === "venue") {
        venueButton.setAttribute("aria-label",
          southFirst ? "開催場順（南から北）" : "開催場順（北から南）");
      } else {
        venueButton.removeAttribute("aria-label");
      }
    }

    options.forEach((candidate) => {
      const active = candidate === option;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    const direction = sort === "venue" && southFirst ? -1 : 1;
    const ordered = [...cards].sort(
      (a, b) =>
        direction * (Number(a.dataset[field]) - Number(b.dataset[field])) ||
        originalPosition.get(a) - originalPosition.get(b)
    );
    // Reattaching an already ordered card resets its child race bar's scrollLeft.
    // In particular this used to undo the initial "next race" scroll on SCR-02.
    const currentOrder = [...scrollArea.querySelectorAll(":scope > .venue-card")];
    if (ordered.every((card, index) => card === currentOrder[index])) return;
    const savedScroll = new Map(cards.map((card) => {
      const bar = card.querySelector(".hscroll-inner");
      return [card, { bar, left: bar?.scrollLeft ?? 0 }];
    }));
    const spacer = scrollArea.querySelector(":scope > .content-end-spacer");
    ordered.forEach((card) => scrollArea.insertBefore(card, spacer));
    savedScroll.forEach(({ bar, left }) => {
      if (bar) bar.scrollLeft = left;
    });
  }

  options.forEach((option) => option.addEventListener("click", () => applySort(option, true)));
  document.addEventListener("gamboo:venues-changed", () => {
    cards=[...scrollArea.querySelectorAll(":scope > .venue-card")];
    originalPosition=new Map(cards.map((card,index)=>[card,index]));
    const selected=options.find(option=>option.classList.contains("active"));
    if(selected && cards.length) applySort(selected,false,true);
  });
  // Keep the selected sort button consistent with the initially displayed order.
  const selected = options.find((option) => option.classList.contains("active"));
  if (selected) applySort(selected);
  requestAnimationFrame(scrollToNextRaces);
})();
