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

// Pointer-based drag & drop state (works with both touch and mouse).
let drag = null;
const HOLD_MS = 160;        // long-press before a touch drag starts
const MOVE_THRESHOLD = 8;   // px of movement that counts as drag/scroll intent
const EDGE = 72;            // px from a viewport edge that triggers auto-scroll
const SCROLL_SPEED = 14;

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
      <div class="kanban-card" data-deal-id="${d.id}">
        <div class="kanban-card-title">${d.companyName || 'Sem empresa'}</div>
        <div class="kanban-card-service">${d.serviceName || 'Sem servico'}</div>
        <div class="kanban-card-footer">
          <div class="kanban-card-value">${formatCurrency(d.value)}</div>
          <div class="avatar avatar-sm" data-tooltip="${d.createdBy?.name || ''}">${(d.createdBy?.name || '?')[0]?.toUpperCase()}</div>
        </div>
      </div>
    `).join('');

    // Pointer-based drag (touch + mouse). A plain tap/click opens the deal.
    body.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('pointerdown', onCardPointerDown);
    });
  });
}

// ============================================================
// Drag & drop via Pointer Events — works on touch and mouse.
// On touch, a short long-press picks up the card (so the board can still be
// scrolled normally); on mouse, movement past a threshold starts the drag.
// A floating clone follows the pointer and the column under it is highlighted.
// ============================================================
function onCardPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const card = e.currentTarget;

  drag = {
    dealId: card.dataset.dealId,
    card,
    pointerId: e.pointerId,
    isTouch: e.pointerType === 'touch',
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    offsetX: 0,
    offsetY: 0,
    active: false,
    moved: false,
    targetStage: null,
    clone: null,
    holdTimer: null,
    rafId: null,
  };

  // Touch: wait for a brief hold before grabbing, so scrolling still works.
  if (drag.isTouch) {
    drag.holdTimer = setTimeout(() => startDrag(), HOLD_MS);
  }

  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  // Non-passive so we can stop the page from scrolling while dragging on touch.
  document.addEventListener('touchmove', onTouchMoveGuard, { passive: false });
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;

  if (!drag.active) {
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (drag.isTouch) {
      // Moved before the hold completed → treat as a scroll, abort the drag.
      if (dist > MOVE_THRESHOLD) cleanupDrag();
    } else if (dist > MOVE_THRESHOLD) {
      startDrag();
    }
    return;
  }

  e.preventDefault();
  drag.moved = true;
  positionClone(e.clientX, e.clientY);
  updateTargetColumn(e.clientX, e.clientY);
}

function startDrag() {
  if (!drag || drag.active) return;
  clearTimeout(drag.holdTimer);
  drag.active = true;

  const card = drag.card;
  const rect = card.getBoundingClientRect();
  drag.offsetX = drag.lastX - rect.left;
  drag.offsetY = drag.lastY - rect.top;

  const clone = card.cloneNode(true);
  clone.classList.add('kanban-card-clone');
  clone.style.width = rect.width + 'px';
  document.body.appendChild(clone);
  drag.clone = clone;
  positionClone(drag.lastX, drag.lastY);

  card.classList.add('dragging');
  if (navigator.vibrate) navigator.vibrate(15);

  startAutoScroll();
}

function positionClone(x, y) {
  if (!drag || !drag.clone) return;
  drag.clone.style.left = (x - drag.offsetX) + 'px';
  drag.clone.style.top = (y - drag.offsetY) + 'px';
}

function updateTargetColumn(x, y) {
  // The clone has pointer-events:none, so elementFromPoint sees what's under it.
  const col = document.elementFromPoint(x, y)?.closest('.kanban-column');
  document.querySelectorAll('.kanban-column-body.drag-over')
    .forEach(c => c.classList.remove('drag-over'));
  drag.targetStage = null;
  if (col) {
    const body = col.querySelector('.kanban-column-body');
    if (body) {
      body.classList.add('drag-over');
      drag.targetStage = col.dataset.stage;
    }
  }
}

function startAutoScroll() {
  const pageEl = document.querySelector('.page-content');
  const boardEl = document.getElementById('kanban-container');
  function tick() {
    if (!drag || !drag.active) return;
    const { lastX: x, lastY: y } = drag;
    if (pageEl) {
      if (y < EDGE) pageEl.scrollTop -= SCROLL_SPEED;
      else if (y > window.innerHeight - EDGE) pageEl.scrollTop += SCROLL_SPEED;
    }
    if (boardEl) {
      if (x < EDGE) boardEl.scrollLeft -= SCROLL_SPEED;
      else if (x > window.innerWidth - EDGE) boardEl.scrollLeft += SCROLL_SPEED;
    }
    drag.rafId = requestAnimationFrame(tick);
  }
  drag.rafId = requestAnimationFrame(tick);
}

function onTouchMoveGuard(e) {
  if (drag && drag.active) e.preventDefault();
}

function onPointerUp() {
  if (!drag) return;
  const { active, moved, targetStage, dealId } = drag;
  cleanupDrag();

  if (!active) {
    // A tap/click with no drag → open the deal.
    const deal = deals.find(d => d.id === dealId);
    if (deal) openDealModal(deal);
    return;
  }
  if (moved && targetStage) moveDeal(dealId, targetStage);
}

function cleanupDrag() {
  if (!drag) return;
  clearTimeout(drag.holdTimer);
  if (drag.rafId) cancelAnimationFrame(drag.rafId);
  if (drag.clone) drag.clone.remove();
  drag.card?.classList.remove('dragging');
  document.querySelectorAll('.kanban-column-body.drag-over')
    .forEach(c => c.classList.remove('drag-over'));
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerUp);
  document.removeEventListener('touchmove', onTouchMoveGuard);
  drag = null;
}

async function moveDeal(dealId, newStage) {
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
