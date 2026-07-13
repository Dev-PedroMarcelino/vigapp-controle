// ============================================================
// VigApp — Calendar / Agenda Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, deleteDocument, getDocuments } from '../utils/firestore.js';
import { getDaysInMonth, getFirstDayOfMonth, WEEKDAYS, MONTHS, isSameDay, today } from '../utils/date.js';

let events = [];
let currentYear, currentMonth;

export async function renderCalendarPage(container) {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Calendario</h1>
          <p>Gerencie seus compromissos e reunioes</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btn-add-event">
            ${icon(ICONS.add, { size: 16 })} Novo Evento
          </button>
        </div>
      </div>

      <div class="calendar-header">
        <div class="calendar-nav">
          <button class="btn-icon" id="btn-prev-month">
            ${icon(ICONS.chevronLeft, { size: 18 })}
          </button>
          <span class="calendar-month" id="calendar-month-label"></span>
          <button class="btn-icon" id="btn-next-month">
            ${icon(ICONS.chevronRight, { size: 18 })}
          </button>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-today">Hoje</button>
      </div>

      <div class="calendar-grid" id="calendar-grid">
      </div>
    </div>
  `;

  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal());
  document.getElementById('btn-prev-month')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('btn-next-month')?.addEventListener('click', () => changeMonth(1));
  document.getElementById('btn-today')?.addEventListener('click', goToday);

  await loadEvents();
  renderCalendar();
}

async function loadEvents() {
  try {
    events = await getDocuments('events');
  } catch (err) {
    console.warn('Error loading events:', err);
  }
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function goToday() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('calendar-month-label');
  if (!grid || !label) return;

  label.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);
  const todayDate = new Date();

  let html = '';

  // Day headers
  WEEKDAYS.forEach(day => {
    html += `<div class="calendar-day-header">${day}</div>`;
  });

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const isToday = isSameDay(date, todayDate);
    const dayEvents = getEventsForDate(date);

    html += `
      <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}">
        <div class="calendar-day-number">${d}</div>
        ${dayEvents.slice(0, 3).map(ev => `
          <div class="calendar-event" data-event-id="${ev.id}" style="background: ${getEventColor(ev.type)}">${ev.title}</div>
        `).join('')}
        ${dayEvents.length > 3 ? `<div class="text-xs text-tertiary" style="padding: 0 6px;">+${dayEvents.length - 3} mais</div>` : ''}
      </div>
    `;
  }

  // Next month days
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`;
  }

  grid.innerHTML = html;

  // Click on day to add event
  grid.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
    dayEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('calendar-event')) return;
      const date = dayEl.dataset.date;
      openEventModal(null, date);
    });
  });

  // Click on event
  grid.querySelectorAll('.calendar-event').forEach(eventEl => {
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const event = events.find(ev => ev.id === eventEl.dataset.eventId);
      if (event) openEventModal(event);
    });
  });
}

function getEventsForDate(date) {
  return events.filter(ev => {
    if (!ev.date) return false;
    const evDate = new Date(ev.date + 'T00:00:00');
    return isSameDay(evDate, date);
  });
}

function getEventColor(type) {
  const colors = {
    meeting: 'var(--accent-subtle)',
    call: 'var(--info-bg)',
    deadline: 'var(--danger-bg)',
    reminder: 'var(--warning-bg)',
    other: 'var(--bg-tertiary)',
  };
  return colors[type] || colors.other;
}

function openEventModal(event = null, prefilledDate = null) {
  const isEdit = !!event;

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Titulo *</label>
      <input type="text" class="form-input" id="event-title" value="${event?.title || ''}" placeholder="Titulo do evento" required />
    </div>
    <div class="form-group">
      <label class="form-label">Descricao</label>
      <textarea class="form-textarea" id="event-description" rows="3">${event?.description || ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input type="date" class="form-input" id="event-date" value="${event?.date || prefilledDate || today()}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-select" id="event-type">
          <option value="meeting" ${event?.type === 'meeting' ? 'selected' : ''}>Reuniao</option>
          <option value="call" ${event?.type === 'call' ? 'selected' : ''}>Ligacao</option>
          <option value="deadline" ${event?.type === 'deadline' ? 'selected' : ''}>Prazo</option>
          <option value="reminder" ${event?.type === 'reminder' ? 'selected' : ''}>Lembrete</option>
          <option value="other" ${event?.type === 'other' ? 'selected' : ''}>Outro</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Hora inicio</label>
        <input type="time" class="form-input" id="event-start" value="${event?.startTime || '09:00'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Hora fim</label>
        <input type="time" class="form-input" id="event-end" value="${event?.endTime || '10:00'}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Local</label>
      <input type="text" class="form-input" id="event-location" value="${event?.location || ''}" placeholder="Local ou link da reuniao" />
    </div>
  `;

  const actions = [
    { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
  ];

  if (isEdit) {
    actions.push({
      label: 'Excluir',
      class: 'btn btn-danger',
      onClick: async (close) => {
        await deleteDocument('events', event.id);
        showToast('Evento excluido', 'success');
        close();
        await loadEvents();
        renderCalendar();
      }
    });
  }

  actions.push({
    label: isEdit ? 'Salvar' : 'Criar',
    class: 'btn btn-primary',
    onClick: async (close) => {
      const title = document.getElementById('event-title').value.trim();
      const date = document.getElementById('event-date').value;
      if (!title || !date) {
        showToast('Titulo e data sao obrigatorios', 'warning');
        return;
      }

      const data = {
        title,
        description: document.getElementById('event-description').value.trim(),
        date,
        type: document.getElementById('event-type').value,
        startTime: document.getElementById('event-start').value,
        endTime: document.getElementById('event-end').value,
        location: document.getElementById('event-location').value.trim(),
      };

      try {
        if (isEdit) {
          await updateDocument('events', event.id, data);
          showToast('Evento atualizado', 'success');
        } else {
          await createDocument('events', data);
          showToast('Evento criado', 'success');
        }
        close();
        await loadEvents();
        renderCalendar();
      } catch (err) {
        showToast('Erro ao salvar evento', 'error');
      }
    }
  });

  openModal({
    title: isEdit ? 'Editar Evento' : 'Novo Evento',
    content: formHTML,
    actions,
  });
}
