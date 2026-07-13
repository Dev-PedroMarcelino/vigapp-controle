// ============================================================
// VigApp — Kanban (Business Pipeline) Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, getDocuments } from '../utils/firestore.js';
import { formatCurrency } from '../utils/format.js';

const STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'contact', label: 'Contato' },
  { id: 'proposal', label: 'Proposta' },
  { id: 'negotiation', label: 'Negociacao' },
  { id: 'closed-won', label: 'Fechado (Ganho)' },
  { id: 'closed-lost', label: 'Fechado (Perdido)' },
];

let deals = [];
let companiesList = [];
let servicesList = [];
let draggedCard = null;

export async function renderKanbanPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Pipeline de Negocios</h1>
          <p>Arraste os cards para gerenciar o processo de vendas</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btn-add-deal">
            ${icon(ICONS.add, { size: 16 })} Novo Negocio
          </button>
        </div>
      </div>

      <div class="kanban-container" id="kanban-container">
        ${STAGES.map(stage => `
          <div class="kanban-column" data-stage="${stage.id}">
            <div class="kanban-column-header">
              <div class="kanban-column-title">
                ${stage.label}
                <span class="kanban-column-count" data-count="${stage.id}">0</span>
              </div>
            </div>
            <div class="kanban-column-body" data-stage="${stage.id}">
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-add-deal')?.addEventListener('click', () => openDealModal());

  // Setup drag and drop
  setupDragAndDrop();

  await loadDeals();
}

async function loadDeals() {
  try {
    [deals, companiesList, servicesList] = await Promise.all([
      getDocuments('deals'),
      getDocuments('companies'),
      getDocuments('services'),
    ]);
    renderKanban();
  } catch (err) {
    console.warn('Error loading deals:', err);
  }
}

function renderKanban() {
  STAGES.forEach(stage => {
    const body = document.querySelector(`.kanban-column-body[data-stage="${stage.id}"]`);
    const countEl = document.querySelector(`[data-count="${stage.id}"]`);
    if (!body) return;

    const stageDeals = deals.filter(d => d.stage === stage.id);
    countEl.textContent = stageDeals.length;

    if (stageDeals.length === 0) {
      body.innerHTML = `<div class="empty-state" style="padding: 20px; opacity: 0.5;"><p class="text-xs">Arraste cards aqui</p></div>`;
      return;
    }

    body.innerHTML = stageDeals.map(d => `
      <div class="kanban-card" draggable="true" data-deal-id="${d.id}">
        <div class="kanban-card-title">${d.companyName || 'Sem empresa'}</div>
        <div class="kanban-card-service">${d.serviceName || 'Sem servico'}</div>
        <div class="kanban-card-footer">
          <div class="kanban-card-value">${formatCurrency(d.value)}</div>
          <div class="avatar avatar-sm" data-tooltip="${d.createdBy?.name || ''}">${(d.createdBy?.name || '?')[0]?.toUpperCase()}</div>
        </div>
      </div>
    `).join('');

    // Make cards draggable
    body.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', onDragStart);
      card.addEventListener('dragend', onDragEnd);
      card.addEventListener('click', () => {
        const deal = deals.find(d => d.id === card.dataset.dealId);
        if (deal) openDealModal(deal);
      });
    });
  });
}

function setupDragAndDrop() {
  const columns = document.querySelectorAll('.kanban-column-body');
  columns.forEach(col => {
    col.addEventListener('dragover', onDragOver);
    col.addEventListener('dragenter', onDragEnter);
    col.addEventListener('dragleave', onDragLeave);
    col.addEventListener('drop', onDrop);
  });
}

function onDragStart(e) {
  draggedCard = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', e.target.dataset.dealId);
}

function onDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedCard = null;
  document.querySelectorAll('.kanban-column-body').forEach(col => {
    col.classList.remove('drag-over');
  });
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const dealId = e.dataTransfer.getData('text/plain');
  const newStage = e.currentTarget.dataset.stage;

  if (!dealId || !newStage) return;

  const deal = deals.find(d => d.id === dealId);
  if (!deal || deal.stage === newStage) return;

  const oldStage = deal.stage;

  try {
    await updateDocument('deals', dealId, { stage: newStage });
    deal.stage = newStage;
    renderKanban();

    if (newStage === 'closed-won') {
      showToast(`Negocio "${deal.companyName}" fechado com sucesso!`, 'success');
    } else if (newStage === 'closed-lost') {
      showToast(`Negocio "${deal.companyName}" marcado como perdido`, 'warning');
    }
  } catch (err) {
    showToast('Erro ao mover negocio', 'error');
    deal.stage = oldStage;
    renderKanban();
  }
}

function openDealModal(deal = null) {
  const isEdit = !!deal;

  const companyOptions = companiesList.map(c =>
    `<option value="${c.id}" data-name="${c.name}" ${deal?.companyId === c.id ? 'selected' : ''}>${c.name}${c.isPotential ? ' (Potencial)' : ''}</option>`
  ).join('');

  const serviceOptions = servicesList.map(s =>
    `<option value="${s.id}" data-name="${s.name}" data-price="${s.price}" ${deal?.serviceId === s.id ? 'selected' : ''}>${s.name} — ${formatCurrency(s.price)}</option>`
  ).join('');

  const stageOptions = STAGES.map(s =>
    `<option value="${s.id}" ${deal?.stage === s.id ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Empresa *</label>
      <select class="form-select" id="deal-company" required>
        <option value="">Selecione uma empresa</option>
        ${companyOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Servico *</label>
      <select class="form-select" id="deal-service" required>
        <option value="">Selecione um servico</option>
        ${serviceOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor (R$)</label>
        <input type="number" class="form-input" id="deal-value" value="${deal?.value || ''}" step="0.01" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Estagio</label>
        <select class="form-select" id="deal-stage">
          ${stageOptions}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observacoes</label>
      <textarea class="form-textarea" id="deal-notes" rows="3">${deal?.notes || ''}</textarea>
    </div>
  `;

  const modal = openModal({
    title: isEdit ? 'Editar Negocio' : 'Novo Negocio',
    content: formHTML,
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: isEdit ? 'Salvar' : 'Criar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const companySelect = document.getElementById('deal-company');
          const serviceSelect = document.getElementById('deal-service');

          if (!companySelect.value) {
            showToast('Selecione uma empresa', 'warning');
            return;
          }
          if (!serviceSelect.value) {
            showToast('Selecione um servico', 'warning');
            return;
          }

          const companyOption = companySelect.options[companySelect.selectedIndex];
          const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];

          const data = {
            companyId: companySelect.value,
            companyName: companyOption.dataset.name,
            serviceId: serviceSelect.value,
            serviceName: serviceOption.dataset.name,
            value: parseFloat(document.getElementById('deal-value').value) || parseFloat(serviceOption.dataset.price) || 0,
            stage: document.getElementById('deal-stage').value || 'lead',
            notes: document.getElementById('deal-notes').value.trim(),
          };

          try {
            if (isEdit) {
              await updateDocument('deals', deal.id, data);
              showToast('Negocio atualizado', 'success');
            } else {
              await createDocument('deals', data);
              showToast('Negocio criado', 'success');
            }
            close();
            await loadDeals();
          } catch (err) {
            showToast('Erro ao salvar negocio', 'error');
          }
        }
      }
    ]
  });

  // Auto-fill value when service changes
  document.getElementById('deal-service')?.addEventListener('change', (e) => {
    const option = e.target.options[e.target.selectedIndex];
    const valueInput = document.getElementById('deal-value');
    if (option.dataset.price && !valueInput.value) {
      valueInput.value = option.dataset.price;
    }
  });
}
