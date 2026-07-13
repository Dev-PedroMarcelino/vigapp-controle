// ============================================================
// VigApp — Services Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, deleteDocument, getDocuments } from '../utils/firestore.js';
import { formatCurrency } from '../utils/format.js';

let services = [];

export async function renderServicesPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Servicos</h1>
          <p>Cadastre os servicos que a VigApp oferece</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btn-add-service">
            ${icon(ICONS.add, { size: 16 })} Novo Servico
          </button>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-bar">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="search-services" placeholder="Buscar servicos..." />
        </div>
        <select class="form-select" id="filter-category" style="width: auto;">
          <option value="">Todas as categorias</option>
          <option value="desenvolvimento">Desenvolvimento</option>
          <option value="marketing">Marketing</option>
          <option value="design">Design</option>
          <option value="consultoria">Consultoria</option>
          <option value="outro">Outro</option>
        </select>
      </div>

      <div class="grid-cards" id="services-grid">
        <div class="empty-state">
          <p>Carregando...</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-service')?.addEventListener('click', () => openServiceModal());
  document.getElementById('search-services')?.addEventListener('input', renderGrid);
  document.getElementById('filter-category')?.addEventListener('change', renderGrid);

  await loadServices();
}

async function loadServices() {
  try {
    services = await getDocuments('services');
    renderGrid();
  } catch (err) {
    console.warn('Error loading services:', err);
    renderEmptyGrid();
  }
}

function renderEmptyGrid() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state" style="grid-column: 1/-1;">
      ${icon(ICONS.services, { size: 40, class: 'icon' })}
      <h3>Nenhum servico cadastrado</h3>
      <p>Adicione servicos como Landing Page, Cardapio Digital, etc.</p>
    </div>
  `;
}

function renderGrid() {
  const search = (document.getElementById('search-services')?.value || '').toLowerCase();
  const category = document.getElementById('filter-category')?.value || '';

  let filtered = services;
  if (search) {
    filtered = filtered.filter(s =>
      (s.name || '').toLowerCase().includes(search) ||
      (s.description || '').toLowerCase().includes(search)
    );
  }
  if (category) {
    filtered = filtered.filter(s => s.category === category);
  }

  const grid = document.getElementById('services-grid');
  if (!grid) return;

  if (filtered.length === 0) {
    renderEmptyGrid();
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="card" style="position: relative;">
      <div class="card-header">
        <span class="badge badge-default">${s.category || 'Sem categoria'}</span>
        <div class="table-actions">
          <button class="btn-icon" data-action="edit" data-id="${s.id}" data-tooltip="Editar">
            ${icon(ICONS.edit, { size: 15 })}
          </button>
          <button class="btn-icon" data-action="delete" data-id="${s.id}" data-tooltip="Excluir">
            ${icon(ICONS.delete, { size: 15 })}
          </button>
        </div>
      </div>
      <h3 style="margin-bottom: 6px;">${s.name}</h3>
      <p class="text-sm text-secondary" style="margin-bottom: 12px;">${s.description || 'Sem descricao'}</p>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 1.25rem; font-weight: 700;">${formatCurrency(s.price)}</span>
        <span class="badge ${s.isActive !== false ? 'badge-success' : 'badge-default'}">
          ${s.isActive !== false ? 'Ativo' : 'Inativo'}
        </span>
      </div>
      <div class="card-footer">
        <span class="text-xs text-tertiary">Criado por ${s.createdBy?.name || '--'}</span>
      </div>
    </div>
  `).join('');

  // Action listeners
  grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const service = services.find(s => s.id === btn.dataset.id);
      if (service) openServiceModal(service);
    });
  });

  grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Excluir servico',
        message: 'Tem certeza que deseja excluir este servico?',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (confirmed) {
        await deleteDocument('services', btn.dataset.id);
        showToast('Servico excluido', 'success');
        await loadServices();
      }
    });
  });
}

function openServiceModal(service = null) {
  const isEdit = !!service;

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Nome do servico *</label>
      <input type="text" class="form-input" id="service-name" value="${service?.name || ''}" placeholder="Ex: Landing Page, Cardapio Digital" required />
    </div>
    <div class="form-group">
      <label class="form-label">Descricao</label>
      <textarea class="form-textarea" id="service-description" rows="3" placeholder="Descreva o servico...">${service?.description || ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Preco (R$)</label>
        <input type="number" class="form-input" id="service-price" value="${service?.price || ''}" step="0.01" min="0" placeholder="0,00" />
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-select" id="service-category">
          <option value="desenvolvimento" ${service?.category === 'desenvolvimento' ? 'selected' : ''}>Desenvolvimento</option>
          <option value="marketing" ${service?.category === 'marketing' ? 'selected' : ''}>Marketing</option>
          <option value="design" ${service?.category === 'design' ? 'selected' : ''}>Design</option>
          <option value="consultoria" ${service?.category === 'consultoria' ? 'selected' : ''}>Consultoria</option>
          <option value="outro" ${service?.category === 'outro' ? 'selected' : ''}>Outro</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Status</label>
      <select class="form-select" id="service-active">
        <option value="true" ${service?.isActive !== false ? 'selected' : ''}>Ativo</option>
        <option value="false" ${service?.isActive === false ? 'selected' : ''}>Inativo</option>
      </select>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Servico' : 'Novo Servico',
    content: formHTML,
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: isEdit ? 'Salvar' : 'Cadastrar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const name = document.getElementById('service-name').value.trim();
          if (!name) {
            showToast('Nome do servico e obrigatorio', 'warning');
            return;
          }

          const data = {
            name,
            description: document.getElementById('service-description').value.trim(),
            price: parseFloat(document.getElementById('service-price').value) || 0,
            category: document.getElementById('service-category').value,
            isActive: document.getElementById('service-active').value === 'true',
          };

          try {
            if (isEdit) {
              await updateDocument('services', service.id, data);
              showToast('Servico atualizado', 'success');
            } else {
              await createDocument('services', data);
              showToast('Servico cadastrado', 'success');
            }
            close();
            await loadServices();
          } catch (err) {
            showToast('Erro ao salvar servico', 'error');
          }
        }
      }
    ]
  });
}

export { services, loadServices };
