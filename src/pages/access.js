// ============================================================
// VigApp — Access Control Page (email allowlist)
// ============================================================
// Admins register the emails allowed to use the app. The list is stored in the
// `allowed_emails` collection (doc id = the lowercased email). Enforcement is
// two layers: the login gate in main.js (UX) and the Firestore security rules
// (real, server-side — see firestore.rules).
import { icon, ICONS } from '../icons.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getDocuments, setDocument, deleteDocument } from '../utils/firestore.js';
import { getUserData } from '../auth.js';

let allowedEmails = [];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function renderAccessPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Controle de Acesso</h1>
          <p>Cadastre os e-mails que podem acessar o sistema</p>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <span class="card-title">Adicionar e-mail autorizado</span>
        </div>
        <div class="form-row" style="align-items: flex-end;">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">E-mail</label>
            <input type="email" class="form-input" id="access-email" placeholder="pessoa@empresa.com" />
          </div>
          <button class="btn btn-primary" id="btn-add-email" style="margin-bottom: 2px;">
            ${icon(ICONS.add, { size: 16 })} Autorizar
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">E-mails autorizados</span>
          <span class="badge badge-default" id="access-count">0</span>
        </div>
        <div id="access-list">
          <div class="empty-state" style="padding: 20px;"><p>Carregando...</p></div>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('access-email');
  document.getElementById('btn-add-email')?.addEventListener('click', addEmail);
  input?.addEventListener('keypress', (e) => { if (e.key === 'Enter') addEmail(); });

  await loadEmails();
}

async function loadEmails() {
  try {
    allowedEmails = await getDocuments('allowed_emails');
    allowedEmails.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    renderList();
  } catch (err) {
    console.warn('Error loading allowed emails:', err);
    const listEl = document.getElementById('access-list');
    if (listEl) listEl.innerHTML = `<div class="empty-state" style="padding: 20px;"><p>Erro ao carregar</p></div>`;
  }
}

function renderList() {
  const listEl = document.getElementById('access-list');
  const countEl = document.getElementById('access-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = allowedEmails.length;

  if (allowedEmails.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        ${icon(ICONS.lock, { size: 36, class: 'icon' })}
        <h3>Nenhum e-mail cadastrado</h3>
        <p>Enquanto a lista estiver vazia, qualquer usuário logado consegue entrar.
        Adicione ao menos o seu e-mail para ativar a trava.</p>
      </div>
    `;
    return;
  }

  const myEmail = (getUserData()?.email || '').toLowerCase();

  listEl.innerHTML = `
    <div class="table-container" style="border: none;">
      <table class="table">
        <thead>
          <tr><th>E-mail</th><th>Adicionado por</th><th style="text-align:right;">Acoes</th></tr>
        </thead>
        <tbody>
          ${allowedEmails.map(e => `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:10px;">
                  <div class="avatar">${(e.email || '?')[0].toUpperCase()}</div>
                  <span style="font-weight:500;">${e.email}</span>
                  ${e.id === myEmail ? `<span class="badge badge-info">voce</span>` : ''}
                </div>
              </td>
              <td class="text-sm text-secondary">${e.createdBy?.name || '--'}</td>
              <td style="text-align:right;">
                <button class="btn-icon" data-action="remove-email" data-id="${e.id}" data-tooltip="Remover acesso">
                  ${icon(ICONS.delete, { size: 15 })}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  listEl.querySelectorAll('[data-action="remove-email"]').forEach(btn => {
    btn.addEventListener('click', () => removeEmail(btn.dataset.id));
  });
}

async function addEmail() {
  const input = document.getElementById('access-email');
  const email = (input?.value || '').trim().toLowerCase();

  if (!email) { showToast('Digite um e-mail', 'warning'); return; }
  if (!EMAIL_RE.test(email)) { showToast('E-mail invalido', 'warning'); return; }
  if (allowedEmails.some(e => (e.email || '').toLowerCase() === email)) {
    showToast('Esse e-mail ja esta autorizado', 'info');
    return;
  }

  try {
    await setDocument('allowed_emails', email, { email });
    showToast(`${email} autorizado`, 'success');
    if (input) input.value = '';
    await loadEmails();
  } catch (err) {
    showToast('Erro ao autorizar e-mail', 'error');
  }
}

async function removeEmail(id) {
  const myEmail = (getUserData()?.email || '').toLowerCase();
  if (id === myEmail) {
    const confirmed = await confirmDialog({
      title: 'Remover seu proprio acesso?',
      message: 'Voce esta removendo o seu proprio e-mail. Se nao for admin, pode perder o acesso ao sistema. Continuar?',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!confirmed) return;
  } else {
    const confirmed = await confirmDialog({
      title: 'Remover acesso',
      message: `Remover o acesso de "${id}"?`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!confirmed) return;
  }

  try {
    await deleteDocument('allowed_emails', id);
    showToast('Acesso removido', 'success');
    await loadEmails();
  } catch (err) {
    showToast('Erro ao remover acesso', 'error');
  }
}
