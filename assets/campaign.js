/* SCR-400: archive pagination and two-state campaign filter. */
(() => {
  "use strict";
  const pageSize = 20;
  const tabs = Array.from(document.querySelectorAll(".campaign-tab"));
  const list = document.getElementById("campaign-list");
  const pagination = document.querySelector(".campaign-pagination");
  const prev = pagination?.querySelector('[data-page="prev"]');
  const next = pagination?.querySelector('[data-page="next"]');
  const indicator = pagination?.querySelector(".campaign-page-info");
  const empty = list?.querySelector(".campaign-empty");
  if (!list || tabs.length !== 2 || !pagination || !prev || !next || !indicator || !empty) return;

  let status = "open";
  let page = 0;

  function render() {
    const items = Array.from(list.querySelectorAll(".cp-card"));
    const filtered = items.filter((item) => item.dataset.status === status);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.max(0, Math.min(page, totalPages - 1));
    const visible = new Set(filtered.slice(page * pageSize, (page + 1) * pageSize));
    items.forEach((item) => { item.hidden = !visible.has(item); });

    for (const tab of tabs) {
      const selected = tab.dataset.status === status;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) list.setAttribute("aria-labelledby", tab.id);
    }
    pagination.hidden = status !== "closed";
    indicator.textContent = (page + 1) + " / " + totalPages;
    prev.disabled = page === 0;
    next.disabled = page >= totalPages - 1;
    empty.hidden = filtered.length !== 0;
  }
  function changeStatus(value) {
    if (value !== "open" && value !== "closed") return;
    if (value !== status) {
      status = value;
      page = 0;
      list.scrollTop = 0;
    }
    render();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => changeStatus(tab.dataset.status));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const target = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      changeStatus(target.dataset.status);
      target.focus();
    });
  });
  prev.addEventListener("click", () => {
    if (prev.disabled) return;
    page--;
    render();
    list.scrollTop = 0;
  });
  next.addEventListener("click", () => {
    if (next.disabled) return;
    page++;
    render();
    list.scrollTop = 0;
  });
  render();
})();
