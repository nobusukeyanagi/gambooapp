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
  const video = panel.querySelector("video");
  const label = panel.querySelector(".race-video-label");
  const digest = new URLSearchParams(location.search).get("video") === "digest";
  const title = digest ? "ダイジェスト映像" : "LIVE中継";
  button.querySelector("[data-video-button-label]").textContent = digest ? "映像" : "LIVE";
  panel.setAttribute("aria-label", title);
  video.setAttribute("aria-label", title);
  label.textContent = title;

  // Use a single native scroll flow when the video is open. Move the
  // existing header, not a copy, so all shared controls retain their state.
  // There is no scroll listener, offset compensation or animation.
  button.addEventListener("click", () => {
    const open = panel.hidden;
    const scrollPosition = scroller.scrollTop;
    if (open) {
      shell.classList.add("race-video-open");
      scroller.prepend(header);
      panel.hidden = false;
    } else {
      video.pause();
      panel.hidden = true;
      shell.insertBefore(header, scroller);
      shell.classList.remove("race-video-open");
    }
    button.setAttribute("aria-pressed", String(open));
    button.setAttribute("aria-expanded", String(open));
    // Preserve the race-content position only when toggling the layout.
    // All subsequent movement is handled natively by the browser.
    scroller.scrollTop = scrollPosition;
  });
})();
