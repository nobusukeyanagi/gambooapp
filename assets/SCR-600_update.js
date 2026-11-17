'use strict';
/* SCR-600 optional-update dialog preview. Native app owns version checks and store URLs. */
(function () {
  const dialog = document.getElementById('update-dialog');
  const backdrop = document.getElementById('update-backdrop');
  const app = document.getElementById('update-preview-app');
  const update = document.getElementById('update-store');
  const later = document.getElementById('update-later');

  function dismiss() {
    dialog.hidden = true;
    backdrop.hidden = true;
    app.removeAttribute('inert');
    app.removeAttribute('aria-hidden');
    app.setAttribute('tabindex', '0');
    app.focus({ preventScroll: true });
  }

  later.addEventListener('click', dismiss);
  document.addEventListener('keydown', event => {
    if (dialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== 'Tab') return;

    const focused = document.activeElement;
    if (event.shiftKey && (focused === update || !dialog.contains(focused))) {
      event.preventDefault();
      later.focus({ preventScroll: true });
    } else if (!event.shiftKey && (focused === later || !dialog.contains(focused))) {
      event.preventDefault();
      update.focus({ preventScroll: true });
    }
  });

  // The dialog is modal: keep keyboard focus inside until "あとで" is selected.
  document.addEventListener('focusin', event => {
    if (!dialog.hidden && !dialog.contains(event.target)) {
      update.focus({ preventScroll: true });
    }
  });
  update.focus({ preventScroll: true });
})();
