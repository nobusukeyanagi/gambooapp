/* SCR-210: shared LIVE / digest layout preview.
 * Actual MPD/MP4 sources and playback initialization belong to production.
 * ?video=digest changes the preview label without changing fixture data.
 */
(() => {
  "use strict";
  const button = document.querySelector("[data-video-toggle]");
  const panel = document.getElementById("race-video-panel");
  if (!button || !panel) return;
  const scroller = panel.parentElement;
  const shell = scroller.parentElement;
  const header = scroller.previousElementSibling;
  const video = panel.querySelector("video");
  const label = panel.querySelector(".race-video-label");
  const digest = new URLSearchParams(location.search).get("video") === "digest";
  const title = digest ? "ダイジェスト映像" : "LIVE中継";
  button.querySelector("[data-video-button-label]").textContent = digest ? "映像" : "LIVE";
  panel.setAttribute("aria-label", title);
  video.setAttribute("aria-label", title);
  label.textContent = title;
  let previousScroll = scroller.scrollTop;
  const hiddenClass = "race-video-header-hidden";
  function setHeaderHidden(hidden) {
    if (shell.classList.contains(hiddenClass) === hidden) return;
    shell.classList.toggle(hiddenClass, hidden);
    // Flush the flex layout before recording scrollTop: expanding the
    // scrollport can clamp scrollTop at the bottom. Do not treat that as a gesture.
    previousScroll = scroller.scrollTop;
  }
  scroller.addEventListener("scroll", () => {
    const current = scroller.scrollTop;
    const direction = current - previousScroll;
    previousScroll = current;
    if (panel.hidden || !direction) return;
    const pinned = panel.getBoundingClientRect().top <= scroller.getBoundingClientRect().top + 1;
    if (direction < 0 || !pinned) {
      setHeaderHidden(false);
    } else if (!header.contains(document.activeElement)) {
      setHeaderHidden(true);
    }
  }, { passive: true });

  button.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute("aria-pressed", String(open));
    button.setAttribute("aria-expanded", String(open));
    shell.classList.toggle("race-video-open", open);
    if (!open) {
      video.pause();
      setHeaderHidden(false);
    }
    previousScroll = scroller.scrollTop;
  });
})();
