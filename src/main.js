// ============================================================
// VigApp — Main Entry Point
// ============================================================
import './styles/index.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

import { initAuth, waitForAuth, getUser, getUserData } from './auth.js';
import { applySavedTheme } from './components/header.js';
import { renderSidebar, initSidebar } from './components/sidebar.js';
import { renderHeader, initHeader } from './components/header.js';
import { registerRoute, initRouter, navigate } from './router.js';

// Pages
import { renderLoginPage } from './pages/login.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderLeadsPage } from './pages/leads.js';
import { renderCompaniesPage } from './pages/companies.js';
import { renderClientsPage } from './pages/clients.js';
import { renderServicesPage } from './pages/services.js';
import { renderSubscriptionsPage } from './pages/subscriptions.js';
import { renderKanbanPage } from './pages/kanban.js';
import { renderCalendarPage } from './pages/calendar.js';
import { renderMarketingPage } from './pages/marketing.js';
import { renderUsersPage } from './pages/users.js';

// Apply saved theme before render to prevent flash
applySavedTheme();

// Initialize auth
initAuth();

// Wait for auth to determine which view to show
waitForAuth().then(() => {
  const user = getUser();

  if (!user) {
    // Show login page
    renderLoginPage(document.getElementById('app'));

    // Listen for auth changes to switch to app
    const { onAuthStateChanged } = import('./firebase.js').then(mod => {
      mod.onAuthStateChanged(mod.auth, (u) => {
        if (u) {
          // Reload to bootstrap the full app
          window.location.reload();
        }
      });
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

  // Register all routes
  registerRoute('/dashboard', renderDashboardPage);
  registerRoute('/leads', renderLeadsPage);
  registerRoute('/companies', renderCompaniesPage);
  registerRoute('/clients', renderClientsPage);
  registerRoute('/services', renderServicesPage);
  registerRoute('/subscriptions', renderSubscriptionsPage);
  registerRoute('/kanban', renderKanbanPage);
  registerRoute('/calendar', renderCalendarPage);
  registerRoute('/marketing', renderMarketingPage);
  registerRoute('/users', renderUsersPage);

  // Initialize router
  initRouter('/dashboard');
}
