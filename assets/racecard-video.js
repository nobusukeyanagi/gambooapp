/* SCR-210 / SCR-310: shared LIVE and digest layout preview.
 * ?video=digest: static digest preview; ?video=test: public DASH-IF live test.
 * Production race streams are not connected. External requests are opt-in.
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
  const mode = new URLSearchParams(location.search).get("video");
  const digest = mode === "digest";
  const test = mode === "test";
  const title = digest ? "ダイジェスト映像" : test ? "LIVE中継（テスト）" : "LIVE中継";
  button.querySelector("[data-video-button-label]").textContent = digest ? "映像" : "LIVE";
  panel.setAttribute("aria-label", title);
  video.setAttribute("aria-label", title);
  label.textContent = title;

  // Static visual reference only; actual playback controls depend on the
  // production player and the supported device / WebView. No fake actions.
  const icon = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + path + '</svg>';
  const playIcon = icon('<path d="M8 5l12 7-12 7z" fill="currentColor" stroke="none"/>');
  const pauseIcon = icon('<path d="M8 5v14M16 5v14" stroke-width="4"/>');
  const playback = digest ? playIcon : pauseIcon;
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

  // Public DASH-IF simulator, intentionally not a real race broadcast.
  const TEST_MPD = "https://livesim.dashif.org/livesim2/testrotate_2s/Manifest.mpd";
  const DASH_JS = "https://cdn.dashjs.org/v5.0.3/modern/umd/dash.all.min.js";
  let player = null;
  let library = null;
  let session = 0;
  let timeout = 0;
  let playButton, volumeButton, fullscreenButton;
  const mutedIcon = icon('<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>');
  function loadDash() {
    if (window.dashjs?.MediaPlayer) return Promise.resolve(window.dashjs);
    if (!library) library = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = DASH_JS;
      script.onload = () => window.dashjs?.MediaPlayer ? resolve(window.dashjs) : reject(new Error("dash.js unavailable"));
      script.onerror = () => { script.remove(); reject(new Error("dash.js load failed")); };
      document.head.append(script);
    }).catch(error => { library = null; throw error; });
    return library;
  }
  function status(message) {
    label.textContent = message;
    label.hidden = !message;
  }
  function syncControls() {
    if (!test) return;
    playButton.innerHTML = video.paused ? playIcon : pauseIcon;
    playButton.setAttribute("aria-label", video.paused ? "再生" : "一時停止");
    volumeButton.innerHTML = video.muted ? mutedIcon : volume;
    volumeButton.setAttribute("aria-label", video.muted ? "ミュート解除" : "ミュート");
  }
  function stopTest() {
    session++;
    clearTimeout(timeout);
    if (player) {
      player.reset();
      player = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  async function startTest() {
    const id = ++session;
    video.muted = true;
    status("テスト映像を読み込み中…");
    syncControls();
    timeout = setTimeout(() => {
      if (session === id && !panel.hidden) status("接続に時間がかかっています");
    }, 15000);
    try {
      if (!window.MediaSource && !window.ManagedMediaSource) throw new Error("MSE unsupported");
      const dash = await loadDash();
      if (id !== session || panel.hidden) return;
      player = dash.MediaPlayer().create();
      player.on(dash.MediaPlayer.events.ERROR, () => {
        if (id !== session || panel.hidden) return;
        clearTimeout(timeout);
        status("テスト映像を再生できません");
      });
      player.initialize(video, TEST_MPD, true);
    } catch (error) {
      if (id !== session || panel.hidden) return;
      clearTimeout(timeout);
      status("テスト映像を再生できません");
    }
  }
  if (test) {
    panel.classList.add("race-video-test");
    controls.removeAttribute("aria-hidden");
    controls.querySelector(".race-video-preview-live").lastChild.textContent = "LIVE TEST";
    const activate = (name, handler) => {
      const placeholder = controls.querySelector('[data-preview-control="' + name + '"]');
      const control = document.createElement("button");
      control.type = "button";
      control.className = placeholder.className;
      control.dataset.previewControl = name;
      control.innerHTML = placeholder.innerHTML;
      control.addEventListener("click", handler);
      placeholder.replaceWith(control);
      return control;
    };
    playButton = activate("playback", () => {
      if (!player) return;
      if (video.paused) video.play().catch(() => status("再生できません"));
      else video.pause();
    });
    volumeButton = activate("volume", () => { video.muted = !video.muted; });
    fullscreenButton = activate("fullscreen", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (video.parentElement.requestFullscreen) await video.parentElement.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch { /* Unsupported fullscreen on this device. */ }
    });
    fullscreenButton.setAttribute("aria-label", "全画面表示");
    if (!video.parentElement.requestFullscreen && !video.webkitEnterFullscreen) fullscreenButton.disabled = true;
    video.muted = true;
    video.disablePictureInPicture = true;
    for (const event of ["play", "pause", "volumechange"]) video.addEventListener(event, syncControls);
    video.addEventListener("playing", () => {
      if (panel.hidden) return;
      clearTimeout(timeout);
      status("");
    });
    video.addEventListener("error", () => {
      if (!panel.hidden && player) status("テスト映像を再生できません");
    });
    window.addEventListener("pagehide", stopTest);
    syncControls();
  }

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
      if (test) startTest();
    } else {
      panel.hidden = true;
      if (test) stopTest();
      else video.pause();
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
