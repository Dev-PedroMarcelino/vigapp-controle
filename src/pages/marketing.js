// ============================================================
// VigApp — Marketing Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, deleteDocument, getDocuments } from '../utils/firestore.js';
import { formatCurrency } from '../utils/format.js';
import { formatTimestamp } from '../utils/firestore.js';

let campaigns = [];
let companiesList = [];

export async function renderMarketingPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Marketing</h1>
          <p>Gerencie campanhas de marketing dos seus clientes</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btn-add-campaign">
            ${icon(ICONS.add, { size: 16 })} Nova Campanha
          </button>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-bar">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="search-campaigns" placeholder="Buscar campanhas..." />
        </div>
        <select class="form-select" id="filter-campaign-status" style="width: auto;">
          <option value="">Todos os status</option>
          <option value="planning">Planejando</option>
          <option value="active">Ativo</option>
          <option value="paused">Pausado</option>
          <option value="completed">Concluido</option>
        </select>
      </div>

      <div class="grid-cards" id="campaigns-grid">
        <div class="empty-state" style="grid-column: 1/-1;">
          <p>Carregando...</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-campaign')?.addEventListener('click', () => openCampaignModal());
  document.getElementById('search-campaigns')?.addEventListener('input', renderGrid);
  document.getElementById('filter-campaign-status')?.addEventListener('change', renderGrid);

  await loadCampaigns();
}

async function loadCampaigns() {
  try {
    [campaigns, companiesList] = await Promise.all([
      getDocuments('marketing_campaigns'),
      getDocuments('companies'),
    ]);
    renderGrid();
  } catch (err) {
    console.warn('Error loading campaigns:', err);
    renderEmptyGrid();
  }
}

function renderEmptyGrid() {
  const grid = document.getElementById('campaigns-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state" style="grid-column: 1/-1;">
      ${icon(ICONS.marketing, { size: 40, class: 'icon' })}
      <h3>Nenhuma campanha de marketing</h3>
      <p>Crie campanhas para gerenciar o marketing dos seus clientes</p>
    </div>
  `;
}

function renderGrid() {
  const search = (document.getElementById('search-campaigns')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filter-campaign-status')?.value || '';

  let filtered = campaigns;
  if (search) {
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(search) ||
      (c.companyName || '').toLowerCase().includes(search)
    );
  }
  if (statusFilter) {
    filtered = filtered.filter(c => c.status === statusFilter);
  }

  const grid = document.getElementById('campaigns-grid');
  if (!grid) return;

  if (filtered.length === 0) {
    renderEmptyGrid();
    return;
  }

  const statusBadge = (status) => {
    const map = {
      planning: { label: 'Planejando', class: 'badge-default' },
      active: { label: 'Ativo', class: 'badge-success' },
      paused: { label: 'Pausado', class: 'badge-warning' },
      completed: { label: 'Concluido', class: 'badge-info' },
    };
    const s = map[status] || { label: status, class: 'badge-default' };
    return `<span class="badge ${s.class}">${s.label}</span>`;
  };

  grid.innerHTML = filtered.map(c => `
    <div class="campaign-card">
      <div class="campaign-card-header">
        <div>
          <h3 style="font-size: 1rem; margin-bottom: 4px;">${c.name || 'Sem nome'}</h3>
          <div class="text-sm text-secondary">${c.companyName || 'Sem empresa'}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${statusBadge(c.status)}
          <div class="table-actions">
            <button class="btn-icon" data-action="edit" data-id="${c.id}" data-tooltip="Editar">
              ${icon(ICONS.edit, { size: 15 })}
            </button>
            <button class="btn-icon" data-action="delete" data-id="${c.id}" data-tooltip="Excluir">
              ${icon(ICONS.delete, { size: 15 })}
            </button>
          </div>
        </div>
      </div>
      <div class="campaign-card-body">
        <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 16px;">
          ${c.type ? `<span class="tag">${c.type}</span>` : ''}
          ${c.startDate ? ` De ${c.startDate}` : ''}
          ${c.endDate ? ` ate ${c.endDate}` : ''}
        </div>
        <div class="campaign-metrics">
          <div class="campaign-metric">
            <div class="campaign-metric-value">${formatCurrency(c.budget || 0)}</div>
            <div class="campaign-metric-label">Orcamento</div>
          </div>
          <div class="campaign-metric">
            <div class="campaign-metric-value">${c.results?.impressions || 0}</div>
            <div class="campaign-metric-label">Impressoes</div>
          </div>
          <div class="campaign-metric">
            <div class="campaign-metric-value">${c.results?.clicks || 0}</div>
            <div class="campaign-metric-label">Cliques</div>
          </div>
        </div>
        <div class="card-footer" style="margin-top: 16px;">
          <span class="text-xs text-tertiary">Criado por ${c.createdBy?.name || '--'}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Action listeners
  grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const campaign = campaigns.find(c => c.id === btn.dataset.id);
      if (campaign) openCampaignModal(campaign);
    });
  });

  grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Excluir campanha',
        message: 'Tem certeza que deseja excluir esta campanha de marketing?',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (confirmed) {
        await deleteDocument('marketing_campaigns', btn.dataset.id);
        showToast('Campanha excluida', 'success');
        await loadCampaigns();
      }
    });
  });
}

function openCampaignModal(campaign = null) {
  const isEdit = !!campaign;

  const companyOptions = companiesList.map(c =>
    `<option value="${c.id}" data-name="${c.name}" ${campaign?.companyId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Nome da campanha *</label>
      <input type="text" class="form-input" id="campaign-name" value="${campaign?.name || ''}" required />
    </div>
    <div class="form-group">
      <label class="form-label">Empresa (cliente) *</label>
      <select class="form-select" id="campaign-company" required>
        <option value="">Selecione a empresa</option>
        ${companyOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-select" id="campaign-type">
          <option value="social-media" ${campaign?.type === 'social-media' ? 'selected' : ''}>Redes Sociais</option>
          <option value="google-ads" ${campaign?.type === 'google-ads' ? 'selected' : ''}>Google Ads</option>
          <option value="seo" ${campaign?.type === 'seo' ? 'selected' : ''}>SEO</option>
          <option value="content" ${campaign?.type === 'content' ? 'selected' : ''}>Conteudo</option>
          <option value="email" ${campaign?.type === 'email' ? 'selected' : ''}>Email Marketing</option>
          <option value="other" ${campaign?.type === 'other' ? 'selected' : ''}>Outro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="campaign-status">
          <option value="planning" ${campaign?.status === 'planning' ? 'selected' : ''}>Planejando</option>
          <option value="active" ${campaign?.status === 'active' ? 'selected' : ''}>Ativo</option>
          <option value="paused" ${campaign?.status === 'paused' ? 'selected' : ''}>Pausado</option>
          <option value="completed" ${campaign?.status === 'completed' ? 'selected' : ''}>Concluido</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data inicio</label>
        <input type="date" class="form-input" id="campaign-start" value="${campaign?.startDate || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Data fim</label>
        <input type="date" class="form-input" id="campaign-end" value="${campaign?.endDate || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Orcamento (R$)</label>
      <input type="number" class="form-input" id="campaign-budget" value="${campaign?.budget || ''}" step="0.01" min="0" />
    </div>
    ${isEdit ? `
      <div style="border-top: 1px solid var(--border-secondary); padding-top: 16px; margin-top: 8px;">
        <label class="form-label" style="margin-bottom: 12px;">Resultados</label>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Impressoes</label>
            <input type="number" class="form-input" id="campaign-impressions" value="${campaign?.results?.impressions || 0}" min="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Cliques</label>
            <input type="number" class="form-input" id="campaign-clicks" value="${campaign?.results?.clicks || 0}" min="0" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Conversoes</label>
            <input type="number" class="form-input" id="campaign-conversions" value="${campaign?.results?.conversions || 0}" min="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Investido (R$)</label>
            <input type="number" class="form-input" id="campaign-spent" value="${campaign?.results?.spent || 0}" step="0.01" min="0" />
          </div>
        </div>
      </div>
    ` : ''}
  `;

  openModal({
    title: isEdit ? 'Editar Campanha' : 'Nova Campanha',
    content: formHTML,
    size: 'lg',
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: isEdit ? 'Salvar' : 'Criar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const name = document.getElementById('campaign-name').value.trim();
          const companySelect = document.getElementById('campaign-company');

          if (!name) {
            showToast('Nome da campanha e obrigatorio', 'warning');
            return;
          }
          if (!companySelect.value) {
            showToast('Selecione uma empresa', 'warning');
            return;
          }

          const companyOption = companySelect.options[companySelect.selectedIndex];

          const data = {
            name,
            companyId: companySelect.value,
            companyName: companyOption.dataset.name,
            type: document.getElementById('campaign-type').value,
            status: document.getElementById('campaign-status').value,
            startDate: document.getElementById('campaign-start').value,
            endDate: document.getElementById('campaign-end').value,
            budget: parseFloat(document.getElementById('campaign-budget').value) || 0,
          };

          if (isEdit) {
            data.results = {
              impressions: parseInt(document.getElementById('campaign-impressions')?.value) || 0,
              clicks: parseInt(document.getElementById('campaign-clicks')?.value) || 0,
              conversions: parseInt(document.getElementById('campaign-conversions')?.value) || 0,
              spent: parseFloat(document.getElementById('campaign-spent')?.value) || 0,
            };
          }

          try {
            if (isEdit) {
              await updateDocument('marketing_campaigns', campaign.id, data);
              showToast('Campanha atualizada', 'success');
            } else {
              await createDocument('marketing_campaigns', data);
              showToast('Campanha criada', 'success');
            }
            close();
            await loadCampaigns();
          } catch (err) {
            showToast('Erro ao salvar campanha', 'error');
          }
        }
      }
    ]
  });
}
