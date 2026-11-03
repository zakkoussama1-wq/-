# النشر على Render باستخدام Docker

المتجر: `h8vsym-t0.myshopify.com`. أُصلح البناء والتشغيل واختُبرا محليًا بحاوية Docker وPostgreSQL. **لم يحدث نشر إلى Render أو تفويض Shopify حي، ولا يعني نجاح الحاوية أن نموذج COD الكامل أصبح جاهزًا للعملاء.** مزامنة المنتجات موجودة، بينما Theme App Extension ومسار طلبات Shopify المتوافق والإعلانات الحقيقية مراحل لاحقة.

## إعداد خدمة Render

راجع الأسعار قبل إنشاء الموارد. ملف `render.yaml` يصف Web Service Docker وخدمة PostgreSQL وقرصًا دائمًا، مع `autoDeploy: false`؛ لا ينشئ شيئًا دون إجراء المالك. أسماء الخطط في الملف تحتاج مراجعة الخيارات المتاحة في حساب Render عند الإنشاء.

من Render: New → Web Service → اربط GitHub → المستودع `zakkoussama1-wq/-` → الفرع `main` → Language/Runtime: Docker. Root directory هو جذر المستودع، وDockerfile path هو `./Dockerfile`، وDocker build context هو `.`. اترك Docker Command دون override ليُستخدم CMD الموجود في الصورة. لا تضع npm run dev أو START-WINDOWS.cmd في الإنتاج. يمكن استعمال Blueprint بدل الإنشاء اليدوي بعد مراجعة الموارد والأسعار.

- Health Check Path: `/api/health`.
- PORT: دع Render يوفره؛ الصورة اختُبرت على `10000`، مع default محلي `3000` فقط. EXPOSE ليس إعدادًا يفرض المنفذ.
- الاستماع: يفرض مدخل الحاوية `0.0.0.0` حتى لو ضبط Docker HOSTNAME على اسم الحاوية.
- Persistent disk: mount path `/var/data`؛ مثال الحجم في Blueprint هو 1GB، ويُراجع حسب احتياجك. الخدمة تعمل بالمستخدم node (UID1000)، ويجب أن يكون المسار مقروءًا وقابلًا للكتابة له. تتوقف الحاوية بوضوح إن لم يكن صالحًا؛ لا تستخدم chmod777 أو تشغيل الخادم root لتجاوز المشكلة.
- لا توجد Build Command أو Start Command إضافية مطلوبة لمسار Docker. الاعتماديات تُثبت بـnpm ci، والجغرافيا تُولّد أثناء البناء، ثم Next يبني standalone.

## متغيرات البيئة

أدخل القيم الحساسة في Render Environment فقط، دون Git أو محادثة. لا تستخدم قيم الاختبارات أو أمثلة كلمات المرور.

| المتغير                     | القيمة/الإعداد                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| NODE_ENV                    | `production` (موجود في الصورة والـBlueprint)                                                           |
| PORT                        | توفره Render؛ لا تثبته على 3000 في الواجهة                                                             |
| DATABASE_URL                | اتصال PostgreSQL الخاص بالتطبيق، وموجود تلقائيًا عبر fromDatabase عند استعمال Blueprint                |
| SHOPIFY_SHOP                | `h8vsym-t0.myshopify.com`                                                                              |
| SHOPIFY_CLIENT_ID           | Client ID من تطبيقك في Shopify Dev Dashboard                                                           |
| SHOPIFY_CLIENT_SECRET       | السر الحقيقي من Shopify، متاح لعملية الخادم لحساب HMAC                                                 |
| SHOPIFY_REDIRECT_URI        | `https://YOUR-SERVICE.onrender.com/api/integrations/shopify/callback`                                  |
| INTEGRATIONS_ENCRYPTION_KEY | مفتاح ثابت عشوائي 32 بايت ممثل بـ64 رمز hex؛ لا تولده من جديد كل deploy ولا تستبدل مفتاح بيانات موجودة |
| MEDIA_STORAGE_DRIVER        | `local`                                                                                                |
| MEDIA_STORAGE_PATH          | `/var/data/media`، تحت القرص الدائم                                                                    |

اترك DZ_LOCAL_DEMO وDZ_AUTH_TEST_BYPASS وLOCAL_MERCHANT_ID وDZ_SHOPIFY_MODE غير مضبوطة في الإنتاج. لا تنقل مسارات SQLite التطويرية أو DATABASE_URL لبيانات demo إلى الخدمة الحية. لا تستخدم NEXT_PUBLIC_ مع الأسرار. لا تُضف proxy البيئة السحابية أو شهادتها إلى Render؛ هذه تخص اختبار هذه الجلسة فقط. إذا كان خادمك الحقيقي يحتاج CA خاصة فاستخدم إعداد ثقة مدعومًا دون تعطيل TLS.

تُرفض الإعدادات الناقصة قبل بدء standalone. يرفض فحص الإعدادات طلب تعطيل TLS للاتصالات البعيدة. قد لا تحتوي connectionString التي توفرها Render على sslmode؛ هذا مقبول لأن محول pg يضيف **verify-full** ويفرض التحقق من الشهادة قبل الاتصال. لا يوجد rejectUnauthorized:false أو مسار إنتاج يرجع إلى SQLite.

**اتصال Render المُدار نفسه لم يُختبر في هذه الجلسة.** إذا لم تتطابق شهادة العنوان الداخلي مع مضيف الاتصال، ستفشل الصحة؛ استخدم عنوان PostgreSQL المدعوم ذي شهادة صالحة، مثل External Database URL مع `sslmode=verify-full`، بعد تقييد Database access بعناوين الخروج الموثوقة لخدمتك. لا توسّع allowlist للعالم ولا تعطّل TLS لحل الفشل. اجعل القاعدة والخدمة في المنطقة نفسها عندما تستخدم الاتصال الداخلي. إعداد Blueprint الحالي `ipAllowList: []` يغلق الدخول الخارجي ويحتاج مراجعة محددة إذا قررت استخدام endpoint الخارجي.

## PostgreSQL والبيانات الدائمة

الحسابات والجلسات والطلبات والشحن والتصاميم والأسرار وكتالوج Shopify المخزن تستخدم PostgreSQL في الإنتاج. تُنشأ الجداول المطلوبة بإجراءات idempotent الحالية عند الاستخدام، لكن نقل بيانات سابقة إلى قاعدة جديدة إجراء منفصل: أوقف الكتابة وخذ نسخة احتياطية واختبر الترحيل على هدف فارغ قبل أي بيانات حية. لا تشغّل scripts/migrate-postgres.mjs تلقائيًا مع كل restart.

SQLite الوحيد داخل الصورة هو **مرجع الجغرافيا العام** `/app/data/geography.sqlite`، يفتح للقراءة فقط. ليس قاعدة إنتاج للحسابات أو العملاء، وحُفظ لدعم 58/69 ولاية و1541 بلدية. لم تُنسخ قواعد الأعمال أو env أو بيانات التجربة إلى الصورة. القرص الدائم للصور المحلية فقط؛ صور Shopify الخارجية تبقى روابط CDN. كاش Next المؤقت قابل لإعادة الإنشاء ولا يحمل السجل الأساسي للطلبات.

لا تستورد سجلات عملاء demo إلى متجر Shopify. لن تظهر الصور المحلية القديمة تلقائيًا في Render: انقل فقط الملفات المصرح بها وmetadata المطابقة إلى القرص الدائم بعد نسخة احتياطية. لا تُحذف البيانات المحلية عند ذلك. اضبط نسخ PostgreSQL الاحتياطية لدى Render حسب خطتك، واختبر الاستعادة والاحتفاظ، واحفظ مفتاح التشفير منفصلًا بأمان. القرص الدائم ليس بديلًا عن النسخ الاحتياطي.

## Shopify وHTTPS

لا تحتاج لشراء دومين لتجربة الاستضافة؛ عنوان Render الافتراضي HTTPS يكفي. عند إتاحة عنوان الخدمة استخدمه في Dev Dashboard:

- App URL: `https://YOUR-SERVICE.onrender.com/dashboard`.
- Allowed redirection URL: قيمة SHOPIFY_REDIRECT_URI نفسها حرفيًا.
- Disable Embed app in Shopify admin، وفعّل Use legacy install flow، بما يوافق التطبيق المستقل الحالي.
- Scopes: `read_products` فقط، وAPI/webhooks version `2026-10`.
- مدخل webhooks: `https://YOUR-SERVICE.onrender.com/api/shopify/webhooks`. يسجله التطبيق بعد OAuth؛ لا يحتاج جلسة متصفح، لكنه يتحقق من HMAC. لا تضف middleware تسجيل دخول أمام callback أو webhooks.

Render ينهي TLS أمام الحاوية؛ لا تفتح منفذ HTTPS داخل Node. اختُبرت ترويسات Host وX-Forwarded-Proto في الحاوية وتأكدنا من إصدار Cookie Secure. هذا لا يغني عن اختبار إعادة توجيه OAuth وTLS على عنوان Render الفعلي.

قد تحتاج معرفة عنوان Render قبل إنشاء إعداد تطبيق Shopify؛ يمكنك أخذ العنوان الذي تعرضه الخدمة ثم إكمال Dev Dashboard وإدخال القيم الحقيقية في Render. إن جرت محاولة تشغيل قبل اكتمالها فستفشل بشكل مغلق، وهذا مقصود. لا تستخدم أسرارًا وهمية لإظهار نجاح الخدمة. بعد الإعداد: سجل الدخول في DZ → التكاملات → بدء الربط → الموافقة داخل حساب Shopify → التحقق الحي → مزامنة المنتجات. لا يعتبر التطبيق مرتبطًا قبل نجاح استعلام مصادق ورؤية منتج حقيقي.

## نتيجة الفحص المحلي

- Docker build اكتمل مع Node24 وNext16 standalone والتحقق من TLS لاعتماديات npm.
- تشغيل غير root على PORT10000 واستجابة عبر عنوان واجهة شبكة الحاوية، لا loopback وحده.
- PostgreSQL مؤقت خاص بالفحص؛ HTTP health200، وقراءة الجغرافيا58، وتسجيل حساب fixture خلف ترويسات HTTPS مع Cookie Secure.
- قراءة حالة bootstrap للحساب الجديد نجحت؛ API منتجات دون جلسة رُفض401، وcallback غير صالح400، وwebhook بتوقيع غير صالح401.
- بقاء حساب fixture في PostgreSQL وملف على mount بعد restart.
- توقف قاعدة الاختبار أعطى health503 وفشل Docker healthcheck؛ لم تُنشأ SQLite للأعمال.
- رفض تشغيل الحاوية عند فقدان الإعدادات، والتحقق من مسار MEDIA_STORAGE_PATH قبل تشغيل الخادم.
- فحص محتوى الصورة أكد أن SQLite الموجودة في data هي الجغرافيا فقط، دون ملفات env أو قواعد عمل.

اختبار PostgreSQL داخل الحاويات استعمل loopback في network namespace خاص بالفحص؛ لم يحاك شهادة قاعدة Render الخارجية. جميع حسابات وأسرار الاختبار مؤقتة، ولم تُستعمل اعتماديات متجر أو تُنشأ طلبات Shopify. أزيلت حاويات الفحص الخاصة فقط.

**الحكم:** جاهز تقنيًا لتجربة نشر Docker مضبوطة على Render، مع إدخال القيم الحقيقية وتوفير PostgreSQL/القرص وصلاحياته. قبول نشر Render النهائي مشروط بصحة اتصال القاعدة وHealth Check وHTTPS وOAuth الحقيقي بعد إنشاء الخدمة. هذا ليس إعلان اكتمال نموذج COD أو جاهزية تشغيله على عملاء حقيقيين.
