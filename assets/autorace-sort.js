/* SCR-02 Autorace: interactive sorting sheet in the single racecourse list. */
(() => {
  "use strict";

  const phone = document.querySelector(".phone-inner");
  const trigger = phone?.querySelector(".sort-btn");
  const label = trigger?.querySelector(".sort-btn-label");
  const scrim = phone?.querySelector(".sheet-scrim");
  const sheet = phone?.querySelector(".auto-sort-sheet");
  const scrollArea = phone?.querySelector(".scroll-area");
  const options = [...(sheet?.querySelectorAll(".sort-opt") || [])];
  const cards = [...(scrollArea?.querySelectorAll(":scope > .venue-card") || [])];

  if (!trigger || !label || !scrim || !sheet || options.length !== 3 || cards.length !== 3) return;

  const originalPosition = new Map(cards.map((card, index) => [card, index]));
  const sortKey = {
    deadline: "sortDeadline",
    grade: "sortGrade",
    venue: "sortVenue",
  };

  function setOpen(open) {
    scrim.hidden = !open;
    sheet.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      (sheet.querySelector(".sort-opt.on") || options[0]).focus();
    } else {
      trigger.focus();
    }
  }

  function applySort(option) {
    const key = option.dataset.sort;
    if (!(key in sortKey)) return;

    options.forEach((candidate) => {
      const selected = candidate === option;
      candidate.classList.toggle("on", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });

    label.textContent = option.querySelector("span")?.textContent.trim() || label.textContent;
    const field = sortKey[key];
    const sorted = [...cards].sort(
      (a, b) =>
        Number(a.dataset[field]) - Number(b.dataset[field]) ||
        originalPosition.get(a) - originalPosition.get(b)
    );
    const spacer = scrollArea.querySelector(":scope > .content-end-spacer");
    sorted.forEach((card) => scrollArea.insertBefore(card, spacer));
    setOpen(false);
  }

  trigger.addEventListener("click", () => setOpen(sheet.hidden));
  scrim.addEventListener("click", () => setOpen(false));
  options.forEach((option) => option.addEventListener("click", () => applySort(option)));

  document.addEventListener("keydown", (event) => {
    if (sheet.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      const first = options[0];
      const last = options[options.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
