'use strict';
/* SCR-600: optional update dialog preview. Native app owns version checks and store URLs. */
(function () {
  const dialog = document.getElementById('update-dialog');
  const backdrop = document.getElementById('update-backdrop');
  const app = document.getElementById('update-preview-app');
  const later = document.getElementById('update-later');
  const store = document.getElementById('update-store');
  const message = document.getElementById('update-demo-message');

  function dismiss() {
    dialog.hidden = true;
    backdrop.hidden = true;
    app.removeAttribute('inert');
    app.removeAttribute('aria-hidden');
    app.removeAttribute('tabindex');
  }

  later.addEventListener('click', dismiss);
  store.addEventListener('click', () => { message.hidden = false; });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.hidden) {
      event.preventDefault();
      dismiss();
    }
  });
})();
