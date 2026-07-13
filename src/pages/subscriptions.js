// ============================================================
// VigApp — Subscriptions & Payments Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createDocument, updateDocument, deleteDocument, getDocuments } from '../utils/firestore.js';
import { formatCurrency } from '../utils/format.js';
import { formatDate } from '../utils/date.js';

let subscriptions = [];
let payments = [];
let companiesList = [];
let servicesList = [];
let activeTab = 'subscriptions';

export async function renderSubscriptionsPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Assinaturas e Pagamentos</h1>
          <p>Controle assinaturas ativas e registro de pagamentos</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="btn-add-payment">
            ${icon(ICONS.dollarSign, { size: 16 })} Registrar Pagamento
          </button>
          <button class="btn btn-primary" id="btn-add-subscription">
            ${icon(ICONS.add, { size: 16 })} Nova Assinatura
          </button>
        </div>
      </div>

      <div class="tabs" id="sub-tabs">
        <button class="tab active" data-tab="subscriptions">Assinaturas</button>
        <button class="tab" data-tab="payments">Pagamentos</button>
      </div>

      <div style="margin-top: 20px;">
        <div id="tab-content"></div>
      </div>
    </div>
  `;

  // Tab switching
  document.querySelectorAll('#sub-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('#sub-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderActiveTab();
    });
  });

  document.getElementById('btn-add-subscription')?.addEventListener('click', () => openSubscriptionModal());
  document.getElementById('btn-add-payment')?.addEventListener('click', () => openPaymentModal());

  await loadData();
}

async function loadData() {
  try {
    [subscriptions, payments, companiesList, servicesList] = await Promise.all([
      getDocuments('subscriptions'),
      getDocuments('payments'),
      getDocuments('companies'),
      getDocuments('services'),
    ]);
    renderActiveTab();
  } catch (err) {
    console.warn('Error loading subscriptions:', err);
  }
}

function renderActiveTab() {
  const content = document.getElementById('tab-content');
  if (!content) return;

  if (activeTab === 'subscriptions') {
    renderSubscriptions(content);
  } else {
    renderPayments(content);
  }
}

function renderSubscriptions(content) {
  if (subscriptions.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        ${icon(ICONS.subscriptions, { size: 40, class: 'icon' })}
        <h3>Nenhuma assinatura cadastrada</h3>
        <p>Crie assinaturas vinculando empresas e servicos</p>
      </div>
    `;
    return;
  }

  const statusBadge = (status) => {
    const map = {
      active: { label: 'Ativa', class: 'badge-success' },
      paused: { label: 'Pausada', class: 'badge-warning' },
      canceled: { label: 'Cancelada', class: 'badge-danger' },
      expired: { label: 'Vencida', class: 'badge-danger' },
    };
    const s = map[status] || { label: status, class: 'badge-default' };
    return `<span class="badge ${s.class}">${s.label}</span>`;
  };

  content.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Servico</th>
            <th>Valor</th>
            <th>Frequencia</th>
            <th>Status</th>
            <th>Inicio</th>
            <th>Criado por</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${subscriptions.map(s => `
            <tr>
              <td style="font-weight: 500;">${s.companyName || '--'}</td>
              <td>${s.serviceName || '--'}</td>
              <td style="font-weight: 600;">${formatCurrency(s.value)}</td>
              <td>${s.paymentFrequency || 'Mensal'}</td>
              <td>${statusBadge(s.status)}</td>
              <td class="text-sm">${formatDate(s.startDate)}</td>
              <td class="text-sm text-secondary">${s.createdBy?.name || '--'}</td>
              <td>
                <div class="table-actions">
                  <button class="btn-icon" data-action="edit-sub" data-id="${s.id}" data-tooltip="Editar">
                    ${icon(ICONS.edit, { size: 15 })}
                  </button>
                  <button class="btn-icon" data-action="delete-sub" data-id="${s.id}" data-tooltip="Excluir">
                    ${icon(ICONS.delete, { size: 15 })}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  content.querySelectorAll('[data-action="edit-sub"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = subscriptions.find(s => s.id === btn.dataset.id);
      if (sub) openSubscriptionModal(sub);
    });
  });

  content.querySelectorAll('[data-action="delete-sub"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Excluir assinatura',
        message: 'Tem certeza que deseja excluir esta assinatura?',
        confirmLabel: 'Excluir',
        danger: true,
      });
      if (confirmed) {
        await deleteDocument('subscriptions', btn.dataset.id);
        showToast('Assinatura excluida', 'success');
        await loadData();
      }
    });
  });
}

function renderPayments(content) {
  if (payments.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        ${icon(ICONS.dollarSign, { size: 40, class: 'icon' })}
        <h3>Nenhum pagamento registrado</h3>
        <p>Registre pagamentos recebidos</p>
      </div>
    `;
    return;
  }

  const statusBadge = (status) => {
    const map = {
      paid: { label: 'Pago', class: 'badge-success' },
      pending: { label: 'Pendente', class: 'badge-warning' },
      overdue: { label: 'Atrasado', class: 'badge-danger' },
    };
    const s = map[status] || { label: status, class: 'badge-default' };
    return `<span class="badge ${s.class}">${s.label}</span>`;
  };

  content.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Valor</th>
            <th>Data</th>
            <th>Metodo</th>
            <th>Status</th>
            <th>Registrado por</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td style="font-weight: 500;">${p.companyName || '--'}</td>
              <td style="font-weight: 600;">${formatCurrency(p.amount)}</td>
              <td class="text-sm">${formatDate(p.date)}</td>
              <td>${p.method || '--'}</td>
              <td>${statusBadge(p.status)}</td>
              <td class="text-sm text-secondary">${p.createdBy?.name || '--'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openSubscriptionModal(subscription = null) {
  const isEdit = !!subscription;

  const companyOptions = companiesList.map(c =>
    `<option value="${c.id}" data-name="${c.name}" ${subscription?.companyId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const serviceOptions = servicesList.map(s =>
    `<option value="${s.id}" data-name="${s.name}" data-price="${s.price}" ${subscription?.serviceId === s.id ? 'selected' : ''}>${s.name} — ${formatCurrency(s.price)}</option>`
  ).join('');

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Empresa *</label>
      <select class="form-select" id="sub-company" required>
        <option value="">Selecione</option>
        ${companyOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Servico *</label>
      <select class="form-select" id="sub-service" required>
        <option value="">Selecione</option>
        ${serviceOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor (R$)</label>
        <input type="number" class="form-input" id="sub-value" value="${subscription?.value || ''}" step="0.01" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Frequencia</label>
        <select class="form-select" id="sub-frequency">
          <option value="Mensal" ${subscription?.paymentFrequency === 'Mensal' ? 'selected' : ''}>Mensal</option>
          <option value="Trimestral" ${subscription?.paymentFrequency === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
          <option value="Semestral" ${subscription?.paymentFrequency === 'Semestral' ? 'selected' : ''}>Semestral</option>
          <option value="Anual" ${subscription?.paymentFrequency === 'Anual' ? 'selected' : ''}>Anual</option>
          <option value="Avulso" ${subscription?.paymentFrequency === 'Avulso' ? 'selected' : ''}>Avulso</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data inicio</label>
        <input type="date" class="form-input" id="sub-start" value="${subscription?.startDate || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="sub-status">
          <option value="active" ${subscription?.status === 'active' ? 'selected' : ''}>Ativa</option>
          <option value="paused" ${subscription?.status === 'paused' ? 'selected' : ''}>Pausada</option>
          <option value="canceled" ${subscription?.status === 'canceled' ? 'selected' : ''}>Cancelada</option>
          <option value="expired" ${subscription?.status === 'expired' ? 'selected' : ''}>Vencida</option>
        </select>
      </div>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Assinatura' : 'Nova Assinatura',
    content: formHTML,
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: isEdit ? 'Salvar' : 'Criar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const companySelect = document.getElementById('sub-company');
          const serviceSelect = document.getElementById('sub-service');

          if (!companySelect.value || !serviceSelect.value) {
            showToast('Selecione empresa e servico', 'warning');
            return;
          }

          const companyOption = companySelect.options[companySelect.selectedIndex];
          const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];

          const data = {
            companyId: companySelect.value,
            companyName: companyOption.dataset.name,
            serviceId: serviceSelect.value,
            serviceName: serviceOption.dataset.name,
            value: parseFloat(document.getElementById('sub-value').value) || parseFloat(serviceOption.dataset.price) || 0,
            paymentFrequency: document.getElementById('sub-frequency').value,
            startDate: document.getElementById('sub-start').value,
            status: document.getElementById('sub-status').value,
          };

          try {
            if (isEdit) {
              await updateDocument('subscriptions', subscription.id, data);
              showToast('Assinatura atualizada', 'success');
            } else {
              await createDocument('subscriptions', data);
              showToast('Assinatura criada', 'success');
            }
            close();
            await loadData();
          } catch (err) {
            showToast('Erro ao salvar assinatura', 'error');
          }
        }
      }
    ]
  });
}

function openPaymentModal() {
  const companyOptions = companiesList.map(c =>
    `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`
  ).join('');

  const formHTML = `
    <div class="form-group">
      <label class="form-label">Empresa *</label>
      <select class="form-select" id="pay-company" required>
        <option value="">Selecione</option>
        ${companyOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor (R$) *</label>
        <input type="number" class="form-input" id="pay-amount" step="0.01" min="0" required />
      </div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-input" id="pay-date" value="${new Date().toISOString().split('T')[0]}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Metodo</label>
        <select class="form-select" id="pay-method">
          <option value="Pix">Pix</option>
          <option value="Boleto">Boleto</option>
          <option value="Cartao">Cartao</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Dinheiro">Dinheiro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="pay-status">
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="overdue">Atrasado</option>
        </select>
      </div>
    </div>
  `;

  openModal({
    title: 'Registrar Pagamento',
    content: formHTML,
    actions: [
      { label: 'Cancelar', class: 'btn btn-secondary', onClick: (close) => close() },
      {
        label: 'Registrar',
        class: 'btn btn-primary',
        onClick: async (close) => {
          const companySelect = document.getElementById('pay-company');
          const amount = parseFloat(document.getElementById('pay-amount').value);

          if (!companySelect.value || !amount) {
            showToast('Empresa e valor sao obrigatorios', 'warning');
            return;
          }

          const companyOption = companySelect.options[companySelect.selectedIndex];

          const data = {
            companyId: companySelect.value,
            companyName: companyOption.dataset.name,
            amount,
            date: document.getElementById('pay-date').value,
            method: document.getElementById('pay-method').value,
            status: document.getElementById('pay-status').value,
          };

          try {
            await createDocument('payments', data);
            showToast('Pagamento registrado', 'success');
            close();
            await loadData();
          } catch (err) {
            showToast('Erro ao registrar pagamento', 'error');
          }
        }
      }
    ]
  });
}
