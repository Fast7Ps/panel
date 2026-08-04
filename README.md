# لوحة تحكم FAST7 — إدارة المتاجر المشتركة (Super-admin Panel)

لوحة ويب مستقلة (منفصلة عن المتجر) يتحكم من خلالها مالك الشركة في كل المتاجر المشتركة:
إضافة متجر، إيقاف/تفعيل، متابعة الاشتراكات، وإصدار أكواد التفعيل والدفع.

> **عزل كامل للمتاجر:** كل متجر له **مشروع Supabase مستقل تماماً** — بياناته لا تختلط مع
> أي متجر آخر. لوحة التحكم تتبع المتاجر في "سحابة الشركة" الرئيسية فقط.

---

## 1) إنشاء سحابة الشركة الرئيسية (Master)

1. أنشئ مشروعاً جديداً على [supabase.com](https://supabase.com) — هذا هو **سحابة الشركة** (Master).
2. افتح **SQL Editor** واعمل على الكود كاملاً من: `supabase/master/schema.sql`
3. أنشئ مستخدماً في **Authentication → Users** (سيكون حسابك كمسؤول).

## 2) إعداد ملف الإعدادات

افتح `js/config.js` وعبّئ القيم من إعدادات مشروع الشركة الرئيسي:

```js
SUPABASE_URL:   https://scmgwkabtybtrmxdqniz.supabase.co   // URL المشروع الرئيسي
SUPABASE_ANON_KEY: anon-public-key                         // المفتاح العام فقط
```

**أمان مهم:** اللوحة تعتمد **Supabase Auth** (بريد + كلمة مرور). لا تضع `service_role` أو
Secret أبداً في `config.js` — فهذه مفاتيح إدارية خارقة، إذا ظهرت في الملفات المرافعة
على GitHub العام فسيتمكن أي شخص من السيطرة الكاملة على مشروعك. استخدم الـ anon key فقط.

## 3) إعداد حساب المشرف (Supabase Auth)

1. في مشروع الشركة الرئيسي افتح **Authentication → Users → Add user**.
2. أنشئ بريداً وكلمة مرور للمشرف.
3. أدخل هذا البريد وكلمة المرور في شاشة دخول اللوحة — ستتطابق مع سياسات RLS
   (`for all to authenticated`) في schema.sql.

## 3) إضافة متجر جديد (داخل اللوحة)

لكل متجر تحتاج **مشروع Supabase مستقل له**:
1. أنشئ مشروعاً جديداً في supabase.com، وصفّق فيه سكربت الجداول الخاص بالمتجر (`supabase/schema.sql`).
2. في اللوحة اضغط **+ إضافة متجر**.
3. أدخل بيانات المتجر + بيانات مشروع Supabase الخاص به (URL / anon key / write token).
4. يُنشأ المتجر بـ `store_id` فريد، ومسار `/slug/`، واشتراك تجريبي `free`.

## 4) إصدار أكواد للاشتراك والدفع

من تبويب **أكواد الاشتراك** يمكنك إصدار:
- **تفعيل اشتراك** (مثلاً كود سنوي/شهري) يخصّص لمتجر معين أو عام.
- **دفع رسوم** لاحتياجات الدفع حسب الطلبات.
- **رصيد** لمتاجر محددة.

صاحب المتجر يدخل الكود في واجهة الترخيص داخل متجره لتفعيل الخطة.

---

## النشر على GitHub Pages

لوحة سوبر-أدمن مشروع **مستقل** — انشرها في مستودع جديد بملف Git Action:

`.github/workflows/deploy.yml`:
```yaml
name: Deploy Superadmin
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './superadmin'
      - uses: actions/deploy-pages@v4
permissions:
  contents: read
  pages: write
  id-token: write
```

ثم في `Settings → Pages` اختر **Source: GitHub Actions**.

---

## بنية المشروع

superadmin/
├── index.html          الواجهة
├── js/
│   ├── config.js       إعدادات سحابة الشركة الرئيسية (URL + anon key)
│   ├── db.js           طبقة الوصول إلى Supabase + Auth (sign in)
│   └── app.js          منطق اللوحة
├── .nojekyll
└── .gitignore