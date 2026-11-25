// File: plataforma cursos SyM/assets/js/chrome.js

import { applyTheme } from './app.js';

const SIDEBAR_STYLE = 'width:var(--sidebar-width);position:fixed;top:0;left:0;height:100vh;background:var(--bg-secondary);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:200;overflow-y:auto;transition:transform .25s cubic-bezier(.4,0,.2,1);';
const LOGO_BASE = '../..';

const ICON = {
  hamburger: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
  panel: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  courses: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>',
  reviews: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>',
  activity: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
  stats: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
  search: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>',
  history: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
  moderation: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  categories: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10v10H7V7zm2 2h6v6H9V9z"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
  finances: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402-2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>',
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>',
  profile: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>'
};

const ROLE_PROFILE = {
  student:   { label: 'Alumno',         color: 'var(--text-muted)' },
  teacher:   { label: 'Profesor',        color: 'var(--accent)' },
  admin:     { label: 'Administrador',   color: 'var(--error)' },
  sub_admin: { label: 'Admin',           color: 'var(--error)' }
};

const NAV = {
  student: [
    { key: 'courses',       tab: 'courses',       label: 'Mis cursos',               icon: 'courses' },
    { key: 'history',       tab: 'history',       label: 'Historial de compras',     icon: 'history' },
    { key: 'reviews',       tab: 'reviews',       label: 'Mis reseñas',              icon: 'reviews' },
    { key: 'notifications', tab: 'notifications', label: 'Notificaciones recientes', icon: 'activity' },
    { divider: true },
    { key: 'profile', href: 'profile.html', label: 'Mi perfil', icon: 'profile' },
    { href: '../catalog/catalog.html', label: 'Explorar cursos', icon: 'search' }
  ],
  teacherTabs: [
    { key: 'panel',    view: 'panel',    label: 'Panel principal', icon: 'panel' },
    { key: 'courses',  view: 'courses',  label: 'Mis cursos',      icon: 'courses' },
    { href: 'course-editor.html',        label: 'Nuevo curso',     icon: 'plus' },
    { key: 'reviews',  view: 'reviews',  label: 'Reseñas',         icon: 'reviews' },
    { key: 'activity', view: 'activity', label: 'Actividad',       icon: 'activity' },
    { divider: true },
    { href: 'stats.html',                label: 'Estadísticas',    icon: 'stats' },
    { key: 'profile', href: 'profile.html', label: 'Mi perfil',   icon: 'profile' },
    { href: '../catalog/catalog.html',   label: 'Ver catálogo',    icon: 'search' }
  ],
  teacherPages: [
    { key: 'panel',    href: 'index.html',          label: 'Panel principal', icon: 'panel' },
    { key: 'courses',  href: 'index.html',          label: 'Mis cursos',      icon: 'courses' },
    { href: 'course-editor.html',                   label: 'Nuevo curso',     icon: 'plus' },
    { key: 'reviews',  href: 'index.html',          label: 'Reseñas',         icon: 'reviews' },
    { key: 'activity', href: 'index.html',          label: 'Actividad',       icon: 'activity' },
    { divider: true },
    { key: 'stats',    href: 'stats.html',          label: 'Estadísticas',    icon: 'stats' },
    { key: 'profile',  href: 'profile.html',         label: 'Mi perfil',       icon: 'profile' },
    { href: '../catalog/catalog.html',              label: 'Ver catálogo',    icon: 'search' }
  ],
  admin: [
    { key: 'panel',      href: 'index.html',       label: 'Panel principal', icon: 'panel' },
    { key: 'moderation', href: 'moderation.html',  label: 'Moderación',      icon: 'moderation', badge: 'pending-badge' },
    { key: 'courses',    href: 'courses.html',     label: 'Cursos',          icon: 'courses' },
    { key: 'categories', href: 'categories.html',  label: 'Categorías',      icon: 'categories' },
    { key: 'users',      href: 'users.html',       label: 'Usuarios',        icon: 'users' },
    { key: 'finances',   href: 'finances.html',    label: 'Finanzas',        icon: 'finances' },
    { divider: true },
    { href: '../catalog/catalog.html', label: 'Ver catálogo', icon: 'search', secondary: true }
  ]
};

// ─── Loader / Cookie banner ────────────────────────────────────
function loaderHTML() {
  return '<div id="app-loader"><div class="loader-spinner"></div></div>';
}

function cookieBannerHTML() {
  return `
  <div id="cookie-banner" class="hidden">
    <div class="cookie-box">
      <h3>Usamos cookies 🍪</h3>
      <p>Esta plataforma utiliza cookies esenciales para funcionar correctamente.</p>
      <div class="cookie-actions">
        <button id="cookie-reject" class="btn btn-ghost btn-sm">Rechazar</button>
        <button id="cookie-accept" class="btn btn-primary btn-sm">Aceptar y continuar</button>
      </div>
    </div>
  </div>`;
}

function logoImage(extraStyle = 'height:28px;width:auto;', wrapper = true) {
  const img = `<img data-logo data-logo-base="${LOGO_BASE}" src="${LOGO_BASE}/img/logo-oscuro.png" alt="Cursos SyM" style="${extraStyle}" />`;
  return wrapper ? `<a href="${LOGO_BASE}/index.html">${img}</a>` : img;
}

function themeToggleHTML() {
  return `
    <div class="theme-toggle" style="margin-bottom:.75rem;width:100%;justify-content:center;">
      <span class="theme-toggle-option" data-value="dark">${ICON.moon} Oscuro</span>
      <span class="theme-toggle-option" data-value="light">${ICON.sun} Claro</span>
    </div>`;
}

// ─── Shell (idempotente) ───────────────────────────────────────
let _loaderBuilt = false;
export function buildChrome() {
  // Loader deshabilitado: la app muestra el contenido de inmediato sin overlay bloqueante.
  if (!_loaderBuilt && !document.getElementById('app-loader')) {
    // no-op: no se inserta el loader
  }
  _loaderBuilt = true;
  if (!document.getElementById('cookie-banner')) {
    document.body.insertAdjacentHTML('afterbegin', cookieBannerHTML());
  }

  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  const isDashboard = !!document.querySelector('.app-layout');

  if (!document.getElementById('sidebar')) {
    const sidebarHTML = isDashboard
      ? `<aside id="sidebar" class="app-drawer" style="${SIDEBAR_STYLE}"></aside>`
      : `<aside class="sidebar" id="sidebar"></aside>`;
    const overlayHTML = isDashboard
      ? `<div class="app-drawer-overlay" id="sidebar-overlay"></div>`
      : `<div class="sidebar-overlay" id="sidebar-overlay"></div>`;
    mainContent.insertAdjacentHTML('beforebegin', sidebarHTML + overlayHTML);
  }

  if (!mainContent.querySelector('#sidebar-open')) {
    if (isDashboard) {
      mainContent.insertAdjacentHTML('afterbegin', `
      <div id="mobile-topbar" class="app-topbar">
        <button id="sidebar-open" class="btn btn-ghost btn-sm" aria-label="Abrir menú">${ICON.hamburger}</button>
        <a href="${LOGO_BASE}/index.html" style="position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;">
          <img data-logo data-logo-base="${LOGO_BASE}" src="${LOGO_BASE}/img/logo-oscuro.png" alt="Cursos SyM" style="height:26px;width:auto;" />
        </a>
        <div style="display:flex;align-items:center;gap:.25rem;">
          <a href="${LOGO_BASE}/index.html" class="btn btn-ghost btn-sm" aria-label="Inicio" style="display:flex;align-items:center;padding:.375rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>
          </a>
          <div id="notif-btn-mobile"></div>
        </div>
      </div>`);
    } else {
      mainContent.insertAdjacentHTML('afterbegin', `
      <header class="topbar">
        <button id="sidebar-open" class="btn btn-ghost btn-sm">${ICON.hamburger}</button>
        <a class="topbar-logo" href="${LOGO_BASE}/index.html">${logoImage('', false)}</a>
        <div class="topbar-actions"></div>
      </header>`);
    }
  }
}

// ─── Sidebar de dashboards ─────────────────────────────────────
function navLinkHTML(item, isAdmin, activeKey) {
  const active = item.key === activeKey || item.href === activeKey
               || item.tab === activeKey || item.view === activeKey;
  const cls = `sidebar-link${active ? ' active' : ''}${item.secondary ? ' sidebar-link-secondary' : ''}`;
  const icon = `<span class="sidebar-icon">${ICON[item.icon] || ''}</span>`;
  const text = `<span class="sidebar-text">${item.label}</span>`;
  const badge = item.badge ? `<span id="${item.badge}" class="hidden sidebar-badge">1</span>` : '';

  if (isAdmin) {
    return `<a href="${item.href}" class="${cls}">${icon}${text}${badge}</a>`;
  }

  let attr = '';
  if (item.href) attr = `href="${item.href}"`;
  if (item.tab)  attr = `href="#" data-tab="${item.tab}"`;
  if (item.view) attr = `href="#" data-view="${item.view}"`;
  return `<a ${attr} class="${cls}">${ICON[item.icon] || ''} ${item.label}</a>`;
}

export function renderDashboardSidebar(family, activeKey, opts = {}) {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const isAdmin = family === 'admin';
  const profile = ROLE_PROFILE[family] || ROLE_PROFILE.student;

  let nav;
  if (family === 'teacher') nav = opts.mode === 'pages' ? NAV.teacherPages : NAV.teacherTabs;
  else nav = NAV[family];

  const links = nav.map(item =>
    item.divider
      ? '<div style="height:1px;background:var(--border);margin:.75rem 1rem;"></div>'
      : navLinkHTML(item, isAdmin, activeKey)
  ).join('');

  // Header: avatar + nombre/rol + botón cerrar (sin logo)
  sidebarEl.innerHTML = `
    <div class="drawer-profile-header">
      <div style="display:flex;align-items:center;gap:.875rem;flex:1;min-width:0;">
        <div class="user-avatar" style="width:44px;height:44px;font-size:1rem;flex-shrink:0;">
          <span id="sidebar-initials">?</span>
        </div>
        <div style="min-width:0;overflow:hidden;">
          <div id="sidebar-name" style="font-weight:700;font-size:.9375rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
          <div style="font-size:.75rem;color:${profile.color};margin-top:.1rem;">${profile.label}</div>
        </div>
      </div>
      <button id="sidebar-close" class="drawer-close-btn" aria-label="Cerrar menú">${ICON.close}</button>
    </div>
    <nav ${isAdmin ? 'class="sidebar-nav"' : 'style="padding:.75rem 0;flex:1;display:flex;flex-direction:column;"'}>
      ${links}
    </nav>
    <div style="padding:1rem;border-top:1px solid var(--border);">
      ${themeToggleHTML()}
      <button id="btn-logout" class="btn btn-ghost btn-sm" style="width:100%;">Cerrar sesión</button>
    </div>`;

  sidebarEl.querySelectorAll('.theme-toggle-option').forEach(opt => {
    opt.addEventListener('click', () => applyTheme(opt.dataset.value));
  });
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

  const overlay = document.getElementById('sidebar-overlay');

  // Cerrar con botón X
  sidebarEl.querySelector('#sidebar-close')?.addEventListener('click', _closeDrawer);

  // Cerrar al hacer clic en overlay
  overlay?.addEventListener('click', _closeDrawer);

  // Cerrar al hacer clic en un link del nav (mobile)
  sidebarEl.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 1024) _closeDrawer();
    });
  });

  function _closeDrawer() {
    sidebarEl.classList.remove('open');
    overlay?.classList.remove('visible');
    document.body.style.overflow = '';
  }
}
