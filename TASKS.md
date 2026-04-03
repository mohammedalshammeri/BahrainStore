# ✅ TASKS.md — المهام التفصيلية لبناء بزار | BSMC.BH

> الأولوية: 🔴 عالية | 🟡 متوسطة | 🟢 منخفضة

---

### 📍 الحالة الحالية — آخر تحديث: 30 مارس 2026 (جلسة مسائية)

| الطبقة | الحالة |
|--------|--------|
| **Backend API** (Node.js + Fastify + Prisma + Neon) | ✅ يعمل على port 3001 |
| قاعدة البيانات (Neon PostgreSQL) | ✅ مرفوعة وجاهزة |
| نظام المصادقة (JWT + Refresh Tokens) | ✅ جاهز |
| API المتاجر والإعدادات | ✅ جاهز |
| API المنتجات + Variants + الصور | ✅ جاهز |
| API التصنيفات المتداخلة | ✅ جاهز |
| API الطلبات + Stock deduction | ✅ جاهز |
| API العملاء والعناوين | ✅ جاهز |
| API الكوبونات والتحقق | ✅ جاهز |
| API الإحصائيات | ✅ جاهز |
| API التقارير المالية + ضريبة القيمة المضافة | ✅ جاهز |
| API التسويق الإلكتروني (Campaigns + Subscribers) | ✅ جاهز |
| API البيع الإضافي (Upsell) + العدادات التنازلية | ✅ جاهز |
| API الإعلانات + مركز المساعدة | ✅ جاهز |
| API Sitemap + robots.txt ديناميكي | ✅ جاهز |
| API Admin Analytics (MRR/ARR + Cohort + Health) | ✅ جاهز |
| API Tabby + Tamara BNPL (Create Session/Order) | ✅ جاهز |
| **Dashboard — صفحات المصادقة** (login/register) | ✅ جاهز |
| **Dashboard — الرئيسية** (إحصائيات + مخطط) | ✅ جاهز |
| **Dashboard — المنتجات** (قائمة + إضافة + تعديل + Pre-order) | ✅ جاهز |
| **Dashboard — الطلبات** (قائمة + تفاصيل) | ✅ جاهز |
| **Dashboard — العملاء** (قائمة) | ✅ جاهز |
| **Dashboard — الكوبونات** (CRUD كامل) | ✅ جاهز |
| **Dashboard — التحليلات** | ✅ جاهز |
| **Dashboard — الإعدادات** | ✅ جاهز |
| **Dashboard — التصنيفات** | ✅ جاهز |
| **Dashboard — تفاصيل العميل** | ✅ جاهز |
| **Dashboard — التقارير المالية** | ✅ جاهز |
| **Dashboard — التسويق الإلكتروني** | ✅ جاهز |
| **Dashboard — البيع الإضافي + العدادات التنازلية** | ✅ جاهز |
| **Dashboard — الإعلانات + مركز المساعدة** | ✅ جاهز |
| **Storefront** (واجهة العميل) | ✅ مكتمل — جاهز للعمل |
| Storefront — Pre-order support | ✅ جاهز |
| Storefront — Countdown Timer Banner | ✅ جاهز |
| Storefront — Upsell Modal (سلة التسوق) | ✅ جاهز |
| تكامل BenefitPay / Credimax | ✅ جاهز — `benefitpay.routes.ts` |
| **تطبيق الجوال (React Native Expo 52)** | ✅ مكتمل 90% — `c:\BahrainStore\mobile\` |
| تطبيق الجوال — ProductDetailScreen + NewProductScreen | ❌ متبقي |
| تطبيق الجوال — babel.config.js + اختبار | ❌ متبقي |

---

## 🏗️ المرحلة 0: التحضير والإعداد

- [x] 🔴 تسجيل الشركة في البحرين (CR)
- [x] 🔴 فتح حساب بنكي للشركة
- [x] 🔴 تسجيل النطاق: `bazar.bh`
- [x] 🔴 إعداد GitHub Repository
- [x] 🔴 إعداد بيئة التطوير المحلية
- [x] 🔴 تصميم قاعدة البيانات الأولية
- [x] 🟡 التقدم لحساب BenefitPay API (يأخذ وقتاً)
- [x] 🟡 التقدم لحساب Credimax التطوير
- [ ] 🟢 إعداد Figma لتصاميم UI

---

## 🔐 المرحلة 1: نظام المصادقة

- [x] 🔴 تسجيل التاجر (Merchant Registration)
  - الاسم، البريد، رقم الهاتف، اسم المتجر
  - التحقق من البريد الإلكتروني (OTP)
  - التحقق من رقم الهاتف (SMS OTP)
- [x] 🔴 تسجيل الدخول (Login)
  - بالبريد/كلمة مرور
  - بالجوال + OTP
- [x] 🔴 المصادقة الثنائية (2FA) — ✅ مكتمل (TOTP via otpauth + QR code + تفعيل/تعطيل من الإعدادات + تحقق خلال تسجيل الدخول)
- [x] 🔴 نسيان/إعادة تعيين كلمة المرور — ✅ مكتمل (بريد إلكتروني + صفحة رسالة تأكيد + صفحة كلمة جديدة)
- [x] 🟡 تسجيل دخول Google OAuth — ✅ مكتمل (Google OAuth 2.0 + callback page + staff login)
- [x] 🟡 إدارة الجلسات (Sessions)
- [x] 🟡 نظام الصلاحيات (Roles: Owner, Admin, Staff) — ✅ مكتمل (StoreStaff model + invite email + accept-invite page + staff card في الإعدادات)

---

## 🏪 المرحلة 2: إعداد المتجر

- [x] 🔴 معالج إنشاء المتجر (Onboarding Wizard) — ✅ مكتمل (3 خطوات: هوية المتجر، تفاصيل، نجاح)
- [x] 🔴 صفحة إدارة التصنيفات (Dashboard) — ✅ مكتملة
- [x] 🔴 صفحة تفاصيل العميل /customers/[id] (Dashboard) — ✅ مكتملة
- [x] 🔴 إعدادات المتجر الأساسية (API جاهزة)
  - اسم المتجر، الشعار، الوصف
  - العملة (BHD أساساً)
  - المنطقة الزمنية
  - اللغة (عربي/إنجليزي/كلاهما)
- [x] 🔴 نظام النطاقات (Domain) — API جاهزة
  - نطاق فرعي مجاني
  - ربط نطاق خاص
  - تجديد SSL تلقائي
- [x] 🟡 صفحات المتجر الثابتة — API جاهزة

---

## 📦 المرحلة 3: إدارة المنتجات

- [x] 🔴 CRUD المنتجات — API + Dashboard كاملان
  - إضافة/تعديل/حذف منتج
  - عنوان ووصف (عربي + إنجليزي)
  - السعر وسعر المقارنة والتكلفة
  - SKU والباركود
- [x] 🔴 صور المنتجات — API جاهزة
  - رفع متعدد الصور
  - ضغط وتحويل WebP تلقائياً
  - ترتيب بالسحب والإفلات
- [x] 🔴 متغيرات المنتج (Variants) — API جاهزة
  - ألوان، مقاسات، أي خيار مخصص
  - سعر مختلف لكل متغير
  - مخزون مستقل لكل متغير
- [x] 🔴 إدارة المخزون — API جاهزة
  - تتبع الكميات
  - تنبيه عند النفاد
  - تاريخ حركة المخزون
- [x] 🔴 التصنيفات والفئات — API جاهزة
  - فئات غير محدودة ومتداخلة
  - صورة لكل فئة
- [x] 🟡 استيراد كتالوج Excel/CSV — ✅ مكتمل (POST /products/bulk + زر استيراد CSV في صفحة المنتجات + client-side parsing)
- [x] 🟡 منتجات رقمية مع رابط تحميل آمن — ✅ مكتمل (isDigital + digitalFileUrl في schema + حقول في صفحة إضافة منتج)
- [x] 🟢 مقارنة المنتجات
- [x] 🟢 المنتجات المرتبطة والمقترحة — ✅ مكتمل (GET /products/:id/related + قسم منتجات مشابهة في صفحة المنتج)

---

## 🛒 المرحلة 4: تجربة التسوق

- [x] 🔴 صفحة المتجر الرئيسية — ✅ Storefront مكتمل
- [x] 🔴 صفحة المنتج — ✅ مكتملة مع gallery + variants
- [x] 🔴 صفحة الفئة مع فلاتر — ✅ مدمجة في صفحة المنتجات
- [x] 🔴 البحث الذكي بالعربية — ✅ بحث نصي في صفحة المنتجات
- [x] 🔴 سلة التسوق (Cart) — ✅ مكتملة
  - إضافة/حذف/تعديل الكميات
  - حفظ السلة (Local Storage)
  - كود الخصم
- [x] 🔴 صفحة الدفع (Checkout) — ✅ مكتملة
  - عنوان الشحن (بيانات بحرينية block/road/building)
  - اختيار طريقة الدفع
  - ملخص الطلب
  - ضريبة القيمة المضافة
- [x] 🟡 قائمة المفضلة (Wishlist) — ✅ مكتمل (Zustand persist + زر قلب على البطاقات + صفحة /wishlist + أيقونة في الشريط العلوي)
- [x] 🟡 حساب العميل (تاريخ طلبات، عناوين) — ✅ مكتمل (تسجيل دخول بالجوال، عرض الطلبات)
- [x] 🟡 استرداد سلة التسوق المتروكة — ✅ مكتمل (AbandonedCart model + cart routes + send-reminders endpoint + email template)

---

## 💳 المرحلة 5: نظام الدفع

- [x] 🔴 دمج BenefitPay API — Schema + Route جاهز
- [x] 🔴 دمج Credimax API — Schema + Route جاهز
- [x] 🔴 دمج Visa/Mastercard (3D Secure) — Schema جاهز
- [x] 🔴 الدفع عند الاستلام (COD) — جاهز
- [x] 🔴 التحقق من الدفع Webhook — endpoint جاهز
- [x] 🔴 إنشاء الفاتورة الضريبية PDF — ✅ مكتمل (pdfkit عربي/إنجليزي + زر تحميل في Dashboard)
- [x] 🟡 دمج Apple Pay / Google Pay
- [x] 🟡 دمج Tabby (BNPL) — ✅ مكتمل (schema fields + checkout option + settings card)
- [x] 🟡 دمج Tamara (BNPL) — ✅ مكتمل (schema fields + checkout option + settings card)
- [x] 🟡 استرداد المبالغ (Refunds) — Schema جاهز

---

## 📦 المرحلة 6: إدارة الطلبات والشحن

- [x] 🔴 لوحة إدارة الطلبات — API + Dashboard كاملان
  - قائمة الطلبات مع فلاتر
  - تفاصيل كل طلب وتأكيد الدفع
  - تغيير حالة الطلب + رقم التتبع
- [x] 🔴 دمج Aramex API — ✅ مكتمل (createAramexShipment + trackAramexShipment + POST /orders/:id/shipment + settings card)
- [x] 🔴 دمج DHL API — ✅ مكتمل (createDhlShipment + POST /orders/:id/shipment + settings card)
- [x] 🔴 طباعة ملصق الشحن — ✅ مكتمل (GET /orders/:id/shipping-label → PDF 10×15cm بـ PDFKit)
- [x] 🔴 إشعارات تتبع الشحنة للعميل — ✅ مكتمل (SMS + WhatsApp fire-and-forget عند tحديث الحالة)
- [x] 🟡 حساب تكلفة الشحن تلقائياً — في Order API
- [x] 🟡 شحن مجاني بشروط — في StoreSettings
- [ ] 🟢 دمج شركات شحن إضافية

---

## 📊 المرحلة 7: لوحة التحليلات

- [x] 🔴 إحصائيات المبيعات (اليوم، الأسبوع، الشهر) — API + Dashboard صفحة التحليلات
- [x] 🔴 إجمالي الإيرادات والطلبات — جاهز
- [x] 🔴 مخطط الإيرادات (30 يوم) + الطلبات (7 أيام) — Dashboard
- [x] 🟡 مصادر الزيارات
- [x] 🟡 معدل التحويل — ✅ مكتمل (conversionRate + repeatCustomers + repeatRate + avgOrderValue في stats API)
- [x] 🟡 تقارير قابلة للتصدير Excel/PDF — ✅ مكتمل (GET /stores/:id/stats/export → CSV بـ BOM عربي)
- [x] 🟢 تحليل العملاء المتكررين — ✅ مكتمل (repeatCustomers + repeatRate في stats endpoint)

---

## 📱 المرحلة 8: واتساب وإشعارات

- [x] 🔴 إشعار تأكيد الطلب (Email) — ✅ مكتمل (HTML email عربي + SMTP + dev console fallback)
- [x] 🔴 إشعار حالة الطلب (Email) — ✅ مكتمل (تحديث الحالة + رقم تتبع الشحنة)
- [x] 🟡 دمج WhatsApp Business API — ✅ مكتمل (Meta Cloud API v19.0 + إعدادات في الداشبورد)
- [x] 🟡 رسالة تأكيد الطلب واتساب — ✅ مكتمل (fire-and-forget عند إنشاء الطلب)
- [x] 🟡 رسالة تحديث الشحن واتساب — ✅ مكتمل (عند تغيير حالة الطلب)
- [x] 🟡 إشعارات SMS عبر Twilio — ✅ مكتمل (Twilio REST + sendSms + order create/status SMS + settings card)

---

## 🎨 المرحلة 9: القوالب والتخصيص

- [x] 🔴 5 قوالب أساسية للبدء — ✅ مكتمل (default / bold / elegant / fresh / dark + بطاقة اختيار في إعدادات الداشبورد)
- [x] 🔴 محرر تخصيص بسيط (ألوان، شعار، خطوط) — ✅ مكتمل (CSS variables + color pickers + font selector في الإعدادات + تطبيق فوري على المتجر)
- [ ] 🟡 محرر Drag & Drop متقدم
- [x] 🟡 10 قوالب إضافية (مدفوع) — ✅ مكتمل (coastal / minimal / luxury / vibrant / retro / nature / tech / bakery / fashion / kids)
- [ ] 🟢 نظام قوالب مفتوح للمطورين

---

## 🚀 المرحلة 10: الإطلاق والتسويق

- [ ] 🔴 اختبار شامل (QA Testing)
- [ ] 🔴 اختبار الأمان والأداء
- [ ] 🔴 إطلاق نسخة Beta لـ 20 متجر
- [ ] 🔴 جمع الملاحظات وإصلاح الأخطاء
- [ ] 🟡 إطلاق رسمي مع حملة تسويقية
- [ ] 🟡 استهداف أصحاب المتاجر في البحرين
- [ ] 🟡 شراكات مع شركات الشحن والبنوك

---

## 🆕 المرحلة 23: ميزات متقدمة — مكتملة (سبرينت الإنجاز الشامل)

### 💰 التقارير المالية (D3)
- [x] 🔴 API ملخص الإيرادات (`GET /finance/summary`) — revenue, VAT, net, refunded, daily breakdown
- [x] 🔴 API تقرير ضريبة القيمة المضافة (`GET /finance/vat-report`) — تقرير شهري أو سنوي
- [x] 🔴 API تصدير CSV (`GET /finance/export`) — تحميل ملف CSV للفاتورة
- [x] 🔴 صفحة Dashboard التقارير المالية — KPIs + مخطط يومي + تقرير VAT

### 📧 التسويق الإلكتروني (E2)
- [x] 🟡 نماذج email campaigns (CRUD + إرسال) — `EmailCampaign` model
- [x] 🟡 إدارة المشتركين (`EmailSubscriber`) — اشتراك/إلغاء اشتراك عام
- [x] 🟡 إحصائيات الحملات (معدل الفتح والنقر)
- [x] 🟡 صفحة Dashboard التسويق الإلكتروني

### ⏱️ العدادات التنازلية + البيع الإضافي (E3)
- [x] 🟡 نموذج `CountdownTimer` — شريط/نافذة/مدمج، قابل للجدولة
- [x] 🟡 API العدادات التنازلية (CRUD + عام للمتجر)
- [x] 🟡 مكون `CountdownTimerBanner` في Storefront (شريط علوي حي)
- [x] 🟡 نموذج `UpsellRule` — قواعد بيع إضافية مرتبطة بالمنتجات/التصنيفات
- [x] 🟡 API البيع الإضافي (CRUD + عام)
- [x] 🟡 مكون `UpsellModal` في سلة التسوق (Storefront)
- [x] 🟡 صفحة Dashboard إدارة البيع الإضافي
- [x] 🟡 صفحة Dashboard إدارة العدادات التنازلية

### 📢 الإعلانات + مركز المساعدة (G3)
- [x] 🟢 نموذج `Announcement` — إعلانات منصة مستوى super-admin
- [x] 🟢 API الإعلانات (admin CRUD + عام)
- [x] 🟢 نموذج `HelpArticle` — مقالات مركز المساعدة بالعربي والإنجليزي
- [x] 🟢 API مركز المساعدة (admin CRUD + عام + عداد مشاهدات)
- [x] 🟢 صفحة Dashboard الإعلانات
- [x] 🟢 صفحة Dashboard مركز المساعدة

### 🗺️ خريطة الموقع (B2)
- [x] 🟡 API Sitemap ديناميكي (`/sitemap/:subdomain.xml`) — منتجات، تصنيفات، مدونة، صفحات
- [x] 🟡 API `robots.txt` ديناميكي (`/robots/:subdomain`)

### 📈 تحليلات MRR/ARR للمشغل (G4)
- [x] 🟢 `GET /admin/analytics/mrr` — MRR, ARR, churn rate, توزيع الخطط
- [x] 🟢 `GET /admin/analytics/cohort` — تحليل cohort آخر 6 أشهر
- [x] 🟢 `GET /admin/health/stats` — صحة النظام، أخطاء webhook، التذاكر

### 🔒 إيقاف المتاجر المنتهية (G1)
- [x] 🟢 `POST /admin/billing/suspend-expired` — تعليق المتاجر التي انتهت خطتها تلقائياً

### 🛒 Pre-order دعم الطلب المسبق (C4)
- [x] 🔴 حقول `isPreOrder`, `preOrderMessageAr`, `preOrderDeliveryDays` في `Product`
- [x] 🔴 صفحة الإضافة/التعديل في Dashboard تعرض بطاقة Pre-order
- [x] 🔴 Storefront: زر "اطلب مسبقاً" + شارة + رسالة تسليم

### 💳 Tabby + Tamara API (D2)
- [x] 🟡 `POST /payment/tabby/create-session` — إنشاء جلسة Tabby BNPL
- [x] 🟡 `POST /payment/tamara/create-order` — إنشاء طلب Tamara
- [x] 🟡 `POST /payment/tamara/webhook` — استقبال callbacks من Tamara

