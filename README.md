# 🛡️ HSE Incident Reporting System

منصة إدارة تقارير الحوادث والسلامة المهنية — **Node.js + React + PostgreSQL**

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)

---

## 📋 المتطلبات الأساسية

قبل البدء، تأكد من تثبيت:

| الأداة | الإصدار | رابط التحميل |
|--------|---------|-------------|
| **Node.js** | 20 LTS أو أحدث | [nodejs.org](https://nodejs.org/) |
| **npm** | 10+ (يأتي مع Node.js) | — |
| **PostgreSQL** | 15 أو أحدث | [postgresql.org](https://www.postgresql.org/download/) |
| **Git** | أي إصدار | [git-scm.com](https://git-scm.com/) |

---

## 🚀 تشغيل المشروع محلياً (خطوة بخطوة)

### الخطوة 1 — استنساخ المشروع

```bash
git clone https://github.com/Hassan-Alhaji/incident-system.git
cd incident-system
```

---

### الخطوة 2 — إعداد قاعدة البيانات PostgreSQL

1. تأكد أن PostgreSQL يعمل على جهازك
2. أنشئ قاعدة بيانات جديدة:

```sql
-- في psql أو pgAdmin
CREATE DATABASE incident_db;
```

---

### الخطوة 3 — إعداد Backend

```bash
cd backend

# 1. نسخ ملف البيئة وتعديله
cp .env.example .env
```

افتح ملف `backend/.env` وعدّل القيم التالية:

```env
NODE_ENV=development
PORT=3000

# رابط قاعدة البيانات المحلية
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/incident_db
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/incident_db

# مفتاح عشوائي طويل (أي نص عشوائي)
JWT_SECRET=any-long-random-secret-string-here-minimum-32-chars

# الإيميل الذي سيُنشئ حساب Admin تلقائياً عند أول تسجيل دخول
ADMIN_EMAIL=admin@example.com

# للتطوير المحلي
FRONTEND_URL=http://localhost:5173

# إعدادات البريد الإلكتروني (اختياري للتطوير)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com
```

```bash
# 2. تثبيت المكتبات
npm install

# 3. رفع Schema إلى قاعدة البيانات (ينشئ الجداول)
npx prisma db push

# 4. تشغيل Backend (على http://localhost:3000)
npm run dev
```

---

### الخطوة 4 — إعداد Frontend

افتح terminal جديد:

```bash
cd frontend

# 1. تثبيت المكتبات
npm install

# 2. تشغيل Frontend (على http://localhost:5173)
npm run dev
```

---

### الخطوة 5 — تسجيل الدخول

1. افتح المتصفح على `http://localhost:5173`
2. اضغط **"إرسال رمز التحقق"** بالإيميل الذي وضعته في `ADMIN_EMAIL`
3. ستجد رمز OTP في الـ terminal (console) عند تطوير بدون SMTP فعلي
4. سيُنشأ حساب ADMIN تلقائياً عند أول دخول

> **ملاحظة:** إذا لم يكن لديك SMTP، ستجد رمز OTP مطبوعاً في console الـ Backend.

---

## 🗂️ هيكل المشروع

```
incident-system/
├── backend/                # Node.js + Express API
│   ├── controllers/        # منطق العمل
│   ├── routes/             # تعريف الـ endpoints
│   ├── middleware/         # المصادقة والحماية
│   ├── prisma/             # Schema قاعدة البيانات
│   │   └── schema.prisma   # ← تعريف الجداول
│   ├── .env.example        # مثال متغيرات البيئة
│   ├── server.js           # نقطة البداية
│   └── package.json
│
├── frontend/               # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/          # صفحات التطبيق
│   │   ├── components/     # المكوّنات
│   │   ├── locales/        # الترجمة (ar/en)
│   │   └── utils/          # الأدوات المساعدة
│   └── package.json
│
├── start_dev.ps1           # سكريبت تشغيل سريع (Windows)
└── README.md
```

---

## ⚡ تشغيل سريع (Windows فقط)

إذا كنت على Windows، يمكنك تشغيل البرنامج كاملاً بأمر واحد:

```powershell
# من جذر المشروع
.\start_dev.ps1
```

سيفتح terminal للـ Backend وآخر للـ Frontend تلقائياً.

---

## 🔧 الأوامر المتاحة

### Backend

```bash
cd backend
npm run dev      # تشغيل بوضع التطوير (مع nodemon)
npm start        # تشغيل للإنتاج
npm test         # تشغيل الاختبارات
npx prisma studio  # واجهة قاعدة البيانات المرئية
```

### Frontend

```bash
cd frontend
npm run dev      # تشغيل بوضع التطوير
npm run build    # بناء للإنتاج
npm run preview  # معاينة build الإنتاج
```

---

## 🛠️ Tech Stack

| الطبقة | التقنية |
|--------|---------|
| **Backend** | Node.js 20, Express.js |
| **Frontend** | React 19, Vite, TypeScript, TailwindCSS |
| **Database** | PostgreSQL 15 + Prisma ORM |
| **Auth** | JWT + OTP via Email |
| **Maps** | Leaflet.js + OpenStreetMap |
| **Charts** | Recharts |
| **i18n** | react-i18next (العربية + الإنجليزية) |

---

## 📌 نقاط API الرئيسية

| الـ Endpoint | الوصف |
|-------------|-------|
| `POST /api/auth/send-otp` | إرسال رمز OTP |
| `POST /api/auth/verify-otp` | التحقق وتسجيل الدخول |
| `GET /api/tickets` | قائمة التذاكر |
| `POST /api/tickets` | إنشاء تذكرة جديدة |
| `GET /api/analytics` | بيانات الإحصائيات |
| `GET /api/health` | فحص حالة الخادم |

---

## 🔐 ملاحظات أمنية

- **لا ترفع ملف `.env` أبداً** — هو مضاف في `.gitignore`
- الـ `JWT_SECRET` يجب أن يكون نصاً عشوائياً طويلاً (32+ حرف)
- في الإنتاج، تأكد من تعيين `NODE_ENV=production` و`FRONTEND_URL` بشكل صحيح

---

## 🐛 مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| `Cannot connect to database` | تأكد أن PostgreSQL يعمل وكلمة المرور صحيحة في `.env` |
| `Prisma validation error` | شغّل `npx prisma db push` في `backend/` |
| `CORS error` | تأكد أن `FRONTEND_URL=http://localhost:5173` في `.env` |
| `Port 3000 in use` | غيّر `PORT=3001` في `.env` |

---

## 📞 التواصل

- **GitHub:** [Hassan-Alhaji/incident-system](https://github.com/Hassan-Alhaji/incident-system)
- **Repository:** `https://github.com/Hassan-Alhaji/incident-system.git`
