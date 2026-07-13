// ============================================================
// VigApp — SPA Router
// ============================================================

const routes = {};
let currentRoute = null;
let currentCleanup = null;

/**
 * Register a route.
 * @param {string} path — Route path (e.g., '/dashboard')
 * @param {Function} handler — Async function that receives the container element and returns optional cleanup
 */
export function registerRoute(path, handler) {
  routes[path] = handler;
}

/**
 * Navigate to a route.
 * @param {string} path
 */
export async function navigate(path) {
  if (path === currentRoute) return;

  // Cleanup previous page
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
  }

  currentRoute = path;
  window.history.pushState({}, '', path);

  const container = document.getElementById('page-container');
  if (!container) return;

  // Clear content
  container.innerHTML = '';

  const handler = routes[path];
  if (handler) {
    try {
      currentCleanup = await handler(container);
    } catch (err) {
      console.error(`Error loading route "${path}":`, err);
      container.innerHTML = `
        <div class="empty-state">
          <h3>Erro ao carregar pagina</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Pagina nao encontrada</h3>
        <p>A rota "${path}" nao existe.</p>
      </div>
    `;
  }

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === path);
  });

  // Update header title
  updateHeaderTitle(path);

  // Close mobile sidebar
  document.querySelector('.sidebar')?.classList.remove('open');
  document.querySelector('.sidebar-overlay')?.classList.remove('active');
}

/**
 * Get current route path.
 */
export function getCurrentRoute() {
  return currentRoute;
}

/**
 * Initialize router — handle back/forward and initial load.
 */
export function initRouter(defaultRoute = '/dashboard') {
  window.addEventListener('popstate', () => {
    const path = window.location.pathname || defaultRoute;
    navigate(path);
  });

  const initialPath = window.location.pathname === '/' ? defaultRoute : window.location.pathname;
  navigate(initialPath);
}

// Map routes to page titles
const routeTitles = {
  '/dashboard': 'Dashboard',
  '/leads': 'Captura de Leads',
  '/companies': 'Empresas',
  '/clients': 'Clientes',
  '/services': 'Servicos',
  '/subscriptions': 'Assinaturas e Pagamentos',
  '/kanban': 'Pipeline de Negocios',
  '/calendar': 'Calendario',
  '/marketing': 'Marketing',
  '/users': 'Usuarios',
};

function updateHeaderTitle(path) {
  const titleEl = document.getElementById('header-title');
  if (titleEl) {
    titleEl.textContent = routeTitles[path] || '';
  }
}
