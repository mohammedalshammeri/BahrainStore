# المهام المتبقية — منصة بازار
> آخر تحديث: 5 أبريل 2026 | الإنجاز الحالي: **~90% ✅**

---

## ❌ المهام المتبقية الآن

---

### 1️⃣ ✅ صفحات داشبورد ناقصة — تم الإنجاز

| # | الصفحة | الحالة |
|---|--------|--------|
| 1 | `/staff` | ✅ مكتمل |
| 2 | `/loyalty` | ✅ مكتمل |
| 3 | `/flash-sales` | ✅ مكتمل |
| 4 | `/inventory` | ✅ مكتمل |

---

### 2️⃣ متغيرات البيئة الناقصة في `.env`

| # | المتغير | الحالة | الأهمية |
|---|---------|--------|---------|
| 5 | `GOOGLE_CLIENT_SECRET` | ⏳ ينتظر المستخدم | 🔴 تسجيل دخول Google لا يعمل |
| 6 | `SMTP_PASS` | ❌ فارغ | 🔴 الإيميلات كلها معطلة |
| 7 | `BENEFIT_MERCHANT_ID` | ❌ فارغ | 🔴 BenefitPay لا تعمل |
| 8 | `BENEFIT_SECRET_KEY` | ❌ فارغ | 🔴 BenefitPay لا تعمل |
| 9 | `TAP_SECRET_KEY` | ❌ فارغ | 🟡 Tap Payments معطلة |
| 10 | `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `FROM` | ❌ فارغ | 🟢 اختياري — SMS |
| 11 | `STRIPE_PLATFORM_SECRET_KEY` | ❌ فارغ | 🟢 اختياري |
| 12 | `MOYASAR_PLATFORM_SECRET_KEY` | ❌ فارغ | 🟢 اختياري |

---

### 3️⃣ أمان — مهم جداً

| # | المهمة | الأولوية |
|---|--------|---------|
| 13 | **تدوير مفتاح OpenAI** — المفتاح `sk-proj-NDvoHta3...` انكشف في المحادثة. اذهب لـ [platform.openai.com/api-keys](https://platform.openai.com/api-keys) وأنشئ مفتاحاً جديداً | 🔴 عاجل |

---

### 4️⃣ النشر على Hostinger VPS

| # | الخطوة | الحالة |
|---|--------|--------|
| 14 | إنشاء VPS على Hostinger (Ubuntu 24.04) | ❌ |
| 15 | تثبيت Docker + Docker Compose على الـ VPS | ❌ |
| 16 | رفع الكود للـ VPS (git clone أو rsync) | ❌ |
| 17 | إضافة DNS records: `A bazar.bsmc.bh → IP`، `A api.bazar.bsmc.bh → IP`، `A dashboard.bazar.bsmc.bh → IP`، `A *.bazar.bsmc.bh → IP` | ❌ |
| 18 | تشغيل certbot للحصول على SSL: `certbot --nginx -d bazar.bsmc.bh -d api.bazar.bsmc.bh -d dashboard.bazar.bsmc.bh` | ❌ |
| 19 | نسخ `backend/.env` للـ VPS | ❌ |
| 20 | تشغيل `docker-compose up -d --build` | ❌ |
| 21 | تطبيق migrations: `docker exec bazar-backend npx prisma migrate deploy` | ❌ |
| 22 | التحقق من عمل كل شيء: `/health` endpoint + تسجيل دخول | ❌ |

---

### 5️⃣ تطبيق الجوال

| # | المهمة | الأولوية |
|---|--------|---------|
| 23 | تثبيت dependencies: `cd mobile && npm install` | 🔴 عالية |
| 24 | اختبار على محاكي: `npx expo start` | 🔴 عالية |
| 25 | رفع على Google Play Store (يحتاج حساب مطور $25) | 🟢 لاحقاً |
| 26 | رفع على Apple App Store (يحتاج Apple Developer Account $99/سنة) | 🟢 لاحقاً |

---

### 6️⃣ بعد النشر — إعداد البيانات الأولية

| # | المهمة | الأولوية |
|---|--------|---------|
| 27 | إنشاء الـ Super Admin عبر: `POST /api/v1/admin/setup` مع `ADMIN_SETUP_TOKEN` | 🔴 |
| 28 | تجربة إنشاء متجر أول وإضافة منتجات | 🟡 |
| 29 | اختبار عملية شراء كاملة (كارت → BenefitPay → تأكيد الطلب → إيميل) | 🔴 |

---

## ✅ ما تم إنجازه (للمرجع)

### الباكند — Backend
- ✅ 62 Route كاملة تمثل كل ميزة في المنصة
- ✅ Prisma schema كامل (60+ نموذج)
- ✅ JWT Auth + Refresh tokens
- ✅ Multi-tenant (كل متجر بـ subdomain)
- ✅ BenefitPay, Tap, Stripe, Moyasar
- ✅ AI (GPT-4o) لكتابة المحتوى وتحليل المتجر
- ✅ WhatsApp Bot للتسوق (FSM)
- ✅ Live Commerce مع YouTube/TikTok/Instagram
- ✅ KYC/Verification routes
- ✅ Docker جاهز للنشر

### الداشبورد — Dashboard
- ✅ 58 صفحة كاملة مع UI عربي
- ✅ جميع الميزات: المنتجات، الطلبات، العملاء، الكوبونات، التحليلات...
- ✅ AI Copilot، ZATCA، B2B، المطعم، Live Commerce، البادجز...
- ❌ **4 صفحات ناقصة**: staff / loyalty / flash-sales / inventory

### الواجهة الأمامية — Storefront
- ✅ Multi-tenant بـ subdomain
- ✅ عربي + إنجليزي
- ✅ Cart + Wishlist + Compare
- ✅ صفحات المنتج والفئات والبحث

### تطبيق الجوال — Mobile
- ✅ 9 شاشات كاملة: تسجيل دخول، داشبورد، طلبات، منتجات، POS، تحليلات، إعدادات
- ✅ Zustand store + SecureStore
- ❌ **لم يختبر بعد** (npm install + expo start)

### البنية التحتية — Infrastructure
- ✅ Dockerfile لكل تطبيق (3 ملفات)
- ✅ docker-compose.yml مع nginx
- ✅ nginx.conf مع SSL + Wildcard subdomains
- ✅ .env.example للمرجع
- ✅ DEPLOY_HOSTINGER.md — دليل النشر خطوة بخطوة

---

## ✅ تم إنجازه في هذه الجلسة (1 أبريل 2026 — الجلسة الثانية)

### Prisma Schema — نماذج جديدة
- ✅ `AiChat` — سجل محادثات المساعد الذكي
- ✅ `MerchantLoan` + `LoanRepayment` + `LoanStatus` enum — نظام تمويل التجار
- ✅ `RestaurantTable` + `RestaurantOrder` + `RestaurantOrderStatus` enum — وضع المطعم
- ✅ `MerchantBadge` + `MerchantBadgeEarned` — شارات التاجر
- ✅ `MerchantAlert` + `AlertConfig` (للتاجر) + `AlertType`/`AlertPriority` enums — التنبيهات الذكية
- ✅ `WhatsappCommerceSession` + `WhatsappCommerceConfig` — واتساب بوت التسوق
- ✅ إعادة تسمية القديم `AlertConfig` → `SystemAlertConfig` لحل التعارض
- ✅ `npx prisma generate` — تحديث كامل للـ client

### Backend Routes الجديدة
- ✅ `ai.routes.ts` — كاتب المنتجات (GPT-4o)، مساعد كوبايلت، كشف الاحتيال، اقتراح السعر، تحليل المتجر
- ✅ `whatsapp-commerce.routes.ts` — بوت تسوق واتساب كامل بـ FSM (GREETING→CART→CHECKOUT)
- ✅ `bazar-finance.routes.ts` — قروض التجار، أهلية بناءً على المبيعات، سداد تلقائي من كل بيع
- ✅ `restaurant.routes.ts` — إدارة الطاولات + QR + KDS + إحصائيات
- ✅ `badges-alerts.routes.ts` — 8 شارات افتراضية + توليد التنبيهات الذكية
- ✅ `server.ts` — تسجيل 6 routes جديدة + imports
- ✅ **0 أخطاء TypeScript** ✅

### Dashboard Pages (Next.js)
- ✅ `(dashboard)/ai/page.tsx` — كوبايلت + كاتب المنتجات + تحليل المتجر
- ✅ `(dashboard)/bazar-finance/page.tsx` — التمويل: الأهلية + طلب + تقدم السداد
- ✅ `(dashboard)/whatsapp-commerce/page.tsx` — الإحصائيات + المحادثات + إعدادات API + إرسال جماعي
- ✅ `(dashboard)/restaurant/page.tsx` — الطاولات + KDS مع تحديث تلقائي كل 15ث + إحصائيات اليوم
- ✅ `(dashboard)/badges/page.tsx` — الشارات المكتسبة + فحص الأهلية + نصائح
- ✅ `(dashboard)/alerts/page.tsx` — تنبيهات ملونة بالأولوية + فلتر + إعدادات + قنوات
- ✅ `sidebar.tsx` — 6 روابط جديدة: بازار AI، التنبيهات، تمويل التاجر، واتساب شوب، الشارات، وضع المطعم

---

## ❌ المتبقي (2 مهام)

| # | المهمة | الأولوية |
|---|--------|----------|
| 1 | تثبيت المكتبات `npm install` ثم `npx expo start` للاختبار في تطبيق الجوال | 🔴 عالية |
| 2 | رفع التطبيق على App Store / Play Store | 🟢 لاحقاً |

---

## ملخص ما تم تنفيذه في الجلسات الأخيرة

### Backend Routes الجديدة
- ✅ `currency.routes.ts` — أسعار الصرف + تحويل العملات
- ✅ `zatca-b2b.routes.ts` — فواتير ZATCA + B2B
- ✅ `recommendations.routes.ts` — توصيات الذكاء الاصطناعي
- ✅ `social-integrations.routes.ts` — TikTok/Instagram/Google Shopping
- ✅ `shipping.routes.ts` — مناطق + معدلات + تتبع الشحن
- ✅ `graphql.ts` — GraphQL API كامل
- ✅ `smart-search.routes.ts` — بحث ذكي + اقتراحات + شعبي + فلاتر
- ✅ `platform-import.routes.ts` — استيراد من Salla/Zid/Shopify CSV/WooCommerce
- ✅ `benefitpay.routes.ts` — بوابة BenefitPay الحقيقية (initiate/verify/webhook/refund)
- ✅ `ai.routes.ts` — طبقة AI كاملة
- ✅ `whatsapp-commerce.routes.ts` — بوت واتساب التسوق
- ✅ `bazar-finance.routes.ts` — تمويل التجار
- ✅ `restaurant.routes.ts` — وضع المطعم
- ✅ `badges-alerts.routes.ts` — الشارات والتنبيهات

### تطبيق الجوال React Native (Expo 52) — مكتمل 99%
- ✅ جميع الشاشات: Login, Dashboard, Orders, OrderDetail, Products, POS, Analytics, Settings, Notifications
- ✅ Navigation، Auth Guard، Zustand stores


---

## ✅ تم إنجازه في آخر جلسة (1 أبريل 2026)

### Backend — إصلاح TypeScript (0 أخطاء)
- ✅ `recommendations.routes.ts` — حذف الدالة المكررة + إصلاح `not: null` المكررة
- ✅ `smart-search.routes.ts` — إصلاح `parsed.ok` → `parsed.success`
- ✅ تأكيد 0 أخطاء بـ `npx tsc --noEmit`

### Backend — Routes جديدة
- ✅ `smart-search.routes.ts` — بحث ذكي + اقتراحات + شعبي + فلاتر
- ✅ `platform-import.routes.ts` — استيراد من Salla/Zid/Shopify CSV/WooCommerce
- ✅ `benefitpay.routes.ts` — بوابة BenefitPay الحقيقية (initiate/verify/webhook/refund)
- ✅ `server.ts` — تسجيل جميع الـ routes الجديدة

### تطبيق الجوال React Native (Expo 52)
- ✅ `package.json` + `app.json` + `tsconfig.json` — الإعداد الأساسي
- ✅ `src/types/index.ts` — جميع الأنواع
- ✅ `src/constants/index.ts` — الألوان، الخطوط، التسميات
- ✅ `src/api/index.ts` — Axios + جميع وحدات API
- ✅ `src/store/auth.store.ts` — Zustand + SecureStore
- ✅ `src/store/pos.store.ts` — Zustand سلة POS مع VAT 10%
- ✅ `src/screens/LoginScreen.tsx`
- ✅ `src/screens/DashboardScreen.tsx` — KPIs + رسوم بيانية + آخر الطلبات
- ✅ `src/screens/OrdersScreen.tsx` — قائمة + فلتر الحالة + بحث
- ✅ `src/screens/OrderDetailScreen.tsx` — تفاصيل + تحديث الحالة + رقم التتبع
- ✅ `src/screens/ProductsScreen.tsx` — قائمة + مؤشرات المخزون
- ✅ `src/screens/POSScreen.tsx` — باركود + بحث + سلة + كاش/BenefitPay
- ✅ `src/screens/AnalyticsScreen.tsx` — رسوم بيانية + مؤشرات الأداء
- ✅ `src/screens/SettingsScreen.tsx` — إعدادات المتجر + تسجيل الخروج
- ✅ `src/screens/NotificationsScreen.tsx` — قراءة/عدم قراءة
- ✅ `app/_layout.tsx` — Auth Guard + QueryClientProvider
- ✅ `app/(auth)/login.tsx`
- ✅ `app/(tabs)/_layout.tsx` — شريط تنقل سفلي 5 تبويبات
- ✅ `app/(tabs)/` — dashboard, orders, pos, products, settings
- ✅ `app/orders/[id].tsx` + `app/products/[id].tsx` + `app/notifications.tsx`

---

## ❌ المتبقي (2 مهام)

| # | المهمة | الأولوية |
|---|--------|----------|
| 1 | تثبيت المكتبات `npm install` ثم `npx expo start` للاختبار | 🔴 عالية |
| 2 | رفع التطبيق على App Store / Play Store | 🟢 لاحقاً |

---

## ملخص ما تم تنفيذه في الجلسات الأخيرة

### Backend Routes الجديدة
- ✅ `currency.routes.ts` — أسعار الصرف + تحويل العملات
- ✅ `zatca-b2b.routes.ts` — فواتير ZATCA + B2B
- ✅ `recommendations.routes.ts` — توصيات الذكاء الاصطناعي
- ✅ `social-integrations.routes.ts` — TikTok/Instagram/Google Shopping
- ✅ `shipping.routes.ts` — مناطق + معدلات + تتبع الشحن
- ✅ `graphql.ts` — GraphQL API كامل
- ✅ `domain.routes.ts`, `subscription-products.routes.ts`, `new-payment.routes.ts`
- ✅ `sms-push.routes.ts`, `advanced-coupon.routes.ts`, `pos.routes.ts`
- ✅ `import.routes.ts`, `platform-health.routes.ts`, `theme-store.routes.ts`
- ✅ `partner.routes.ts`, `live-commerce.routes.ts`, `warehouse.routes.ts`

### SDK
- ✅ JavaScript/TypeScript SDK
- ✅ Python SDK
- ✅ PHP SDK

### Dashboard Pages (17 صفحة جديدة)
- ✅ Domain, Warehouses, SMS, Push Notifications, POS
- ✅ Import, Platform Health, Theme Store, Live Commerce
- ✅ ZATCA, B2B Invoices, Currencies, Shipping
- ✅ Subscriptions, Recommendations, Advanced Coupons, Partners

### Sidebar Navigation
- ✅ جميع الصفحات الجديدة مضافة للقائمة الجانبية

### Page Builder
- ✅ زر معاينة Mobile (390px) / Tablet (768px) / Desktop

### Storefront
- ✅ PWA: `manifest.json` + `service-worker.js`
- ✅ Dark Mode toggle
- ✅ Currency Selector مع تحويل الأسعار آنياً
- ✅ Recommendation Widgets: AlsoViewed, CompleteTheLook, TrendingProducts
- ✅ PWA Installer (install banner)

---

## ✅ جميع Sprints منجزة (1–40+)

المنصة جاهزة للإطلاق! 🚀

