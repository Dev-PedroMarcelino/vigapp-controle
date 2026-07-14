// ============================================================
// VigApp — Header Component
// ============================================================
import { icon, ICONS } from '../icons.js';

/**
 * Render the header bar.
 */
export function renderHeader() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const themeIcon = currentTheme === 'dark' ? ICONS.sun : ICONS.moon;

  return `
    <header class="app-header">
      <div class="header-left">
        <button class="btn-icon mobile-menu-btn" id="btn-mobile-menu">
          ${icon(ICONS.menu, { size: 20 })}
        </button>
        <div>
          <h2 class="header-title" id="header-title">Dashboard</h2>
        </div>
      </div>
      <div class="header-right">
        <button class="btn-icon" id="btn-install-app" data-tooltip="Instalar app" style="display: none;">
          ${icon(ICONS.download, { size: 18 })}
        </button>
        <button class="btn-icon" id="btn-theme-toggle" data-tooltip="Alternar tema">
          ${icon(themeIcon, { size: 18 })}
        </button>
      </div>
    </header>
  `;
}

/**
 * Attach header event listeners.
 */
export function initHeader() {
  // Theme toggle
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

  // Mobile menu
  document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
  });
}

/**
 * Toggle dark/light mode.
 */
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('vigapp-theme', next);

  // Update icon
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) {
    btn.innerHTML = icon(next === 'dark' ? ICONS.sun : ICONS.moon, { size: 18 });
  }
}

/**
 * Apply saved theme on load.
 */
export function applySavedTheme() {
  const saved = localStorage.getItem('vigapp-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}
