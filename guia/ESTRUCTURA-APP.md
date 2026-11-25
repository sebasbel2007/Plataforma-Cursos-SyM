# ESTRUCTURA-APP.md — Cursos SyM
# Arquitectura de archivos, flujos de usuario y decisiones de diseño

---

## ÁRBOL DE ARCHIVOS COMPLETO

```
proyecto plataforma de cursos/
│
├── README.md                            # Documentación principal
├── CONTEXTO.md                          # Estado de avance por etapa
├── SCHEMA-BDD.md                        # Esquema Firestore completo
├── ESTRUCTURA-APP.md                    # Este archivo
├── resumen proyecto.txt                 # Idea original del proyecto
│
├── img/                                 # Logos (nivel raíz, fuera de la app)
│   ├── logo-claro.png
│   └── logo-oscuro.png
│
└── plataforma cursos SyM/               # TODO EL CÓDIGO VA AQUÍ
    │
    ├── index.html                       # Página de inicio = Catálogo público
    ├── .env.example                     # Variables de entorno requeridas
    │
    ├── assets/
    │   ├── css/
    │   │   ├── main.css                 # Variables CSS, reset, temas, tipografía
    │   │   ├── components.css           # Bento grid, tarjetas, botones, modales, nav
    │   │   └── responsive.css           # Breakpoints y menú mobile
    │   │
    │   ├── js/
    │   │   ├── app.js                   # Init, router, toggle tema, guards de ruta
    │   │   ├── auth.js                  # Firebase Auth: registro, login, logout, sesión
    │   │   ├── db.js                    # Firestore: CRUD de todas las colecciones
    │   │   ├── storage.js               # Cloudinary uploads (videos, thumbnails, promo) + Drive (certificados)
    │   │   ├── payments.js              # Mercado Pago Sandbox — reemplazar en etapa final
    │   │   └── notifications.js         # onSnapshot listeners, render campanita
    │   │
    │   └── img/                         # Imágenes de la UI (íconos, placeholders)
    │
    ├── pages/
    │   │
    │   ├── auth/
    │   │   ├── login.html               # Formulario login
    │   │   └── register.html            # Formulario registro (alumno por defecto)
    │   │
    │   ├── catalog/
    │   │   └── catalog.html             # Catálogo con filtros y búsqueda
    │   │
    │   ├── course/
    │   │   ├── course-detail.html       # Ficha del curso (pública, antes de comprar)
    │   │   ├── course-player.html       # Consumo de contenido (requiere compra)
    │   │   └── course-exam.html         # Examen final (requiere completar todos los módulos)
    │   │
    │   ├── checkout/
    │   │   ├── checkout.html            # Resumen + términos + pago
    │   │   └── checkout-result.html     # Resultado del pago (aprobado/fallido/pendiente)
    │   │
    │   ├── dashboard-student/
    │   │   └── index.html               # Mis cursos, progreso, historial, reseñas
    │   │
    │   ├── dashboard-teacher/
    │   │   ├── index.html               # Panel principal del profesor
    │   │   ├── course-editor.html       # Crear/editar curso completo
    │   │   └── stats.html               # Estadísticas de ventas y alumnos
    │   │
    │   └── dashboard-admin/
    │       ├── index.html               # Panel principal admin
    │       ├── moderation.html          # Cola de moderación de cursos
    │       ├── users.html               # Gestión de usuarios
    │       └── finances.html            # Transacciones, reembolsos, disputas
    │
    ├── firebase/
    │   ├── firebase-config.js           # Config Firebase (lee de .env)
    │   ├── firestore-rules.txt          # Reglas de seguridad Firestore
    │   └── firestore-schema.md          # Copia del schema para referencia rápida
    │
    └── legal/
        ├── terms.html                   # Términos y condiciones
        └── privacy.html                 # Política de privacidad
```

---

## FLUJOS DE USUARIO

### Flujo Alumno
```
Visita index.html (catálogo)
  → Sin sesión: ve cursos, no puede comprar
  → Clic en curso → course-detail.html
      → Clic "Comprar" → redirect a login.html (si no tiene sesión)
      → login.html / register.html → vuelve a checkout.html
  → checkout.html: resumen + acepta términos + pago Mercado Pago
  → Pago aprobado → enrollment creado en Firestore → redirect a course-player.html
  → course-player.html:
      Clase 1 (video + texto) → Quiz módulo 1 (obligatorio) → Clase 2...
      Al completar todos los módulos → course-exam.html
  → course-exam.html: examen final → si aprueba → certificado disponible
  → dashboard-student: ver progreso, historial, dejar reseña
```

### Flujo Profesor
```
register.html → selecciona rol "Profesor"
  → redirect a checkout.html (membresía $20.000 ARS)
  → Pago aprobado → role = "teacher" en Firestore
  → dashboard-teacher/index.html
  → course-editor.html: llena datos del curso
      → Guarda borrador (status: "draft")
      → Envía a moderación (status: "pending")
  → Admin aprueba → status: "published" → notificación al profesor
  → stats.html: ve ventas, ingresos, alumnos
```

### Flujo Admin
```
login.html → role = "admin" → redirect a dashboard-admin/index.html
  → moderation.html: ve cursos en status "pending"
      → Aprueba → status: "published" + notificación al profesor
      → Rechaza → status: "rejected" + motivo + notificación al profesor
  → users.html: gestiona cuentas
  → finances.html: ve transacciones, procesa reembolsos
```

---

## SISTEMA DE TEMAS (CLARO / OSCURO)

### Variables CSS (main.css)
```css
/* Modo oscuro (default) */
:root[data-theme="dark"] {
  --bg-primary: #0d0d0f;
  --bg-secondary: #16161a;
  --bg-card: #1c1c21;
  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
  --accent: #00d4ff;          /* azul/cian neón suave */
  --accent-hover: #00b8d9;
  --border: #2a2a35;
  --success: #00c896;
  --error: #ff4757;
  --warning: #ffa502;
}

/* Modo claro */
:root[data-theme="light"] {
  --bg-primary: #f5f5f7;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --text-primary: #0d0d0f;
  --text-secondary: #6b6b80;
  --accent: #0099cc;
  --accent-hover: #007aaa;
  --border: #e0e0e8;
  --success: #00a878;
  --error: #e63946;
  --warning: #f4a261;
}
```

### Lógica de toggle (app.js)
- Lee preferencia guardada en `localStorage`
- Si no hay preferencia, usa `prefers-color-scheme` del sistema
- Al cambiar: actualiza `data-theme` en `<html>`, guarda en `localStorage`
- Logo: `<img id="logo">` cambia `src` entre `logo-claro.png` y `logo-oscuro.png`

---

## SISTEMA DE ROLES Y GUARDS

### Guards de ruta (app.js)
Cada página protegida verifica al cargar:
```
1. ¿Hay sesión activa? → No → redirect login.html
2. ¿El rol del usuario coincide con la página? → No → redirect index.html
```

| Página | Rol requerido |
|---|---|
| dashboard-student/ | student |
| dashboard-teacher/ | teacher |
| dashboard-admin/ | admin |
| course-player.html | student + enrollment activo |
| course-exam.html | student + todos los módulos completados |
| checkout.html | cualquier usuario autenticado |

---

## SISTEMA DE NOTIFICACIONES

- Colección Firestore: `notifications/{notificationId}`
- Al cargar cualquier dashboard: `onSnapshot` escucha notificaciones del usuario
- Campanita muestra badge con cantidad de no leídas
- Al hacer clic: marca como leídas (`read: true`)

### Tipos de notificación por rol
| Tipo | Destinatario | Trigger |
|---|---|---|
| `sale` | teacher | Alumno compra su curso |
| `enrollment` | student | Compra exitosa |
| `course_approved` | teacher | Admin aprueba curso |
| `course_rejected` | teacher | Admin rechaza curso |
| `refund` | teacher + student | Reembolso procesado |
| `moderation` | admin | Nuevo curso enviado a revisión |

---

## LÓGICA DE REEMBOLSO

```
progressPercent = (completedModules.length / course.totalModules) * 100

if (progressPercent < 50) → refundEligible = true
else → refundEligible = false
```

- El alumno solicita reembolso desde dashboard-student
- Admin lo procesa desde finances.html
- Al aprobar: `transaction.status = "refunded"`, `enrollment` marcado como reembolsado
- Notificación a alumno y profesor

---

## SPLIT DE PAGOS (SIMULADO)

```
totalAmount = course.price (en ARS)
platformFee = totalAmount * 0.30
teacherEarnings = totalAmount * 0.70
```

- Se guarda en `transactions/{id}` al confirmar el pago
- No hay transferencia real en Sandbox, solo registro en Firestore
- El panel de finanzas del admin muestra los totales

---

## ESTRUCTURA DEL CURSO (EDITOR)

```
Curso
├── Datos básicos (título, descripción, precio, categoría, tags, etc.)
├── Multimedia (upload miniatura Cloudinary, upload video promo Cloudinary)
├── Módulo 1 (máx 15 módulos)
│   ├── Clase 1.1 (upload video Cloudinary + texto apoyo)
│   ├── Clase 1.2
│   └── Quiz del módulo (multiple choice, mínimo 1 pregunta)
├── Módulo 2
│   └── ...
└── Examen Final (multiple choice, mínimo 5 preguntas)
    └── URL Certificado PDF (Google Drive)
```

---

## ESQUEMA CLOUDINARY

```
cursos-sym/
└── {teacherId}/
    └── {courseId}/
        ├── videos/
        │   └── {moduleId}_{lessonId}     # video de cada clase
        ├── thumbnails/
        │   └── thumbnail                 # miniatura del curso
        └── promo/
            └── promo                     # video promocional
```

---

## VARIABLES DE ENTORNO (.env.example)

```
# Firebase
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# Mercado Pago Sandbox
MP_PUBLIC_KEY=
MP_ACCESS_TOKEN=
```

---

## DECISIONES TÉCNICAS CLAVE

| Decisión | Elegido | Motivo |
|---|---|---|
| Framework JS | Vanilla JS | Sin dependencias, proyecto escolar |
| Auth | Firebase Authentication | Gratuito, fácil integración |
| BDD | Firestore | Tiempo real, sin servidor |
| Videos | Cloudinary (upload directo) | Upload con progreso, reproductor HTML5 nativo |
| PDFs | Google Drive link (temp) | Gratuito, sin backend |
| Imágenes cursos | Cloudinary (upload directo) | Upload con preview, esquema de carpetas por curso |
| Pagos | Mercado Pago Sandbox | Requerimiento del proyecto, ARS |
| Hosting | GitHub Pages | Gratuito, fácil deploy |
| CSS | Variables nativas + BEM | Sin frameworks, mantenible |
