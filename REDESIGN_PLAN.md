# خطة إعادة تصميم لوحة تحكم التجار — بزار
> الهدف: تجاوز سلة، زد، وشوبفاي في التصميم والتجربة

---

## أولاً — تحليل المنافسين وأين نتفوق عليهم

| المنصة | نقاط ضعف التصميم | ما سنفعله أحسن |
|---|---|---|
| **سلة** | ألوان باردة، قوائم مسطحة، كثافة بصرية عالية، لا animations | تدرجات حية، مجموعات قابلة للطي، micro-interactions على كل عنصر |
| **زد** | تصميم مؤسسي جاف، spacing ضيق، sidebar ثقيل | فضاء واسع، بطاقات بأبعاد مريحة، glassmorphism خفيف |
| **شوبفاي** | موجه للغرب، ضعيف في RTL، data tables معقدة | RTL أصيل بالكامل، Arabic-first typography، UX مبسط |

---

## ثانياً — نظام التصميم الجديد (Design Tokens)

### الألوان
```css
/* Brand */
--brand-500: #6366f1     /* Indigo - اللون الرئيسي */
--brand-600: #4f46e5
--brand-gradient: linear-gradient(135deg, #6366f1, #8b5cf6)  /* Indigo → Violet */

/* Surfaces — طبقات الواجهة */
--surface-0: #ffffff      /* أبيض نقي — البطاقات */
--surface-1: #f8fafc      /* خلفية الصفحة */
--surface-2: #f1f5f9      /* الصفوف المتناوبة */
--surface-glass: rgba(255,255,255,0.7)  /* Glass effect */

/* Sidebar */
--sidebar: #0f0c29        /* Deep indigo-black */
--sidebar-mid: #1e1b4b
--sidebar-glow: rgba(99,102,241,0.15)  /* Glow حول العنصر النشط */

/* Status */
--success: #10b981
--warning: #f59e0b
--danger: #ef4444
--info: #3b82f6
--purple: #8b5cf6
```

### الخط
```css
/* عرض على جميع الصفحات */
font-family: "IBM Plex Sans Arabic", "Tajawal", system-ui

/* أحجام متسقة */
--text-xs: 11px    /* labels, badges */
--text-sm: 13px    /* body text */
--text-base: 14px  /* default */
--text-lg: 16px    /* section titles */
--text-xl: 20px    /* page titles */
--text-2xl: 28px   /* KPI numbers */
--text-3xl: 36px   /* hero numbers */
```

### الظلال (Shadows)
```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04)
--shadow-sm: 0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md: 0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)
--shadow-lg: 0 8px 32px rgba(0,0,0,0.12)
--shadow-brand: 0 4px 20px rgba(99,102,241,0.3)   /* Brand colored glow */
--shadow-glass: 0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)
```

### الحركات (Motion)
```css
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)  /* Spring bounce */
--duration-fast: 120ms
--duration-base: 200ms
--duration-slow: 350ms
```

---

## ثالثاً — المكونات الجديدة (Components)

### 1. `Card` — بطاقة محسّنة
- خلفية بيضاء + shadow-sm
- Hover: shadow-md + ارتفاع 1px (translateY -1px)
- حواف border-radius: 16px
- `GlassCard` variant: backdrop-blur + شفافية

### 2. `StatCard` — بطاقة الإحصاء
- رقم ضخم `3xl font-bold`
- Sparkline mini-chart (7 نقاط) بجانب الرقم
- أيقونة ملونة بخلفية gradient خفيفة
- شريط progress في الأسفل يمثل التغيير
- Animated counter عند أول تحميل

### 3. `Button` — أزرار محسّنة
- `primary`: gradient indigo-violet + shadow-brand
- `secondary`: خلفية amber + glow
- `ghost`: hover يظهر background خفيف مع transition
- جميعها: scale(0.97) عند الضغط

### 4. `Badge` — شارات محسّنة
- شكل pill (border-radius: 999px)
- خلفية ملونة خفيفة + نص ملون
- نقطة ملونة صغيرة بجانب النص (dot indicator)

### 5. `DataTable` — جداول البيانات
- Header لزج (sticky) عند السكرول
- Hover row: خلفية خفيفة + cursor pointer
- Sorting arrows مع animation
- Checkbox multi-select
- Empty state جميل مع أيقونة وnull message
- Skeleton loader عند التحميل

### 6. `Modal` — نوافذ حوارية
- Backdrop blur + تعتيم تدريجي
- Slide-up animation عند الفتح
- Scale animation للمحتوى

### 7. `Toast` — إشعارات النجاح/خطأ
- موضوعها أسفل اليمين
- Slide-in من اليمين + fade
- أيقونة ملونة حسب النوع
- Auto-dismiss بشريط progress

### 8. `Skeleton` — حالة التحميل
- شكل يطابق المحتوى الحقيقي
- Shimmer animation (موجة من اليمين لليسار)

### 9. `Empty State` — حالة الفراغ
- أيقونة كبيرة ملونة
- عنوان و وصف
- زر CTA

### 10. `CommandPalette` — بحث عالمي (Cmd+K)
- Modal بحث لكل شيء
- نتائج فورية مع تصنيف
- Keyboard navigation

---

## رابعاً — الـ Sidebar الجديد

### المواصفات
- عرض: 260px (مفتوح) / 68px (مطوي على موبايل)
- خلفية: gradient من `#0f0c29` إلى `#1e1b4b`
- حواف يمنى: border خفيف + glow effect
- اسم المتجر مع صورة/أحرف أولى ملونة

### عناصر التنقل
- أيقونة + نص بجانب بعض
- العنصر النشط: خلفية brand مع glow جانبي أيسر (border-right: 3px solid brand)
- Hover: خلفية خفيفة مع transition
- المجموعات: header أصغر + indent للعناصر
- Collapse/Expand بـ animation ناعم

### Footer الـ Sidebar
- صورة التاجر/أحرف أولى
- اسم + البريد
- زر تسجيل الخروج
- Badge الخطة (GROWTH / PRO / ENTERPRISE)

---

## خامساً — صفحات ستُعاد كتابتها (بالترتيب)

### المرحلة 1 — الأساس (الأولوية القصوى)
1. **globals.css** — نظام التصميم + CSS Variables + animations + fonts
2. **card.tsx** — إعادة كتابة كاملة مع variants جديدة
3. **button.tsx** — gradients + micro-interactions
4. **badge.tsx** — pill style + dot indicator
5. **input.tsx** — floating label + focus ring جميل
6. **header.tsx** — search محسّن + notifications panel
7. **sidebar.tsx** — تحسينات بصرية (بُني مسبقاً، الآن نضيف الـ styling)

### المرحلة 2 — الصفحات الرئيسية
8. **Dashboard Home** (`page.tsx`) — KPI cards، charts، quick actions
9. **Orders** — data table محسّن + status timeline
10. **Products** — grid/list view toggle + image preview

### المرحلة 3 — بقية الصفحات (يُطبَّق عليها نظام التصميم تلقائياً بعد تحديث المكونات)

---

## سادساً — تغييرات globals.css

```
1. استيراد خط IBM Plex Sans Arabic
2. CSS variables كاملة (colors, shadows, motion)
3. Keyframe animations:
   - @keyframes fadeIn
   - @keyframes slideUp
   - @keyframes shimmer
   - @keyframes scaleIn
   - @keyframes countUp (JS-triggered)
4. Utility classes:
   - .glass — glassmorphism
   - .gradient-brand — brand gradient
   - .shadow-brand — brand glow
   - .animate-fade-in, .animate-slide-up
5. Scrollbar styling (thin, colored)
6. Selection color (brand color)
7. Focus-visible ring
```

---

## سابعاً — ميزات UX إضافية (تفوق المنافسين)

| الميزة | التفصيل | لا يوجد في: |
|---|---|---|
| **Dark Mode** | زر تبديل في header، يحفظ التفضيل | سلة ✓ |
| **Animated Counters** | الأرقام تعد من 0 عند تحميل الصفحة | الكل ✓ |
| **Skeleton Loaders** | كل صفحة لها skeleton يطابق شكلها | زد ✓ |
| **Command Palette** | Cmd+K يفتح بحث عالمي | شوبفاي جزئياً ✓ |
| **Quick Actions** | زر عائم أسفل اليمين لأسرع الأفعال | الكل ✓ |
| **Contextual Tooltips** | tooltip على كل عنصر مهم | الكل ✓ |
| **Confetti on Milestones** | أول طلب، أول 100 طلب — احتفال! | الكل ✓ |
| **Progress Indicators** | شريط progress أعلى الصفحة عند التحميل | الكل ✓ |

---

## ثامناً — ترتيب التنفيذ

```
اليوم 1: ✅ مكتمل
  ✅ globals.css — نظام التصميم الكامل (Design System v2.0 + CSS variables + keyframes)
  ✅ card.tsx — إعادة كتابة (StatCard مع animated counter + color variants)
  ✅ button.tsx — إعادة كتابة (gradient-brand + 6 variants + loading state)
  ✅ badge.tsx — إعادة كتابة (dot indicator + 7 variants)
  ✅ input.tsx — إعادة كتابة (focus animations + floating label colors)

اليوم 2: ✅ مكتمل
  ✅ header.tsx — تحسين كامل (search expand + brand notification + plan badge)
  ✅ sidebar.tsx — تحسين بصري (gradient-sidebar + glow active + glass store info)
  ✅ Skeleton component — جديد (shimmer + SkeletonStatCard + SkeletonTableRow)
  ✅ Empty State component — جديد (sm/md/lg sizes + gradient icon)
  ✅ Toast system — جديد (context-based + 4 نوع + auto-dismiss)
  ✅ layout.tsx — IBM Plex Sans Arabic font

اليوم 3: ✅ مكتمل
  ✅ Dashboard Home — إعادة كتابة كاملة (quick actions + animated KPIs + dual chart + skeleton table)

اليوم 4–5: (المرحلة التالية)
  ✦ Orders page — data table جديد
  ✦ Products page — grid + list view
  ✦ تطبيق النظام على بقية الـ 48 صفحة
```

---

## تاسعاً — المعيار الذي سنقيس به النجاح

| المعيار | الهدف |
|---|---|
| اللون الأول الذي يلاحظه التاجر | "واو! هذا يشبه تطبيق Apple" |
| سرعة الاستيعاب | يجد أي معلومة في أقل من 2 ثانية |
| الإحساس العام | احترافية بنكية + دفء العلامة التجارية |
| المقارنة | "سلة وزد تبدو قديمة بجانبه" |
