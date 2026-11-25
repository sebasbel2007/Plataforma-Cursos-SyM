// File: plataforma cursos SyM/assets/js/app.js

import { auth } from '../../firebase/firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getUserData } from './db.js';
import { buildChrome } from './chrome.js';

// ─── Rutas por rol ────────────────────────────────────────────
export const ROLE_HOME = {
  student: '/pages/dashboard-student/index.html',
  teacher: '/pages/dashboard-teacher/index.html',
  admin:   '/pages/dashboard-admin/index.html'
};

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAppShell();
});

// El shell se arma apenas carga el módulo (los scripts están al final del body),
// para que renderSidebar / renderDashboardSidebar encuentren #sidebar aunque la
// sesión resuelva antes de DOMContentLoaded. Es idempotente: initAppShell
// (p. ej. tras un swap del router SPA) lo vuelve a llamar sin efectos.
if (document.body) buildChrome();

// Inicializa el shell de la app (tema, sidebar, toast, loader).
// Es idempotente: lo usa también el router SPA (spa.js) tras intercambiar contenido.
export function initAppShell() {
  buildChrome();
  initTheme();
  initCookieBanner();
  initSidebar();
  initToastContainer();
  initLoader();
}

// ─── Tema ─────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('sym-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || preferred);

  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  });

  document.querySelectorAll('.theme-toggle-option').forEach(opt => {
    opt.addEventListener('click', () => applyTheme(opt.dataset.value));
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sym-theme', theme);
  document.querySelectorAll('[data-logo]').forEach(img => {
    const base = img.dataset.logoBase || '.';
    img.src = base + '/' + (theme === 'light' ? 'img/logo-claro.png' : 'img/logo-oscuro.png');
  });
  document.querySelectorAll('.theme-toggle-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.value === theme);
  });
}

// ─── Loader ───────────────────────────────────────────────────
// Una sola suscripción a onAuthStateChanged para ocultar el loader
// (el #app-loader es persistente entre swaps SPA). Idempotente.
let _loaderBound = false;

function initLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.remove();
  }
  if (_loaderBound) return;
  _loaderBound = true;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userData = await getUserData(user.uid);
      window.__currentUser = { uid: user.uid, email: user.email, ...userData };
    } else {
      window.__currentUser = null;
    }
  });
}

function _hideLoader() {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  loader.classList.add('fade-out');
  setTimeout(() => loader.remove(), 300);
}

// ─── onSessionChange — único, con retry y replay ──────────────
// Una sola suscripción a onAuthStateChanged para toda la app (evita
// acumular listeners cuando el router SPA re-ejecuta los scripts de
// cada página). La última sesión se re-emite a los nuevos callbacks.
const _sessionCbs = new Set();
let _sessionBound = false;
let _sessionResolved = false;
let _lastSession = null;

export function onSessionChange(callback) {
  _sessionCbs.add(callback);
  if (_sessionResolved) callback(_lastSession);
  if (!_sessionBound) {
    _sessionBound = true;
    onAuthStateChanged(auth, async (user) => {
      _sessionResolved = true;
      _lastSession = user ? { user, userData: await _getUserWithRetry(user.uid) } : null;
      _sessionCbs.forEach(cb => cb(_lastSession));
    });
  }
  return () => { _sessionCbs.delete(callback); };
}

// El router SPA la llama antes de ejecutar los scripts de la página
// destino, para descartar los callbacks de la página anterior.
export function resetSessionListeners() {
  _sessionCbs.clear();
}

async function _getUserWithRetry(uid, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const data = await getUserData(uid);
    if (data) return data;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

// ─── logout ───────────────────────────────────────────────────
export async function logout() {
  for (const k in _roleCache) delete _roleCache[k];
  await signOut(auth);
}

// ─── Redirect por rol ─────────────────────────────────────────
export function redirectByRole(role) {
  const path = window.location.pathname;
  const targets = {
    student: 'dashboard-student/index.html',
    teacher: 'dashboard-teacher/index.html',
    admin:   'dashboard-admin/index.html'
  };
  const target = targets[role];
  if (!target) { window.location.href = '/index.html'; return; }

  // Construir ruta relativa según dónde estamos
  if (path.includes('/pages/auth/')) {
    window.location.href = '../' + target;
  } else if (path.includes('/pages/')) {
    window.location.href = '../' + target;
  } else {
    window.location.href = './pages/' + target;
  }
}

// ─── Guard de ruta ────────────────────────────────────────────
// Cachea la sesión por rol: si el router SPA re-ejecuta el script
// de un dashboard, requireRole resuelve al instante sin registrar
// otro listener de auth.
const _roleCache = {};

export function requireRole(roleRequired) {
  return new Promise((resolve) => {
    const cached = _roleCache[roleRequired];
    if (cached) { resolve(cached); return; }

    // Timeout de seguridad: si Firebase tarda más de 10s, redirige al login
    const timeout = setTimeout(() => _redirectToLogin(), 10000);

    onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      if (!user) { _redirectToLogin(); return; }

      const userData = await _getUserWithRetry(user.uid);
      if (!userData) { _redirectToLogin(); return; }

// Admin puede entrar a cualquier página
      if (userData.role !== roleRequired && userData.role !== 'admin' && userData.role !== 'sub_admin') {
        redirectByRole(userData.role);
        return;
      }
      const session = { user, userData };
      _roleCache[roleRequired] = session;
      resolve(session);
    });
  });
}

function _redirectToLogin() {
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    window.location.href = '../auth/login.html';
  } else {
    window.location.href = './pages/auth/login.html';
  }
}

// ─── Toast ────────────────────────────────────────────────────
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

// ─── Sidebar mobile ───────────────────────────────────────────
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const openBtn  = document.getElementById('sidebar-open');
  const closeBtn = document.getElementById('sidebar-close');
  if (!sidebar) return;

  const open  = () => { sidebar.classList.add('open');    overlay?.classList.add('visible');    document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('visible'); document.body.style.overflow = ''; };

  openBtn?.addEventListener('click', open);
  // sidebar-close puede ser inyectado después por renderDashboardSidebar;
  // usamos delegación en el sidebar para capturarlo siempre.
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('#sidebar-close')) close();
  });
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
}

// ─── Toast container ──────────────────────────────────────────
function initToastContainer() {
  if (!document.getElementById('toast-container')) {
    const c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
}

// ─── Cookie banner ────────────────────────────────────────────
function initCookieBanner() {
  if (localStorage.getItem('sym-cookies-accepted')) return;
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  document.getElementById('cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem('sym-cookies-accepted', 'true');
    banner.remove();
  });
  document.getElementById('cookie-reject')?.addEventListener('click', () => {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
        background:#0d0d0f;color:#fff;font-family:Inter,sans-serif;text-align:center;padding:2rem;">
        <div>
          <h2 style="margin-bottom:1rem;">Cookies requeridas</h2>
          <p style="color:#a0a0b0;margin-bottom:1.5rem;">
            Esta plataforma requiere cookies para funcionar.<br>Debés aceptarlas para continuar.
          </p>
          <button onclick="location.reload()"
            style="background:#00d4ff;color:#000;border:none;padding:.75rem 1.5rem;
            border-radius:12px;font-weight:700;cursor:pointer;font-size:1rem;">
            Volver a intentar
          </button>
        </div>
      </div>`;
  });
}

// ─── Utilidades ───────────────────────────────────────────────
export function formatARS(amount) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
