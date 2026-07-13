// ============================================================
// VigApp — Clients Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, deleteDocument, getDocuments } from '../utils/firestore.js';
import { formatPhone } from '../utils/format.js';

let clients = [];
let companiesList = [];

export async function renderClientsPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Clientes</h1>
          <p>Gerencie os contatos dos seus clientes</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btn-add-client">
            ${icon(ICONS.add, { size: 16 })} Novo Cliente
          </button>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-bar">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="search-clients" placeholder="Buscar clientes..." />
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Empresa</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Criado por</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody id="clients-tbody">
            <tr><td colspan="6"><div class="empty-state"><p>Carregando...</p></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-add-client')?.addEventListener('click', () => openClientModal());
  document.getElementById('search-clients')?.addEventListener('input', renderTable);

  await loadClients();
}

async function loadClients() {
  try {
    [clients, companiesList] = await Promise.all([
      getDocuments('clients'),
      getDocuments('companies'),
    ]);
    renderTable();
  } catch (err) {
    console.warn('Error loading clients:', err);
    renderEmptyTable();
  }
}

function renderEmptyTable() {
  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr><td colspan="6"><div class="empty-state">
      ${icon(ICONS.clients, { size: 40, class: 'icon' })}
      <h3>Nenhum cliente cadastrado</h3>
      <p>Adicione um novo contato clicando no botao acima</p>
    </div></td></tr>
  `;
}

function renderTable() {
  const search = (document.getElementById('search-clients')?.value || '').toLowerCase();
  let filtered = clients;

  if (search) {
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(search) ||
      (c.email || '').toLowerCase().includes(search) ||
      (c.companyName || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    renderEmptyTable();
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="avatar">${(c.name || '?')[0].toUpperCase()}</div>
          <span style="font-weight: 500;">${c.name || '--'}</span>
        </div>
      </td>
      <td>${c.companyName || '--'}</td>
      <td>${formatPhone(c.phone)}</td>
      <td>${c.email || '--'}</td>
      <td><span class="text-sm text-secondary">${c.createdBy?.name || '--'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" data-action="edit" data-id="${c.id}" data-tooltip="Editar">
            ${icon(ICONS.edit, { size: 15 })}
          </button>
          <button class="btn-icon" data-action="delete" data-id="${c.id}" data-tooltip="Excluir">
            ${icon(ICONS.delete, { size: 15 })}
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const client = clients.find(c => c.id === btn.dataset.id);
      if (client) openClientModal(client);
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Excluir cliente',
        message: 'Tem certeza que deseja excluir este cliente?',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (confirmed) {
        await deleteDocument('clients', btn.dataset.id);
        showToast('Cliente excluido', 'success');
        await loadClients();
      }
    });
  });
}

function openClientModal(client = null) {
  const isEdit = !!client;

  const companyOptions = companiesList.map(c =>
    `<option value="${c.id}" data-name="${c.name}" ${client?.companyId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Nome do cliente *</label>
      <input type="text" class="form-input" id="client-name" value="${client?.name || ''}" required />
    </div>
    <div class="form-group">
      <label class="form-label">Empresa</label>
      <select class="form-select" id="client-company">
        <option value="">Sem empresa</option>
        ${companyOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input type="text" class="form-input" id="client-phone" value="${client?.phone || ''}" placeholder="(00) 00000-0000" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="client-email" value="${client?.email || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observacoes</label>
      <textarea class="form-textarea" id="client-notes" rows="3">${client?.notes || ''}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Cliente' : 'Novo Cliente',
    content: formHTML,
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: isEdit ? 'Salvar' : 'Cadastrar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const name = document.getElementById('client-name').value.trim();
          if (!name) {
            showToast('Nome do cliente e obrigatorio', 'warning');
            return;
          }

          const companySelect = document.getElementById('client-company');
          const selectedOption = companySelect.options[companySelect.selectedIndex];

          const data = {
            name,
            companyId: companySelect.value || null,
            companyName: selectedOption?.dataset?.name || null,
            phone: document.getElementById('client-phone').value.trim(),
            email: document.getElementById('client-email').value.trim(),
            notes: document.getElementById('client-notes').value.trim(),
          };

          try {
            if (isEdit) {
              await updateDocument('clients', client.id, data);
              showToast('Cliente atualizado', 'success');
            } else {
              await createDocument('clients', data);
              showToast('Cliente cadastrado', 'success');
            }
            close();
            await loadClients();
          } catch (err) {
            showToast('Erro ao salvar cliente', 'error');
          }
        }
      }
    ]
  });
}
