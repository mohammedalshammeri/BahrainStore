# خطة تطوير محرك قوالب البحرين ستور (Next-Gen Theme Engine)
**الهدف:** تحويل المنصة من نظام قوالب يعتمد على تغيير ألوان CSS إلى محرك قوالب ديناميكي قوي ينافس أسلوب Shopify (Online Store 2.0) ويتفوق عليه باستخدام تقنيات النشر المسبق والتصيير عبر الخادم (SSR / SSG) الخاص بـ Next.js.

## الحالة التنفيذية الحالية

- تم تنفيذ الأساس البنيوي فعلياً داخل المشروع، وليس فقط التخطيط له:
- يوجد بالفعل `ThemeAsset` و `StoreThemeConfig` و `StorePageTemplate` في قاعدة البيانات ويجري استخدامها runtime.
- الصفحة الرئيسية تعمل عبر template موحد مع fallback logic.
- تم الآن توسيع المحرك إلى صفحة المنتج وصفحات المحتوى العامة وصفحة المنتجات العامة وصفحات المدونة والسلة والدفع أيضاً، وأصبحت هذه الصفحات تُجلب عبر SSR أو عبر runtime section متخصصة وتُرندر من `SectionRenderer` بدلاً من صفحات client ثابتة.
- تم توسيع الـ builder ليحمّل ويحفظ `homepage` و `product` و `collection` و `blog` و `page` و `cart` و `checkout` عبر endpoints عامة للـ page templates.
- تمت إضافة sections متخصصة للمنتج (`product_detail`, `related_products`) ولصفحات المحتوى (`page_content`) ولصفحة المنتجات (`collection_header`, `collection_products`) وللمدونة (`blog_posts`, `blog_post_content`) وللسلة والدفع (`cart`, `checkout`) داخل الـ schema والـ metadata registry والـ storefront renderer.

## ما تم إنجازه من هذه الخطة الآن

1. تم تحقيق جزء مهم من المرحلة الأولى دون الحاجة إلى schema overhaul جديد، لأن الجداول الأساسية كانت موجودة وتم تفعيل استخدامها فعلياً.
2. تم تحقيق جزء محوري من المرحلة الثانية: الصفحة الرئيسية وصفحة المنتج وصفحة المنتجات وصفحات المدونة وصفحات المحتوى وصفحتا السلة والدفع أصبحت template-driven على نفس العقد.
3. تم تنفيذ الجزء الحرج من المرحلة الثالثة داخل الـ builder: iframe live preview حقيقي مع postMessage sync للصفحة الرئيسية وصفحة المنتج وصفحة المنتجات وصفحات المدونة وصفحات المحتوى وصفحتي السلة والدفع، مع تحميل صفحات storefront الفعلية داخل المحرر قبل الحفظ.
4. تم أيضاً إكمال إعدادات الثيم العامة داخل نفس الدورة: الألوان والخط والـ theme variant أصبحت قابلة للتعديل من الـ builder، تُبث مباشرة إلى iframe preview، وتُحفظ داخل backend على `StoreThemeConfig.settingsData` مع fallback legacy منظم.
5. لم تعد المرحلتان الرابعة والخامسة roadmap صرفة: توجد الآن حزمة ملفات تشغيلية مع validate/import/export، وواجهة Theme Store صارت تدعم install/activate/customize فعلياً، كما أصبح لدى admin CRUD وإجراءات مراجعة عاملة للثيمات. ما تزال licensing/updates المتقدمة وlocal dev tooling والـ linter الأمني العميق مراحل لاحقة.

---

## المرحلة الأولى: بناء هيكل البيانات المتقدم (Database Schema Overhaul)
**في هذه المرحلة سنتخلى عن الاعتماد على صفحات `page.tsx` الثابتة في الـ Storefront ونجعل تصميم كل صفحة مبنياً على JSON.**

*   **إنشاء جدول `ThemeFile` (أو `ThemeAsset`):**
    *   كل قالب سيحتوي على ملفات بصيغة JSON.
    *   `template.index.json` (للصفحة الرئيسية).
    *   `template.product.json` (لصفحة المنتج).
    *   `template.collection.json` (لصفحة التصنيفات).
*   **إنشاء جدول `StorePageCustomization`:**
    *   لحفظ التعديلات التي يجريها التاجر على قالب معين دون المساس بالملف الأساسي للقالب.
    *   يحتوي على: `storeId`, `themeId`, `pageType` (مثل product)، و `configuration` (JSON يحتوي على ترتيب الأقسام وإعداداتها الخاصة بالتاجر).
*   **إنشاء جدول `ThemeSchema`:**
    *   لتعريف المتغيرات القابلة للتعديل لكل قالب (الألوان، الخطوط، التباعد) والتي ستظهر في لوحة تحكم التاجر.

---

## المرحلة الثانية: واجهة المتجر الديناميكية (Dynamic Storefront Renderer)
**تعديل تطبيق الـ Storefront `app/[subdomain]/**/*` ليصبح محرك تصيير ذكي للـ JSON.**

*   **بناء مكون `<SectionRenderer>`:**
    *   مكون رئيسي يستقبل مصفوفة من الـ Sections (مستخرجة من قاعدة البيانات للتاجر الحالي).
    *   يقوم بعمل `Dynamic Import` لمكونات React (مثل `ProductInfo`, `Reviews`, `HeroBanner`, `FeaturedProducts`) بناءً على القالب المختار.
*   **تحويل الصفحات الثابتة:**
    *   بدلاً من تصميم صفحة المنتج `app/[subdomain]/products/[slug]/page.tsx` بشكل ثابت، ستقوم الصفحة بجلب الـ JSON الخاص بتخطيط صفحة المنتج لهذا القالب وهذا التاجر، ثم تمريره إلى `<SectionRenderer>`.
    *   هذا سيسمح للتاجر بإضافة أو إزالة أقسام في صفحة المنتج، السلة، الدفع، وأي صفحة أخرى (ميزة يتفوق بها Shopify 2.0).
*   **عزل الـ CSS (CSS CSS-in-JS أو Tailwind Scoping):**
    *   جعل الكلاسات ومتغيرات Tailwind مرتبطة بملف إعدادات القالب الديناميكي وتمريرها للصفحة كـ CSS Variables في الـ `Root Layout`.

---

## المرحلة الثالثة: المحرر المرئي الاحترافي (Advanced Visual Theme Editor)
**بناء محرر داخل الـ Dashboard يتجاوز ميزة "تعديل أقسام الرئيسية" الموجود حالياً.**

*   **متصفح القوالب الحي (Iframe Communication):**
    *   [x] فتح واجهة المتجر `storefront` داخل `iframe` في لوحة التحكم.
    *   [x] بناء نظام تراسل (postMessage API) لكي يرى التاجر التعديلات تظهر فوراً قبل الحفظ (Hot Reload).
*   **التنقل بين الصفحات أثناء التحرير:**
    *   [x] قائمة منسدلة أعلى المحرر تسمح للتاجر بالانتقال بين "الصفحة الرئيسية" و"صفحة المنتج" و"صفحة المنتجات" و"المدونة" و"صفحات المحتوى" و"السلة" و"الدفع" وتعديل الأقسام الخاصة بكل منها.
    *   [x] تم توسيع نفس الآلية إلى `collection/blog` مع معاينة حية على storefront.
*   **إعدادات القالب العامة (Theme Settings):**
    *   [x] تبويب فعلي داخل الـ builder لتغيير هوية المتجر بالكامل (الألوان الأولية، الثانوية، الخط، theme variant).
    *   [x] بث هذه الإعدادات مباشرة إلى storefront preview داخل الـ iframe قبل الحفظ.
    *   [x] حفظ هذه الإعدادات في backend ضمن `StoreThemeConfig.settingsData` مع fallback legacy منضبط عند غياب `themeConfig`.

---

## المرحلة الرابعة: نظام ملفات القوالب وحزمة المطورين (Theme Filesystem & CLI SDK)
**فتح المنصة للمطورين الخارجيين ليبنوا قوالبهم ويبيعوها في منصتك.**

*   **محرك القوالب كملفات (Filesystem Theme Engine):**
    *   [x] توجد الآن نواة تشغيلية لرفع ملف مضغوط `.zip` يحتوي على هيكلية مجلدات قياسية (حالياً manifest + templates + config نصية/JSON) ويتم التحقق منه واستيراده وتصديره عبر backend.
    *   [x] أصبحت لوحة admin تدعم فحص الحزمة واستيرادها وتصديرها من الواجهة نفسها فوق هذه الـ endpoints.
*   **أداة سطر الأوامر `Bazar CLI`:**
    *   [~] يوجد CLI أولي داخل `backend/sdk/js/theme-cli.mjs` لأوامر `validate`, `import`, `export` لحزم الثيم.
    *   [ ] ما يزال مسار `init theme` و `dev` المحلي الكامل مرحلة لاحقة.
*   **التحقق التلقائي (Theme Linter):**
    *   [x] يوجد تحقق بنيوي على manifest و templates و `config/settings_schema.json` داخل backend قبل الاستيراد.
    *   [ ] فحص أعمق للـ XSS والسياسات الأمنية داخل assets البرمجية يبقى مرحلة لاحقة.
*   **Versioning و Changelog داخل الحزمة:**
    *   [x] يتم الآن حفظ `version` و `changelog` داخل metadata/assets الخاصة بالثيم، وتستخدمها لوحة الإدارة والتاجر في التصدير والمزامنة.

---

## المرحلة الخامسة: متجر القوالب وإدارة التراخيص (Marketplace & Monetization)
**بناء اقتصاد حول المنصة.**

*   **مراجعة القوالب والموافقة:**
    *   [x] توجد الآن مراجعة تشغيلية عبر backend وdashboard: merchant يستطيع تثبيت/تفعيل/تخصيص القالب على متجره، وadmin يملك CRUD وموافقة/رفض/تمييز للثيمات من لوحة التحكم.
    *   [x] شاشة التاجر تعرض الآن license key وحالة وجود تحديث للحزمة المثبتة مع إجراء مزامنة مباشر.
*   **إدارة التحديثات (Theme Updates):**
    *   [x] أصبح النظام يحدد وجود تحديث عبر الفرق بين `installedVersion` على المتجر و`version` المتاح في package metadata، ويعرض changelog ويتيح مزامنة النسخة من dashboard.
    *   [ ] ما تزال إشعارات التحديث الرسمية وسجل releases المتعدد لكل ثيم مرحلة لاحقة.

---

## الخطوات الأولى للتنفيذ البرمجي (Action Plan):
1. **أولاً:** تم تفعيل الجداول الحالية فعلياً كطبقة page templates بدلاً من الاكتفاء بوجودها في schema.
2. **ثانياً:** تم ربط الصفحة الرئيسية وصفحة المنتج وصفحتي السلة والدفع بمحرك `<SectionRenderer>` وبعقد page template موحد.
3. **ثالثاً:** تم تنفيذ شاشة الـ Iframe داخل مجلد الـ `dashboard/builder` مع postMessage preview، ثم تم إكمال دورة إعدادات theme العامة داخل نفس المسار بحيث أصبحت الألوان والخط والـ variant حية داخل الـ preview ومخزنة في backend، مع دعم مباشر لمعاينة صفحة المنتجات وصفحات المدونة وصفحات المحتوى والسلة والدفع أيضاً.

## ������� ������� �������� (Enterprise-Grade Architecture):
1. ����� ThemeContext ������ ��������� ��� �������.
2. ����� SectionErrorBoundary ���� ����� �������.
3. ����� Loading fallback �������� �����������.
4. ����� ����� ������� (Registry) ��� Default � Theme-specific � Blocks.
5. ����� BlockRenderer ���� �������� ��������� (Nested blocks).
6. ����� SectionLayout ����� ������ �������� ���������.
7. ����� ���� ����� Zod ������ �� �������� (Schema Validation).
8. ����� ���������� Fallback resolution (Store -> Theme -> Hardcoded).
9. ����� Metadata registry ������ �� ���� ������ (Builder).
10. ����� ��������� ��� ������ �������� (Homepage) ������ ����.

