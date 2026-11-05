/* SCR-03 race selector follows the published SCR-02 Hofu schedule.
 * The HTML contains a verified 12-race fallback, so the screen also works if
 * the optional same-origin schedule refresh is unavailable. */
(() => {
  "use strict";
  const bar = document.querySelector(".keirin-race-selector");
  if (!bar) return;
  const tabs = [...bar.querySelectorAll(".race-tab[data-race]")];
  if (tabs.length !== 12) return;

  const plusFiveMinutes = (cutoff) => {
    const match = /^(\d{2}):(\d{2})$/.exec(cutoff || "");
    if (!match) return null;
    const total = Number(match[1]) * 60 + Number(match[2]) + 5;
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" +
      String(total % 60).padStart(2, "0");
  };
  const updateBand = (tab, label) => {
    let band = tab.querySelector(".race-state-band");
    if (!label) {
      band?.remove();
      return;
    }
    if (!band) {
      band = document.createElement("span");
      band.className = "race-state-band";
      tab.insertBefore(band, tab.firstChild);
    }
    band.textContent = label;
  };
  const refresh = async () => {
    const response = await fetch(bar.dataset.sourcePage || "./SCR-02_keirin.html", {
      cache: "force-cache"
    });
    if (!response.ok) throw new Error("Cannot load SCR-02 race schedule");
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const venue = doc.querySelector('.venue-card[data-venue="防府"]');
    if (!venue) throw new Error("Hofu race data was not found in SCR-02");
    const sourceRaces = [...venue.querySelectorAll(".rcol > .rchip")];
    if (sourceRaces.length !== tabs.length) {
      throw new Error("Hofu schedule has an unexpected number of races");
    }

    // Validate the whole schedule before updating any button.
    const entries = sourceRaces.map((race, index) => {
      const cutoff = race.getAttribute("data-closing-time");
      const startTime = plusFiveMinutes(cutoff);
      if (!startTime || race.querySelector("b")?.textContent.trim() !== (index + 1) + "R") {
        throw new Error("Unusable race time for " + (index + 1) + "R");
      }
      return {
        cutoff, startTime,
        raceType: race.dataset.raceType || "",
        past: race.classList.contains("closed"),
        soon: race.classList.contains("soon"),
        rebate: !!race.querySelector(".rchip-rebate"),
        countdown: race.querySelector(".rchip-warning")?.textContent.trim() || ""
      };
    });
    entries.forEach((entry, index) => {
      const tab = tabs[index];
      tab.dataset.closingTime = entry.cutoff;
      tab.classList.toggle("past", entry.past);
      tab.classList.toggle("soon", entry.soon);
      tab.classList.toggle("rebate", entry.rebate);
      tab.title = entry.raceType + " ／ 締切 " + entry.cutoff + " ／ 発走 " + entry.startTime;
      const startTime = tab.querySelector("small");
      if (startTime) startTime.textContent = entry.startTime;
      // Urgent red takes priority over a gold rebate, as on SCR-02.
      updateBand(tab, entry.soon ? entry.countdown : (entry.rebate ? "5%還元" : ""));
    });
  };
  refresh().catch((error) => {
    // Keep the initially rendered 12 verified start times and visual statuses.
    console.warn("SCR-03 is using the embedded SCR-02 schedule snapshot.", error);
  });
})();
