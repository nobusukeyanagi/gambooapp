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

  // Static visual reference only; actual playback controls depend on the
  // production player and the supported device / WebView. No fake actions.
  const icon = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + path + '</svg>';
  const playback = digest
    ? icon('<path d="M8 5l12 7-12 7z" fill="currentColor" stroke="none"/>')
    : icon('<path d="M8 5v14M16 5v14" stroke-width="4"/>');
  const volume = icon('<path d="M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>');
  const fullscreen = icon('<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>');
  const controls = document.createElement("div");
  controls.className = "race-video-preview-controls";
  controls.setAttribute("aria-hidden", "true");
  controls.innerHTML = (digest
    ? '<div class="race-video-preview-progress"><span></span></div>'
    : '') +
    '<div class="race-video-preview-row">' +
      '<span class="race-video-preview-icon" data-preview-control="playback">' + playback + '</span>' +
      '<span class="race-video-preview-icon" data-preview-control="volume">' + volume + '</span>' +
      (digest
        ? '<span class="race-video-preview-time">0:00 / 2:30</span>'
        : '<span class="race-video-preview-live"><span></span>LIVE</span>') +
      '<span class="race-video-preview-icon race-video-preview-fullscreen" data-preview-control="fullscreen">' + fullscreen + '</span>' +
    '</div>';
  label.after(controls);

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
