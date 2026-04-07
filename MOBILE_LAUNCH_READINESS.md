# Mobile Launch Readiness

هذا الملف يصف حالة تطبيق التاجر على الجوال بعد مواءمة العقود الفعلية مع backend الحالي، وليس بناءً على افتراضات UI فقط.

## Ready

- Dashboard: يعتمد على `/analytics/dashboard` و`/analytics/revenue` بعد توحيد shape البيانات.
- Analytics: يعتمد على `/analytics/dashboard` و`/analytics/revenue` و`/analytics/top-products`.
- Orders list/detail/status: يعتمد على `/orders` و`/orders/:id` و`PATCH /orders/:id/status`.
- Products list/create/edit/detail: يعتمد على `/products` و`/products/:id/merchant` و`PATCH /products/:id`.
- Inventory adjust: يعتمد على `POST /inventory/adjust`.
- POS: يعتمد على `/pos/products/search` و`/pos/products/barcode/:barcode` و`/pos/summary` و`/pos/checkout`.
- Notifications inbox: يعتمد على `/alerts` و`PATCH /alerts/:id/read` و`POST /alerts/read-all` مع ownership enforcement على backend.
- Store basic settings: تعديل اسم المتجر فقط عبر `PATCH /stores/:id`.

## Truthful But Limited

- Store settings: التطبيق لا يعرض تحرير `phone` لأن هذا الحقل غير موجود في `Store` أو `StoreSettings` داخل Prisma حالياً.
- Notification preferences: أزيلت مفاتيح التبديل المحلية لأنها لم تكن محفوظة أو مطبقة على backend.

## Not Ready

- Mobile push registration: التطبيق يستخرج Expo push token، لكن backend الحالي يملك نموذج web-push فقط (`PushSubscription` مع `endpoint` و`p256dh` و`auth`). لذلك تم تحويل التسجيل إلى no-op صريح حتى لا يفشل بصمت وكأنه مدعوم.

## Release Gate

- لا تعاد واجهة مفاتيح push أو notification preferences المحلية قبل وجود backend contract صريح لتخزين Expo tokens وإرسال الإشعارات لها.
- أي شاشة جديدة في الجوال يجب أن تُصنف قبل الإطلاق إلى `Ready` أو `Truthful But Limited` أو `Not Ready` بنفس هذا النمط.