/* Shared immediate tap feedback. No navigation or app logic is added here. */
(function () {
  "use strict";
  if (window.__gambooTapFeedbackInitialized) return;
  window.__gambooTapFeedbackInitialized = true;

  var targets = [
    'a[href]', 'button:not(:disabled)', 'summary',
    'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
    'input[type="checkbox"]', 'input[type="radio"]',
    '[role="button"]', '[role="link"]', '[role="tab"]',
    '.icon-btn', '.cta-btn', '.action-btn', '.action-bar-btn',
    '.chip', '.tab-item', '.date-tab', '.top-tab', '.info-tab', '.race-tab',
    '.menu-item', '.news-item', '.blog-card', '.feature-card', '.feature-cta',
    '.venue-tile', '.vcard', '.race-tile', '.dokanto-card', '.hero-banner',
    '.pickup-card', '.rebate-chip', '.bn', '.tsubu-link', '.pay-toggle',
    '.mori-sp', '.mori-next', '.vgroup-head:not(.mori-heading)',
    '.sort-btn', '.sort-opt', '.rchip', '.compact-row', '.op-btn', '.rpred',
    '.item-btn', '.sheet-close', '.ri-btn', '.sw', '.rd-lab', '.lb-btn',
    '.lsheet-close', '.oshi-act', '.om-edit', '.om-row', '.om-add',
    '.os-tab', '.os-chip', '.os-btn', '.cp-card', '.cp-btn',
    '.point-use span', '.seg span', '.header-payout'
  ].join(',');

  var current = null;
  var recent = null;
  var releaseTimer = 0;
  var startedAt = 0;
  var pointerId = null;

  function stopRecent() {
    clearTimeout(releaseTimer);
    releaseTimer = 0;
    if (recent) recent.classList.remove('tap-pressed');
    recent = null;
  }
  function reset() {
    if (current) current.classList.remove('tap-pressed');
    current = null;
    pointerId = null;
    stopRecent();
  }
  function findTarget(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!el || !el.closest) return null;
    var target = el.closest(targets);
    if (!target || target.matches(':disabled, [aria-disabled="true"], .disabled')) return null;
    return target;
  }
  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (current) return; // do not restart a held press
    var target = findTarget(event.target);
    if (!target) return;
    stopRecent();
    current = target;
    pointerId = event.pointerId;
    startedAt = Date.now();
    target.classList.add('tap-pressed');
  }, { passive: true });

  document.addEventListener('pointerup', function (event) {
    if (!current || event.pointerId !== pointerId) return;
    var target = current;
    current = null;
    pointerId = null;
    recent = target;
    var remaining = Math.max(0, 105 - (Date.now() - startedAt));
    releaseTimer = window.setTimeout(function () {
      if (recent === target) {
        target.classList.remove('tap-pressed');
        recent = null;
      }
      releaseTimer = 0;
    }, remaining);
  }, { passive: true });

  document.addEventListener('pointercancel', reset, { passive: true });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) reset();
  });
})();
