# متطلبات البنية التحتية — Oracle Cloud Infrastructure (OCI)
## منصة إدارة الحوادث | Incident Management System
### وثيقة متطلبات للفريق التقني — OCI Team Requirements

**الإصدار:** 1.0  
**التاريخ:** 2026-07-20  
**الحالة:** للمراجعة والتنفيذ

---

## 📌 نظرة عامة على المشروع

| البند | التفاصيل |
|-------|-----------|
| نوع التطبيق | منصة ويب لإدارة تقارير الحوادث والسلامة |
| الـ Stack | Node.js (Express) + React/Vite + PostgreSQL |
| نظام التشغيل | Linux (Ubuntu 22.04 LTS) |
| الحمل المتوقع | ~3,000 تذكرة/سنة ، ذروة: 50-100 مستخدم متزامن |
| البيئات المطلوبة | **إنتاج (Production)** + **اختبار (Staging)** |

---

## 🏗️ معمارية البنية التحتية

```
Internet
    │
    ▼
[OCI Load Balancer - 100 Mbps]
    │
    ├──► [WAF - Web Application Firewall]
    │
    ▼
  VCN (Virtual Cloud Network)
  ┌─────────────────────────────────────────────┐
  │                                             │
  │  ┌─────────────┐      ┌──────────────────┐ │
  │  │ Public Subnet│      │  Private Subnet  │ │
  │  │             │      │                  │ │
  │  │ [App Server]│─────►│ [DB Server]      │ │
  │  │ Node.js +   │      │ PostgreSQL 15    │ │
  │  │ React Static│      │                  │ │
  │  └─────────────┘      └──────────────────┘ │
  │                                             │
  │  ┌──────────────────────────────────────┐  │
  │  │ Object Storage Bucket                │  │
  │  │ (Backups + Static Assets)            │  │
  │  └──────────────────────────────────────┘  │
  └─────────────────────────────────────────────┘
```

---

## 🟢 بيئة الإنتاج (Production Environment)

### 1. Compute Instance — خادم التطبيق

| المواصفة | القيمة |
|----------|--------|
| **Shape** | `VM.Standard.E4.Flex` |
| **OCPUs** | 2 OCPU |
| **RAM** | 16 GB |
| **Storage (Boot)** | 100 GB SSD (Block Volume) |
| **Storage (App/Uploads)** | 200 GB Block Volume (منفصل) |
| **OS** | Ubuntu 22.04 LTS |
| **Network** | 1 Gbps |

**الاستخدام:**
- Node.js Backend (Port 3000 داخلياً)
- Nginx Reverse Proxy (Port 80/443 خارجياً)
- React Static Files (served via Nginx)
- PM2 لإدارة العملية وإعادة التشغيل التلقائي

---

### 2. Database Server — خادم قاعدة البيانات

| المواصفة | القيمة |
|----------|--------|
| **الخيار المفضل** | `OCI PostgreSQL Database Service` |
| **الشكل البديل** | `VM.Standard.E4.Flex` مع PostgreSQL 15 |
| **OCPUs** | 2 OCPU |
| **RAM** | 16 GB |
| **Storage** | 200 GB SSD (قابل للتوسع) |
| **PostgreSQL** | الإصدار 15 |
| **High Availability** | Standby replica (يُفضَّل) |

> **ملاحظة:** إذا استُخدم `OCI PostgreSQL Database Service` يوفر:
> - Automated backups تلقائية
> - Point-in-time recovery
> - Automatic failover
> - مُدار بالكامل بدون صيانة يدوية

---

### 3. Load Balancer

| المواصفة | القيمة |
|----------|--------|
| **النوع** | OCI Flexible Load Balancer |
| **Bandwidth** | 100 Mbps (يكفي للحمل الحالي) |
| **SSL Termination** | نعم — شهادة SSL من Let's Encrypt أو OCI Certificates |
| **Health Check** | `/api/health` كل 30 ثانية |

---

### 4. Networking — الشبكة

```
VCN CIDR: 10.0.0.0/16

Subnets:
  Public Subnet:   10.0.1.0/24  (App Server + Load Balancer)
  Private Subnet:  10.0.2.0/24  (Database Server)
  
Security Lists (Firewall Rules):

  Public Subnet — Ingress (Incoming):
  ┌──────────┬──────────┬─────────────────────────┐
  │ Protocol │ Port     │ Source                  │
  ├──────────┼──────────┼─────────────────────────┤
  │ TCP      │ 80       │ 0.0.0.0/0 (HTTP)        │
  │ TCP      │ 443      │ 0.0.0.0/0 (HTTPS)       │
  │ TCP      │ 22       │ Your Office IP only      │
  └──────────┴──────────┴─────────────────────────┘

  Private Subnet — Ingress:
  ┌──────────┬──────────┬─────────────────────────┐
  │ Protocol │ Port     │ Source                  │
  ├──────────┼──────────┼─────────────────────────┤
  │ TCP      │ 5432     │ 10.0.1.0/24 (App only)  │
  └──────────┴──────────┴─────────────────────────┘
```

---

### 5. Object Storage — التخزين

| البند | التفاصيل |
|-------|-----------|
| **Bucket: backups-prod** | نسخ احتياطية قاعدة البيانات |
| **Bucket: uploads-prod** | ملفات المرفقات (صور، PDFs) |
| **Versioning** | مفعّل على bucket المرفقات |
| **Retention Policy** | 90 يوم للـ backups اليومية |
| **Encryption** | OCI-managed keys |

---

### 6. SSL/TLS والدومين

| البند | التفاصيل |
|-------|-----------|
| **Domain** | يُحدَّد من المشروع |
| **API Subdomain** | `api.domain.com` |
| **Frontend** | `app.domain.com` أو `domain.com` |
| **SSL** | Let's Encrypt (Auto-renew) أو OCI Certificates Service |
| **TLS Version** | 1.2 كحد أدنى، 1.3 مفضّل |

---

## 🟡 بيئة الاختبار (Staging Environment)

> بيئة الاختبار هي نسخة مصغّرة من الإنتاج تُستخدم لاختبار التحديثات قبل الرفع.

### 1. Compute Instance — خادم الاختبار

| المواصفة | القيمة |
|----------|--------|
| **Shape** | `VM.Standard.E4.Flex` |
| **OCPUs** | 1 OCPU |
| **RAM** | 8 GB |
| **Storage (Boot)** | 50 GB SSD |
| **Storage (App)** | 100 GB Block Volume |
| **OS** | Ubuntu 22.04 LTS |

---

### 2. Database Server — قاعدة بيانات الاختبار

| المواصفة | القيمة |
|----------|--------|
| **النوع** | PostgreSQL على نفس VM أو VM منفصل |
| **RAM** | 4-8 GB |
| **Storage** | 50 GB SSD |
| **PostgreSQL** | 15 (نفس الإنتاج) |
| **البيانات** | نسخة من بيانات الإنتاج (مُعقَّمة) |

> ⚠️ **مهم:** قاعدة بيانات الاختبار يجب أن تكون منفصلة تماماً عن الإنتاج.

---

### 3. Networking للاختبار

```
VCN منفصل أو Subnet منفصل:
  Staging Subnet: 10.0.3.0/24

Security Lists:
  - HTTP/HTTPS: مفتوح للفريق فقط (IP Whitelist)
  - لا يوجد Load Balancer (النفاذ المباشر بـ IP أو Nginx)
  - SSH: من مكتب الفريق فقط
```

---

### 4. متغيرات البيئة المطلوبة

على السيرفر، يجب إنشاء ملف `/etc/incident-system/.env.production` يحتوي على:

```bash
# يُرسَل للفريق بشكل آمن (ليس في هذه الوثيقة)

NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:5432/incident_db
DIRECT_URL=postgresql://USER:PASSWORD@DB_HOST:5432/incident_db
JWT_SECRET=[random 64-char string]
ADMIN_EMAIL=[admin email]
FRONTEND_URL=https://app.domain.com
SMTP_HOST=[SMTP server]
SMTP_PORT=587
SMTP_USER=[email user]
SMTP_PASS=[email password]
SMTP_FROM=noreply@domain.com
```

---

## 💾 استراتيجية النسخ الاحتياطي (Backup Strategy)

### المستويات الثلاثة للحماية

```
Level 1: Automated DB Backup (يومي)
    ↓
Level 2: Weekly Full Snapshot (أسبوعي)
    ↓
Level 3: Pre-Deployment Snapshot (قبل كل تحديث)
```

---

### Level 1 — النسخ الاحتياطي اليومي التلقائي

| البند | التفاصيل |
|-------|-----------|
| **الأداة** | `pg_dump` عبر Cron Job |
| **التوقيت** | كل يوم الساعة 2:00 صباحاً (وقت الذروة الأدنى) |
| **الوجهة** | OCI Object Storage — bucket: `backups-prod` |
| **الصيغة** | `.sql.gz` (مضغوط) |
| **الاحتفاظ** | 30 يوم |
| **التشفير** | AES-256 (OCI Server-Side Encryption) |

**إعداد Cron Job على السيرفر:**
```bash
# /etc/cron.d/incident-backup
0 2 * * * ubuntu /opt/incident-system/scripts/daily-backup.sh >> /var/log/incident-backup.log 2>&1
```

**سكريبت النسخ الاحتياطي اليومي:**
```bash
#!/bin/bash
# daily-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BUCKET="backups-prod"
FILENAME="db_backup_${DATE}.sql.gz"

# Dump and compress
PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" -U "$DB_USER" -d incident_db \
  | gzip -9 > /tmp/$FILENAME

# Upload to OCI Object Storage
oci os object put \
  --bucket-name $BUCKET \
  --file /tmp/$FILENAME \
  --name "daily/$FILENAME"

# Remove temp file
rm -f /tmp/$FILENAME

echo "[$DATE] Backup completed: $FILENAME"

# Delete backups older than 30 days
oci os object list --bucket-name $BUCKET --prefix "daily/" \
  | jq -r '.data[] | select(.["time-created"] < "'$(date -d '30 days ago' --iso-8601)'" ) | .name' \
  | xargs -I{} oci os object delete --bucket-name $BUCKET --object-name {} --force
```

---

### Level 2 — Snapshot أسبوعي كامل

| البند | التفاصيل |
|-------|-----------|
| **التوقيت** | كل الجمعة الساعة 1:00 صباحاً |
| **المحتوى** | DB كامل + ملفات المرفقات |
| **الوجهة** | OCI Object Storage — `backups-prod/weekly/` |
| **الاحتفاظ** | 90 يوم (13 أسبوع) |
| **الحجم التقديري** | 50-200 MB (بحسب حجم المرفقات) |

---

### Level 3 — Snapshot قبل كل تحديث

| البند | التفاصيل |
|-------|-----------|
| **التوقيت** | يدوي قبل كل `git push` للإنتاج |
| **الأداة** | `npm run pre:deploy` (مدمج في المشروع) |
| **المحتوى** | جميع الجداول + الملفات الثنائية |
| **التخزين** | محلي على الجهاز + يُرفَع لـ Object Storage يدوياً |
| **الاحتفاظ** | آخر 15 نسخة |

---

### جدول الاستعادة (Recovery Time Objectives)

| السيناريو | RTO | RPO | الإجراء |
|-----------|-----|-----|---------|
| خطأ في تحديث | < 15 دقيقة | آخر snapshot | `npm run snapshot:restore` |
| فساد بيانات جزئي | < 1 ساعة | آخر backup يومي | استعادة من Object Storage |
| فشل سيرفر كامل | < 2 ساعة | آخر backup يومي | رفع Instance جديد |
| كارثة كاملة | < 4 ساعات | آخر backup يومي | إعادة بناء كاملة |

---

## 🔐 متطلبات الأمان

### ما يجب تطبيقه على OCI

| المتطلب | التفاصيل |
|---------|-----------|
| **SSH Access** | مفاتيح SSH فقط (لا password login) |
| **SSH Port** | تغيير من 22 إلى منفذ غير قياسي |
| **Firewall** | Security Lists مُقيَّدة (انظر الشبكة أعلاه) |
| **DB Access** | لا يوجد وصول مباشر لـ DB من الإنترنت |
| **Secrets** | متغيرات البيئة في ملفات مشفّرة، لا في الكود |
| **Backups** | مشفّرة تلقائياً في Object Storage |
| **Monitoring** | OCI Monitoring + Logging مفعّل |

---

### SSH Key Management

```bash
# الفريق يُرسل مفاتيح SSH العامة (public keys) فقط
# يتم إضافتها في ~/.ssh/authorized_keys على السيرفر

# مثال:
ssh-rsa AAAAB3NzaC1yc2E... developer@company.com
ssh-rsa AAAAB3NzaC1yc2E... devops@company.com
```

> **يجب على OCI Team:** إضافة المفاتيح العامة فقط — لا مشاركة المفاتيح الخاصة أبداً.

---

## 📊 مقارنة التكاليف التقديرية (شهرياً)

| المكوّن | الإنتاج | الاختبار |
|---------|---------|----------|
| Compute VM | ~$30-50 | ~$15-25 |
| PostgreSQL DB | ~$30-50 | ~$10-15 |
| Load Balancer | ~$10 | - |
| Object Storage (100 GB) | ~$2 | ~$1 |
| **المجموع** | **~$75-115/شهر** | **~$25-40/شهر** |

> الأسعار تقديرية وتعتمد على المنطقة والعرض المتاح من OCI.

---

## 📋 قائمة مهام OCI Team

### البيئة الفورية المطلوبة (Checklist)

#### الشبكة
- [ ] إنشاء VCN مع CIDR `10.0.0.0/16`
- [ ] إنشاء Public Subnet `10.0.1.0/24`
- [ ] إنشاء Private Subnet `10.0.2.0/24`
- [ ] تهيئة Security Lists كما هو محدد أعلاه
- [ ] إنشاء Internet Gateway
- [ ] إنشاء NAT Gateway للـ Private Subnet

#### الخوادم — الإنتاج
- [ ] إنشاء Compute Instance (App Server) بالمواصفات المذكورة
- [ ] إنشاء Compute Instance أو DB Service (Database Server)
- [ ] تثبيت Ubuntu 22.04 LTS
- [ ] تثبيت Node.js 20 LTS
- [ ] تثبيت PostgreSQL 15
- [ ] تثبيت Nginx
- [ ] تثبيت Certbot (Let's Encrypt)
- [ ] تثبيت PM2 لإدارة Node.js
- [ ] إعداد Cron Job للـ backup اليومي

#### الخوادم — الاختبار
- [ ] إنشاء Compute Instance بالمواصفات المصغّرة
- [ ] تثبيت نفس البرامج
- [ ] إنشاء قاعدة بيانات اختبار منفصلة

#### التخزين
- [ ] إنشاء Object Storage Bucket: `backups-prod`
- [ ] إنشاء Object Storage Bucket: `uploads-prod`
- [ ] إنشاء Object Storage Bucket: `backups-staging`
- [ ] تفعيل Versioning على bucket المرفقات
- [ ] تهيئة Retention Policy (30 يوم للـ daily، 90 للـ weekly)

#### الأمان
- [ ] إضافة SSH Keys للمطورين
- [ ] تعطيل Password Login على SSH
- [ ] تهيئة OCI Vault لتخزين الـ Secrets (اختياري لكن يُفضَّل)
- [ ] تفعيل OCI Monitoring
- [ ] تفعيل OCI Logging

#### الشبكة والدومين
- [ ] تعيين IP ثابت (Reserved Public IP) للسيرفر
- [ ] إعداد DNS records للدومين
- [ ] تثبيت SSL certificate

---

## 🔑 ما يحتاجه المطوّر من OCI Team

بعد تهيئة البيئة، يُرسل OCI Team للمطوّر:

```
1. IP Address للإنتاج      : xxx.xxx.xxx.xxx
2. IP Address للاختبار     : xxx.xxx.xxx.xxx
3. SSH Username            : ubuntu (الافتراضي)
4. مفتاح SSH الخاص         : [production.pem] (مرة واحدة فقط)
5. DB Host الإنتاج         : db.internal.domain أو IP داخلي
6. DB Host الاختبار        : staging-db.internal أو IP داخلي
7. DB Username             : [يُحدَّد]
8. DB Password             : [يُحدَّد بشكل آمن]
9. Object Storage Namespace: [من OCI Console]
10. Region                 : [المنطقة المختارة]
```

---

## 📝 ملاحظات للفريق التقني

> [!IMPORTANT]
> قاعدة بيانات الاختبار يجب أن تكون **منفصلة تماماً** عن الإنتاج. لا يجوز توصيل بيئة الاختبار بـ DATABASE_URL الإنتاج أبداً.

> [!WARNING]
> النسخ الاحتياطية اليومية تُخزَّن في Object Storage مشفّرة. يجب التحقق يومياً من نجاح عملية الـ backup عبر OCI Monitoring Alerts.

> [!TIP]
> يُنصح باستخدام `OCI PostgreSQL Database Service` بدلاً من PostgreSQL مثبّت يدوياً. يوفر الخدمة إدارة تلقائية للنسخ الاحتياطية وتحديثات الأمان والـ failover.

> [!NOTE]
> بيئة الاختبار تحتاج وصولاً محدوداً (IP Whitelist لفريق التطوير فقط). لا يجب أن تكون متاحة للعموم.
