// File: plataforma cursos SyM/assets/js/moderation.js
// Moderación = cola de revisión de elementos que NO son cursos.
// Los cursos (aprobar / rechazar / archivar / eliminar / solicitudes / preview)
// se gestionan íntegramente en la sección "Cursos".
// Esta cola queda preparada para otros tipos de solicitudes a futuro.

import { onSessionChange } from './app.js';
import { initAdminSidebar } from './admin-utils.js';

onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'admin' && session.userData?.role !== 'sub_admin') {
    window.location.href = '../dashboard-admin/index.html';
    return;
  }

  await initAdminSidebar(session.user, session.userData, 'moderation');
  // Cuando existan otros ítems por revisar (no cursos), se cargan acá.
});
