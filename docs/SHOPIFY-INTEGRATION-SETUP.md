# DZ Lead Form Pro — تجربة متجر Shopify المصرح به

المتجر الذي أكده المالك: **h8vsym-t0.myshopify.com**. هذه المرحلة تجهز المصادقة والتثبيت فقط. التطبيق الحالي Next.js مستقل خارج iframe (`embedded = false`)؛ لم يحدث تثبيت فعلي أو تفويض حساب Shopify أو تعديل ثيم أو نشر. لا يعني نجاح اختبارات المحاكاة نجاح الربط الحي.

## 1. اختيار طريقة التجربة والتوزيع

- متجرك المدفوع يمكنه تثبيت تطبيق مصرح له بالتوزيع المناسب. الدومين المخصص واجهة المتجر؛ OAuth وAdmin API يستخدمان `h8vsym-t0.myshopify.com`.
- أمر Shopify CLI `app dev` يقبل متجر تطوير أو Shopify Plus sandbox مؤهلًا، وليس أي متجر مدفوع عادي. لتجربة CLI previews وTheme App Extension بأمان أنشئ متجر تطوير منفصلًا. تثبيت التطبيق على المتجر المدفوع مسار منفصل بعد إعداد HTTPS والتوزيع.
- **Custom distribution** مناسب لتطبيق تجربة منفصل لمتجرك. اختيار طريقة التوزيع قد يكون غير قابل للتغيير؛ لا تضغط تأكيده دون مراجعة التحذير. إذا كان هذا معرّف التطبيق الذي تريد بيعه لعدة تجار لاحقًا، احتفظ به لمسار Public distribution، وأنشئ هوية تطبيق منفصلة للتجربة الخاصة. لا تفترض إمكانية تحويل تطبيق Custom إلى Public لاحقًا.
- Public distribution للمشروع التجاري يتطلب استيفاء متطلبات Shopify والمراجعة ذات الصلة. إعداد إصدار خاص أو تثبيته لا يساوي نشر App Store، ومع ذلك لا ننفذ أي Release أو توزيع في هذه المرحلة.

## 2. ما نُفذ في الكود

- SDK الرسمي `@shopify/shopify-api` بالإصدار **15.0.1**، وAdmin GraphQL بإصدار **2026-10**.
- يبدأ `/api/integrations/shopify/start` التفويض بعد جلسة تاجر حقيقية، وفحص Origin مقابل نطاق HTTPS المضبوط، والتحقق من المتجر المصرح به. لا تستخدم هوية التاجر الافتراضية لتثبيت Shopify.
- يستخدم SDK `auth.begin` و`auth.callback` لتوقيع cookie الـstate من نوع HttpOnly/Secure/SameSite=Lax. تُربط الحالة أيضًا بالتاجر والمتجر في قاعدة البيانات وتُستهلك مرة واحدة. cookie الـSDK قصير العمر؛ إذا تأخرت الموافقة ابدأ الربط مجددًا.
- يفحص callback HMAC والوقت وتكرار المعاملات وتطابق المتجر و`read_products`، ويطلب offline tokens قابلة للانتهاء. يتحقق باستعلام مصادق من هوية المتجر ويسجل webhook إلغاء التثبيت قبل حفظ الاتصال.
- رموز الوصول والتحديث وبيانات انتهاء الصلاحية مشفرة AES-256-GCM مع ربطها بالتاجر. التجديد متسلسل لمنع تدوير رمز التحديث مرتين بالتوازي. الاتصالات القديمة باقية وقابلة للقراءة؛ أعد تفويضها للانتقال إلى رموز قابلة للتجديد.
- يستقبل `/api/shopify/webhooks` حدث `app/uninstalled`، ويتحقق من التوقيع قبل JSON، ويحد حجم الجسم ويتحقق من المتجر وتاريخ الحدث ويتعامل مع تكرار التسليم. يمحو الاعتمادات الملغاة فقط، ويترك الطلبات والشحن والمنتجات وبيانات المستخدمين دون تغيير. تتطلب الأحداث الصحيحة `X-Shopify-Triggered-At` للحماية من أحداث قديمة تصل بعد إعادة التثبيت.
- يستخدم legacy authorization-code install flow اشتراكات webhook خاصة بكل متجر عبر GraphQL، وليس اشتراكات TOML المتعارضة معه. لا تضف `[[webhooks.subscriptions]]` إلى هذا القالب دون تغيير استراتيجية التثبيت.
- `/api/integrations/shopify/verify` يجري استعلام Shopify حيًا لحساب التاجر المسجل ويعيد `verified: true` فقط إذا نجح وتطابق المتجر. لا يعرض أي اعتماد.
- `dev:local` ووضع Windows والبيانات والجغرافيا والشحن والتصميم لم تُستبدل. لم تُضف صلاحيات كتابة طلبات أو تعديلات ثيم. لم تُفعّل أحداث إعلانات إنتاجية.

## 3. ما تضغط عليه في Shopify الآن

تختلف أسماء بعض الأزرار باختلاف لغة الحساب وصلاحياته؛ لا يمكن التحقق من شاشتك دون تفويض حسابك.

1. افتح Shopify Admin لمتجرك → **Settings → Apps → Develop apps** → افتح **Dev Dashboard**. يمكنك أيضًا فتح [dev.shopify.com/dashboard](https://dev.shopify.com/dashboard) مباشرة ثم اختيار المؤسسة المالكة للتطبيق. لا ترسل كلمة المرور أو مفاتيح الحساب هنا.
2. من **Apps → Create app** اختر إنشاء التطبيق من Dev Dashboard إن ظهر الاختيار، وسمّه مثلًا `DZ Lead Form Pro — Private Test`. إذا لديك تطبيق سابق افتحه بدل إنشاء بديل دون حاجة.
3. افتح **Settings** داخل التطبيق وسجّل Client ID، وانقل Client Secret إلى إعدادات التشغيل الآمنة فقط. افحص **Distribution** دون اختيار طريقة نهائية الآن. إن اخترت لاحقًا Custom distribution فليكن تطبيق التجربة المنفصل الذي تقبل بقاءه خاصًا.
4. افتح **Versions → Create a version** أو مسودة إعدادات التطبيق. بعد توفير HTTPS اضبط:
   - App URL: `https://YOUR_HTTPS_HOST/dashboard`.
   - ألغِ **Embed app in Shopify admin** لهذه المرحلة.
   - Allowed redirect URL: `https://YOUR_HTTPS_HOST/api/integrations/shopify/callback` مطابقًا تمامًا.
   - Access scopes: `read_products` فقط.
   - Webhooks API version: `2026-10`.
   - إذا عُرض خيار أسلوب التثبيت، لا تختَر managed installation/token exchange لتطبيق هذه المرحلة المستقل؛ القالب يستخدم authorization-code grant (`use_legacy_install_flow = true`).
5. احفظ المسودة المتاحة. **توقف قبل Release أو تأكيد Distribution أو Install** إذا لم تكن مستعدًا للمرحلة الثالثة. لم ننفذ هذه الإجراءات في حسابك. تثبيت متجر فعلي قد يتطلب إصدارًا مفعّلًا ومراجعة اختيار التوزيع أولًا.
6. في Shopify Admin → **Online Store → Themes** → قائمة الثيم الحالي → **Duplicate**. احتفظ بالنسخة غير منشورة للمرحلة الخامسة. لا تستخدم Customize للثيم الحي ولا Publish. لا يوجد COD App Block جاهز في هذه المرحلة بعد.

## 4. HTTPS وتشغيل نسخة منفصلة للتجربة

لا توجد استضافة عامة أو بوابة HTTPS مُنشأة في هذه الجلسة، ولا نشر مدفوع. الدومين المخصص للمتجر لا يستضيف خادم Next.js تلقائيًا.

يمكنك استخدام خادم HTTPS تملكه بالفعل، أو تشغيل tunnel مؤقت بموافقتك على جهازك. مثال اختياري بعد تثبيت أداة Cloudflare الرسمية:

```sh
cloudflared tunnel --url http://127.0.0.1:3000
```

لم يُشغّل هذا الأمر هنا ولم يُتحقق من tunnel حي. عنوانه المؤقت يتغير عند إعادة التشغيل؛ كل تغيير يتطلب تحديث App URL وRedirect URL والمتغيرات وإعادة تشغيل التطبيق. هذا tunnel لخادم التطبيق المستقل؛ لا يحوّل متجرك المدفوع إلى متجر تطوير يقبله `shopify app dev`.

من جذر المستودع جهّز ملفًا محليًا `.env.shopify-test` خارج Git، بصلاحيات مقيدة، أو استخدم مدير الأسرار في خادمك. القيم الحساسة تدخلها أنت في إعدادات آمنة، لا في المحادثة. المتغيرات:

```dotenv
SHOPIFY_SHOP=h8vsym-t0.myshopify.com
SHOPIFY_CLIENT_ID=YOUR_CLIENT_ID
SHOPIFY_CLIENT_SECRET=YOUR_CLIENT_SECRET
SHOPIFY_REDIRECT_URI=https://YOUR_HTTPS_HOST/api/integrations/shopify/callback
INTEGRATIONS_ENCRYPTION_KEY=YOUR_EXISTING_OR_NEW_64_HEX_KEY
AUTH_DATABASE_PATH=data/shopify-test/auth.sqlite
CHECKOUT_DATABASE_PATH=data/shopify-test/checkout.sqlite
SHIPPING_DATABASE_PATH=data/shopify-test/shipping.sqlite
ORDERS_DATABASE_PATH=data/shopify-test/orders.sqlite
DZ_LOCAL_DEMO=0
DZ_DISABLE_EXTERNAL_INTEGRATIONS=0
```

لا تضع القيم الوهمية كما هي ثم تتوقع اتصالًا. يحتاج SDK السر الحقيقي داخل عملية الخادم لحساب HMAC، وكذلك مفتاح التشفير؛ placeholder يستبدله proxy فقط عند الطلب الخارجي لا يكفي لهذه العمليات المحلية. لا تستبدل مفتاح تشفير موجودًا. مفتاح جديد يجب أن يكون 32 بايت عشوائية ممثلة بـ64 رمز hex، ويُحفظ دون طباعته أو إدخاله في Git. استخدم قواعد منفصلة كما في المثال ولا تضع `DATABASE_URL` لقاعدة الإنتاج في هذه التجربة.

على Node.js 24، من جذر المشروع:

```sh
npm ci
npm run build
node --env-file=.env.shopify-test scripts/shopify-preflight.mjs
node --env-file=.env.shopify-test node_modules/next/dist/bin/next start --hostname 127.0.0.1
```

على Windows استخدم `npm.cmd` إن احتاج PowerShell ذلك. `dev:local` يبقى للتجربة المحلية بدون Shopify ولا تستخدمه للتفويض الحي. في البيئة السحابية حافظ على proxy وشهادة TLS الموروثة، واستخدم إعداد Node المدعوم `NODE_USE_ENV_PROXY=1` عند الحاجة إلى proxy مع fetch؛ لا تعطل TLS أو تتجاوز سياسة الوجهات.

ينبغي السماح لخادم التطبيق بالوصول إلى `h8vsym-t0.myshopify.com`، ولحاسوب المالك بالوصول إلى صفحة تفويض Shopify. CLI قد يحتاج `accounts.shopify.com` ووجهات إدارة الشركاء؛ لا تضف wildcard عامًا. اتصال Shopify الوارد إلى عنوان HTTPS يجب أن يصل إلى callback و`/api/shopify/webhooks` دون مطالبة بتسجيل دخول تاجر؛ كلاهما يتحقق من توقيع Shopify.

## 5. ربط CLI المحلي دون نشر

CLI المثبت هنا: `/workspace/shopify-tools/node_modules/.bin/shopify` إصدار **5.0.0**. خارج هذه البيئة يمكن استخدام `npx --package=@shopify/cli@5.0.0 shopify`.

انسخ `shopify.app.toml.example` إلى `shopify.app.toml` واستبدل Client ID والعنوان. لا تضع Client Secret في TOML. بعد تسجيل دخولك الرسمي، الأمر `shopify app config link --client-id YOUR_CLIENT_ID` يمكنه جلب الإعداد من حسابك؛ راجع الملف الناتج ولا تستخدم `--force` لاستبدال إعداد موجود. ثم `shopify app config validate` للتحقق المصرح. لم ينجح تحقق الحساب الحي في هذه الجلسة.

لا تشغّل `shopify app deploy` أو `app dev` على متجرك المدفوع العادي ضمن هذه المرحلة. عند اختيار متجر تطوير مؤهل، راجع أوامر CLI وإعداد الخادم قبل معاينات المرحلة التالية.

## 6. الاختبار الحي بعد تفويض المرحلة الثالثة

بعد إعداد HTTPS واختيار التوزيع وتفعيل الإصدار الخاص بالموافقة المناسبة: افتح التطبيق عبر HTTPS → أنشئ حساب تاجر → سجل الدخول → لوحة التحكم → التكاملات → تأكد من `h8vsym-t0.myshopify.com` → **بدء ربط المتجر** → **متابعة التفويض على Shopify**. راجع الصلاحية `read_products` داخل حسابك قبل Install/الموافقة. عند العودة، افتح `/api/integrations/shopify/verify` من المتصفح نفسه؛ لا نعتبر المتجر متصلًا حيًا إلا عند نجاح هذا الطلب المصادق.

قد يحتاج تثبيت التطبيق من داخل Shopify Admin تسجيل الدخول إلى حساب التاجر في DZ؛ لا توجد App Bridge/session-token authentication للعرض المضمن حاليًا. لا يوجد استيراد منتجات أو امتداد ثيم أو إنشاء طلب Shopify في هذه المرحلة.

جلسة التاجر مستقلة عن جلسة Shopify؛ إذا أعادك المتصفح إلى صفحة تسجيل الدخول بعد callback، ادخل بحساب التاجر نفسه قبل فحص الاتصال.

## 7. حدود المراحل اللاحقة

منتجات Shopify الحقيقية والخيارات والصور والأسعار والتوفر تُربط في المرحلة الرابعة دون إعادة إنشاء المنتجات يدويًا. COD App Block والثيم غير المنشور في الخامسة. لا تنفذ طلبًا أو تتجاوز Shopify Checkout في المرحلة السابعة قبل مراجعة السياسة والواجهات الرسمية المناسبة لنموذج التطبيق؛ طلب COD غير مدفوع قد يغير مخزون المتجر ويرسل إشعارات رغم عدم وجود تحصيل مالي. لا توجد موافقة هنا على إنشاء طلبات حقيقية أو إرسال Purchase إنتاجي.

قبل توزيع تجاري عام: استراتيجية embedded/managed installation، وwebhooks الخصوصية، والتعامل مع بيانات العملاء، ومتطلبات المراجعة تحتاج مرحلة مستقلة. لا تقر هذه المرحلة جاهزية App Store.

## 8. المصادر والنسخ الاحتياطية

- [Shopify SDK OAuth — المصدر الرسمي](https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/docs/guides/oauth.md): يدعم authorization-code grant للتطبيقات المستقلة، ويوصي token exchange للتطبيقات المضمنة.
- [Shopify SDK webhooks](https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/docs/guides/webhooks.md).
- [اختيار طريقة التوزيع](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method).
- [Shopify CLI والتجربة](https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally).

وثائق shopify.dev محجوبة بسياسة الشبكة الحالية؛ استُخدمت أدلة SDK من مستودع Shopify الرسمي وأوامر CLI المثبتة. تحقق واجهة الحساب والتوزيع نفسه ينتظر المالك.

نقطة ما قبل التعديلات: `c78d107`. النسخ خارج Git في `/workspace/dz-backups/pre-shopify-stage2-default` و`pre-shopify-stage2-local-demo`، مع manifests SHA-256 وفحص سلامة SQLite. أرشيف مجلد data كاملًا: `/workspace/dz-backups/pre-shopify-stage2-data.tar.gz`. يتضمن بيانات خاصة؛ لا تنشره ولا ترفعه إلى Git. بصمته SHA-256: `00b9cc8ad7919143d58ae789a2cd473e6577b0581a80177c00221def1a42d3e4`.

## 9. نتيجة التحقق لهذه المرحلة

نجحت `lint` و`typecheck` والبناء و181 اختبارًا آليًا، منها 11 حالة جديدة لمصادقة Shopify ودورة الاعتماد وwebhooks. تخطيت 4 حالات PostgreSQL لغياب خدمته في مسار SQLite الحالي؛ أُضيفت جداول جلسات Shopify وإيصالات webhook إلى مخطط وترحيل PostgreSQL دون ادعاء اختبار ترحيل حي.

نجح 16 اختبار متصفح موجودًا للحاسوب والهاتف يشمل الشحن والطلبات واللغات والتكاملات المحلية، مع إبقاء قواعد الاختبار مؤقتة ومستقلة. وفي خادم Next.js المبني رُفضت مسارات بدء التفويض والتحقق غير المصادق بـ401، وأعادت callback وwebhook حالة 503 عند غياب الإعدادات، كما هو متوقع. يفشل preflight الحالي عمدًا لغياب القيم المطلوبة؛ لم تُختلق اعتماديات.

لم ينجح اختبار Shopify حي: الوجهة `h8vsym-t0.myshopify.com` رفضها proxy الحالي بـ403، والأسرار وHTTPS وتفويض المالك غير متوفرة. حُفظت إضافة نطاق المتجر و`accounts.shopify.com` و`partners.shopify.com` مع `shopify.dev` في مسودة إعداد البيئة، وحُفظت أسماء متغيرات التشغيل المطلوبة دون قيم حساسة. نجاح الحفظ لا يطبق الشبكة ولا ينشر البيئة أو تطبيق Shopify. راجع إعدادات البيئة واحفظ التغييرات ثم انشر نسخة البيئة إذا أردت تفعيلها؛ هذا منفصل عن نشر Shopify. لا حاجة لإعادة إرسال نطاق المتجر.
