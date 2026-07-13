// ============================================================
// VigApp — Users Management Page (Admin Only)
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getDocuments, updateDocument } from '../utils/firestore.js';
import { isAdmin } from '../auth.js';
import { formatTimestamp } from '../utils/firestore.js';

let users = [];

export async function renderUsersPage(container) {
  if (!isAdmin()) {
    container.innerHTML = `
      <div class="page-content">
        <div class="empty-state">
          ${icon(ICONS.users, { size: 48, class: 'icon' })}
          <h3>Acesso restrito</h3>
          <p>Apenas administradores podem acessar esta pagina</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Usuarios</h1>
          <p>Gerencie os usuarios do sistema</p>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Papel</th>
              <th>Criado em</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            <tr><td colspan="5"><div class="empty-state"><p>Carregando...</p></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadUsers();
}

async function loadUsers() {
  try {
    users = await getDocuments('users');
    renderTable();
  } catch (err) {
    console.warn('Error loading users:', err);
    const tbody = document.getElementById('users-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="5"><div class="empty-state">
          ${icon(ICONS.users, { size: 40, class: 'icon' })}
          <h3>Nenhum usuario encontrado</h3>
          <p>Os usuarios aparecerao aqui apos se registrarem</p>
        </div></td></tr>
      `;
    }
  }
}

function renderTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5"><div class="empty-state">
        <h3>Nenhum usuario</h3>
      </div></td></tr>
    `;
    return;
  }

  const roleBadge = (role) => {
    if (role === 'admin') return '<span class="badge badge-warning">Admin</span>';
    return '<span class="badge badge-default">Usuario</span>';
  };

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="avatar">${(u.name || '?')[0].toUpperCase()}</div>
          <span style="font-weight: 500;">${u.name || '--'}</span>
        </div>
      </td>
      <td>${u.email || '--'}</td>
      <td>${roleBadge(u.role)}</td>
      <td class="text-sm text-secondary">${formatTimestamp(u.createdAt)}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" data-action="toggle-role" data-id="${u.id}" data-tooltip="Alterar papel">
            ${icon(ICONS.edit, { size: 15 })}
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="toggle-role"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = users.find(u => u.id === btn.dataset.id);
      if (!user) return;

      const newRole = user.role === 'admin' ? 'user' : 'admin';
      const confirmed = await confirmDialog({
        title: 'Alterar papel',
        message: `Deseja alterar o papel de "${user.name}" para ${newRole === 'admin' ? 'Administrador' : 'Usuario'}?`,
        confirmLabel: 'Confirmar',
      });

      if (confirmed) {
        try {
          await updateDocument('users', user.id, { role: newRole });
          showToast(`Papel alterado para ${newRole === 'admin' ? 'Administrador' : 'Usuario'}`, 'success');
          await loadUsers();
        } catch (err) {
          showToast('Erro ao alterar papel', 'error');
        }
      }
    });
  });
}
