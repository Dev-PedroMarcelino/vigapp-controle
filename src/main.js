// ============================================================
// VigApp — Main Entry Point
// ============================================================
import './styles/index.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

import { initAuth, waitForAuth, getUser } from './auth.js';
import { auth, onAuthStateChanged } from './firebase.js';
import { applySavedTheme } from './components/header.js';
import { renderSidebar, initSidebar } from './components/sidebar.js';
import { renderHeader, initHeader } from './components/header.js';
import { registerRoute, initRouter } from './router.js';

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
    // Show main app
    renderApp();
  }
});

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

  // Initialize router
  initRouter('/dashboard');
}
