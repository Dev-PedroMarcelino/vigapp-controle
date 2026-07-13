// ============================================================
// VigApp — Modal Component
// ============================================================
import { icon, ICONS } from '../icons.js';

/**
 * Open a modal dialog.
 * @param {object} options
 * @param {string} options.title — Modal title
 * @param {string|HTMLElement} options.content — HTML string or element
 * @param {string} [options.size='md'] — 'sm', 'md', 'lg'
 * @param {Array} [options.actions] — Footer buttons [{label, class, onClick}]
 * @param {Function} [options.onClose] — Called when modal is closed
 * @returns {object} — { close(), getElement() }
 */
export function openModal({ title, content, size = 'md', actions = [], onClose }) {
  const root = document.getElementById('modal-root');

  const sizeMap = { sm: '400px', md: '560px', lg: '720px' };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = sizeMap[size] || sizeMap.md;

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h3>${title}</h3>
    <button class="btn-icon modal-close-btn">${icon(ICONS.close, { size: 18 })}</button>
  `;

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  modal.appendChild(header);
  modal.appendChild(body);

  // Footer (if actions)
  if (actions.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = action.class || 'btn btn-secondary';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.onClick) action.onClick(close);
      });
      footer.appendChild(btn);
    });

    modal.appendChild(footer);
  }

  overlay.appendChild(modal);
  root.appendChild(overlay);

  // Close handlers
  function close() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s';
    setTimeout(() => {
      overlay.remove();
      if (onClose) onClose();
    }, 150);
  }

  header.querySelector('.modal-close-btn').addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // ESC key
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  }
  document.addEventListener('keydown', onKeyDown);

  // Focus trap — focus first input
  requestAnimationFrame(() => {
    const firstInput = body.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  });

  return {
    close,
    getElement: () => body,
    getModal: () => modal,
  };
}

/**
 * Confirm dialog.
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false }) {
  return new Promise(resolve => {
    openModal({
      title,
      content: `<p style="color: var(--text-secondary); font-size: 0.875rem;">${message}</p>`,
      size: 'sm',
      actions: [
        { label: cancelLabel, class: 'btn btn-secondary', onClick: (close) => { close(); resolve(false); } },
        {
          label: confirmLabel,
          class: danger ? 'btn btn-danger' : 'btn btn-primary',
          onClick: (close) => { close(); resolve(true); }
        },
      ],
      onClose: () => resolve(false),
    });
  });
}
