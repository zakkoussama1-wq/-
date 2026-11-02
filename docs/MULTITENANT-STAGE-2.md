# المرحلتان 1 و2: تدقيق وعزل المتاجر

هذه مرحلة تأسيس أمني، وليست نظام Shopify تجاريًا مكتملًا أو اتصالًا حيًا. لم يحدث نشر أو تثبيت أو تغيير ثيم أو إرسال طلبات أو إعلانات.

## النسخة المرجعية والنسخ الاحتياطية

المرجع السابق للتعديل `18341dc0ca1c12b01dd8c6dc6f4912916acfa7cf`. نسخ SQLite والجغرافيا خارج Git في `/workspace/dz-backups/pre-multitenant-default` و`pre-multitenant-demo`؛ سكربت النسخ يتحقق من سلامة SQLite ويحفظ manifests SHA-256. لم تُحذف قواعد البيانات أو بيانات demo أو الاختبارات.

## نتائج التدقيق والمعالجة

- كان resolver يعيد تاجرًا افتراضيًا عند فقدان الجلسة ويقبل اختيار متجر عام من query. الإنتاج الآن يتطلب جلسة حساب صحيحة مرتبطة بتثبيت Shopify متحقق منه؛ أي هوية مفقودة أو اختيار متجر مختلف مرفوض. fallback بقي لاختبارات معزولة ووضع التطوير الصريح فقط.
- هوية Shopify الثابتة هي `gid://shopify/Shop/...` من استعلام Admin API المصادق داخل OAuth، لا من body أو query. يربط جدول `shopify_shops` هذه الهوية بحساب التاجر، بقيد فريد للنطاق والحساب، وFK إلى accounts وحالة active. عند إلغاء التثبيت يصبح الربط غير نشط.
- مفاتيح merchant_id الحالية في المنتجات والطلبات والشحن وتصاميم النماذج والمحاكاة تمثل هوية الحساب نفسها؛ لم تُعد تسمية بيانات سابقة أو ربطها تلقائيًا بمتجر. الحسابات القديمة تحتاج OAuth ناجحًا لتفعيلها في الإنتاج. لا يجوز إدراج هوية متجر مستنتجة يدويًا.
- middleware يحمي APIs العميل في الإنتاج أيضًا، بما فيها الكتالوج والتسعير والمحاكاة. دخول إعداد OAuth له استثناء bootstrap مع بقاء فحص جلسة الحساب وOrigin داخله؛ callback وwebhook يثبتان التوقيع مستقلين. الجغرافيا المشتركة ليست بيانات تاجر.
- عمليات المستودعات الحالية تستخدم merchant_id في SQL. اختبارات جديدة تفحص الكتالوج وCSV وبيانات العملاء وتحديث الطلبات والشحن واعتماديات التكامل بين حسابين. لا توجد shared tenant caches جديدة؛ الاستجابات الخاصة no-store.
- صور الإنتاج المحلية أصبحت تتطلب نفس التاجر حسب metadata وتُرسل private/no-store. النماذج المجهولة لا تستطيع استخدام صور تاجر آخر. عرض الصور والنموذج في واجهة Shopify العامة ينتظر App Proxy أو آلية موقعة في مرحلة الثيم؛ إلى ذلك الحين يُرفض الوصول بدل كشف بيانات افتراضية.
- أضيف vault خادمي داخلي لمزودي meta/tiktok/google، مشفر AES-256-GCM بمفتاح الخادم وAAD من merchant+provider، وقيد مركب merchant/provider. لا توجد API تعيد الأسرار إلى المتصفح. إعدادات المزود وواجهاته والإرسال ليست منفذة هنا؛ vault أساس للمرحلة السادسة فقط.
- لم تعد SHOPIFY_SHOP تحدد هوية جميع التجار في الإنتاج؛ هي اقتراح/قيد تجربة في وضع التطوير، بينما الإنتاج يحدد المتجر من ربط OAuth لكل حساب.
- تشغيل `npm start` يسبق بفحص إعدادات الإنتاج: PostgreSQL وHTTPS والأسرار وعدم وجود bypass. طبقة التخزين ترفض SQLite وdemo/bypass في الإنتاج حتى عند تشغيل Next مباشرة. النشر standalone يجب أن ينفذ `node scripts/production-preflight.mjs` أيضًا قبل server.js؛ فحص الإعدادات لا يثبت اتصال قاعدة البيانات.
- لا تُزرع منتجات demo في الإنتاج. كتابة منتجات وصور محلية وتسعير/إنشاء طلبات المحول المحلي في الإنتاج معطلة حتى تنفيذ Shopify CommerceAdapter. APIs محاكاة الإعلانات في الإنتاج غير مفعلة. هذه استجابات فشل واضحة، وليست مزامنة وهمية.

## المخطط والترحيل

`scripts/migrations/002_verified_shop_tenants.sql` ترحيل إضافي transactional ينشئ `shopify_shops` و`tenant_secrets`. المخطط الكامل وسكربت ترحيل SQLite إلى PostgreSQL يتضمنان الجدولين أيضًا. لا يُنفّذ الترحيل تلقائيًا على قاعدة حية ولا يعيد إسناد البيانات القديمة.

مع نسخة احتياطية وقاعدة تجربة فارغة/مخصصة، يطبق المشغل SQL باستخدام psql وON_ERROR_STOP. يجب أن تكون accounts وshopify_connections الأساسية موجودة. يمكن إعادة تطبيق CREATE IF NOT EXISTS؛ لا تغيّر هذه الصيغة مخطط جدول موجود مختلف.

الرجوع الآمن: إيقاف التطبيق ثم الرجوع إلى نسخة الكود السابقة مع إبقاء الجداول الإضافية والبيانات والمفتاح. لا ترجع نسخة قديمة إلى خدمة عامة لأن ضمانات العزل الجديدة لن تبقى فيها. لا توجد عملية DROP تمحو بيانات أو rollback تلقائي يخاطر بالأسرار.

قيود مهمة: اختُبر العزل بحسابين في fixtures على SQLite ثم PostgreSQL 17 محلي، واختُبر الترحيل الإضافي مرتين داخل schema مؤقت. PostgreSQL مُدار أو ترحيل بيانات متجر حي لم يُختبر هنا. لم تُفعّل PostgreSQL RLS؛ العزل في سياق التطبيق والاستعلامات والقيود. يلزم قبل الإنتاج اختبار PostgreSQL فعلي بأقل صلاحيات DB، ومراجعة RLS وسياسات الاحتفاظ والخصوصية والترحيل على نسخة بيانات. لا تمنح اتصال DB مباشرًا للتجار ولا تعتبر هذا تدقيق أمان مستقلًا.

## الاختبارات

- `tests/multitenant-security.test.ts`: هويتان ثابتتان، منع تغيير store query، منع الاستيلاء على متجر مرتبط، فصل المنتجات والطلبات وCSV والشحن والأسرار، وإلغاء تثبيت متجر دون المساس بالآخر، وفشل الإنتاج عند فقدان الهوية/PostgreSQL.
- `tests/production-startup.test.ts`: رفض الإعدادات الناقصة وbypass وقاعدة بعيدة دون TLS، وعدم طباعة الأسرار.
- الاختبارات السابقة محفوظة؛ مجموعتها تشمل تسعير المخزون والطلبات والعزل وwebhooks وOAuth والملفات.

## المتبقي والخطوة التالية

تتوقف هذه المهمة عند المرحلتين 1 و2. مزامنة منتجات Shopify والخيارات والصور وpagination وreconciliation والوظائف الخلفية هي المرحلة 3، وTheme App Extension مع سياق متجر موقّع المرحلة 4، ومسار الطلب المتوافق المرحلة 5، والمزودون الحقيقيون المرحلة 6. لا توجد ادعاءات نجاح لهذه الأجزاء.

للمتجر الأول `h8vsym-t0.myshopify.com`: أنشئ تطبيق تجربة من Dev Dashboard، ووفّر HTTPS وPostgreSQL مخصصًا للتجربة، وأدخل القيم في الإعدادات الآمنة. اضبط callback على `/api/integrations/shopify/callback` وread_products والتطبيق المستقل غير المضمن. اتبع دليل `SHOPIFY-INTEGRATION-SETUP.md` للـOAuth بعد تجهيز هذه المتطلبات؛ تعليماته القديمة باستخدام SQLite مع next start لم تعد صالحة للإنتاج. اختر التوزيع بعد مراجعة أن Custom قد يتطلب تطبيق Public منفصلًا مستقبلًا. لا ترسل أسرارًا في المحادثة. التحقق الحقيقي يكون من `/api/integrations/shopify/verify` بعد التفويض، ولا يكفي نجاح fixtures لادعاء اتصال المتجر.

نتيجة الجلسة: نجح lint وفحص الأنواع والبناء، و188 اختبارًا في المجموعة العامة، و11 حالة في أمر test:postgres (تتداخل حالات عزل التجار مع المجموعة العامة وليست أعدادًا تُجمع)، و16 اختبار متصفح للحاسوب والهاتف. مجموعة الاختبار العامة تتخطى 5 حالات PostgreSQL اختيارية؛ شغّلت هذه الحالات ضمن فحص PostgreSQL المحلي. لم يُختبر Shopify أو مزود إعلان حي.

## الملفات المعدلة والمضافة

- `README.md`
- `docs/MULTITENANT-STAGE-2.md`
- `docs/SHOPIFY-INTEGRATION-SETUP.md`
- `package.json`
- `scripts/migrate-postgres.mjs`
- `scripts/migrations/002_verified_shop_tenants.sql`
- `scripts/postgres-schema.sql`
- `scripts/production-preflight.mjs`
- `scripts/test-postgres.mjs`
- `src/app/api/integrations/shopify/callback/route.ts`
- `src/app/api/integrations/shopify/start/route.ts`
- `src/app/api/products/media/route.ts`
- `src/app/api/products/route.ts`
- `src/app/media/[filename]/route.ts`
- `src/modules/auth/store.ts`
- `src/modules/checkout/repository.ts`
- `src/modules/commerce/adapter.ts`
- `src/modules/integrations/shopify/connections.ts`
- `src/modules/integrations/shopify/sdk.ts`
- `src/modules/media/storage.ts`
- `src/modules/merchants/README.md`
- `src/modules/merchants/local-context.ts`
- `src/modules/merchants/shops.ts`
- `src/modules/merchants/vault.ts`
- `src/modules/storage/database.ts`
- `src/proxy.ts`
- `tests/multitenant-security.test.ts`
- `tests/production-startup.test.ts`
