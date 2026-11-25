/* File: plataforma cursos SyM/assets/js/sidebar.js
 * Sidebar compartido para páginas del storefront (catálogo, ficha de curso, checkout).
 * Depende de: <aside id="sidebar" class="sidebar">…</aside>, <div class="sidebar-overlay" id="sidebar-overlay">
 * y de una topbar móvil con #sidebar-open (ver app.js initSidebar).
 */
import { getInitials, showToast, applyTheme } from './app.js';
import { logout } from './app.js';

const ICON = {
  search: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>',
  home: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>',
  login: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 7v1a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>',
  register: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>'
};

const ROLE_LABEL = { admin: 'Administrador', sub_admin: 'Admin', teacher: 'Profesor', student: 'Alumno' };

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function navLink(label, href, icon, active) {
  return `<a href="${href}" class="sidebar-link${active ? ' active' : ''}">${ICON[icon] || ''} ${label}</a>`;
}

function divider() {
  return '<div style="height:1px;background:var(--border);margin:.75rem 1rem;"></div>';
}

/**
 * @param {object|null} session { user, userData }
 * @param {string} activeKey 'catalog' | 'detail' | 'checkout'
 */
export function renderSidebar(session, activeKey = '') {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const loggedIn = !!(session && session.user);
  const role = session && session.userData ? session.userData.role : null;
  const isAdmin = role === 'admin' || role === 'sub_admin';

  const homeHref = loggedIn
    ? (isAdmin ? '../dashboard-admin/index.html'
      : role === 'teacher' ? '../dashboard-teacher/index.html'
      : '../dashboard-student/index.html')
    : '../../index.html';

  const links = [];
  if (loggedIn) {
    if (isAdmin) links.push(navLink('Panel admin', '../dashboard-admin/index.html', 'home', activeKey === 'dashboard'));
    if (role === 'teacher') {
      links.push(navLink('Mi panel', '../dashboard-teacher/index.html', 'home', activeKey === 'dashboard'));
      links.push(navLink('Crear curso', '../dashboard-teacher/course-editor.html', 'plus'));
    }
    if (role === 'student') links.push(navLink('Mi panel', '../dashboard-student/index.html', 'home', activeKey === 'dashboard'));
    links.push(divider());
    links.push(navLink('Explorar cursos', '../catalog/catalog.html', 'search', activeKey === 'catalog'));
  } else {
    links.push(navLink('Explorar cursos', '../catalog/catalog.html', 'search', activeKey === 'catalog'));
    links.push(divider());
    links.push(navLink('Ingresar', '../auth/login.html', 'login'));
    links.push(navLink('Registrarse', '../auth/register.html', 'register'));
  }

  const name = loggedIn ? (session.userData && (session.userData.displayName || session.user.email) || 'Usuario') : '';
  const initials = loggedIn ? getInitials(name) : '?';

  const profile = loggedIn ? `
    <div style="padding:1.25rem 1rem;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:.75rem;">
        <div class="user-avatar" style="width:40px;height:40px;font-size:1rem;flex-shrink:0;">
          <span>${escapeHtml(initials)}</span>
        </div>
        <div style="overflow:hidden;">
          <div style="font-weight:600;font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);">${ROLE_LABEL[role] || 'Visitante'}</div>
        </div>
      </div>
    </div>` : '';

  sidebarEl.innerHTML = `
    <div style="padding:1.25rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <a href="${homeHref}">
        <img data-logo data-logo-base="../.." src="../../img/logo-oscuro.png" alt="Cursos SyM" style="height:28px;width:auto;" />
      </a>
      <button id="sidebar-close" class="btn btn-ghost btn-sm" style="display:none;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
    </div>
    ${profile}
    <nav style="padding:.75rem 0;flex:1;display:flex;flex-direction:column;">
      ${links.join('')}
    </nav>
    <div style="padding:1rem;border-top:1px solid var(--border);">
      <div class="theme-toggle" style="margin-bottom:.75rem;width:100%;justify-content:center;">
        <span class="theme-toggle-option" data-value="dark"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg> Oscuro</span>
        <span class="theme-toggle-option" data-value="light"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg> Claro</span>
      </div>
      ${loggedIn ? '<button id="sidebar-logout" class="btn btn-ghost btn-sm" style="width:100%;">Cerrar sesión</button>' : ''}
    </div>`;

  sidebarEl.querySelectorAll('.theme-toggle-option').forEach(opt => {
    opt.addEventListener('click', () => applyTheme(opt.dataset.value));
  });
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

  const logoutBtn = sidebarEl.querySelector('#sidebar-logout');
  logoutBtn?.addEventListener('click', async () => {
    if (!window.confirm('¿Cerrar sesión?')) return;
    try {
      await logout();
      window.location.href = '../../index.html';
    } catch (err) {
      console.error(err);
      showToast('No se pudo cerrar la sesión', 'error');
    }
  });
}
