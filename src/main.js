// ============================================================
// VigApp — Main Entry Point
// ============================================================
import './styles/index.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

import { initAuth, waitForAuth, getUser, getUserData, isAdmin, logout } from './auth.js';
import { auth, onAuthStateChanged } from './firebase.js';
import { getDocuments } from './utils/firestore.js';
import { applySavedTheme } from './components/header.js';
import { renderSidebar, initSidebar } from './components/sidebar.js';
import { renderHeader, initHeader } from './components/header.js';
import { registerRoute, initRouter } from './router.js';
import { initPWA } from './pwa.js';

// Lazily load a page module only when its route is first visited.
// Each import() becomes its own chunk, so pages are no longer in the initial bundle.
const lazyPage = (loader, exportName) => (container) =>
  loader().then(mod => mod[exportName](container));

// Apply saved theme before render to prevent flash
applySavedTheme();

// Initialize auth
initAuth();

// Wait for auth to determine which view to show
waitForAuth().then(async () => {
  const user = getUser();

  if (!user) {
    // Show login page (loaded on demand)
    const { renderLoginPage } = await import('./pages/login.js');
    renderLoginPage(document.getElementById('app'));

    // When the user signs in, reload to bootstrap the full app
    onAuthStateChanged(auth, (u) => {
      if (u) window.location.reload();
    });
  } else {
    // Gate access on the email allowlist, then show the app.
    const allowed = await isAccessAllowed();
    if (allowed) {
      renderApp();
    } else {
      renderUnauthorized();
    }
  }
});

/**
 * A signed-in user may use the app if they are an admin, or their email is in
 * the `allowed_emails` collection. An empty allowlist means "not configured
 * yet" and lets anyone in (bootstrap). This is the UX gate; the Firestore
 * security rules are the real, server-side enforcement.
 */
async function isAccessAllowed() {
  if (isAdmin()) return true;
  try {
    const list = await getDocuments('allowed_emails');
    if (!list.length) return true; // allowlist not configured yet
    const email = (getUserData()?.email || '').toLowerCase();
    return list.some(e => (e.email || '').toLowerCase() === email);
  } catch (e) {
    // If the list can't be read, don't hard-lock the UI — unauthorized users
    // are still blocked by the Firestore rules (their data reads will fail).
    console.warn('Access check failed:', e);
    return true;
  }
}

function renderUnauthorized() {
  const email = getUserData()?.email || '';
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card" style="max-width:420px; text-align:center; padding:32px;">
        <h1 style="font-size:1.25rem; margin-bottom:8px;">Acesso não autorizado</h1>
        <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:8px;">
          O e-mail <strong>${email}</strong> não tem permissão para acessar este sistema.
        </p>
        <p style="color:var(--text-tertiary); font-size:0.85rem; margin-bottom:24px;">
          Fale com o administrador para liberar o seu acesso.
        </p>
        <button class="btn btn-primary" id="btn-unauth-logout" style="width:100%;">Sair</button>
      </div>
    </div>
  `;
  document.getElementById('btn-unauth-logout')?.addEventListener('click', async () => {
    await logout();
    window.location.reload();
  });
}

function renderApp() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar()}
      <div class="main-content">
        ${renderHeader()}
        <div id="page-container"></div>
      </div>
    </div>
  `;

  // Initialize interactive components
  initSidebar();
  initHeader();
  initPWA();

  // Register all routes — page modules are code-split and loaded on first visit
  registerRoute('/dashboard', lazyPage(() => import('./pages/dashboard.js'), 'renderDashboardPage'));
  registerRoute('/leads', lazyPage(() => import('./pages/leads.js'), 'renderLeadsPage'));
  registerRoute('/companies', lazyPage(() => import('./pages/companies.js'), 'renderCompaniesPage'));
  registerRoute('/clients', lazyPage(() => import('./pages/clients.js'), 'renderClientsPage'));
  registerRoute('/services', lazyPage(() => import('./pages/services.js'), 'renderServicesPage'));
  registerRoute('/subscriptions', lazyPage(() => import('./pages/subscriptions.js'), 'renderSubscriptionsPage'));
  registerRoute('/kanban', lazyPage(() => import('./pages/kanban.js'), 'renderKanbanPage'));
  registerRoute('/calendar', lazyPage(() => import('./pages/calendar.js'), 'renderCalendarPage'));
  registerRoute('/marketing', lazyPage(() => import('./pages/marketing.js'), 'renderMarketingPage'));
  registerRoute('/users', lazyPage(() => import('./pages/users.js'), 'renderUsersPage'));
  registerRoute('/access', lazyPage(() => import('./pages/access.js'), 'renderAccessPage'));

  // Initialize router
  initRouter('/dashboard');
}
