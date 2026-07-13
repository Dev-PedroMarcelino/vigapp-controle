// ============================================================
// VigApp — Toast Notification Component
// ============================================================
import { icon, ICONS } from '../icons.js';

const TOAST_DURATION = 4000;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-root');
  if (!container) return;

  // Ensure container has the right class
  if (!container.classList.contains('toast-container')) {
    container.classList.add('toast-container');
  }

  const iconMap = {
    success: ICONS.success,
    error: ICONS.error,
    warning: ICONS.warning,
    info: ICONS.info,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${icon(iconMap[type], { size: 18 })}
    <span class="toast-message">${message}</span>
    <button class="toast-close">${icon(ICONS.close, { size: 14 })}</button>
  `;

  // Close on click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => removeToast(toast), TOAST_DURATION);
}

function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  toast.style.transition = 'all 0.3s ease';
  setTimeout(() => toast.remove(), 300);
}
