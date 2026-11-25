# SCHEMA-BDD.md — Cursos SyM
# Esquema de colecciones Firestore
# Todos los campos, tipos y relaciones

---

## COLECCIÓN: `users`
**Documento ID:** `{uid}` (Firebase Auth UID)

```
users/{uid}
├── uid: string
├── email: string
├── displayName: string
├── photoURL: string | null
├── role: "student" | "teacher" | "admin"
├── membershipStatus: "none" | "active" | "expired"   // solo teachers
├── membershipPaidAt: timestamp | null
├── createdAt: timestamp
├── suspended: boolean
└── suspendedReason: string | null
```

---

## COLECCIÓN: `courses`
**Documento ID:** auto-generado

```
courses/{courseId}
├── courseId: string
├── teacherId: string                    // ref a users/{uid}
├── teacherName: string
├── title: string
├── subtitle: string
├── description: string                  // texto largo
├── category: string
├── tags: array<string>
├── requirements: array<string>          // qué necesita saber el alumno
├── outcomes: array<string>              // 3-5 resultados esperados
├── price: number                        // en ARS, 0 = gratis
├── isFree: boolean
├── thumbnailURL: string                 // URL externa (Cloudinary)
├── promoVideoURL: string                // URL YouTube
├── totalModules: number
├── totalDuration: string                // ej. "4h 30min" (calculado)
├── status: "draft" | "pending" | "published" | "rejected"
├── rejectionReason: string | null
├── certificateURL: string               // URL Google Drive (PDF plantilla)
├── rating: number                       // promedio calculado
├── totalRatings: number
├── totalStudents: number
├── createdAt: timestamp
└── updatedAt: timestamp
```

---

## SUBCOLECCIÓN: `courses/{courseId}/modules`
**Documento ID:** auto-generado (ordenar por `order`)

```
courses/{courseId}/modules/{moduleId}
├── moduleId: string
├── order: number                        // 1, 2, 3... (máx 15)
├── title: string
└── lessons: array<{                     // array embebido dentro del módulo
      lessonId: string,
      order: number,
      title: string,
      videoURL: string,                  // URL YouTube
      content: string                    // texto de apoyo (markdown o HTML)
    }>
```

---

## SUBCOLECCIÓN: `courses/{courseId}/modules/{moduleId}/quiz`
**Documento ID:** fijo `"quiz"` (uno por módulo)

```
courses/{courseId}/modules/{moduleId}/quiz/quiz
├── questions: array<{
      questionId: string,
      text: string,
      options: {
        a: string,
        b: string,
        c: string,
        d: string
      },
      correctOption: "a" | "b" | "c" | "d"
    }>
└── passingScore: number                 // % mínimo para aprobar (ej. 70)
```

---

## SUBCOLECCIÓN: `courses/{courseId}/finalExam`
**Documento ID:** fijo `"exam"`

```
courses/{courseId}/finalExam/exam
├── questions: array<{
      questionId: string,
      text: string,
      options: {
        a: string,
        b: string,
        c: string,
        d: string
      },
      correctOption: "a" | "b" | "c" | "d"
    }>
└── passingScore: number                 // % mínimo para aprobar (ej. 70)
```

---

## COLECCIÓN: `enrollments`
**Documento ID:** `{uid}_{courseId}`

```
enrollments/{uid}_{courseId}
├── studentId: string
├── courseId: string
├── teacherId: string
├── enrolledAt: timestamp
├── pricePaid: number                    // en ARS
├── paymentId: string                    // ID de Mercado Pago
├── completedModules: array<string>      // array de moduleIds completados
├── completedLessons: array<string>      // array de lessonIds completados
├── quizResults: map<moduleId, {         // resultado por quiz
      passed: boolean,
      score: number,
      attempts: number
    }>
├── examResult: {
      passed: boolean,
      score: number,
      completedAt: timestamp | null
    } | null
├── certificateIssued: boolean
├── certificateIssuedAt: timestamp | null
├── progressPercent: number              // (completedModules.length / totalModules) * 100
├── refundEligible: boolean              // true si progressPercent < 50
└── refundRequested: boolean
```

---

## COLECCIÓN: `transactions`
**Documento ID:** auto-generado

```
transactions/{transactionId}
├── type: "course_purchase" | "membership" | "refund"
├── studentId: string
├── teacherId: string | null
├── courseId: string | null
├── amount: number                       // total en ARS
├── platformFee: number                  // 30% del amount
├── teacherEarnings: number              // 70% del amount
├── paymentId: string                    // ID Mercado Pago
├── status: "pending" | "approved" | "refunded" | "disputed"
├── createdAt: timestamp
└── updatedAt: timestamp
```

---

## COLECCIÓN: `reviews`
**Documento ID:** `{uid}_{courseId}`

```
reviews/{uid}_{courseId}
├── studentId: string
├── courseId: string
├── teacherId: string
├── rating: number                       // 1-5 estrellas
├── comment: string
└── createdAt: timestamp
```

---

## SUBCOLECCIÓN: `courses/{courseId}/lessons/{lessonId}/comments`
**Documento ID:** auto-generado

```
courses/{courseId}/lessons/{lessonId}/comments/{commentId}
├── authorId: string
├── authorName: string
├── authorRole: "student" | "teacher"
├── text: string
├── createdAt: timestamp
└── parentId: string | null              // para respuestas anidadas
```

---

## SUBCOLECCIÓN: `courses/{courseId}/forum`
**Documento ID:** auto-generado

```
courses/{courseId}/forum/{postId}
├── authorId: string
├── authorName: string
├── authorRole: "student" | "teacher"
├── title: string
├── text: string
├── createdAt: timestamp
└── replies: array<{
      authorId: string,
      authorName: string,
      text: string,
      createdAt: timestamp
    }>
```

---

## COLECCIÓN: `notifications`
**Documento ID:** auto-generado

```
notifications/{notificationId}
├── userId: string                       // destinatario
├── type: "sale" | "enrollment" | "moderation" | "refund" | "course_approved" | "course_rejected"
├── title: string
├── message: string
├── read: boolean
├── relatedCourseId: string | null
├── relatedTransactionId: string | null
└── createdAt: timestamp
```

---

## COLECCIÓN: `categories`
**Documento ID:** auto-generado

```
categories/{categoryId}
├── name: string
├── slug: string
├── createdBy: string                    // uid del admin o teacher
└── createdAt: timestamp
```

---

## COLECCIÓN: `tags`
**Documento ID:** auto-generado

```
tags/{tagId}
├── name: string
├── slug: string
├── createdBy: string
└── createdAt: timestamp
```

---

## ÍNDICES RECOMENDADOS (Firestore Composite Indexes)
- `courses`: `status` ASC + `createdAt` DESC
- `courses`: `category` ASC + `status` ASC + `rating` DESC
- `enrollments`: `studentId` ASC + `enrolledAt` DESC
- `enrollments`: `teacherId` ASC + `enrolledAt` DESC
- `transactions`: `teacherId` ASC + `createdAt` DESC
- `notifications`: `userId` ASC + `read` ASC + `createdAt` DESC
