# CONTEXTO.md — Cursos SyM
# Estado de desarrollo por módulo y etapa
# Actualizar este archivo al completar cada ítem

---

## LEYENDA
- [ ] Pendiente
- [~] En progreso
- [x] Completado
- [T] Temporal (será reemplazado en etapa final)

---

## ETAPA 0 — Bases y Documentación
- [x] Resumen del proyecto definido
- [x] Stack tecnológico elegido
- [x] Reglas de negocio definidas
- [x] README.md creado
- [x] CONTEXTO.md creado
- [x] SCHEMA-BDD.md creado
- [x] ESTRUCTURA-APP.md creado
- [ ] Repositorio GitHub creado
- [ ] Firebase project creado
- [ ] .env configurado con credenciales reales

---

## ETAPA 1 — Estructura Base y Autenticación
- [x] Carpetas y archivos HTML base creados
- [x] CSS global: variables, temas claro/oscuro, tipografía
- [x] CSS componentes: bento grid, tarjetas, botones, modales
- [x] CSS responsive: menú lateral fijo/desplegable
- [x] firebase-config.js conectado
- [x] auth.js: registro de alumno (email/password)
- [x] auth.js: login
- [x] auth.js: logout
- [x] auth.js: persistencia de sesión y redirección por rol
- [x] auth.js: registro de profesor (requiere pago de membresía)
- [x] auth.js: reset de contraseña (sendPasswordResetEmail)
- [x] auth.js: bloqueo de cuenta suspendida al login
- [x] app.js: toggle tema claro/oscuro + logo dinámico
- [x] app.js: router básico entre páginas (routeGuard por rol)
- [x] app.js: banner de cookies estricto
- [x] app.js: loader global con fade-out
- [x] app.js: utilidades globales (formatARS, formatDate, getInitials, showToast)

---

## ETAPA 2 — Catálogo y Ficha de Curso
- [x] index.html: landing/catálogo con tarjetas
- [x] catalog.html: filtros por categoría y etiqueta
- [x] Búsqueda por texto libre (debounce 300ms)
- [x] Filtro por precio (gratis / de pago / todos)
- [x] Ordenamiento (más nuevo, mejor rating, más alumnos, precio)
- [x] Chips de filtros activos con botón de limpieza individual
- [x] course-detail.html: ficha completa del curso
- [x] Tarjetas con efecto apilamiento por categoría
- [x] Barra de progreso en tarjetas (para alumnos con curso comprado)
- [x] Thumbnails desde Cloudinary (sin fallback a YouTube)

---

## ETAPA 3 — Dashboard Profesor y Editor de Cursos
- [x] dashboard-teacher/index.html: panel principal bento grid
- [x] course-editor.html: formulario datos básicos del curso
- [x] course-editor.html: creador dinámico de módulos (+ Agregar Módulo, máx 15)
- [x] course-editor.html: creador dinámico de clases por módulo (+ Agregar Clase)
- [x] course-editor.html: upload de video por clase (Cloudinary, con barra de progreso)
- [x] course-editor.html: creador de quizzes por módulo (multiple choice)
- [x] course-editor.html: examen final (multiple choice, mín. 5 preguntas)
- [x] course-editor.html: URL certificado PDF (Google Drive)
- [x] course-editor.html: upload miniatura del curso (Cloudinary)
- [x] course-editor.html: upload video promocional (Cloudinary)
- [x] course-editor.html: checklist de publicación en tiempo real
- [x] course-editor.html: resumen lateral (módulos, clases, precio)
- [x] db.js: guardar borrador de curso en Firestore
- [x] db.js: enviar curso a moderación (estado: "pending")
- [x] stats.html: estadísticas de ventas e ingresos
- [x] stats.html: tasa de finalización de alumnos por curso
- [x] Notificaciones en tiempo real para el profesor

---

## ETAPA 4 — Moderación y Dashboard Admin
- [x] dashboard-admin/index.html: panel principal bento grid
- [x] moderation.html: cola de cursos pendientes
- [x] moderation.html: aprobar curso (estado: "published") + notificación al profesor
- [x] moderation.html: rechazar curso con motivo + notificación al profesor
- [x] moderation.html: thumbnails desde Cloudinary
- [x] users.html: listado de usuarios con búsqueda y filtro por rol
- [x] users.html: suspender cuenta con motivo
- [x] users.html: reactivar cuenta
- [x] finances.html: listado de transacciones (tabs: todas / reembolsos)
- [x] finances.html: stats de ingresos plataforma, profesores, membresías, reembolsos
- [x] finances.html: procesar reembolso + notificación a alumno y profesor
- [x] finances.html: disputas (visualización)

---

## ETAPA 5 — Consumo de Contenido (Player)
- [x] course-player.html: reproductor de video Cloudinary (nativo HTML5)
- [x] course-player.html: texto de apoyo por clase
- [x] course-player.html: quiz obligatorio al final de cada módulo
- [x] course-player.html: bloqueo de siguiente módulo hasta aprobar quiz
- [x] course-player.html: reintentar quiz si no aprueba
- [x] course-player.html: guardado de progreso en Firestore (% módulos completados)
- [x] course-player.html: reanudación automática desde última clase no completada
- [x] course-player.html: comentarios por clase (tiempo real con onSnapshot)
- [x] course-player.html: respuestas anidadas en comentarios
- [x] course-player.html: foro general del curso (posts + respuestas)
- [x] course-player.html: banner de examen final al completar todos los módulos
- [x] course-exam.html: examen final multiple choice
- [x] course-exam.html: corrección automática con revisión de respuestas
- [x] course-exam.html: mostrar/descargar certificado PDF al aprobar
- [x] course-exam.html: reintentar examen si no aprueba

---

## ETAPA 6 — Pagos y Checkout
- [x] checkout.html: resumen de compra
- [x] checkout.html: aceptación de términos y condiciones
- [x] checkout-result.html: página de resultado de pago (aprobado/fallido/pendiente)
- [x] payments.js: integración Mercado Pago Checkout Pro (Sandbox)
- [x] payments.js: membresía profesor $20.000 ARS
- [x] payments.js: compra de curso (precio variable)
- [x] payments.js: split 70/30 registrado en Firestore
- [x] payments.js: renderCheckoutButton (redirect a MP)
- [x] Lógica de reembolso (< 50% módulos consumidos)
- [x] Notificación al profesor por venta (tiempo real)
- [x] Notificación al alumno por compra exitosa

---

## ETAPA 7 — Dashboard Alumno
- [x] dashboard-student/index.html: mis cursos comprados
- [x] Barra de progreso por curso
- [x] Historial de compras con estado
- [x] Reseñas y calificaciones (estrellas 1-5) al completar curso
- [x] Solicitud de reembolso desde dashboard y desde historial
- [x] Thumbnails desde Cloudinary

---

## ETAPA 8 — Legal y Seguridad
- [x] terms.html: términos y condiciones
- [x] privacy.html: política de privacidad
- [x] Banner de cookies estricto (bloquea la plataforma si no acepta)
- [x] Reglas de seguridad Firestore (firestore-rules.txt)
- [x] Validación de roles en cada página (JS del lado cliente)
- [x] Bloqueo de cuenta suspendida al intentar login

---

## ETAPA 9 — Almacenamiento y Producción
- [x] Cloudinary: upload de videos de clases con barra de progreso
- [x] Cloudinary: upload de thumbnail del curso
- [x] Cloudinary: upload de video promocional
- [x] Cloudinary: esquema de carpetas cursos-sym/{teacherId}/{courseId}/...
- [x] Cloudinary: renderCloudinaryVideo (reproductor HTML5 nativo)
- [x] Cloudinary: getCourseThumbnail helper en storage.js
- [T] Google Drive: certificados PDF (link externo, sin personalización)
- [T] Mercado Pago Sandbox → producción (credenciales reales pendientes)
- [ ] Mover MP_ACCESS_TOKEN a backend/Cloud Function antes de producción
- [ ] Correos transaccionales (definir servicio: SendGrid / Firebase Extensions)
- [ ] Deploy final en GitHub Pages

---

## DECISIONES PENDIENTES
| Decisión | Estado | Notas |
|---|---|---|
| Almacenamiento PDFs certificados | Temporal | Google Drive link externo |
| Correos transaccionales | Pendiente | Depende de pasarela final |
| Mercado Pago producción | Pendiente | Sandbox activo, MP_ACCESS_TOKEN en frontend (solo OK en sandbox) |
| Deploy GitHub Pages | Pendiente | Requiere Firebase project real |

---

## NOTAS TÉCNICAS IMPORTANTES
- Videos: Cloudinary (upload directo desde browser con XMLHttpRequest + progreso)
- Thumbnails e imágenes: Cloudinary, esquema cursos-sym/{teacherId}/{courseId}/thumbnails/thumbnail
- Videos promo: Cloudinary, esquema cursos-sym/{teacherId}/{courseId}/promo/promo
- Videos de clases: Cloudinary, esquema cursos-sym/{teacherId}/{courseId}/videos/{moduleId}_{lessonId}
- PDFs certificados: el profesor pega link de Google Drive; el sistema NO personaliza el PDF
- Reproductor: video HTML5 nativo con controlsList="nodownload"
- Progreso del alumno: se guarda en Firestore como array de módulos completados
- Reembolso: se habilita solo si `modulosCompletados / totalModulos < 0.5`
- Notificaciones: Firestore `onSnapshot` listeners, colección `notifications/{userId}`
- Roles: guardados en Firestore `users/{uid}.role` = "student" | "teacher" | "admin"
- Pagos: Mercado Pago Checkout Pro, redirect a sandbox_init_point, resultado en checkout-result.html
- Split: 70% profesor / 30% plataforma, registrado en `transactions` de Firestore
