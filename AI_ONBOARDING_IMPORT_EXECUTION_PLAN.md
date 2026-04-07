# خطة التنفيذ الكاملة: AI-Powered Onboarding And Import Engine

هذه الخطة مخصصة للبند التالي من خطة القيادة السوقية:

- جعل onboarding/import أسرع وأذكى من المنافسين.

هذه الخطة لا تصف MVP ولا نسخة جزئية.
هذه الخطة تصف التنفيذ الكامل القابل للإطلاق الحقيقي والمنافسة الفعلية.

## حالة التنفيذ الحالية

آخر تحديث: 2026-04-08

### ما تم تنفيذه فعلياً

1. بناء طبقة AI مشتركة صادقة في الجاهزية والحالة التشغيلية، بدون fallback مضلل عند غياب الإعداد.
2. بناء onboarding workspace كامل في backend وdashboard مع draft generation وحفظ واسترجاع وتطبيق صريح بعد المراجعة.
3. بناء import engine حقيقي يدعم CSV وExcel مع preview artifact محفوظ، وapproval gate قبل التنفيذ.
4. بناء import job lifecycle عملي مع preview, approve, background execution, report, cancellation.
5. إضافة remediation report وqueue داخل backend وربطها بواجهة dashboard.
6. إضافة audit trail أساسي لمسارات preview, approve, complete, cancel.
7. إضافة contract coverage واختبارات عزل سلبية لمسارات import الأساسية، مع نجاح suite التشغيلية الحالية.

### ما يزال مفتوحاً قبل اعتبار المسار منجزاً بالكامل

1. AI session model وconversation scope المعزولان بشكل صريح ما زالا بحاجة إلى إغلاق كامل.
2. source adapters للروابط والمنصات الخارجية ما زالت غير مكتملة.
3. mapping review المتقدم وapprove selected أو reject selected لم يكتمل بعد.
4. resume/retry الحقيقي للفشل الجزئي ما زال يحتاج تنفيذ تشغيلي كامل.
5. observability الإدارية وتكلفة workflows وprompt metadata ما زالت ناقصة.
6. dashboard tests وsmoke flow end-to-end ما زالا غير مغلقين.

## 1. الهدف التنفيذي

بناء نظام ذكاء اصطناعي كامل يساعد التاجر من أول دقيقة في:

1. فهم نشاطه التجاري.
2. تجهيز إعدادات متجره تلقائياً بشكل صحيح.
3. استيراد بياناته من ملفات أو روابط أو منصات أخرى.
4. تنظيف الكتالوج وتصحيح الأخطاء قبل الحفظ.
5. إعطاء Preview واضح قبل التنفيذ.
6. تنفيذ Import حقيقي آمن ومعزول بين التجار.
7. إصدار تقرير نهائي بعد الاستيراد يشرح ما تم وما فشل وما يحتاج مراجعة.

## 2. المبدأ الحاكم

هذا المسار لا يعتبر منجزاً إذا كان:

1. يعتمد على demo أو mock أو fallback مضلل.
2. يسمح باختلاط بيانات التجار.
3. ينفذ كتابة مباشرة بدون review gate واضح.
4. يدعم نوع import واحد فقط مع ادعاء الشمول.
5. لا يملك audit trail وتقرير أخطاء واسترجاع واضح.

## 3. تعريف المنتج النهائي

المنتج النهائي هنا هو:

AI assistant خاص بكل تاجر يساعده في onboarding والاستيراد والتحسين الأولي للمتجر، مع isolation كامل، وقرارات قابلة للمراجعة، وتنفيذ end-to-end حقيقي.

## 4. ما الذي يجب أن يفعله النظام عند الاكتمال

### 4.1 Onboarding الذكي

يجب أن يستطيع التاجر:

1. بدء onboarding conversational بالعربية أو الإنجليزية.
2. اختيار نوع النشاط التجاري.
3. تزويد النظام بمعلومات الشحن والدفع والدولة والعملة والضرائب والسياسات.
4. الحصول على إعدادات متجر مقترحة جاهزة للمراجعة.
5. رؤية why this recommendation لكل إعداد مهم.
6. اعتماد الإعدادات أو تعديلها قبل الحفظ.

### 4.2 Import الذكي

يجب أن يستطيع التاجر:

1. رفع CSV أو Excel.
2. تزويد رابط متجره السابق عند وجود connector مدعوم.
3. استيراد منتجات مع صور ومتغيرات وأسعار ومخزون وتصنيفات ووسوم.
4. رؤية mapping ذكي للأعمدة بدلاً من mapping يدوي فقط.
5. رؤية تنبيهات قبل التنفيذ: أعمدة مفقودة، أسعار غير صالحة، صور فاشلة، duplicate SKUs، تصنيفات غير متناسقة.
6. تنفيذ import فعلي مع progress وتتبع job واضح.

### 4.3 تحسين الكتالوج بعد الاستيراد

يجب أن يستطيع النظام:

1. اقتراح أسماء أفضل للمنتجات.
2. اقتراح أوصاف أنظف وأقصر وأوضح.
3. توحيد التصنيفات والوسوم.
4. اكتشاف المنتجات المكررة أو شبه المكررة.
5. اقتراح متغيرات عندما تكون البيانات غير منظمة.
6. اكتشاف القيم الشاذة مثل سعر صفر أو مخزون سالب أو صور مكسورة.

### 4.4 التقرير النهائي

بعد كل onboarding/import يجب أن يحصل التاجر على:

1. Summary واضح.
2. عدد السجلات الناجحة.
3. عدد السجلات التي تحتاج مراجعة.
4. عدد السجلات الفاشلة مع السبب.
5. قائمة إصلاحات مقترحة.
6. CTA مباشرة لإكمال النواقص.

## 5. العزل والأمان

هذا المسار يسقط بالكامل إذا لم يكن العزل صحيحاً.

### 5.1 قواعد العزل الإلزامية

1. كل request إلى AI أو import يأخذ merchant identity من session فقط.
2. لا يعتمد النظام على storeId قادم من body وحده.
3. كل data fetch يمر عبر ownership-scoped queries.
4. أي embeddings أو vector storage يجب أن تكون namespaced لكل merchant/store.
5. لا يسمح بأي prompt أو retrieval يخلط بيانات متجرين.
6. كل job import يجب أن يكون مربوطاً بمالك واضح وبصلاحيات واضحة.

### 5.2 قواعد التنفيذ الآمن

1. AI لا ينفذ مباشرة إلى database بدون preview وموافقة.
2. الحفظ النهائي يحصل بعد explicit confirmation.
3. كل عملية import تملك audit log.
4. كل عملية import قابلة للتعقب والاستئناف أو الإلغاء حسب المرحلة.
5. عند غياب AI provider أو credentials أو source data الجاهزة يجب إرجاع NOT_READY أو validation error صريح.

## 6. المسارات التنفيذية

## Track A: AI Session And Merchant Isolation

### الهدف

بناء طبقة AI آمنة لا يمكنها قراءة أو تلويث بيانات تاجر آخر.

### المهام

- [ ] تعريف AI session model مربوط بالتاجر والمتجر.
- [ ] تعريف conversation scope واضح لكل onboarding/import workflow.
- [x] منع أي store selection خارج ملكية التاجر.
- [ ] بناء retrieval layer مع merchant/store namespace صريح.
- [ ] توثيق security rules الخاصة بالـ AI context.
- [ ] إضافة اختبارات cross-tenant سلبية لمسارات AI/import.

ملاحظة التنفيذ الحالية: تم إغلاق ownership checks السلبية لمسارات import/jobs/previews، لكن عزل AI session نفسه ما زال يحتاج إغلاقاً صريحاً على مستوى model وretrieval.

### Definition of Done

1. لا يمكن لأي merchant الوصول لسياق AI أو jobs أو previews تخص merchant آخر.
2. كل prompt context وimport job مثبت ownership له باختبارات.

## Track B: AI Onboarding Assistant

### الهدف

تحويل onboarding من فورمات مشتتة إلى guided setup ذكي.

### المهام

- [x] بناء onboarding conversation contract في backend.
- [x] تعريف structured questions حسب نوع النشاط.
- [x] توليد store setup draft: name, category, shipping model, payment recommendations, policies, currency, locale.
- [ ] توليد checklist مخصصة للتاجر قبل النشر.
- [x] حفظ draft onboarding وإمكانية العودة له.
- [x] بناء dashboard onboarding workspace كامل وليس modal بسيط.
- [ ] دعم العربية والإنجليزية بنفس الجودة.

### Definition of Done

1. التاجر يستطيع إكمال onboarding مدعوماً بالـ AI حتى الحصول على store draft جاهز.
2. كل recommendation لها justification واضح ويمكن قبولها أو تعديلها.

## Track C: Import Ingestion And Source Adapters

### الهدف

دعم استيراد حقيقي من مصادر متعددة مع contracts واضحة.

### المهام

- [x] دعم CSV import الكامل.
- [x] دعم Excel import الكامل.
- [ ] دعم source adapter architecture للروابط أو المنصات المدعومة لاحقاً.
- [x] بناء upload pipeline آمن للملفات.
- [x] استخراج الصور والـ metadata وربطها بالصفوف.
- [x] بناء import job lifecycle: uploaded, parsing, mapped, previewed, approved, importing, completed, failed.
- [x] حفظ artifacts الخاصة بكل job للمراجعة اللاحقة.

### Definition of Done

1. الملفات الشائعة تُرفع وتُحلل وتنتقل إلى preview صالح.
2. النظام لا ينهار عند أعمدة ناقصة أو malformed rows بل يعطي errors مفهومة.

## Track D: AI Mapping, Classification, And Cleanup

### الهدف

جعل AI هو طبقة الفهم والتنظيف لا مجرد chat جانبي.

### المهام

- [x] بناء column mapping engine يعتمد على AI + قواعد ثابتة.
- [x] اكتشاف title/description/price/sku/stock/image/category/variant fields تلقائياً.
- [ ] بناء category normalization engine.
- [x] بناء duplicate detection engine.
- [ ] بناء variant grouping engine للمنتجات متعددة الخيارات.
- [ ] بناء content cleanup engine للوصف والعناوين.
- [ ] بناء confidence score لكل قرار AI.

ملاحظة التنفيذ الحالية: يوجد mapping ذكي فعلي وتحذيرات duplicate ومشاكل الصور والصفوف المحجوبة، لكن طبقة cleanup والتصنيف والثقة ما زالت غير مكتملة بالشكل النهائي المطلوب.

### Definition of Done

1. النظام ينتج mapping واضح لكل عمود أو يصرّح بعدم الثقة.
2. القرارات منخفضة الثقة تُرفع للمراجعة بدلاً من التنفيذ الصامت.

## Track E: Preview, Approval, And Execution UX

### الهدف

إعطاء التاجر رؤية كاملة قبل تنفيذ أي تغيير.

### المهام

- [x] بناء preview grid للصفوف قبل الحفظ.
- [x] تمييز rows: valid, warning, blocked.
- [ ] إظهار original value مقابل normalized value.
- [ ] إظهار why changed لكل قرار AI مهم.
- [ ] دعم approve all / approve selected / reject selected.
- [ ] تنفيذ import batch-by-batch مع progress حي.
- [ ] دعم resume/retry للفشل الجزئي.

ملاحظة التنفيذ الحالية: approve all والتنفيذ الخلفي متاحان عملياً، لكن review granularity والتنفيذ الدفعي الحي وresume/retry ما زالت تحتاج إكمالاً.

### Definition of Done

1. لا توجد كتابة صامتة إلى database.
2. التاجر يستطيع فهم ما الذي سيتغير قبل التنفيذ.

## Track F: Post-Import Audit And Remediation

### الهدف

تحويل نهاية الاستيراد إلى actionable cleanup workflow.

### المهام

- [x] بناء final import report.
- [x] بناء remediation queue للأخطاء المتبقية.
- [ ] اقتراحات AI بعد الاستيراد: missing images, weak titles, missing prices, duplicate variants.
- [x] CTA مباشرة لإصلاح المنتجات المتأثرة.
- [ ] ربط التقرير بصفحات products/categories/inventory داخل dashboard.

ملاحظة التنفيذ الحالية: remediation workspace صار موجوداً داخل import dashboard، لكن الربط التشغيلي العميق مع صفحات products/categories/inventory لم يُغلق بعد.

### Definition of Done

1. بعد كل import يحصل التاجر على report واضح وقابل للتنفيذ.
2. الأخطاء لا تختفي داخل logs فقط بل تظهر في UX تشغيلي واضح.

## Track G: Observability, Cost, And Governance

### الهدف

ضبط AI/import كمنظومة تشغيلية وليست black box.

### المهام

- [ ] تسجيل prompt/response metadata بدون تسريب بيانات حساسة.
- [ ] حساب التكلفة لكل workflow أو merchant عند الحاجة.
- [ ] تسجيل confidence metrics وfailure reasons.
- [ ] health checks لمسارات import والـ queues.
- [ ] admin observability للـ AI/import jobs.

ملاحظة التنفيذ الحالية: يوجد audit trail تشغيلي أساسي لـ import lifecycle، لكنه لا يكفي بعد لإغلاق هذا المسار كمنظومة observability كاملة.

### Definition of Done

1. يمكن معرفة لماذا فشل import ولماذا اتخذ AI قراراً معيناً.
2. توجد مؤشرات تشغيلية تمنع الانهيار الصامت أو التكلفة المنفلتة.

## Track H: Contracts, Testing, And Release Gates

### الهدف

منع regression في أخطر مسار من حيث البيانات.

### المهام

- [x] API contract tests لمسارات onboarding/import.
- [ ] integration tests لرفع الملفات وتحليلها وتنفيذ preview.
- [x] negative tests لعزل التجار.
- [ ] validation tests للـ malformed files.
- [ ] dashboard tests لمسارات preview/approve/import report.
- [ ] smoke test حقيقي لتدفق onboarding ثم import ثم post-import audit.

ملاحظة التنفيذ الحالية: contract suite التشغيلية الحالية تغطي onboarding/import/remediation والعزل الأساسي، لكن ما زال يلزم dashboard coverage وsmoke flow حقيقي قبل الإغلاق النهائي.

### Definition of Done

1. لا يتم إغلاق هذا البند بدون contract coverage واختبارات عزل وتشغيل.
2. المسار end-to-end يمر على بيئة حقيقية بنجاح.

## 7. مكونات النظام المطلوبة

### Backend

- AI orchestration routes.
- onboarding recommendation engine.
- import parsing pipeline.
- mapping and normalization services.
- import job processor.
- post-import audit services.
- audit and observability hooks.

### Dashboard

- onboarding workspace.
- import upload center.
- mapping review UI.
- preview and approval UI.
- job progress UI.
- final report and remediation workspace.

### Mobile

- ليس شرطاً أن يملك كل workflow في النسخة الأولى من هذا المسار.
- لكن يجب أن يملك على الأقل visibility للحالة النهائية أو progress إذا قرر المنتج ذلك.

## 8. تعريف الإنجاز الكامل

لا نعتبر هذا البند منجزاً إلا إذا تحقق الآتي:

1. onboarding الذكي يعمل end-to-end.
2. import الذكي يعمل end-to-end من ملفات حقيقية.
3. AI يساعد فعلاً في mapping والتنظيف والتصنيف.
4. لا يوجد خلط بيانات بين التجار.
5. يوجد preview وموافقة قبل التنفيذ.
6. يوجد final report وremediation queue.
7. توجد اختبارات contracts + integration + isolation.
8. لا توجد fake responses أو fallbacks مضللة عند غياب الجاهزية.

## 9. ترتيب التنفيذ الإجباري

1. العزل والأمان.
2. import job architecture.
3. AI mapping and normalization.
4. onboarding assistant الكامل.
5. preview and approval UX.
6. post-import audit.
7. observability and release gates.

## 10. القرار التنفيذي

هذا المسار يجب تنفيذه كمنظومة كاملة اسمها:

AI-powered merchant onboarding and import engine

وليس كميزة صغيرة داخل onboarding فقط.

ولا يتم وضع علامة [x] عليه إلا بعد أن يصبح:

1. حقيقياً.
2. آمناً.
3. معزولاً بين التجار.
4. قابلاً للتشغيل اليومي.
5. قابلاً للدفاع عنه هندسياً أمام أي منافس.