# ✅ قائمة المهام الكاملة — منصة بازار

> كل مهمة لها حالة: `[ ]` لم تبدأ · `[~]` جارية · `[x]` مكتملة

---

## 🏗️ المرحلة A — الأساس المتين

### A1 — البنية التحتية
- [x] نظام Multi-tenant (متاجر منفصلة بـ subdomain)
- [ ] SSL تلقائي لكل متجر عند ربط دومين مخصص
- [ ] CDN لتحميل الصور والأصول
- [ ] Domain mapping — ربط دومين مخصص لكل متجر
- [x] Webhooks system للتكامل مع أنظمة خارجية ✅
- [ ] Rate limiting وحماية DDoS

### A2 — المنتجات المتقدمة
- [x] إضافة وتعديل وحذف المنتجات
- [x] رفع الصور
- [x] كود المنتج (SKU)
- [x] متغيرات المنتج (Variants) — اللون، المقاس، الخامة
- [x] مجموعات المنتجات (Bundles)
- [ ] منتجات الاشتراك (Subscriptions / Recurring)
- [ ] منتجات رقمية (ملفات PDF، كورسات، مفاتيح تفعيل)
- [ ] منتجات مخصصة (طباعة على الطلب)
- [x] استيراد/تصدير المنتجات عبر CSV/Excel ✅
- [ ] إدارة المخزون متعدد المواقع
- [x] تحذيرات نفاد المخزون تلقائياً ✅
- [x] باركود وQR code لكل منتج ✅

### A3 — الطلبات المتقدمة
- [x] استقبال الطلبات وتتبع حالتها
- [x] إدارة الطلبات من لوحة التحكم
- [x] إدارة المرتجعات والاسترداد (Returns & Refunds)
- [x] طلبات المسودة (Draft Orders)
- [ ] نظام POS (نقطة بيع) للمتاجر الفعلية
- [ ] تتبع الشحن الآلي مع تحديثات SMS/WhatsApp
- [ ] تكامل مع شركات الشحن (Aramex, DHL, SMSA, Fetchr)
- [ ] الفوترة الإلكترونية المتوافقة مع ZATCA (ضريبة السعودية)

---

## 🎨 المرحلة B — تجربة التاجر

### B1 — محرر الصفحات (Page Builder)
- [x] Page Builder مرئي بأقسام قابلة للترتيب
- [x] قوالب أقسام جاهزة (Hero, Banner, Products Grid, Categories, Marquee, Text, Divider)
- [ ] قوالب جاهزة لصفحة المنتج
- [ ] قوالب Landing Pages
- [x] تخصيص الألوان والنصوص لكل قسم
- [ ] معاينة فورية على Mobile + Desktop
- [ ] حفظ قوالب مخصصة وإعادة استخدامها

### B2 — نظام المحتوى (CMS) ✅
- [x] إدارة المدونة والمقالات ✅
- [x] صفحات مخصصة (About Us, FAQ, سياسة الخصوصية) ✅
- [x] SEO متقدم: meta tags, OG images, structured data ✅
- [x] Sitemap تلقائي ✅
- [x] robots.txt مُدار ✅

### B3 — تجربة الإعداد (Onboarding)
- [x] Onboarding Wizard ذكي (5 خطوات) ✅
- [ ] استيراد المنتجات من Salla
- [ ] استيراد المنتجات من Zid
- [ ] استيراد المنتجات من WooCommerce
- [ ] استيراد المنتجات من Shopify
- [ ] اقتراحات ذكية بناءً على فئة المتجر

---

## 🛍️ المرحلة C — تجربة المتسوق

### C1 — الواجهة والأداء
- [x] واجهة Storefront أساسية
- [ ] PWA (Progressive Web App)
- [ ] Core Web Vitals سكور 95+
- [ ] وضع الليل (Dark Mode)
- [ ] دعم اللغات المتعددة (AR / EN)
- [ ] دعم العملات المتعددة مع تحويل آني

### C2 — البحث والاكتشاف
- [x] بحث أساسي في المنتجات
- [x] Instant Search بنتائج آنية (مع debounce + dropdown) ✅
- [x] فلترة متقدمة (سعر، لون، مقاس، تقييم) ✅
- [ ] توصيات المنتجات بالذكاء الاصطناعي
- [ ] "رأى المشترون أيضاً"
- [ ] "يكمل بعضه" (Complete the Look)

### C3 — الولاء والتفاعل
- [x] مقارنة المنتجات
- [x] نظام نقاط الولاء (Loyalty Points) ✅
- [x] برنامج الإحالة (Referral Program) ✅
- [x] قائمة المفضلة (Wishlist) ✅
- [x] إشعارات العودة للمخزون ✅
- [x] تقييمات ومراجعات المنتجات + صور من المشترين ✅
- [ ] محادثة مباشرة (Live Chat) مدمجة

### C4 — التجارة المباشرة (Live Commerce)
- [ ] بث مباشر مع إضافة منتجات أثناء البث
- [x] Flash Sales مع عداد تنازلي ✅
- [x] حجز المنتجات قبل الإطلاق (Pre-order) ✅

---

## 💳 المرحلة D — المدفوعات الشاملة

### D1 — بوابات الدفع
- [x] Apple Pay (هيكل مكتمل)
- [x] Google Pay (هيكل مكتمل)
- [x] Tap Payments (الكويت، السعودية، البحرين، الإمارات) ✅
- [x] Moyasar (السعودية) ✅
- [x] Benefit Pay (البحرين) ✅
- [ ] PayTabs (الخليج)
- [ ] Stripe (الدولية)
- [ ] HyperPay
- [ ] PayPal
- [ ] STC Pay
- [ ] mada (السعودية)
- [ ] Benefit (البحرين)

### D2 — التقسيط والدفع الآجل
- [x] Tabby (اشتري الآن وادفع لاحقاً) ✅
- [x] Tamara ✅
- [ ] Postpay
- [ ] فواتير B2B للشركات

### D3 — إدارة المالية
- [x] لوحة مالية للتاجر (إيرادات، مصاريف، أرباح) ✅
- [x] تقارير ضريبة القيمة المضافة ✅
- [x] تصدير كشف الحساب (Excel/PDF) ✅

---

## 📣 المرحلة E — محرك التسويق

### E1 — التسويق الرقمي
- [x] Google Ads Tag مدمج ✅
- [x] Facebook Pixel مدمج ✅
- [ ] Google Shopping Feed تلقائي
- [ ] تكامل مع TikTok Shop
- [ ] تكامل مع Instagram Shopping
- [x] Snapchat Pixel ✅
- [x] TikTok Pixel ✅

### E2 — الأتمتة والإرسال ✅
- [x] Email Marketing مدمج (Campaigns + Automations) ✅
- [x] WhatsApp Business API — تأكيد الطلب، الشحن، التذكير
- [ ] SMS Marketing (حملات + OTP)
- [ ] Push Notifications للمتسوقين
- [x] Abandoned Cart Recovery (استرداد سلة المهجورة)

### E3 — أدوات التحويل
- [x] Popups وExit Intent ✅
- [x] Countdown Timers ✅
- [x] Upsell/Cross-sell عند الدفع ✅
- [ ] برامج الكوبونات المتقدمة (Tiered Discounts, BOGO)
- [x] كوبونات الخصم الأساسية
- [x] Gift Cards (كروت هدية) ✅

---

## 👨‍💻 المرحلة F — منصة المطورين

### F1 — واجهات برمجية ✅
- [x] REST API داخلية
- [x] Public REST API موثقة (Swagger/OpenAPI)
- [ ] GraphQL API
- [x] Webhooks للأحداث (طلب جديد، منتج محدّث) ✅
- [ ] SDK لـ JavaScript
- [ ] SDK لـ Python
- [ ] SDK لـ PHP

### F2 — متجر التطبيقات (App Store) ✅
- [x] منصة لنشر تطبيقات الطرف الثالث
- [ ] نظام اشتراك وعمولة للمطورين الشركاء
- [x] تطبيق ERP رسمي
- [x] تطبيق محاسبة رسمي
- [x] تطبيق CRM رسمي
- [x] تطبيقات شركات الشحن

### F3 — متجر القوالب (Theme Store)
- [ ] رفع وبيع القوالب من مصممين خارجيين
- [ ] نظام مراجعة ومعايير جودة
- [ ] معاينة حية قبل الشراء
- [ ] نظام ترخيص القوالب

### F4 — برنامج الشركاء
- [ ] Agency Partners — وكالات تبني متاجر
- [ ] Referral Commission للشركاء
- [ ] Certified Partner Badge وبوابة الشركاء

---

## 🛡️ المرحلة G — السوبر أدمن الكامل

### G0 — السوبر أدمن المبدئي (مكتمل)
- [x] إحصائيات المنصة الكاملة
- [x] إدارة التجار (عرض، تفعيل، إلغاء تفعيل)
- [x] إدارة المتاجر (عرض، تغيير الخطة، تفعيل)
- [x] نظام `isAdmin` في قاعدة البيانات
- [x] `requireAdmin` middleware
- [x] `ADMIN_SETUP_TOKEN` لأول أدمن

### G1 — إدارة الاشتراكات والفوترة ✅
- [x] خطط الأسعار (STARTER / GROWTH / PRO / ENTERPRISE) — هيكل أساسي
- [x] فترة تجريبية مجانية (14 يوم) مع تحويل تلقائي
- [ ] ربط Stripe Billing للرسوم الشهرية
- [ ] ربط Moyasar للرسوم الشهرية (للسوق العربي)
- [x] فواتير أتوماتيكية للتجار
- [x] إيقاف تلقائي عند انتهاء الاشتراك ✅
- [x] صفحة Upgrade لترقية الخطة

### G2 — مراقبة الأداء
- [ ] لوحة صحة المنصة (Uptime، Response Time، Error Rate)
- [ ] تنبيهات البريد/Slack عند الأعطال
- [ ] سجل الأخطاء (Error Logs)
- [ ] استخدام الموارد لكل متجر (Storage، API Calls)

### G3 — دعم التجار
- [x] نظام تذاكر الدعم مدمج ✅
- [ ] Live Chat بين الأدمن والتجار
- [x] قاعدة المعرفة (Help Center) ✅
- [x] Announcement System للإشعارات الجماعية للتجار ✅

### G4 — التحليلات المتقدمة للأدمن
- [x] Cohort Analysis — معدل الاستبقاء حسب الشهر ✅
- [x] MRR / ARR / Churn Rate ✅
- [ ] خريطة الدول (تجار وأوردرات)
- [ ] Conversion Funnel للتسجيل

---

## 📊 ملخص الحالة

| المرحلة | المكتمل | المتبقي |
|---------|---------|---------|
| A — الأساس | 13 | 8 |
| B — تجربة التاجر | 6 | 15 |
| C — تجربة المتسوق | 9 | 13 |
| D — المدفوعات | 10 | 7 |
| E — التسويق | 12 | 5 |
| F — المطورين | 6 | 11 |
| G — السوبر أدمن | 12 | 6 |
| **الإجمالي** | **68** | **65** |

---

## 🗓️ ترتيب التنفيذ المقترح

```
Sprint 1:  A2 — متغيرات المنتج (Variants) ✅ مكتمل
Sprint 2:  A3 — المرتجعات + Draft Orders ✅ مكتمل
Sprint 3:  B1 — Page Builder (الأقوى تنافسياً) ✅ مكتمل
Sprint 4:  D1 — بوابات الدفع المحلية (Tap + Moyasar) ✅ مكتمل
Sprint 5:  C2 — Instant Search + فلترة متقدمة ✅ مكتمل
Sprint 6:  C3 — نقاط الولاء + Wishlist ✅ مكتمل
Sprint 7:  E2 — WhatsApp + استرداد السلة ✅ مكتمل
Sprint 8:  G1 — فوترة الاشتراكات ✅ مكتمل
Sprint 9:  F1 — Public API + Swagger ✅ مكتمل
Sprint 10: F2 — App Store ✅ مكتمل
Sprint 11: B2 — CMS (مدونة + صفحات مخصصة + SEO) ✅ مكتمل
Sprint 12: C3 — تقييمات المنتجات ✅ مكتمل
Sprint 13: E3 — Flash Sales + عداد تنازلي ✅ مكتمل
Sprint 14: A2 — CSV Export/Import + Barcode + QR + Low-Stock Alerts ✅ مكتمل
Sprint 15: A1 — Webhooks System (HMAC signing + delivery logs) ✅ مكتمل
Sprint 16: B3 — Onboarding Wizard (5 خطوات) ✅ مكتمل
Sprint 17: C3 — Referral Program (codes + stats + storefront) ✅ مكتمل
Sprint 18: C3 — Back-in-Stock Notifications ✅ مكتمل
Sprint 19: E3 — Gift Cards (إنشاء + استرداد + storefront checkout) ✅ مكتمل
Sprint 20: E3 — Popups & Exit Intent (4 triggers + showOnce) ✅ مكتمل
Sprint 21: E1 — Marketing Pixels (Google Tag, Facebook, TikTok, Snapchat, Google Ads) ✅ مكتمل
Sprint 22: G3 — Support Tickets (تذاكر الدعم بين التجار والأدمن) ✅ مكتمل
Sprint 12: C3 — تقييمات المنتجات ✅ مكتمل
Sprint 13: E3 — Flash Sales + عداد تنازلي ✅ مكتمل
```

---

*آخر تحديث: مارس 2026 — Sprints 1–23 مكتملة (68/133 مهمة)*
