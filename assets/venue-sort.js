/* Shared inline venue sorting for SCR-02 prediction pages. */
(() => {
  "use strict";

  const scrollArea = document.querySelector(".phone-inner > .scroll-area");
  const options = [...document.querySelectorAll(".venue-sort-options [data-sort]")];
  const cards = [...(scrollArea?.querySelectorAll(":scope > .venue-card") || [])];
  if (!scrollArea || options.length < 2 || options.length > 3 || !cards.length) return;

  const originalPosition = new Map(cards.map((card, index) => [card, index]));
  const sortKey = {
    deadline: "sortDeadline",
    grade: "sortGrade",
    venue: "sortVenue",
  };

  function applySort(option) {
    const field = sortKey[option.dataset.sort];
    if (!field) return;

    options.forEach((candidate) => {
      const active = candidate === option;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    const ordered = [...cards].sort(
      (a, b) =>
        Number(a.dataset[field]) - Number(b.dataset[field]) ||
        originalPosition.get(a) - originalPosition.get(b)
    );
    const spacer = scrollArea.querySelector(":scope > .content-end-spacer");
    ordered.forEach((card) => scrollArea.insertBefore(card, spacer));
  }

  options.forEach((option) => option.addEventListener("click", () => applySort(option)));
  // Keep the selected sort button consistent with the initially displayed order.
  const selected = options.find((option) => option.classList.contains("active"));
  if (selected) applySort(selected);
})();
