/* SCR-210 / SCR-310: shared LIVE and digest layout preview.
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
  const info = panel.previousElementSibling;
  const video = panel.querySelector("video");
  const label = panel.querySelector(".race-video-label");
  const digest = new URLSearchParams(location.search).get("video") === "digest";
  const title = digest ? "ダイジェスト映像" : "LIVE中継";
  button.querySelector("[data-video-button-label]").textContent = digest ? "映像" : "LIVE";
  panel.setAttribute("aria-label", title);
  video.setAttribute("aria-label", title);
  label.textContent = title;

  let previousScroll = scroller.scrollTop;
  let headerOffset = 0;
  const clamp = (value, max) => Math.max(0, Math.min(value, max));
  const headerHeight = () => header.getBoundingClientRect().height;
  function setHeaderOffset(value) {
    const height = headerHeight();
    const next = clamp(value, height);
    if (next !== headerOffset) {
      headerOffset = next;
      if (next) header.style.setProperty("--race-video-header-offset", next + "px");
      else header.style.removeProperty("--race-video-header-offset");
    }
    header.inert = height > 0 && next >= height;
    // Layout can clamp the scroll position at the very bottom. Do not
    // interpret the resulting scroll event as a reversal of the gesture.
    previousScroll = scroller.scrollTop;
  }
  scroller.addEventListener("scroll", () => {
    const current = scroller.scrollTop;
    const delta = current - previousScroll;
    previousScroll = current;
    if (panel.hidden || !delta) return;

    // Natural panel position, relative to the start of the scroll content.
    // Use the preceding race-info box because the player itself is sticky.
    const threshold = current + info.getBoundingClientRect().bottom -
      scroller.getBoundingClientRect().top;
    const beyond = Math.max(0, current - threshold);
    if (header.contains(document.activeElement)) {
      setHeaderOffset(0);
      return;
    }
    const movement = delta > 0 ? Math.min(delta, beyond) : delta;
    // After reaching the sticky position, each additional scroll pixel
    // hides one pixel of header; an upward scroll restores it in reverse.
    setHeaderOffset(Math.min(headerOffset + movement, beyond));
  }, { passive: true });

  header.addEventListener("focusin", () => setHeaderOffset(0));
  window.addEventListener("resize", () => {
    if (panel.hidden) return;
    const beyond = Math.max(0, scroller.getBoundingClientRect().top -
      info.getBoundingClientRect().bottom);
    setHeaderOffset(Math.min(headerOffset, beyond));
  }, { passive: true });

  button.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute("aria-pressed", String(open));
    button.setAttribute("aria-expanded", String(open));
    shell.classList.toggle("race-video-open", open);
    if (!open) {
      video.pause();
      setHeaderOffset(0);
    }
    previousScroll = scroller.scrollTop;
  });
})();
