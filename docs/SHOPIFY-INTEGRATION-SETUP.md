# إعداد تجربة Shopify الخاصة

هذه مرحلة إعداد فقط: التطبيق الحالي Next.js يبقى مستقلًا خارج iframe (`embedded = false`). لا تُستبدل بنيته بقالب React Router، ولا تتغير بيانات الجغرافيا والشحن أو التصميم أو وضع `dev:local`. لم يُنشأ تطبيق في حساب Shopify ولم يحدث تثبيت أو نشر أو إرسال بيانات إلى المتجر.

## الأساس الموجود

- `/api/integrations/shopify/start`: بدء OAuth بصلاحية `read_products`.
- `/api/integrations/shopify/callback`: التحقق من HMAC والوقت وstate أحادي الاستخدام ثم حفظ الاعتماد مشفرًا ومرتبطًا بالتاجر.
- عميل Admin GraphQL موجود؛ إصدار طلباته الحالي `2026-01`، منفصل عن إصدار إعداد webhooks في القالب. لا توجد مزامنة منتجات أو إنشاء طلبات Shopify أو امتداد قالب متجر في هذه المرحلة.
- `npm run dev:local` يعطل التكاملات الخارجية عمدًا؛ لا تستخدمه لاختبار OAuth حي.

## الأدوات الرسمية

تم تثبيت وفحص Shopify CLI **5.0.0** خارج المستودع في البيئة السحابية:

```sh
/workspace/shopify-tools/node_modules/.bin/shopify version
```

على جهازك يمكنك استخدام `npx --package=@shopify/cli@5.0.0 shopify` بدل المسار أعلاه. تتطلب الأدوات Node.js حديثًا؛ المشروع يستخدم Node.js 24 وnpm 11. مراجع Shopify الرسمية: [CLI](https://shopify.dev/docs/apps/build/cli-for-apps)، [إعداد TOML](https://shopify.dev/docs/apps/tools/cli/configuration)، [التوزيع](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method).

## المطلوب من صاحب المتجر

1. في Shopify Developer Dashboard أنشئ تطبيقًا مخصصًا لتجربة متجرك، أو اختر التطبيق الذي تملكه بالفعل. إذا كان متجرًا فعليًا، تحقق من خيار **Custom distribution** والتثبيت لمتجرك؛ `app dev` مخصص لمتاجر التطوير ولا يفترض صلاحية التشغيل على متجر فعلي. لا تختَر نشر App Store.
2. وفّر عنوان HTTPS قابلًا للوصول لتطبيق Next.js أثناء التجربة. لا يوجد رابط معاينة سحابي جاهز هنا. اضبط App URL على `/dashboard` وAllowed redirection URL على `/api/integrations/shopify/callback` تحت نفس النطاق. اترك التطبيق غير مضمن واطلب `read_products` فقط.
3. انسخ `shopify.app.toml.example` إلى `shopify.app.toml` واستبدل Client ID والنطاق. لا تضع Client Secret في TOML. للمزامنة من الحساب استخدم `shopify app config link --client-id YOUR_CLIENT_ID`؛ راجع الملف الناتج ولا تستخدم `--force` لاستبدال ملف موجود دون مراجعته. إعداد الملف وحده لا يغير إعدادات الحساب.
4. أدخل القيم في إعدادات تشغيل آمنة: `SHOPIFY_CLIENT_ID` و`SHOPIFY_CLIENT_SECRET` و`SHOPIFY_REDIRECT_URI` و`INTEGRATIONS_ENCRYPTION_KEY`، و`SHOPIFY_SHOP` لنطاق متجرك. المتجر المذكور سابقًا `leadformarab.myshopify.com` يحتاج تأكيدك. مفتاح التشفير 32 بايت عشوائية ممثلة بـ64 رمز hex؛ احتفظ به لاسترجاع الاعتمادات ولا ترسله في المحادثة. لا تستبدل مفتاحًا موجودًا.
5. بعد حقن المتغيرات شغّل `node scripts/shopify-preflight.mjs` ثم `npm run dev` من جذر المشروع. لتجربة منفصلة استخدم مسارات SQLite الأربعة خارج قواعد التجربة المحلية عبر `AUTH_DATABASE_PATH` و`CHECKOUT_DATABASE_PATH` و`SHIPPING_DATABASE_PATH` و`ORDERS_DATABASE_PATH`. لا تستخدم قاعدة إنتاج لفحوص البيانات.
6. أنشئ حساب تاجر وسجّل الدخول في التطبيق، ثم ابدأ الربط من صفحة التكاملات ووافق داخل Shopify. تحقق من العودة إلى لوحة التحكم وحالة الاتصال. لا يعني الاتصال مزامنة المنتجات أو الطلبات أو عرض النموذج في واجهة متجرك؛ هذه مراحل تنفيذ لاحقة.

لا تشغّل `shopify app deploy` في هذه المرحلة. إعداد تجربة متجر تطوير أو إنشاء إصدار خاص للتثبيت على متجر فعلي خطوة حساب لاحقة يراجعها المالك، ولا تعني نشر App Store.

## حدود الفحص

فحص preflight يتحقق من شكل الإعدادات فقط ولا يثبت صحة الأسرار أو الملكية أو صلاحية Shopify. فحوص `tests/shopify.test.ts` محلية بمحاكاة HTTP. الاختبار الحي يحتاج حساب المالك والعنوان الآمن وإعدادات التطبيق. لا توجد App Bridge أو session tokens للعرض المضمن أو مزامنة أو دورة webhooks كاملة حتى الآن.

التحقق في جلسة الإعداد: نجحت قراءة المستودع وتثبيت `npm ci`، و`lint` و`typecheck` والبناء، و170 اختبارًا آليًا و82 اختبار متصفح للحاسوب والهاتف. تخطيت 4 حالات PostgreSQL لغياب خدمته الاختيارية في مسار SQLite. نجحت 8 تأكيدات لفحص preflight ببيانات وهمية، وتحليل TOML محليًا. تعذر إكمال `shopify app config validate` بسبب الوصول إلى مصادقة Shopify؛ لم يُتحقق من القالب داخل حساب حقيقي. وثائق shopify.dev محجوبة بسياسة الشبكة الحالية؛ إضافة نطاقها محفوظة في مسودة البيئة ولم يُثبت تطبيقها على التشغيل الحالي.
