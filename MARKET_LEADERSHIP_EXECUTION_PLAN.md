# خطة القيادة السوقية الكاملة — BahrainStore

هذا الملف هو الخطة التنفيذية الشاملة للوصول بالمشروع إلى منصة مكتملة عملياً، قابلة للإطلاق بثقة، ثم متفوقة على سلة وزد في السوق الخليجي، ثم قادرة على بناء طبقة منصة أعمق على المدى المتوسط.

هذه الخطة مبنية على الواقع الحالي للكود، لا على ملفات قديمة تفترض أن المشروع مكتمل 100%.

## 1) الحقيقة الحالية

المشروع اليوم قوي جداً من حيث السطح والملكية التقنية، لكنه ليس مكتمل الجاهزية بعد.

الموجود فعلياً وبقوة:
- Backend واسع وغني بالميزات.
- Storefront حقيقي مع theme engine وpage builder فعلي.
- Dashboard كبير ويغطي مسارات أعمال كثيرة.
- Mobile app موجود وله أساس جيد.
- قاعدة بيانات ومنظومة نماذج كبيرة وطموحة.

الفجوة الحالية ليست في قلة الميزات، بل في:
- صلابة multi-tenant authorization.
- readiness لبعض بوابات الدفع والـ webhooks.
- اتساق dashboard/mobile مع backend.
- إزالة الـ mock والـ legacy والـ fallback من المسارات الحساسة.
- تحويل المشروع من code-rich platform إلى operationally reliable SaaS.

## 2) ماذا يعني “100%” هنا

لن نستخدم “100%” بمعنى أن كل صفحة موجودة فقط. سنستخدمه بمعنى:

1. كل ميزة مفعلة في الواجهة تعمل end-to-end على staging وproduction.
2. لا توجد ثغرات tenant isolation معروفة.
3. لا توجد بوابة دفع نشطة بلا webhook verification حقيقي.
4. لا توجد صفحة تشغيل رئيسية تعتمد على mock data أو endpoint غير موجود.
5. الجوال، الداشبورد، والستورفرونت متوافقون مع عقود backend الفعلية.
6. توجد اختبارات وتتبّع وأدوات تشغيل تمنع الارتداد بعد الإصلاح.

## 3) ماذا يعني “يتفوق عليهم”

التفوق لا يكون بمحاولة تقليد Shopify كاملاً دفعة واحدة. الترتيب الصحيح هو:

1. التفوق على سلة وزد في السوق الخليجي عبر جودة المنتج + عمق التشغيل + ميزات GCC-native.
2. بناء نقاط تميز لا يملكونها بعمق كافٍ: WhatsApp commerce, live commerce, advanced builder, Bahrain/GCC finance and compliance, merchant intelligence.
3. بعد ذلك فقط تبدأ طبقة platform maturity الأقرب لنموذج Shopify، مثل developer ecosystem، app contracts، partner platform، and extensibility discipline.

## 4) الهدف التنفيذي الأعلى

الوصول إلى منصة تحقق هذه النتيجة خلال 3 طبقات:

### الطبقة الأولى: Launch-Safe
- آمنة.
- مستقرة.
- متوافقة end-to-end.
- صالحة للبيع والدعم والتشغيل.

### الطبقة الثانية: GCC-Leading
- أفضل من سلة وزد في merchant tooling داخل الخليج.
- أفضل في WhatsApp commerce والبيع المباشر والثيمات والعمليات المحلية.
- أسرع في onboarding والتفعيل.

### الطبقة الثالثة: Platform-Grade
- APIs وعقود تكامل ناضجة.
- App ecosystem واضح.
- Theme ecosystem منضبط.
- Partner-led growth.

## 5) المبادئ غير القابلة للتفاوض

1. لا ميزة جديدة فوق مسار مكسور أو غير آمن.
2. أي شيء customer-facing أو merchant-facing يجب أن يكون حقيقياً أو معطلاً، لا نصف جاهز.
3. أي mock في مسار تشغيل حقيقي إما يزال أو يُغلق وراء feature flag داخلي.
4. أي route متعددة المستأجرين يجب أن تطبق ownership checks صريحة.
5. أي claim في ملفات التخطيط القديمة لا يعتمد ما لم يثبته الكود والاختبار.

## 6) مسارات العمل الرئيسية

## Track A: Security and Tenant Isolation

الهدف:
إغلاق كل ثغرات الملكية بين المتاجر وتحويل الأمان من best effort إلى guaranteed enforcement.

المهام:
- بناء طبقة helpers موحدة للتحقق من ملكية store, warehouse, shipping rate, live stream, live support session, whatsapp commerce config/session.
- مراجعة كل route تستقبل `storeId` أو IDs حساسة من body أو params أو query.
- تطبيق ownership checks على وحدات: warehouse, shipping, ai, live-commerce, whatsapp-commerce.
- مراجعة staff/store roles إن وجدت وتحديد policy واضحة: owner/admin/staff capabilities.
- إضافة integration tests سلبية لكل مسار cross-tenant.

معيار الإنجاز:
- لا توجد أي route حرجة تعتمد على auth فقط دون authorization.
- كل اختبار cross-tenant يفشل بشكل صحيح.

## Track B: Payments, Billing, and Webhooks

الهدف:
تحويل الدفع من breadth إلى trusted production infrastructure.

المهام:
- إصلاح Stripe webhook verification باستخدام raw body والتوقيع الرسمي.
- مراجعة PayTabs, PayPal, Tap, Tamara, Postpay, BenefitPay وكل gateway ضمن نطاق الإطلاق.
- توحيد callback URL construction مع env contract واحد واضح.
- إضافة idempotency guard لكل webhook/payment callback.
- توحيد payment status transitions ومنع الانتقالات غير الصحيحة.
- بناء test matrix لكل بوابة: create, callback, verify, refund, failure path.
- تصنيف البوابات إلى 3 مستويات: production-ready, beta, disabled.

معيار الإنجاز:
- لا توجد بوابة مفعلة بدون verification حقيقي.
- كل بوابة مفعلة لها checklist نجاح واختبارات smoke/staging موثقة.

## Track C: Dashboard Truthfulness and Operational UX

الهدف:
جعل الداشبورد أداة تشغيل يمكن الوثوق بها لا واجهة كبيرة فقط.

المهام:
- إصلاح dashboard analytics بالكامل: encoding, response shape, charts, contracts.
- إزالة mock chart data من الصفحة الرئيسية وأي صفحات مشابهة.
- مراجعة كل صفحة dashboard عالية التأثير وربطها مع API فعلي وصحيح.
- بناء API contract matrix بين dashboard pages وbackend endpoints.
- توحيد error states, loading states, empty states, and permission states.
- تحديد الصفحات الجاهزة والصفحات beta والصفحات الداخلية.

معيار الإنجاز:
- لا توجد صفحة تشغيل رئيسية تعتمد على mocks أو endpoint غير موجود.
- التاجر يستطيع إدارة الأعمال اليومية من dashboard دون مفاجآت تشغيلية.

## Track D: Mobile Reality and Merchant App Completion

الهدف:
تحويل mobile من واجهات جيدة بصرياً إلى merchant app موثوق.

المهام:
- جرد كامل لكل mobile API calls ومطابقتها مع backend.
- إصلاح methods والمسارات غير المتوافقة مثل PUT/PATCH وanalytics/POS paths.
- إغلاق أو تأجيل أي شاشة لا تملك backend صالحاً.
- اختبار flows الأساسية: login, dashboard, orders, order status, products, stock, POS, notifications.
- إضافة release gate خاص بالـ mobile يمنع النشر قبل contract pass.

معيار الإنجاز:
- لا توجد شاشة رئيسية تستدعي endpoint غير موجود.
- الجوال يصبح أداة يومية حقيقية للتاجر، لا مجرد واجهة مكملة.

## Track E: Storefront and Theme Leadership

الهدف:
تحويل الواجهة الأمامية والثيمات إلى نقطة تفوق فعلية على سلة وزد.

المهام:
- تنظيف legacy fallbacks تدريجياً بعد تثبيت العقد الحديث.
- إكمال تغطية templates لكل page types الحساسة مع validation صارم.
- تعميق theme packages, versioning, preview, install, rollback, and migration contracts.
- تقوية SEO, structured data, page speed, caching, and revalidation policies.
- جعل builder أكثر قوة في sections, presets, reusable blocks, device-specific controls, and conversion widgets.
- بناء theme QA checklist لأي theme جديدة.

معيار الإنجاز:
- التاجر يستطيع بناء storefront محترف وسريع ومرن دون كسر runtime.
- theme system يصبح ميزة تفوق حقيقية وليست فقط قائمة sections.

## Track F: Shipping, Operations, and Merchant Backoffice

الهدف:
جعل العمليات اليومية للتاجر أفضل من حلول السوق المحلية.

المهام:
- استبدال tracking mocks بتكاملات فعلية أو تعطيلها مؤقتاً.
- توحيد shipping zones, rates, labels, tracking, notifications.
- استكمال warehouse workflows, stock movements, transfers, and audit trail.
- إكمال KYC reviewer backoffice بشكل كامل.
- تقوية returns, refunds, disputes, and order exception management.

معيار الإنجاز:
- العمليات اليومية الحرجة تعمل من داخل النظام بلا اعتماد على حلول جانبية.

## Track G: Merchant Growth Engine

الهدف:
التفوق على سلة وزد في growth tooling وليس فقط في الإدارة.

المهام:
- تعميق abandoned carts, upsell, cross-sell, promotions, referrals, loyalty.
- جعل WhatsApp commerce production-grade: ownership, queueing, rate limits, message templates, stats, broadcast governance.
- تعميق live commerce بربط المنتجات والشراء المباشر والتفاعل والإدارة اللحظية.
- تحسين analytics لتصبح decision-grade: revenue, cohorts, conversion, funnel, attribution, top channels.
- بناء merchant health score and playbooks inside dashboard.

معيار الإنجاز:
- النظام لا يكتفي بإدارة المتجر، بل يساعد التاجر على النمو الفعلي.

## Track H: AI That Is Honest and Useful

الهدف:
بناء طبقة AI مميزة خليجياً بدون ادعاء زائد.

المهام:
- منع أي fallback مضلل عندما لا يوجد provider key.
- فصل AI capabilities إلى: enabled, unavailable, degraded.
- بناء use cases ذات قيمة مباشرة: product writer, pricing hints, fraud scoring, campaign drafting, catalog cleanup, merchant assistant.
- إضافة observability: prompt logs, cost tracking, failure states, merchant-visible confidence.
- ربط AI بالبيانات الصحيحة وبصلاحيات صحيحة فقط.

معيار الإنجاز:
- AI يعزز المنتج فعلاً، ولا يخلق انطباعاً خاطئاً بأنه يعمل بينما هو fallback فقط.

## Track I: Reliability, QA, and Release Discipline

الهدف:
تحويل الجودة من عمل يدوي إلى نظام.

المهام:
- إضافة integration tests للمسارات الحرجة.
- إضافة API contract tests بين backend وكل من dashboard/mobile/storefront.
- إضافة smoke tests deployment-level.
- بناء production checklist للإطلاق.
- تفعيل structured logging, health checks, alerting, tracing where possible.
- تعريف release train واضح: alpha, internal beta, private beta, public launch.

معيار الإنجاز:
- أي regression حرج يُكتشف قبل أن يصل للمستخدم.

## Track J: Platform and Ecosystem

الهدف:
بناء الطبقة التي تجعل المشروع يتجاوز الحلول المحلية على المدى المتوسط.

المهام:
- ضبط public API contracts and versioning.
- بناء OAuth/app authentication strategy لتطبيقات الطرف الثالث.
- تنظيم webhooks developer experience.
- تعميق SDKs وتوثيقها.
- بناء partner workflows, app review policy, theme certification, and extension governance.

معيار الإنجاز:
- يصبح المشروع منصة قابلة للبناء فوقها، لا مجرد SaaS مغلق.

## 7) مراحل التنفيذ الزمنية

## المرحلة 0: Freeze and Truth Reset

المدة:
1 أسبوع.

الهدف:
إيقاف أي تضخم في scope وتثبيت الواقع.

المهام:
- اعتماد هذا الملف كمرجع أعلى من ملفات “100% مكتمل”.
- تصنيف كل وحدة: ready, partial, broken, internal-only.
- إخفاء أي ميزة غير جاهزة من الواجهة العامة عند الحاجة.
- تحديد gateways الفعلية الداخلة في الإطلاق الأول.

ناتج المرحلة:
- baseline حقيقي، بلا أوهام إنجاز.

## المرحلة 1: Launch Safety

المدة:
2 إلى 4 أسابيع.

المهام:
- Track A بالكامل.
- Track B في الجزء الحرج فقط.
- Track C للصفحات التشغيلية الحرجة.
- Track D للـ mobile blockers فقط.

ناتج المرحلة:
- منصة قابلة للإطلاق الخاص أو beta المغلق دون مخاطر معروفة كبيرة.

## المرحلة 2: Operational Completion

المدة:
4 إلى 6 أسابيع.

المهام:
- إكمال dashboard truthfulness.
- إكمال mobile parity.
- إكمال shipping/warehouse/KYC/backoffice.
- تقوية observability وrelease process.

ناتج المرحلة:
- منصة قابلة للبيع وتشغيل التجار الحقيقيين بكفاءة.

## المرحلة 3: Competitive Parity Plus

المدة:
6 إلى 8 أسابيع.

المهام:
- تعميق storefront/theme experience.
- تعميق growth engine.
- تحسين onboarding, import, analytics, retention tooling.
- تحسين merchant support workflows.

ناتج المرحلة:
- تفوق واضح على سلة وزد في عدة محاور داخل السوق الخليجي.

## المرحلة 4: Market Leadership Features

المدة:
8 إلى 12 أسبوعاً.

المهام:
- live commerce production-grade.
- whatsapp commerce production-grade.
- advanced merchant intelligence and AI.
- partner and extension workflows.

ناتج المرحلة:
- تميز فعلي وليس فقط parity.

## المرحلة 5: Platform-Grade Expansion

المدة:
مستمرة.

المهام:
- public API versioning.
- app auth and app lifecycle.
- theme certification.
- enterprise admin capabilities.
- regional expansion hardening.

ناتج المرحلة:
- قاعدة منصة طويلة الأمد تتجاوز حلول السوق المحلية.

## 8) خطة السبرنتات المقترحة

## Sprint 1
- [x] إغلاق ثغرات الملكية في warehouse.
- [x] إغلاق ثغرات الملكية في shipping.
- [x] إغلاق ثغرات الملكية في whatsapp-commerce.
- [x] إغلاق ثغرات الملكية في ai.
- [x] حماية live support routes.
- [x] إغلاق ثغرات الملكية في finance routes.
- [x] إغلاق ثغرات الملكية في email-marketing routes.
- [x] إغلاق ثغرات الملكية في upsell/countdown routes.
- [x] إغلاق ثغرات الملكية في POS session/order routes.
- [x] إغلاق ثغرات الملكية في import job details.
- [x] إغلاق ثغرات الملكية في restaurant routes.
- [x] إغلاق ثغرات الملكية في benefitpay routes.
- [x] تقوية ownership/admin enforcement في bazar-finance routes.
- [x] توحيد ownership enforcement في pages/blog/flash-sales routes.

## Sprint 2
- [x] إصلاح Stripe webhook.
- [x] إصلاح PayPal token contract.
- [x] توحيد callback env contract.
- [x] إضافة idempotency للحساسات المالية.

## Sprint 3
- [x] إصلاح dashboard analytics بالكامل.
- [x] إزالة mock chart data.
- [x] جرد dashboard API matrix.

## Sprint 4
- [x] مطابقة mobile API contracts بالكامل.
- [x] إصلاح POS checkout and barcode flows.
- [x] تحديد الشاشات المؤهلة للإطلاق من الجوال.

## Sprint 5
- [x] استبدال shipping mocks أو تعطيلها.
- [x] تعطيل Instagram demo import flow حتى يتوفر backend حقيقي.
- [x] إزالة BenefitPay mock session/refund وإرجاع حالة صادقة عند عدم الجاهزية.
- [x] تصحيح billing truthfulness: منع تفعيل الخطط المدفوعة قبل تأكيد الدفع الحقيقي، وحصر تعليم الفواتير كمدفوعة يدوياً على full admin فقط.
- [x] تقوية KYC review validation وإظهار حالة الوثيقة بوضوح في governance dashboard.
- [x] تقوية سلامة platform roles/team contracts ومنع تعديل system roles.
- [x] رفع RBAC الفعلي للمنصة: حماية admin routes الحساسة بصلاحيات واضحة وربط admin dashboard navigation بـ platformAccess.
- [x] إكمال نشر RBAC خارج admin.routes أيضاً: دعم الإدارة، التمويل، theme approvals، partner operations، وplatform health لم تعد تعتمد على isAdmin/raw requireAdmin فقط.
- [x] إغلاق ownership leak في apps marketplace: منع إظهار app installation status لأي store إلا بعد auth وربطها بملكية التاجر الفعلية.
- [x] رفع warehouse backoffice: تعديل بيانات المستودع واستعراض مخزونه الفعلي من dashboard.
- [x] رفع KYC backoffice: إضافة إنشاء يدوي لوثائق KYC مع بحث فعلي عن التاجر وإظهار تفاصيل المراجعة.
- [x] تعميق KYC reviewer flow: فلترة حسب الحالة/النوع، بحث بالمراجعين/التجار، pagination، وتحديث stats مباشرة بعد قرارات المراجعة.
- [x] رفع returns workflow في dashboard إلى itemized return requests بدل طلبات عامة بلا عناصر.
- [x] إزالة legacy fallback من حفظ homepage/page templates وربط الحفظ تلقائياً بـ main theme config أو إرجاع خطأ صادق عند غياب ثيم فعّال.
- [x] تقوية returns/refunds backend: منع over-return التراكمي وربط REFUNDED / PARTIALLY_REFUNDED بالمبالغ المستردة فعلياً.
- [x] تحويل refund execution إلى flow تشغيلي حقيقي: endpoint مستقل لتنفيذ الاسترداد، منع REFUNDED المباشر، وربط original_payment مع BenefitPay أو إرجاع NOT_READY بصدق.
- [x] رفع shipping operations: إخفاء إنشاء الشحنة التلقائي عند غياب carrier جاهز، إصلاح shipping rate calculation حسب المدينة/الحد الأدنى/التفعيل، وإضافة إدارة rates من dashboard.
- [x] استكمال refunds/disputes operational flows: إضافة dispute tickets تشغيلية مرتبطة بالطلب/المرتجع مع listing, merchant replies, وإغلاق النزاع من dashboard، مع إعادة استخدام support backoffice الحالي.

## Sprint 6
- [x] تعميق builder/theme package workflow جزئياً: إضافة rollback فعلي للثيم النشط إلى آخر theme سابق مثبت، مع إظهاره داخل merchant theme store.
- [x] تحسين storefront performance and SEO: إضافة metadata مولدة للصفحات التجارية الأساسية، structured data لـ homepage/product/collection، وpreconnect/dns-prefetch لطبقة الـ API داخل storefront.
- [x] توسيع controls التي ترفع conversion: إضافة trust badges، shipping promise، low-stock urgency، وsticky mobile add-to-cart كإعدادات فعلية داخل `product_detail` metadata والثيم runtime.

## Sprint 7
- [x] إزالة AI demo/template fallback وإرجاع NOT_READY عند غياب التهيئة.
- [x] تعميق WhatsApp commerce وlive commerce إلى production-grade: إضافة readiness/test-message/broadcast governance صريحة في WhatsApp، وتصحيح live viewer counting عبر heartbeat حقيقي مع stream detail وchat pinning بدل counters مضللة.
- [x] تحسين analytics وmerchant health insights: إضافة merchant health score فعلي مع issues/actions/dimensions وربطه داخل dashboard analytics.
- [x] ضبط AI capability model: إضافة `/ai/capabilities` بحالات `enabled | degraded | unavailable` وربط dashboard AI بها لتعطيل الأدوات غير الجاهزة وإظهار الحالة الحقيقية.

## Sprint 8
- [x] API contracts, SDK quality, webhook DX: نشر `/api/public/v1/contract` كعقد صريح، توسيع public API ليغطي orders/customers/coupons/inventory التي تعلنها الـ SDKs، وتصحيح JS/Python/PHP SDKs لتطابق order numbers وcustomer phones وإضافة webhook signature helpers.
- [x] partner/app/theme governance: تحويل مراجعة governance من صفحات متفرقة فقط إلى gate تنفيذي موحد يعتمد على pending queues الفعلية للتطبيقات والثيمات والشركاء.
- [x] launch readiness review and executive sign-off: إضافة `/admin/launch-readiness` داخل backend ولوحة admin تعرض blockers/warnings وموثوقية webhooks وعقود الـ API ومدخلات sign-off بشكل مباشر.

## 9) الـ backlog التنفيذي الكامل

### P0 — مانع إطلاق
- [x] إغلاق كل ownership gaps في الوحدات الحرجة.
- [x] إصلاح payment webhook verification للبوابات النشطة.
- [x] إصلاح dashboard analytics.
- [x] إزالة mock data من مسارات التشغيل الأساسية.
- [x] مطابقة mobile مع backend أو تعطيل ما لا يعمل.

### P1 — قبل public launch
- [x] استكمال shipping الحقيقي.
- [x] استكمال KYC reviewer flows.
- [x] استكمال returns/refunds operational flows.
- [x] توحيد role/permission enforcement للإدارة والموظفين.
- [x] إضافة integration and contract tests.

### P2 — للتفوق على سلة وزد
- [x] جعل theme builder أفضل في reusable sections and presets.
- [ ] جعل WhatsApp commerce أداة مبيعات يومية حقيقية.
- [ ] جعل live commerce وحدة بيع حقيقية وليست مجرد بث.
- [x] بناء merchant health score and growth recommendations.
- [ ] جعل onboarding/import أسرع وأذكى من المنافسين.

### P3 — لبناء طبقة منصة أعمق
- [ ] OAuth/app auth للتطبيقات الخارجية.
- [ ] public API versioning.
- [ ] app review/governance.
- [ ] theme certification and version discipline.
- [ ] partner platform and revenue-sharing maturity.

## 10) توزيع الفرق المقترح

إذا كان الفريق صغيراً، فالتنفيذ يكون عبر 3 مسارات فقط:

### Squad 1: Core Commerce and Security
- backend auth
- payments
- orders
- shipping
- warehouse

### Squad 2: Merchant Experience
- dashboard
- storefront
- builder
- analytics
- onboarding

### Squad 3: Growth and Platform
- whatsapp commerce
- live commerce
- ai
- public api
- partners/apps/themes

إذا كان الفريق شخصاً واحداً أو فريقاً صغيراً جداً، فالترتيب الإجباري هو:
1. P0
2. P1
3. theme/storefront advantage
4. growth engine
5. platform ecosystem

## 11) مقاييس النجاح ضد المنافسين

لن نقول “تفوقنا” إلا إذا تحققت هذه المؤشرات:

### جودة المنتج
- 0 ثغرات tenant isolation معروفة في المسارات الحرجة.
- 0 dashboard critical page تعتمد على mock أو endpoint مفقود.
- 0 mobile critical flow مكسور في الإطلاق.
- 95%+ success rate في checkout للبوابات المفعلة.

### تجربة التاجر
- onboarding لتاجر جديد خلال أقل من 30 دقيقة.
- أول store publish خلال أقل من ساعتين.
- theme customization usable بدون تدخل تقني.
- WhatsApp and live commerce flows usable فعلياً وليس عرضياً.

### التشغيل
- MTTR منخفض وواضح.
- health checks and alerting فعالة.
- deployment repeatable.
- no hidden production-only surprises.

### النمو والمنافسة
- import from competitors أسرع من بقائهم على المنصة.
- merchant sees clear value in analytics/growth tools.
- وجود 3 إلى 5 ميزات GCC-native لا يملكونها بنفس العمق.

## 12) الميزات التي تعطي أفضلية حقيقية إذا نُفذت جيداً

هذه ليست أفكاراً نظرية، بل المحاور التي فعلاً يمكن أن تكسب السوق إذا نُفذت بجودة عالية:

1. WhatsApp commerce الحقيقي، لا مجرد إشعارات.
2. live commerce الذي يقود إلى شراء مباشر.
3. theme builder عربي قوي وسريع وقابل للبيع للقوالب.
4. عمليات خليجية أصلية: VAT, ZATCA-like readiness, local payments, local shipping.
5. merchant intelligence داخل dashboard بدلاً من مجرد تقارير جامدة.

## 13) القرار التنفيذي النهائي

إذا كان الهدف “منصة 100% وتتفوق عليهم”، فالمسار الصحيح ليس إضافة مزيد من الصفحات الآن.

المسار الصحيح هو:

1. تنظيف الحقيقة التشغيلية.
2. إغلاق الأمان والعقود والدفعات.
3. تثبيت dashboard/mobile/storefront end-to-end.
4. ثم تعميق نقاط التفوق الحقيقية.
5. ثم بناء طبقة منصة طويلة الأمد.

هذا هو الطريق الوحيد الذي يجعل المشروع يتفوق عليهم فعلاً، بدلاً من أن يبدو أكبر منهم فقط على الورق.
