// ============================================================
// VigApp — Companies Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, deleteDocument, getDocuments } from '../utils/firestore.js';
import { formatCNPJ, formatPhone } from '../utils/format.js';
import { formatTimestamp } from '../utils/firestore.js';

let companies = [];

export async function renderCompaniesPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Empresas</h1>
          <p>Gerencie as empresas cadastradas</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btn-add-company">
            ${icon(ICONS.add, { size: 16 })} Nova Empresa
          </button>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-bar">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="search-companies" placeholder="Buscar empresas..." />
        </div>
        <select class="form-select" id="filter-source" style="width: auto;">
          <option value="">Todas as origens</option>
          <option value="manual">Cadastro manual</option>
          <option value="lead">Via leads</option>
        </select>
        <select class="form-select" id="filter-potential" style="width: auto;">
          <option value="">Todos</option>
          <option value="true">Potenciais</option>
          <option value="false">Regulares</option>
        </select>
      </div>

      <div class="table-container" id="companies-table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Segmento</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Origem</th>
              <th>Criado por</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody id="companies-tbody">
            <tr><td colspan="7"><div class="empty-state"><p>Carregando...</p></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-add-company')?.addEventListener('click', () => openCompanyModal());
  document.getElementById('search-companies')?.addEventListener('input', renderTable);
  document.getElementById('filter-source')?.addEventListener('change', renderTable);
  document.getElementById('filter-potential')?.addEventListener('change', renderTable);

  await loadCompanies();
}

async function loadCompanies() {
  try {
    companies = await getDocuments('companies');
    renderTable();
  } catch (err) {
    console.warn('Error loading companies:', err);
    document.getElementById('companies-tbody').innerHTML = `
      <tr><td colspan="7"><div class="empty-state">
        ${icon(ICONS.companies, { size: 40, class: 'icon' })}
        <h3>Nenhuma empresa cadastrada</h3>
        <p>Adicione sua primeira empresa clicando no botao acima</p>
      </div></td></tr>
    `;
  }
}

function renderTable() {
  const search = (document.getElementById('search-companies')?.value || '').toLowerCase();
  const sourceFilter = document.getElementById('filter-source')?.value || '';
  const potentialFilter = document.getElementById('filter-potential')?.value || '';

  let filtered = companies;

  if (search) {
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(search) ||
      (c.segment || '').toLowerCase().includes(search) ||
      (c.email || '').toLowerCase().includes(search)
    );
  }

  if (sourceFilter) {
    filtered = filtered.filter(c => c.source === sourceFilter);
  }

  if (potentialFilter) {
    filtered = filtered.filter(c => String(c.isPotential) === potentialFilter);
  }

  const tbody = document.getElementById('companies-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7"><div class="empty-state">
        ${icon(ICONS.companies, { size: 40, class: 'icon' })}
        <h3>Nenhuma empresa encontrada</h3>
        <p>Tente ajustar os filtros ou adicione uma nova empresa</p>
      </div></td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="avatar">${(c.name || '?')[0].toUpperCase()}</div>
          <div>
            <div style="font-weight: 500;">${c.name || '--'}</div>
            ${c.isPotential ? '<span class="badge badge-potential">Potencial</span>' : ''}
          </div>
        </div>
      </td>
      <td>${c.segment || '--'}</td>
      <td>${formatPhone(c.phone)}</td>
      <td>${c.email || '--'}</td>
      <td><span class="badge badge-default">${c.source === 'lead' ? 'Via Lead' : 'Manual'}</span></td>
      <td>
        <span class="text-sm text-secondary">${c.createdBy?.name || '--'}</span>
      </td>
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

  // Attach action listeners
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const company = companies.find(c => c.id === btn.dataset.id);
      if (company) openCompanyModal(company);
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Excluir empresa',
        message: 'Tem certeza que deseja excluir esta empresa? Esta acao nao pode ser desfeita.',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (confirmed) {
        await deleteDocument('companies', btn.dataset.id);
        showToast('Empresa excluida', 'success');
        await loadCompanies();
      }
    });
  });
}

function openCompanyModal(company = null) {
  const isEdit = !!company;

  const formHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nome da empresa *</label>
        <input type="text" class="form-input" id="company-name" value="${company?.name || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">CNPJ</label>
        <input type="text" class="form-input" id="company-cnpj" value="${company?.cnpj || ''}" placeholder="00.000.000/0000-00" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input type="text" class="form-input" id="company-phone" value="${company?.phone || ''}" placeholder="(00) 00000-0000" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="company-email" value="${company?.email || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Website</label>
      <input type="url" class="form-input" id="company-website" value="${company?.website || ''}" placeholder="https://" />
    </div>
    <div class="form-group">
      <label class="form-label">Endereco</label>
      <input type="text" class="form-input" id="company-address" value="${company?.address || ''}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Segmento</label>
        <input type="text" class="form-input" id="company-segment" value="${company?.segment || ''}" placeholder="Ex: Restaurantes, Saude..." />
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="company-potential">
          <option value="false" ${!company?.isPotential ? 'selected' : ''}>Regular</option>
          <option value="true" ${company?.isPotential ? 'selected' : ''}>Potencial</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observacoes</label>
      <textarea class="form-textarea" id="company-notes" rows="3">${company?.notes || ''}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Empresa' : 'Nova Empresa',
    content: formHTML,
    size: 'lg',
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: isEdit ? 'Salvar' : 'Cadastrar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const name = document.getElementById('company-name').value.trim();
          if (!name) {
            showToast('Nome da empresa e obrigatorio', 'warning');
            return;
          }

          const data = {
            name,
            cnpj: document.getElementById('company-cnpj').value.trim(),
            phone: document.getElementById('company-phone').value.trim(),
            email: document.getElementById('company-email').value.trim(),
            website: document.getElementById('company-website').value.trim(),
            address: document.getElementById('company-address').value.trim(),
            segment: document.getElementById('company-segment').value.trim(),
            isPotential: document.getElementById('company-potential').value === 'true',
            notes: document.getElementById('company-notes').value.trim(),
            source: company?.source || 'manual',
          };

          try {
            if (isEdit) {
              await updateDocument('companies', company.id, data);
              showToast('Empresa atualizada', 'success');
            } else {
              await createDocument('companies', data);
              showToast('Empresa cadastrada', 'success');
            }
            close();
            await loadCompanies();
          } catch (err) {
            showToast('Erro ao salvar empresa', 'error');
          }
        }
      },
    ],
  });
}

// Export for use by other modules (e.g., leads, services)
export { companies, loadCompanies };
