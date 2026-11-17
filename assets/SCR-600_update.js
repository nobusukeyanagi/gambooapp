'use strict';
/* SCR-600 preview behavior. Production app-version checks and store URLs belong to native app logic. */
(function () {
  const buttons = Array.from(document.querySelectorAll('[data-mode]'));
  const dialog = document.getElementById('update-dialog');
  const backdrop = document.getElementById('update-backdrop');
  const title = document.getElementById('update-dialog-title');
  const description = document.getElementById('update-dialog-description');
  const later = document.getElementById('update-later');
  const store = document.getElementById('update-store');
  const message = document.getElementById('update-demo-message');
  const copy = {
    recommended: {
      title: '新しいバージョンがあります',
      description: 'より快適にご利用いただくため、最新バージョンへのアップデートをおすすめします。'
    },
    required: {
      title: 'アップデートが必要です',
      description: 'このバージョンのアプリはご利用いただけません。最新バージョンにアップデートしてから、再度お試しください。'
    }
  };
  let mode = 'recommended';

  function show(nextMode) {
    mode = nextMode === 'required' ? 'required' : 'recommended';
    const data = copy[mode];
    title.textContent = data.title;
    description.textContent = data.description;
    later.hidden = mode === 'required';
    dialog.hidden = false;
    backdrop.hidden = false;
    message.hidden = true;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    const address = new URL(window.location.href);
    address.searchParams.set('mode', mode);
    window.history.replaceState(null, '', address);
    store.focus({ preventScroll: true });
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => show(button.dataset.mode));
  });
  later.addEventListener('click', () => {
    if (mode !== 'recommended') return;
    dialog.hidden = true;
    backdrop.hidden = true;
    buttons.find(button => button.dataset.mode === mode).focus({ preventScroll: true });
  });
  store.addEventListener('click', () => { message.hidden = false; });

  /* Esc is intentionally unavailable for forced updates. */
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mode === 'recommended' && !dialog.hidden) {
      event.preventDefault();
      later.click();
    }
  });
  show(new URL(window.location.href).searchParams.get('mode'));
})();
