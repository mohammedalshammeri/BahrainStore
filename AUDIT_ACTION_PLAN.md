# خطة العمل الشاملة — تدقيق مشروع BahrainStore
> تاريخ التدقيق: 12 أبريل 2026  
> نطاق التدقيق: Backend · Dashboard · Storefront · Mobile  
> الحالة: قائمة مهام قابلة للتنفيذ مرتبة حسب الأولوية

---

## الملخص التنفيذي

| الأولوية | العدد | النوع |
|----------|-------|-------|
| 🔴 حرجة | 7 | ثغرات أمنية فورية |
| 🟠 عالية | 11 | ميزات معطوبة أو غير مكتملة |
| 🟡 متوسطة | 10 | أخطاء منطق وديون تقنية |
| 🔵 أداء | 4 | فجوات قاعدة البيانات |
| 🟤 منسية | 6 | ميزات لم تُبدأ |
| **المجموع** | **38** | |

---

## 🔴 المرحلة الأولى — ثغرات أمنية حرجة (أسبوع 1)

### [x] BUG-001 — إنشاء الطلبات بدون مصادقة ✅ مكتمل (Session 1)
- **الملف:** `backend/src/routes/order.routes.ts`
- **المشكلة:** `app.post('/', async ...)` بدون `preHandler: authenticate`
- **الخطر:** أي شخص يستطيع إنشاء طلب لأي متجر بدون حساب
- **الحل:** إضافة `{ preHandler: authenticate }` على الـ endpoint ثم التحقق أن `customerId` ينتمي للمتجر المطلوب

### [x] BUG-002 — Refresh Token في Cookie غير httpOnly ✅ مكتمل (Session 1)
- **الملف:** `dashboard/src/lib/api.ts`
- **المشكلة:** `Cookies.set('refreshToken', ...)` بدون `httpOnly: true`
- **الخطر:** أي XSS يسرق الـ refreshToken (صلاحية 30 يوم) ويحتفظ بالوصول الكامل
- **الحل:** تحويل إدارة الـ tokens من `js-cookie` إلى cookies يُعيّنها الـ backend عبر `Set-Cookie` بـ `httpOnly; Secure; SameSite=Strict`

### [x] BUG-003 — SSRF في نظام الـ Webhooks ✅ مكتمل (Session 1)
- **الملف:** `backend/src/routes/webhook.routes.ts`
- **المشكلة:** `z.string().url()` يقبل عناوين داخلية مثل `http://localhost/admin` أو `http://169.254.169.254`
- **الخطر:** التاجر يستخدم المنصة كأداة SSRF ضد البنية التحتية
- **الحل:** إضافة Validator يرفض: `localhost`, `127.x.x.x`, `10.x.x.x`, `192.168.x.x`, `169.254.x.x`, `::1`, عناوين IPv6 المحلية

### [x] BUG-004 — لا حماية Brute-Force على `/auth/2fa/verify` ✅ مكتمل (Session 1)
- **الملف:** `backend/src/routes/auth.routes.ts`
- **المشكلة:** لا Rate Limiting على endpoint التحقق من TOTP
- **الخطر:** 1,000,000 محاولة ممكنة في نافذة 30 ثانية
- **الحل:** Rate limit صارم 5 محاولات / 10 دقائق مع lockout تلقائي + إلغاء `tempToken` بعد الفشل

### [x] BUG-005 — لا Rate Limit على `/auth/forgot-password` ✅ مكتمل (Session 1)
- **الملف:** `backend/src/routes/auth.routes.ts`
- **المشكلة:** طلبات غير محدودة لإعادة تعيين كلمة المرور
- **الخطر:** إغراق بريد المستخدم واستنزاف رصيد SMTP
- **الحل:** حد 3 طلبات / 15 دقيقة لكل email + لكل IP

### [x] BUG-006 — Password Reset Token محفوظ كـ Plaintext ✅ مكتمل (Session 1)
- **الملف:** `backend/src/routes/auth.routes.ts`
- **المشكلة:** رمز إعادة التعيين يُخزَّن مباشرة في DB
- **الخطر:** في حالة تسرب البيانات، كل رموز إعادة التعيين النشطة تُستخدَم مباشرة
- **الحل:** تخزين `bcrypt(token, 10)` في DB والتحقق بـ `bcrypt.compare`

### [x] BUG-007 — `ADMIN_SETUP_TOKEN` غير مُتضمَّن في Zod Schema ✅ مكتمل (Session 1)
- **الملف:** `backend/src/lib/env.ts`
- **المشكلة:** إذا لم يُعيَّن المتغير، `undefined === undefined` يُعطي `true`
- **الخطر:** أي شخص يستطيع إنشاء حساب Platform Admin
- **الحل:** إضافة `ADMIN_SETUP_TOKEN: z.string().min(32)` لمخطط Zod

---

## 🟠 المرحلة الثانية — ميزات معطوبة (أسبوع 2-3)

### [x] FEAT-001 — Webhooks لا تُرسَل أبداً ✅ مكتمل 2026-04-12
- **الملفات:** `backend/src/routes/webhook.routes.ts` · `order.routes.ts` · `payment.routes.ts`
- **المشكلة:** `fireWebhook()` موجودة لكن **لم تُستورَد أو تُستدعَ في أي مكان**
- **الحل:** استيراد `fireWebhook` واستدعاؤها في:
  - `order.routes.ts` → أحداث: `order.created`, `order.status_changed`, `order.cancelled`
  - `payment.routes.ts` → أحداث: `payment.paid`, `payment.failed`, `payment.refunded`
  - `product.routes.ts` → حدث: `product.stock_low`

### [x] FEAT-002 — فرض حدود خطط SaaS غير موجود ✅ مكتمل 2026-04-12
- **الملفات:** `backend/src/routes/product.routes.ts` · `order.routes.ts`
- **المشكلة:** خطة STARTER تعلن "100 منتج، 50 طلب/شهر" لكن لا كود يفرضها
- **الحل:** 
  - دالة مساعدة `checkPlanLimit(storeId, 'products' | 'orders')` في `lib/plan-limits.ts`
  - استدعاؤها قبل الإنشاء في كلا الـ endpoint
  - تعريف الحدود في ملف ثابت بجانب `PLAN_PRICES` في `billing.routes.ts`

### [x] FEAT-003 — اشتراكات المنتجات بدون تجديد تلقائي ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/subscription-products.routes.ts`
- **المشكلة:** لا Cron job، لا ربط بالدفع، المشتركون يبقون `ACTIVE` إلى الأبد
- **الحل:**
  - إضافة `lib/subscription-renewal.ts` تجلب الاشتراكات المنتهية وتُحاول إعادة الشحن
  - تشغيلها عبر Cron أو setInterval عند بدء التشغيل
  - تحديث الحالة إلى `EXPIRED` عند فشل الدفع

### [x] FEAT-004 — Dashboard الاشتراكات يستدعي endpoint خاطئ ✅ مكتمل 2026-04-12
- **الملف:** `dashboard/src/app/(dashboard)/subscriptions/page.tsx`
- **المشكلة:** يستدعي `POST /subscription-products` وهذا المسار غير موجود
- **الحل:** تغيير الاستدعاء إلى `POST /subscription-products/:productId/plans` مع اختيار المنتج أولاً

### [x] FEAT-005 — Live Commerce: RTMP غير مُنَفَّذ + حضور المشاهدين في ذاكرة RAM ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/live-commerce.routes.ts`
- **المشكلة:** عنوان RTMP مُشفَّر بدون سيرفر حقيقي، وبيانات الحضور تُفقَد عند إعادة التشغيل
- **الحل قصير المدى:** إزالة RTMP وإبقاء YouTube/TikTok/Instagram فقط، نقل `liveViewerPresence` إلى Redis

### [x] FEAT-006 — Bazar Finance: لا تحويل مالي حقيقي ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/bazar-finance.routes.ts`
- **المشكلة:** الموافقة تُغيِّر الحالة فقط، خصم 10% غير مرتبط بـ `order.routes.ts`
- **الحل:**
  - ربط خطاف في `order.routes.ts` يتحقق من قرض نشط ويخصم النسبة تلقائياً عند إنجاز الطلب
  - إضافة رابط webhook/API لتحويل مبلغ القرض للبنك (أو تعليق الميزة وإخفاؤها من الواجهة)

### [x] FEAT-007 — إشعارات "العودة للمخزون" لا تُرسَل تلقائياً ✅ مكتمل 2026-04-12
- **الملفات:** `backend/src/routes/back-in-stock.routes.ts` · `inventory.routes.ts`
- **المشكلة:** `notifyBackInStock` لا تُستورَد في `inventory.routes.ts`
- **الحل:** استيراد `notifyBackInStock` واستدعاؤها في `POST /inventory/adjust` عند أن `nextStock > 0`

### [x] FEAT-008 — Flash Sale لا يؤثر على سعر الطلب ✅ مكتمل 2026-04-12
- **الملفات:** `backend/src/routes/order.routes.ts` · `flash-sales.routes.ts`
- **المشكلة:** `price = Number(product.price)` دائماً بدون فحص العروض النشطة
- **الحل:** قبل احتساب السعر، استعلام عن `FlashSaleItem` نشطة لهذا المنتج وتطبيق الخصم

### [x] FEAT-009 — موظفو المتجر (Staff) يحصلون على 403 في كل طلب ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/middleware/auth.middleware.ts`
- **المشكلة:** JWT يحتوي `{ id: staffId, type: 'staff' }` لكن المسارات تبحث بـ `merchantId = user.id`
- **الحل:** في `authenticate`، إذا كان `type === 'staff'` ابحث عن الـ `storeId` من `StoreStaff` وأضفه للـ request context

### [x] FEAT-010 — سباق بيانات في أرقام طلبات المطعم ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/restaurant.routes.ts`
- **المشكلة:** `tx.order.count()` خارج أي lock → طلبان يحصلان على نفس الرقم
- **الحل:** استخدام `SELECT ... FOR UPDATE` أو sequence DB أو UUID مباشرة كـ orderNumber

### [x] FEAT-011 — عميل ضيف المطعم يسبب تعارضاً عند الطلب الثاني ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/restaurant.routes.ts`
- **المشكلة:** `phone: 'restaurant-guest'` مع unique constraint على `(storeId, phone)` يمنع أي طلب ضيف ثانٍ
- **الحل:** استخدام `phone: `restaurant-guest-${tableId}-${Date.now()}`\` أو إنشاء customer منفصل لكل جلسة طاولة

---

## 🟡 المرحلة الثالثة — أخطاء المنطق والديون التقنية (أسبوع 3-4)

### [x] LOGIC-001 — Coupon: لا تتبع للاستخدام لكل عميل ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/order.routes.ts`
- **المشكلة:** عميل واحد يمكنه استخدام الكوبون مرات عديدة حتى `maxUses`
- **الحل:** إضافة جدول `CouponUsage(couponId, customerId)` والتحقق قبل تطبيق الكوبون

### [x] LOGIC-002 — Race Condition في حد استخدام الكوبون ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/order.routes.ts`
- **المشكلة:** فحص `usedCount >= maxUses` يتم خارج الـ transaction، وتحديث `usedCount` داخلها
- **الحل:** نقل الفحص داخل الـ transaction أو استخدام atomic check

### [x] LOGIC-003 — `findMerchantLiveChatMessage` دائماً يُرجع null ✅ مكتمل 2026-04-12 (N/A — LiveChatMessage IS linked to LiveStream via streamId, query was correct)
- **الملف:** `backend/src/lib/merchant-ownership.ts`
- **المشكلة:** `prisma.liveChatMessage.findFirst({ where: { stream: ... } })` — الرسائل مرتبطة بـ `LiveChatSession` وليس `LiveStream`
- **الحل:** تغيير الاستعلام إلى `{ where: { session: { stream: { store: { merchantId } } } } }`

### [x] LOGIC-004 — كشف رابط الملف الرقمي للعموم ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/product.routes.ts`
- **المشكلة:** `GET /:id` (بدون auth) يُرجع `digitalFileUrl`
- **الحل:** إزالة `digitalFileUrl` من استجابة المسارات العامة، وتوفيره فقط بعد التحقق من الشراء

### [x] LOGIC-005 — سجل تعديلات المخزون لا يُحفَظ ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/inventory.routes.ts`
- **المشكلة:** `POST /inventory/adjust` يُعدِّل المخزون بدون audit trail
- **الحل:** حفظ سجل في جدول `InventoryLog(productId, quantity, reason, merchantId, createdAt)` بعد كل تعديل

### [x] LOGIC-006 — Race Condition في تخفيض مخزون POS ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/pos.routes.ts`
- **المشكلة:** `updateMany` متتالية خارج `$transaction`
- **الحل:** تغليف عمليات تخفيض المخزون في `prisma.$transaction([...])` مع guard `stock: { gte: qty }`

### [x] LOGIC-007 — Auth Guard في Dashboard يفحص وجود Cookie فقط ✅ مكتمل 2026-04-12
- **الملف:** `dashboard/src/app/(dashboard)/layout.tsx`
- **المشكلة:** `isAuthenticated()` تتحقق من وجود cookie وليس صلاحيتها
- **الحل:** تغيير منطق الـ guard ليُرسل طلب تحقق صغير للـ backend أو فك تشفير الـ JWT في الـ client

### [x] LOGIC-008 — Mobile: لا Refresh Token (تسجيل خروج كل 15 دقيقة) ✅ مكتمل 2026-04-12
- **الملف:** `mobile/src/api/index.ts`
- **المشكلة:** 401 يُطلِق تسجيل الخروج مباشرة بدون محاولة تحديث الـ token
- **الحل:** إضافة interceptor مشابه للـ Dashboard يحاول `/auth/refresh` قبل تسجيل الخروج

### [x] LOGIC-009 — رسائل AI Copilot تنمو بلا حدود ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/ai.routes.ts`
- **المشكلة:** لا TTL ولا عتبة حجم لسجل المحادثة في DB
- **الحل:** إضافة حد `messages.take(50)` عند جلب السياق + task تنظيف دورية للمحادثات الأقدم من 90 يوماً

### [x] LOGIC-010 — Raw SQL يُكسر عند تغيير Schema ✅ مكتمل 2026-04-12
- **الملف:** `backend/src/routes/bazar-finance.routes.ts`
- **المشكلة:** `$queryRaw` يستخدم أسماء أعمدة مباشرة (`created_at`, `store_id`, `total`)
- **الحل:** استبدال الـ Raw SQL بـ Prisma QueryAPI المناسبة

---

## 🔵 المرحلة الرابعة — أداء قاعدة البيانات (أسبوع 4)

### [x] DB-001 — جدول `orders` بدون Index كافٍ ✅ مكتمل 2026-04-12
- **الملف:** `backend/prisma/schema.prisma`
- **المشكلة:** لا يوجد `@@index([storeId, status])` أو `@@index([storeId, createdAt])`
- **التأثير:** Full Table Scan عند تصفية الطلبات بالحالة أو الفرز بالتاريخ
- **الحل:**
  ```prisma
  @@index([storeId, createdAt])
  @@index([storeId, status])
  @@index([storeId, paymentStatus])
  ```

### [x] DB-002 — جدول `products` بدون Index على `(storeId, isActive)` ✅ مكتمل 2026-04-12
- **الملف:** `backend/prisma/schema.prisma`
- **المشكلة:** الاستعلام الأكثر شيوعاً في المتجر بدون index
- **الحل:**
  ```prisma
  @@index([storeId, isActive])
  @@index([storeId, isFeatured])
  ```

### [x] DB-003 — `Session` بدون Index على `refreshToken` ✅ مكتمل 2026-04-12 (refreshToken @unique)
- **الملف:** `backend/prisma/schema.prisma`
- **المشكلة:** كل طلب refresh يبحث عن token دون index
- **الحل:** `@@index([refreshToken])` أو `@unique([refreshToken])`

### [x] DB-004 — Enum المحفوظ كـ String في Schema ✅ مكتمل 2026-04-12
- **الملف:** `backend/prisma/schema.prisma`
- **المشكلة:** `Session.kind` و `Merchant.kycStatus` نصوص تقبل أي قيمة
- **الحل:** تحويلهما إلى `enum` PostgreSQL مع migration

---

## 🟤 المرحلة الخامسة — ميزات لم تُبدأ (أسبوع 5-6)

### [x] NEW-001 — نظام Cron Jobs / Scheduled Tasks ✅ مكتمل 2026-04-13
- **المشكلة:** لا توجد أي مهام مجدولة في المشروع
- **المهام المطلوبة:**
  - تجديد الاشتراكات المنتهية
  - تفعيل/إنهاء عروض Flash Sale تلقائياً
  - إغلاق الخطط المنتهية الصلاحية وتطبيق grace period
  - إرسال حملات Email Marketing المجدولة
  - تنظيف سجلات الـ AI القديمة
- **الحل:** استخدام `node-cron` أو تحويل المشروع لاستخدام BullMQ + Redis

### [x] NEW-002 — إشعار التاجر عند وصول طلب جديد ✅ مكتمل 2026-04-13
- **المشكلة:** التاجر لا يعلم بالطلبات الجديدة إلا بالدخول للـ Dashboard
- **الحل:** في `order.routes.ts` بعد إنشاء الطلب:
  - إرسال بريد إلكتروني للتاجر
  - إرسال Push Notification عبر Expo إذا التاجر مسجَّل
  - إرسال WhatsApp عبر `whatsapp.routes.ts` إذا مُفعَّل

### [x] NEW-003 — رموز الإنقاذ لـ 2FA (Backup Codes) ✅ مكتمل 2026-04-13
- **الملف:** `backend/src/routes/auth.routes.ts`
- **المشكلة:** فقدان تطبيق TOTP = فقدان دائم للحساب
- **الحل:**
  - عند تفعيل 2FA: توليد 10 رموز أحادية الاستخدام مُشفَّرة
  - تخزينها كـ `bcrypt(code)` في جدول `TwoFactorBackupCode`
  - إضافة endpoint `/auth/2fa/recover` يقبل هذه الرموز

### [x] NEW-004 — إشعار واجهة Mobile عند وصول الـ Push Notifications ✅ مكتمل 2026-04-13
- **الملف:** `mobile/app/_layout.tsx`
- **المشكلة:** Push Token مسجَّل لكن لا معالج للإشعارات الواردة
- **الحل:** إضافة `addNotificationReceivedListener` و `addNotificationResponseReceivedListener` للتنقل للشاشة المناسبة

### [x] NEW-005 — التحقق التلقائي من DNS للدومين المخصص ✅ مكتمل 2026-04-13
- **الملف:** `backend/src/routes/domain.routes.ts`
- **المشكلة:** التاجر يُضيف الدومين لكن لا تحقق تلقائي من CNAME/A record
- **الحل:** background job يفحص `dns.resolve(domain)` كل 10 دقائق ويُحدِّث الحالة

### [x] NEW-006 — تخزين الملفات على السحابة بدلاً من Disk المحلي ✅ مكتمل 2026-04-13
- **الملف:** `backend/src/routes/upload.routes.ts` · `verification.routes.ts`
- **المشكلة:** كل الملفات في `public/uploads/` على الـ Server المحلي — تُفقَد عند إعادة النشر
- **الحل:** دمج `AWS S3` أو `Cloudflare R2` أو `Wasabi` مع signed URLs

---

## ملاحظات تقنية إضافية

### أماكن تحتاج مراجعة لاحقة (خارج نطاق الأولويات الحالية)
- `new-payment.routes.ts`: لا timeout على طلبات HTTPS للـ Payment Gateways
- `platform-import.routes.ts`: حلقة `while(true)` في توليد الـ slug قد تعلق
- `analytics.routes.ts`: حساب health score يجمع بيانات كثيرة دون caching
- `store.routes.ts`: تعديل الـ theme لا يتحقق من ملكية الـ theme
- `Customer.isActive`: غير موجود في Schema — إضافته ضرورية لإيقاف حساب عميل
- `OrderItem` لا يحتوي `imageUrl` — الواجهة تُعيد طلب صور المنتج في كل مرة

---

## ترتيب التنفيذ المقترح

```
الأسبوع 1:   BUG-001 → BUG-002 → BUG-003 → BUG-004 → BUG-005 → BUG-006 → BUG-007
الأسبوع 2:   FEAT-001 → FEAT-002 → FEAT-007 → FEAT-008 → FEAT-009
الأسبوع 3:   FEAT-003 → FEAT-004 → FEAT-010 → FEAT-011 → LOGIC-003 → LOGIC-004
الأسبوع 4:   DB-001 → DB-002 → DB-003 → DB-004 → LOGIC-001 → LOGIC-002 → LOGIC-006
الأسبوع 5:   FEAT-005 → FEAT-006 → LOGIC-005 → LOGIC-007 → LOGIC-008 → LOGIC-009 → LOGIC-010
الأسبوع 6:   NEW-001 → NEW-002 → NEW-003 → NEW-004 → NEW-005 → NEW-006
```

---

*آخر تحديث: 12 أبريل 2026 | مُنشأ تلقائياً من تدقيق الكود الشامل*
