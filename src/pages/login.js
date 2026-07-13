// ============================================================
// VigApp — Login Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { login, register, loginWithGoogle } from '../auth.js';
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

          <button type="submit" class="btn btn-primary btn-lg" id="btn-login" style="width: 100%;">
            Entrar
          </button>

          <div style="display: flex; align-items: center; margin: 16px 0;">
            <div style="flex: 1; height: 1px; background: var(--border-primary);"></div>
            <span style="padding: 0 10px; color: var(--text-tertiary); font-size: 0.8125rem;">ou</span>
            <div style="flex: 1; height: 1px; background: var(--border-primary);"></div>
          </div>
          
          <button type="button" class="btn btn-outline btn-lg" id="btn-google" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar com Google
          </button>

          <p style="text-align: center; font-size: 0.8125rem; color: var(--text-tertiary); margin-top: 16px;">
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

  // Google Login handler
  document.getElementById('btn-google')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-google');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Aguarde...`;

    try {
      await loginWithGoogle();
      // Auth state change will reload the app
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(getAuthErrorMessage(err.code), 'error');
      }
      btn.disabled = false;
      btn.innerHTML = originalContent;
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
