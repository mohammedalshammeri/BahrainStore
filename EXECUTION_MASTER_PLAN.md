# BahrainStore Execution Master Plan

## المبدأ الحاكم

هذا الملف ليس خطة تجميلية ولا قائمة أفكار.
هذا مرجع التنفيذ الأساسي للمشروع.

المعيار المعتمد من الآن:

- لا يوجد "مشي حالك"
- لا يوجد "حل مؤقت" بدون توثيق صريح
- لا يوجد "يكفي للإطلاق" إذا كان يفتح كسر في الطلبات أو الأمان أو البيانات
- أي جزء يدخل الإنتاج يجب أن يكون قابل للدفاع عنه هندسياً

## الهدف التنفيذي

الوصول إلى منصة قوية جداً وقابلة للإطلاق الحقيقي، وليس مجرد MVP هش.

العمل سيتم على ثلاث طبقات متوازية:

1. طبقة سلامة النظام
2. طبقة المعمارية الأساسية
3. طبقة الجاهزية التشغيلية

## الأولويات غير القابلة للتفاوض

### P0: موانع الإطلاق

هذه البنود تمنع الإطلاق حتى لو كانت بقية المنصة ممتازة:

1. [x] حماية تدفق الطلبات والمخزون من الانكسار تحت الضغط
2. [x] إغلاق ثغرة تتبع الطلبات العامة
3. [x] توحيد عقد الدفع بين الواجهة والباكند
4. [x] تثبيت نظام الثيم على عقد واحد بين runtime و builder
5. [x] وضع caching strategy واضحة للستورفرونت

### P1: تقوية المعمارية

1. فصل واضح بين البيانات العامة وبيانات التاجر والبيانات الحساسة
2. إزالة التضارب بين الأنظمة القديمة والجديدة
3. تقليل الاعتماد على fallbackات الطوارئ في المسارات الأساسية
4. جعل الـ builder يعكس النظام الحقيقي وليس نسخة legacy

### P2: الجاهزية التشغيلية

1. [x] صرامة env validation
2. وضوح health and failure handling
3. وضوح deployment contract لكل تطبيق
4. تقليل استهلاك الـ API في الصفحات عالية الحركة

## مسارات التنفيذ

## Track A: Orders, Inventory, Payment Contract

### الهدف

منع أي كسر مالي أو تشغيلي في إنشاء الطلب والدفع والمخزون.

### المهام

1. توحيد payment method contract بين storefront checkout و backend order creation
2. منع overselling عبر atomic stock update داخل transaction وبشروط تحقق داخل قاعدة البيانات
3. فصل order creation عن payment gateway dispatch بشكل أوضح
4. مراجعة حالات order status و payment status ومنع الانتقالات غير الصحيحة
5. توحيد تسمية methods بين order, payment, callback, verification

### Definition of Done

1. لا يمكن إنشاء طلب بقيمة payment method غير مدعومة فعلياً
2. لا يمكن خصم مخزون منتج إذا أصبح stock غير كافٍ أثناء المنافسة
3. كل بوابة مدعومة لها create, verify, callback contract ثابت وواضح
4. order status لا يتقدم إلى CONFIRMED أو PAID إلا عبر مسار صحيح

## Track B: Order Security and Public Access

### الهدف

منع كشف بيانات العملاء والطلبات من خلال روابط أو أرقام قابلة للتخمين.

### المهام

1. استبدال public tracking by orderNumber فقط بآلية signed tracking token أو customer-auth flow
2. تقليل البيانات الراجعة من public order tracking إلى الحد الأدنى
3. فصل merchant order views عن public customer views
4. مراجعة كل public routes المرتبطة بالطلبات والعملاء

### Definition of Done

1. لا يمكن الوصول لعنوان العميل أو هاتفه من public endpoint بدون صلاحية صحيحة
2. public tracking لا يعتمد على identifier قابل للتخمين وحده
3. responses العامة لا تحتوي بيانات زائدة

## Track C: Theme Engine Completion

### الهدف

تحويل نظام الثيم من runtime جيد إلى منصة ثيم كاملة وقوية فعلاً.

### المهام

1. توحيد العقد بين backend template payload و dashboard builder
2. نقل الـ builder من blocks legacy إلى sections, settings, layout, nested blocks
3. ربط metadata registry فعلياً داخل dashboard builder
4. إكمال block coverage أو إزالة الأنواع غير المنفذة من schema
5. تفعيل theme-specific overrides الحقيقية بدل registry فارغة
6. توسيع نفس العقد إلى صفحات storefront الحرجة بعد تثبيت الصفحة الرئيسية

### Definition of Done

1. builder يقرأ ويحفظ template موحداً وليس blocks قديمة
2. runtime و builder يستخدمان نفس schema ونفس field model
3. لا توجد أنواع blocks أو sections معرفة وغير قابلة للرندر فعلياً
4. merchant يستطيع تعديل homepage من النظام الجديد بالكامل

الحالة الحالية: تم تجاوز homepage-only فعلياً. أصبح backend يدعم page templates عامة للصفحة الرئيسية وصفحة المنتج وصفحتي السلة والدفع، وأصبح storefront يرندر هذه الصفحات عبر SectionRenderer وtemplate contract بدلاً من صفحات client ثابتة. كما تم توسيع الـ builder ليتعامل مع homepage وproduct وcart وcheckout على نفس العقد، وتمت إضافة أقسام product_detail وrelated_products وcart وcheckout مع SSR data flow مباشر. تم كذلك تنفيذ المعاينة الحية داخل الـ builder عبر iframe حقيقي على storefront مع postMessage preview آمن ومقيد بالأصل، وأصبح التاجر يرى تعديلات homepage وproduct وcart وcheckout قبل الحفظ على الواجهة الفعلية. وتم إكمال طبقة إعدادات الثيم العامة أيضاً: ألوان وهوية الخط والـ theme variant أصبحت تُعدل من الـ builder، تُبث فورياً إلى storefront preview، وتُحفظ في `StoreThemeConfig.settingsData` مع fallback legacy منظم. ما تزال طبقات filesystem/CLI/marketplace وصفحات مثل collection/blog/pages ضمن مراحل لاحقة، لكنه لم يعد هناك قفل معماري يمنع الوصول إليها.
الحالة الحالية: تم تجاوز homepage-only فعلياً. أصبح backend يدعم page templates عامة للصفحة الرئيسية وصفحة المنتج وصفحة المنتجات العامة وصفحة المحتوى العامة وصفحتي السلة والدفع وصفحات المدونة، وأصبح storefront يرندر هذه المسارات عبر SectionRenderer وtemplate contract بدلاً من صفحات client ثابتة. كما تم توسيع الـ builder ليتعامل مع homepage وproduct وcollection وblog وpage وcart وcheckout على نفس العقد، وتمت إضافة أقسام product_detail وrelated_products وcollection_header وcollection_products وblog_posts وblog_post_content وcart وcheckout وpage_content مع data flow مباشر. وتم كذلك تنفيذ المعاينة الحية داخل الـ builder عبر iframe حقيقي على storefront مع postMessage preview آمن ومقيد بالأصل، وأصبح التاجر يرى تعديلات homepage وproduct وcollection وblog وpage وcart وcheckout قبل الحفظ على الواجهة الفعلية. وتم إكمال طبقة إعدادات الثيم العامة أيضاً: ألوان وهوية الخط والـ theme variant أصبحت تُعدل من الـ builder، تُبث فورياً إلى storefront preview، وتُحفظ في `StoreThemeConfig.settingsData` مع fallback legacy منظم. ولم تعد المرحلة الرابعة نظرية بالكامل: أصبح backend يدعم validate/import/export لحزم القوالب بصيغة zip مع `ThemeAsset`، وتمت إضافة CLI أولي للمطورين داخل `backend/sdk/js/theme-cli.mjs`، وأصبحت لوحة admin نفسها تدعم validate/import/export للحزم. كما أصبحت شريحة marketplace والتراخيص والتحديثات عملية فعلاً: merchant يثبت القالب ويُفعّله ويطبّق quick customization من dashboard، ويحفظ `installedVersion` داخل `StoreThemeConfig.settingsData`، ويرى license key والنسخة المثبتة والنسخة المتاحة وchangelog مع مزامنة مباشرة، وadmin يملك CRUD وموافقة/رفض/تمييز وتصدير للحزم مع تحرير version/changelog. ما تزال إشعارات التحديث الرسمية وسجل releases متعدد الإصدارات مرحلة لاحقة، لكنه لم يعد هناك قفل معماري يمنع الوصول إليها.

## Track D: Storefront Performance and Caching

### الهدف

تقليل الضغط على الباكند وتحسين الاستقرار تحت الترافيك.

### المهام

1. تحديد الصفحات dynamic والصفحات القابلة لـ revalidate بوضوح
2. تقليل تكرار جلب store/homepage data بين layout والصفحات
3. وضع caching strategy للبيانات العامة: store, homepage, categories, product pages, blog
4. مراجعة client fetches غير الضرورية في الصفحات الحساسة
5. تقييم أين نحتاج server fetch native بدل axios داخل server components

### Definition of Done

1. كل صفحة رئيسية لها سياسة cache/revalidate واضحة
2. لا يوجد تكرار غير مبرر لنفس الـ API calls في نفس request path
3. homepage و product pages لا تعتمد على fetch عشوائي بدون policy

## Track E: Auth and Operational Hardening

### الهدف

رفع صلابة المنصة إدارياً وتشغيلياً قبل الإطلاق.

### المهام

1. مراجعة تخزين access/refresh tokens في dashboard
2. تطبيق فعلي لسياسات SecuritySettings المهمة أو إزالة الحقول غير المطبقة
3. إضافة startup env validation للمتغيرات الحرجة
4. مراجعة public/admin auth boundaries
5. مراجعة webhook authenticity لكل integrations التي تعتمد callbacks

الحالة الحالية: تم تحويل Tap order webhooks و Tap subscription callbacks إلى مسار تحقق من البوابة نفسها قبل أي تحديث مالي، وتم منع BenefitPay من قبول callback بلا توقيع. تم أيضاً تأكيد أن backend build أخضر بعد هذه التعديلات. Stripe ليس ضمن نطاق الإطلاق الحالي للسوق السعودي/الخليجي ولن يكون أولوية تنفيذية الآن. كما تم تنظيف checkout الظاهر للعميل ليعرض فقط وسائل الدفع الموصولة فعلياً. تم كذلك تحويل PayTabs وPostpay وTamara إلى نمط verification-first قبل أي تحديث مالي. وتم إصلاح تحذيرات Next 16 الخاصة بـ themeColor بنقلها إلى viewport export، وأصبح storefront build أخضر. حاولنا تنفيذ sandbox smoke test للبوابات الخليجية من البيئة الحالية، لكن قاعدة البيانات المحلية لا تحتوي أي store settings مفعلة أو مزودة باعتمادات لـ Tamara أو PayTabs أو Postpay، لذلك تعذر تنفيذ اختبار gateway حي فعلياً من هذا الجهاز حالياً. يبقى هذا البند مفتوحاً فقط إذا ظهر Gateway خليجي إضافي ضمن نطاق الإطلاق ولم يُراجع بعد، أو عند توفير اعتمادات sandbox وربط callback فعلي للاختبار.

### Definition of Done

1. لا توجد secrets أو token flows ضعيفة بوضوح في المسارات الإدارية
2. security settings ليست مجرد حقول محفوظة بدون enforcement
3. التطبيق يفشل مبكراً إذا كانت envs الحرجة ناقصة

## ترتيب التنفيذ المقترح

### المرحلة 1: تثبيت الإطلاق

1. Orders and inventory integrity
2. Public order tracking security
3. Payment contract cleanup

### المرحلة 2: تثبيت الثيم فعلياً

1. Builder migration
2. Metadata integration
3. Registry completion

### المرحلة 3: الأداء والتشغيل

1. Storefront caching
2. Auth hardening
3. Env and deployment discipline

## قائمة المهام التنفيذية المباشرة

### Sprint 1

1. [x] إصلاح payment method mismatch بين checkout و create order
2. [x] تصميم وتنفيذ secure order tracking flow
3. [x] إصلاح stock race conditions

### Sprint 2

1. [x] نقل builder إلى template model الجديد
2. [x] ربط metadata registry بالـ builder UI
3. [x] إنهاء block type consistency

### Sprint 3

1. [x] بناء caching strategy للستورفرونت
2. [x] تقليل duplicated fetching
3. [x] تقوية auth/admin token handling
4. [x] تنفيذ live iframe preview داخل theme builder للصفحة الرئيسية وصفحة المنتج
5. [x] تنفيذ live theme settings editing مع حفظ backend وبث مباشر إلى storefront preview
6. [x] توسيع نفس العقد والمعاينة الحية إلى cart و checkout

### Sprint 4

1. [x] ربط dashboard analytics والصفحة الرئيسية ببيانات حقيقية بدل mock data
2. [x] إضافة endpoints تحليلات تشغيلية موحدة للداشبورد والجوال
3. [x] إصلاح POS checkout و barcode flows المتوقعة من الجوال
4. [x] توفيق عقود orders/products/alerts الأساسية داخل mobile API مع backend
5. [x] إكمال مطابقة جميع شاشات الجوال غير الحرجة وتحديد الجاهز للإطلاق

الحالة الحالية لسبرنت 4: تم إغلاق فجوات الجوال المتبقية التي كانت تعطي انطباعاً مضللاً أو تفشل على backend حقيقي. أصبح الجوال يجلب تفاصيل المنتج عبر مسار merchant-safe حتى للمنتجات غير النشطة، وتمت مواءمة شاشة إعدادات المتجر مع schema الحقيقي بدل محاولة حفظ `phone` غير الموجود في قاعدة البيانات، وتم تقييد alerts routes بملكية المتجر فعلياً، كما تم تعطيل تسجيل Expo push token كمسار no-op صريح إلى أن توجد طبقة backend مخصصة له. وتم توثيق جاهزية الشاشات وmatrix مسارات الداشبورد الأساسية في ملفات مرجعية مستقلة حتى لا تبقى حالة الإطلاق ضمنية.

تحديث لاحق بعد سبرنت 4: تم إغلاق ثغرتين إضافيتين من نفس فئة multi-tenant ownership في backend، إذ أصبحت finance routes تتحقق من ملكية المتجر قبل إرجاع summary أو vat report أو export، كما أصبحت email-marketing routes تتحقق من ملكية المتجر والحملة والمشترك قبل القراءة أو التعديل أو الإرسال أو الإلغاء. هذا لا يعني إغلاق بند ownership gaps بالكامل بعد، لكنه يقلل مساحة المخاطر في المسارات التشغيلية التي يستخدمها التاجر مباشرة.

تحديث لاحق إضافي: تم إغلاق دفعة أخرى من نفس الفئة في المسارات التي يلمسها التاجر يومياً، فأصبحت upsell/countdown routes تفرض ملكية المتجر على القراءة والإنشاء والتعديل والحذف، وأصبحت POS routes تتحقق من ملكية session/store قبل عرض الجلسات أو إغلاقها أو إنشاء الطلبات أو جلب الطلبات والمنتجات، كما تم تقييد `GET /import/jobs/:id` بملكية التاجر بدلاً من كشف حالة أي مهمة استيراد عبر المعرّف فقط.

تحديث أخير ضمن نفس المسار: تم أيضاً فرض ownership checks على restaurant routes المصادَق عليها، بما يشمل tables وkitchen وorders وstats، بحيث لم يعد بالإمكان قراءة أو تعديل موارد المطعم عبر `storeId` أو `table/order id` فقط من دون أن تكون تابعة فعلاً للتاجر الحالي.

تحديث أحدث في نفس السلسلة: تم تقييد BenefitPay merchant routes بملكية الطلب/المتجر/مرجع الدفع، فلم يعد ممكناً initiate أو verify أو query status لطلبات لا تخص التاجر الحالي. كما تم إصلاح bazar-finance routes لتأخذ merchant identity من الجلسة بدلاً من body، مع قصر approve وdisburse وdashboard على المشرفين فقط والتحقق من ملكية المتجر أو القرض في بقية المسارات.

تحديث إضافي أخير في نفس خط العمل: تم توحيد ownership enforcement في pages وblog وflash-sales عبر lookup مباشر يربط المورد بالتاجر من البداية، بدلاً من نمط جلب المورد أولاً ثم فحص `storeId` في خطوة ثانية. النتيجة أن مسارات المحتوى والعروض الموسمية أصبحت متسقة مع بقية طبقة الحماية multi-tenant في backend.

## قواعد العمل أثناء التنفيذ

1. لا نغلق مهمة قبل وجود Definition of Done واضح
2. لا نضيف feature جديدة فوق مسار مكسور أساساً
3. أي legacy path يبقى فقط إذا كان له سبب واضح وخطة إزالة
4. أي fallback مؤقت يجب أن يكون معزولاً وغير معتمد كمسار أساسي
5. أي جزء غير مكتمل بوضوح يتم وصفه كـ NOT READY وليس "لاحقاً"

## طريقة المتابعة بيننا

في كل خطوة تنفيذية سنعمل بهذا الشكل:

1. نحدد المسار الحالي
2. نثبت الواقع من الكود
3. ننفذ أصغر مجموعة تغييرات قوية تكمل المسار من الجذر
4. نتحقق build أو diagnostics
5. نغلق المهمة فقط إذا أصبحت صلبة فعلاً

## القرار التنفيذي الحالي

من الآن فصاعداً التركيز سيكون على:

1. سلامة الطلبات والمخزون
2. أمان الوصول العام للطلبات
3. توحيد theme builder مع theme runtime
4. رفع صلابة storefront تحت الحمل

هذا هو المسار الصحيح إذا كان الهدف منصة قوية جداً.
أي انحراف عنه سيعيدنا إلى حلول متوسطة، وهذا غير مقبول.