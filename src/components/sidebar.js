// ============================================================
// VigApp — Sidebar Component
// ============================================================
import { icon, ICONS } from '../icons.js';
import { navigate } from '../router.js';
import { getUserData, getUserInitials, isAdmin, logout } from '../auth.js';

const navItems = [
  { section: 'Principal' },
  { route: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { route: '/leads', label: 'Captura de Leads', icon: ICONS.leads },
  { route: '/kanban', label: 'Pipeline', icon: ICONS.kanban },
  { section: 'Cadastros' },
  { route: '/companies', label: 'Empresas', icon: ICONS.companies },
  { route: '/clients', label: 'Clientes', icon: ICONS.clients },
  { route: '/services', label: 'Servicos', icon: ICONS.services },
  { section: 'Financeiro' },
  { route: '/subscriptions', label: 'Assinaturas', icon: ICONS.subscriptions },
  { section: 'Gestao' },
  { route: '/calendar', label: 'Calendario', icon: ICONS.calendar },
  { route: '/marketing', label: 'Marketing', icon: ICONS.marketing },
  { section: 'Admin', adminOnly: true },
  { route: '/users', label: 'Usuarios', icon: ICONS.users, adminOnly: true },
  { section: 'Sistema' },
  { route: '/access', label: 'Controle de Acesso', icon: ICONS.lock },
];

/**
 * Render the sidebar.
 */
export function renderSidebar() {
  const user = getUserData();
  const admin = isAdmin();
  const initials = getUserInitials();

  let navHTML = '';
  navItems.forEach(item => {
    if (item.adminOnly && !admin) return;

    if (item.section) {
      navHTML += `<div class="nav-section-title">${item.section}</div>`;
    } else {
      navHTML += `
        <button class="nav-item" data-route="${item.route}">
          ${icon(item.icon, { size: 18 })}
          <span class="nav-label">${item.label}</span>
        </button>
      `;
    }
  });

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <img src="/midia/logo vigapp.png" alt="VigApp" class="sidebar-logo" />
        <span class="sidebar-brand">VigApp</span>
      </div>

      <nav class="sidebar-nav">
        ${navHTML}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user">
          <div class="avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${user?.name || 'Usuario'}</div>
            <div class="sidebar-user-role">${user?.role === 'admin' ? 'Administrador' : 'Usuario'}</div>
          </div>
          <button class="btn-icon" id="btn-logout" data-tooltip="Sair">
            ${icon(ICONS.logout, { size: 16 })}
          </button>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
}

/**
 * Attach sidebar event listeners.
 */
export function initSidebar() {
  // Nav item click
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      navigate(item.dataset.route);
    });
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logout();
    window.location.reload();
  });

  // Mobile overlay
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  });
}
