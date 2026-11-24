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
      if (next) shell.style.setProperty("--race-video-header-offset", next + "px");
      else shell.style.removeProperty("--race-video-header-offset");
    }
    header.inert = height > 0 && next >= height;
    // The equal-height scroll spacer and header offset preserve the native
    // scroll range. Record the actual position after any layout adjustment.
    previousScroll = scroller.scrollTop;
  }
  scroller.addEventListener("scroll", () => {
    const current = scroller.scrollTop;
    const delta = current - previousScroll;
    previousScroll = current;
    if (panel.hidden || !delta) return;

    // The spacer consumes exactly the scroll distance allocated to the header.
    // Subtract the current spacer height to recover the natural sticky threshold.
    const threshold = current + info.getBoundingClientRect().bottom -
      scroller.getBoundingClientRect().top - headerOffset;
    const beyond = Math.max(0, current - threshold);
    if (header.contains(document.activeElement)) {
      setHeaderOffset(0);
      return;
    }
    const movement = delta > 0 ? Math.min(delta, beyond) : delta;
    // Allocate the available delta to the header first. The spacer offsets
    // the corresponding native scroll so the content does not scroll relative
    // to the player until the header reaches its limit. No scrollTop writes.
    setHeaderOffset(Math.min(headerOffset + movement, beyond));
  }, { passive: true });

  header.addEventListener("focusin", () => setHeaderOffset(0));
  window.addEventListener("resize", () => {
    if (panel.hidden) return;
    const beyond = Math.max(0, scroller.getBoundingClientRect().top -
      info.getBoundingClientRect().bottom + headerOffset);
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
