// ============================================================
// VigApp — PWA install + service worker registration
// ============================================================
import { openModal } from './components/modal.js';

// Register the service worker as soon as the app boots (any page, incl. login),
// production only to avoid dev-server caching pain. This is what makes the app
// installable and gives an offline shell.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

let deferredPrompt = null;

// Capture Chrome/Android's install prompt as early as possible (this may fire
// before the header — and its button — exists, so we just stash it).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setInstallButtonVisible(true);
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  setInstallButtonVisible(false);
});

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setInstallButtonVisible(show) {
  const btn = document.getElementById('btn-install-app');
  if (btn) btn.style.display = show && !isStandalone() ? '' : 'none';
}

export function initPWA() {
  const btn = document.getElementById('btn-install-app');
  if (!btn) return;

  if (isStandalone()) { btn.style.display = 'none'; return; }

  // Show if we already captured a prompt, or on iOS (which installs manually).
  btn.style.display = (deferredPrompt || isIOS()) ? '' : 'none';

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;
      btn.style.display = 'none';
      return;
    }

    if (isIOS()) {
      openModal({
        title: 'Instalar o VigApp',
        size: 'sm',
        content: `<p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7;">
          Para instalar no iPhone/iPad (pelo Safari):<br><br>
          1. Toque no botão <strong>Compartilhar</strong> (o quadrado com a seta para cima).<br>
          2. Escolha <strong>Adicionar à Tela de Início</strong>.<br>
          3. Toque em <strong>Adicionar</strong>.
        </p>`,
        actions: [{ label: 'Entendi', class: 'btn btn-primary', onClick: (c) => c() }],
      });
      return;
    }

    openModal({
      title: 'Instalar o VigApp',
      size: 'sm',
      content: `<p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.7;">
        No menu do navegador (⋮), procure por <strong>"Instalar app"</strong> ou
        <strong>"Adicionar à tela inicial"</strong>.
      </p>`,
      actions: [{ label: 'Entendi', class: 'btn btn-primary', onClick: (c) => c() }],
    });
  });
}
