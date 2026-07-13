// ============================================================
// VigApp — Login Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { login, register } from '../auth.js';
import { showToast } from '../components/toast.js';

/**
 * Render login page.
 */
export async function renderLoginPage(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-container animate-fade-in">
        <div class="login-logo">
          <img src="/midia/logo vigapp.png" alt="VigApp" />
          <h1>VigApp</h1>
          <p>Gestao inteligente para sua startup</p>
        </div>

        <form class="login-form" id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input
              type="email"
              id="login-email"
              class="form-input"
              placeholder="seu@email.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Senha</label>
            <div style="position: relative;">
              <input
                type="password"
                id="login-password"
                class="form-input"
                placeholder="Sua senha"
                required
                style="width: 100%; padding-right: 40px;"
                autocomplete="current-password"
              />
              <button type="button" class="btn-icon" id="toggle-password" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%);">
                ${icon(ICONS.eye, { size: 16 })}
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-lg" id="btn-login">
            Entrar
          </button>

          <p style="text-align: center; font-size: 0.8125rem; color: var(--text-tertiary); margin-top: 8px;">
            Nao tem conta?
            <a href="#" id="link-register" style="color: var(--text-primary); font-weight: 500;">Criar conta</a>
          </p>
        </form>

        <!-- Register Form (hidden by default) -->
        <form class="login-form" id="register-form" style="display: none;">
          <div class="form-group">
            <label class="form-label" for="register-name">Nome</label>
            <input
              type="text"
              id="register-name"
              class="form-input"
              placeholder="Seu nome"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="register-email">Email</label>
            <input
              type="email"
              id="register-email"
              class="form-input"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="register-password">Senha</label>
            <input
              type="password"
              id="register-password"
              class="form-input"
              placeholder="Minimo 6 caracteres"
              required
              minlength="6"
            />
          </div>

          <button type="submit" class="btn btn-primary btn-lg" id="btn-register">
            Criar conta
          </button>

          <p style="text-align: center; font-size: 0.8125rem; color: var(--text-tertiary); margin-top: 8px;">
            Ja tem conta?
            <a href="#" id="link-login" style="color: var(--text-primary); font-weight: 500;">Entrar</a>
          </p>
        </form>
      </div>
    </div>
  `;

  // Toggle password visibility
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('login-password');
  toggleBtn?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = icon(isPassword ? ICONS.eyeOff : ICONS.eye, { size: 16 });
  });

  // Switch between login and register
  document.getElementById('link-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'flex';
  });

  document.getElementById('link-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
  });

  // Login handler
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Entrando...`;

    try {
      await login(email, password);
      // Auth state change will reload the app
    } catch (err) {
      showToast(getAuthErrorMessage(err.code), 'error');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  // Register handler
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const btn = document.getElementById('btn-register');

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Criando...`;

    try {
      await register(email, password, name);
      showToast('Conta criada com sucesso', 'success');
    } catch (err) {
      showToast(getAuthErrorMessage(err.code), 'error');
      btn.disabled = false;
      btn.textContent = 'Criar conta';
    }
  });
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Email invalido',
    'auth/user-disabled': 'Conta desativada',
    'auth/user-not-found': 'Usuario nao encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/email-already-in-use': 'Email ja esta em uso',
    'auth/weak-password': 'Senha muito fraca (minimo 6 caracteres)',
    'auth/invalid-credential': 'Credenciais invalidas',
  };
  return messages[code] || 'Erro ao autenticar. Tente novamente.';
}
