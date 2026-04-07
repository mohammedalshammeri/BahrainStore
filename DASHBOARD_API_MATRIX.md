# Dashboard API Matrix

هذا الملف يغطي الصفحات التشغيلية الأساسية في dashboard التي يجب أن تبقى مربوطة بعقود backend حقيقية.

## Merchant Dashboard

- Home: `/analytics/dashboard`, `/analytics/revenue`
- Analytics: `/analytics/dashboard`, `/analytics/revenue`, `/analytics/top-products`, `/analytics/:storeId/traffic`
- Header search: `/products`, `/orders`, `/customers`
- Orders: `/orders`, `/orders/:id`, `PATCH /orders/:id/status`
- Products: `/products`, `PATCH /products/:id`, `/products/:id/options/save`, `PATCH /products/:id/variants`
- POS: `/pos/products/search`, `/pos/products/barcode/:barcode`, `/pos/summary`, `/pos/checkout`
- Alerts: `/alerts`, `PATCH /alerts/:id/read`, `POST /alerts/read-all`
- Store stats and settings: `/stores/:id`, `/stores/:id/stats`, `PATCH /stores/:id`, `PATCH /stores/:id/settings`

## Admin Surfaces

- Admin themes: `/admin/themes`, `/admin/themes/stats`, `/admin/themes/import-package`, `/admin/themes/:id/export-package`, `/themes/validate-package`

## Rule

- أي صفحة تشغيلية جديدة لا تعتبر جاهزة إذا لم تُسجل هنا مع endpoint فعلي قائم في backend، أو إذا كانت تعتمد على mock data أو local-only state.