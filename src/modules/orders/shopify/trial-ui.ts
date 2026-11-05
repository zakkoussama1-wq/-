import { z } from "zod";
// Only fixed, translated text and allowlisted machine codes are rendered.
const copy: Record<string, readonly [string, string, string]> = {
  title: [
    "تجربة Shopify للطلب",
    "Shopify order trial",
    "Essai Shopify de la commande",
  ],
  prepare: [
    "تحضير تجربة Shopify",
    "Prepare Shopify trial",
    "Préparer l’essai Shopify",
  ],
  readiness: ["فحص الجاهزية", "Check readiness", "Vérifier la préparation"],
  preparing: [
    "جارٍ تحضير التجربة…",
    "Preparing trial…",
    "Préparation de l’essai…",
  ],
  checking: [
    "جارٍ فحص الجاهزية…",
    "Checking readiness…",
    "Vérification en cours…",
  ],
  explanation: [
    "التحضير يثبت الطلب للتجربة فقط. الفحص للقراءة فقط؛ لا ينشئ أي منهما طلبًا في Shopify.",
    "Preparation only binds this order to the trial. The check is read-only; neither action creates a Shopify order.",
    "La préparation lie uniquement cette commande à l’essai. La vérification est en lecture seule ; aucune action ne crée de commande Shopify.",
  ],
  prepared: [
    "تم تحضير الطلب للتجربة. لم تُفعّل المزامنة ولم يُنشأ طلب Shopify.",
    "Order prepared for the trial. Sending was not enabled and no Shopify order was created.",
    "Commande préparée pour l’essai. L’envoi n’a pas été activé et aucune commande Shopify n’a été créée.",
  ],
  ready: [
    "اجتازت فحوص الجاهزية. لم تُفعّل المزامنة ولم يُنشأ طلب Shopify.",
    "Readiness checks passed. Sending was not enabled and no Shopify order was created.",
    "Les vérifications ont réussi. L’envoi n’a pas été activé et aucune commande Shopify n’a été créée.",
  ],
  blocked: [
    "التجربة غير جاهزة؛ راجع نتائج الفحوص أدناه.",
    "Trial not ready; review the checks below.",
    "Essai non prêt ; consultez les vérifications ci-dessous.",
  ],
  passed: ["ناجح", "Passed", "Réussi"],
  blockedStatus: ["عائق", "Blocked", "Bloqué"],
  unverified: ["غير متحقق", "Unverified", "Non vérifié"],
  login: [
    "تسجيل الدخول بحساب التاجر",
    "Sign in as merchant",
    "Se connecter comme marchand",
  ],
  network: [
    "تعذر الاتصال بالخادم. أعد المحاولة؛ تحضير الطلب نفسه آمن ولا ينشئ طلب Shopify.",
    "Could not reach the server. Retry; preparing the same order is safe and does not create a Shopify order.",
    "Connexion au serveur impossible. Réessayez ; préparer la même commande est sûr et ne crée aucune commande Shopify.",
  ],
  caveat: [
    "نجاح القراءة لا يثبت قبول إنشاء طلب حقيقي أو موافقة كتابة بيانات العملاء؛ راجع ذلك وأتمتة المتجر قبل أي تفعيل.",
    "Successful reads do not prove live creation or protected-data write approval; review those and store automation before enabling sending.",
    "La lecture réussie ne prouve ni la création réelle ni l’autorisation d’écrire les données protégées ; vérifiez aussi les automatisations avant tout envoi.",
  ],
  postgres: [
    "جداول PostgreSQL وصلاحيات الطابور",
    "PostgreSQL schema and queue privileges",
    "Schéma PostgreSQL et droits de file",
  ],
  databaseFence: [
    "حواجز قاعدة البيانات",
    "Database fences",
    "Protections de base de données",
  ],
  trial: [
    "ربط طلب التجربة",
    "Trial order binding",
    "Liaison de la commande d’essai",
  ],
  selectedJob: [
    "مهمة الطلب المحدد",
    "Selected order job",
    "Tâche de la commande sélectionnée",
  ],
  offline: [
    "توكن Offline الحالي",
    "Current offline token",
    "Jeton hors ligne actuel",
  ],
  localOrder: [
    "صلاحية الطلب المحلي",
    "Local order eligibility",
    "Éligibilité de la commande locale",
  ],
  scopes: ["الصلاحيات الفعلية", "Effective scopes", "Autorisations effectives"],
  storedScope: [
    "صلاحية الطلبات في الجلسة المخزنة",
    "Stored session order scope",
    "Autorisation de commande de la session stockée",
  ],
  shopPolicy: [
    "هوية المتجر والعملة والضرائب",
    "Store identity, currency and taxes",
    "Identité de boutique, devise et taxes",
  ],
  schema: [
    "توافق API 2026-10",
    "API 2026-10 compatibility",
    "Compatibilité API 2026-10",
  ],
  protectedData: [
    "قراءة بيانات العملاء المحمية",
    "Protected customer data reads",
    "Lecture des données clients protégées",
  ],
  upstream: [
    "الاتصال أو استجابة Shopify",
    "Shopify connection or response",
    "Connexion ou réponse Shopify",
  ],
  AUTH_REQUIRED: [
    "انتهت جلسة التاجر أو لم تُرسل. سجّل الدخول ثم أعد المحاولة.",
    "Merchant session missing or expired. Sign in and retry.",
    "Session marchand absente ou expirée. Connectez-vous puis réessayez.",
  ],
  TENANT_FORBIDDEN: [
    "لا يمكن فحص طلب تابع لمتجر آخر.",
    "Cannot inspect another store’s order.",
    "Impossible de vérifier la commande d’une autre boutique.",
  ],
  SHOPIFY_CONNECTION_REQUIRED: [
    "يلزم ربط متجر موثّق بحساب التاجر.",
    "A verified store must be linked to this merchant account.",
    "Une boutique vérifiée doit être liée à ce compte marchand.",
  ],
  ORDER_NOT_FOUND: [
    "الطلب غير موجود في حساب التاجر الحالي.",
    "Order not found in the current merchant account.",
    "Commande introuvable dans le compte marchand actuel.",
  ],
  ORIGIN_DENIED: [
    "رفض الخادم مصدر الطلب. أعد المحاولة من لوحة التحكم.",
    "Request origin denied. Retry from the dashboard.",
    "Origine de requête refusée. Réessayez depuis le tableau de bord.",
  ],
  DISABLE_SYNC_BEFORE_TRIAL: [
    "يجب تعطيل المزامنة قبل تحضير التجربة.",
    "Disable sending before preparing the trial.",
    "Désactivez l’envoi avant de préparer l’essai.",
  ],
  TRIAL_CONFIG_MISMATCH: [
    "هذا الطلب لا يطابق إعداد تجربة الطلب الواحد في الخادم.",
    "This order does not match the server’s single-order trial setting.",
    "Cette commande ne correspond pas à l’essai configuré sur le serveur.",
  ],
  TRIAL_ALREADY_BOUND: [
    "التجربة مثبتة مسبقًا لطلب آخر؛ يلزم مراجعة المسؤول.",
    "The trial is already bound to another order; operator review is required.",
    "L’essai est déjà lié à une autre commande ; une vérification opérateur est nécessaire.",
  ],
  TRIAL_ORDER_INVALID: [
    "الطلب غير صالح للتحضير في حساب التاجر الحالي.",
    "Order is not eligible for preparation in this merchant account.",
    "Commande non éligible à la préparation dans ce compte marchand.",
  ],
  TRIAL_WORKERS_IN_FLIGHT: [
    "توجد مهمة قيد المعالجة؛ راجعها قبل تحضير التجربة.",
    "A job is processing; review it before preparing the trial.",
    "Une tâche est en cours ; vérifiez-la avant de préparer l’essai.",
  ],
  TRIAL_PREPARATION_FAILED: [
    "تعذر تحضير التجربة. راجع إعداد الطلب وحواجز قاعدة البيانات.",
    "Could not prepare the trial. Review the order setting and database fences.",
    "Préparation impossible. Vérifiez la commande configurée et les protections de base.",
  ],
  READINESS_STORAGE_UNAVAILABLE: [
    "تعذر فحص قاعدة البيانات مؤقتًا؛ لم تُعدّل بياناتها.",
    "Database readiness unavailable; no data was changed.",
    "Vérification de base indisponible ; aucune donnée modifiée.",
  ],
  INTEGRATIONS_DISABLED: [
    "التكاملات الخارجية أو وضع التشغيل الحالي لا يسمحان بالفحص.",
    "External integrations or the current runtime mode prevent checking.",
    "Les intégrations externes ou le mode actuel empêchent la vérification.",
  ],
  NOT_CHECKED: [
    "لم يُنفّذ هذا الفحص بسبب عائق سابق.",
    "Not checked because an earlier prerequisite failed.",
    "Non vérifié en raison d’un prérequis manquant.",
  ],
  OFFLINE_CURRENT_TOKEN_VERIFIED: [
    "تم التحقق من جلسة Offline الحالية دون تجديد التوكن.",
    "Current offline session verified without refreshing its token.",
    "Session hors ligne actuelle vérifiée sans renouveler le jeton.",
  ],
  OFFLINE_CURRENT_TOKEN_UNUSABLE: [
    "تعذر قراءة توكن Offline صالح؛ راجع الاتصال أو انتهاء التفويض.",
    "No usable current offline token; review connection or authorization expiry.",
    "Aucun jeton hors ligne actuel utilisable ; vérifiez la connexion ou l’expiration.",
  ],
  QUEUE_SCHEMA_PRESENT: [
    "جداول الطابور والأعمدة المطلوبة موجودة.",
    "Queue tables and required columns exist.",
    "Tables de file et colonnes requises présentes.",
  ],
  QUEUE_SCHEMA_MISSING: [
    "جداول أو أعمدة الطابور مفقودة؛ راجع الترحيل.",
    "Queue tables or columns are missing; review the migration.",
    "Tables ou colonnes de file manquantes ; vérifiez la migration.",
  ],
  QUEUE_PRIVILEGES_MISSING: [
    "صلاحيات قاعدة البيانات لا تكفي لتشغيل الطابور.",
    "Database privileges are insufficient for the queue.",
    "Droits de base insuffisants pour la file.",
  ],
  QUEUE_UNIQUENESS_MISSING: [
    "قيود منع تكرار مهام الطلبات مفقودة.",
    "Queue uniqueness constraints are missing.",
    "Contraintes d’unicité de file manquantes.",
  ],
  TRIAL_GUARDS_PRESENT: [
    "حواجز PostgreSQL الخاصة بالتجربة موجودة وفعالة.",
    "PostgreSQL trial guards exist and are enabled.",
    "Protections PostgreSQL de l’essai présentes et actives.",
  ],
  TRIAL_GUARDS_MISSING: [
    "بعض حواجز PostgreSQL مفقودة أو معطلة؛ راجع الترحيل.",
    "PostgreSQL trial guards are missing or disabled; review the migration.",
    "Protections PostgreSQL manquantes ou désactivées ; vérifiez la migration.",
  ],
  SINGLE_ORDER_BOUND: [
    "الطلب مطابق لإعداد الخادم والربط الدائم في قاعدة البيانات.",
    "Order matches server configuration and the durable database binding.",
    "Commande conforme à la configuration serveur et à la liaison persistante.",
  ],
  SINGLE_ORDER_NOT_BOUND: [
    "لم يُثبت هذا الطلب للتجربة أو لا يطابق إعداد الخادم.",
    "Order is not prepared for the trial or does not match server configuration.",
    "Commande non préparée pour l’essai ou non conforme au serveur.",
  ],
  SELECTED_JOB_UNSENT: [
    "مهمة الطلب موجودة ولم تُرسل بعد.",
    "The order job exists and has not been dispatched.",
    "La tâche de commande existe et n’a pas été envoyée.",
  ],
  SELECTED_JOB_NOT_READY_FOR_CREATION: [
    "المهمة مفقودة أو أُرسلت سابقًا أو ليست في حالة تسمح بإنشاء جديد؛ لا تمسح علامة الإرسال.",
    "Job missing, previously dispatched or not eligible for new creation; do not clear its dispatch marker.",
    "Tâche absente, déjà envoyée ou non éligible à une nouvelle création ; ne supprimez pas son marqueur.",
  ],
  LOCAL_ORDER_ELIGIBLE: [
    "الطلب محلي من منتجات Shopify وغير ملغى.",
    "Local Shopify-sourced order is not cancelled.",
    "Commande locale issue de Shopify non annulée.",
  ],
  LOCAL_ORDER_INELIGIBLE: [
    "الطلب ملغى أو ليس من منتجات Shopify.",
    "Order is cancelled or not Shopify-sourced.",
    "Commande annulée ou non issue de Shopify.",
  ],
  STORED_ORDER_SCOPE_VERIFIED: [
    "الجلسة المخزنة تتضمن صلاحية الطلبات المطلوبة.",
    "Stored session includes the required order scope.",
    "La session stockée inclut l’autorisation de commande requise.",
  ],
  STORED_ORDER_SCOPE_MISSING: [
    "بيانات الجلسة المخزنة لا تؤكد write_orders، حتى لو منحها Shopify حاليًا؛ راجع الاتصال.",
    "Stored session does not confirm write_orders, even if Shopify currently grants it; review connection.",
    "La session stockée ne confirme pas write_orders, même si Shopify l’accorde actuellement ; vérifiez la connexion.",
  ],
  REQUIRED_SCOPES_VERIFIED: [
    "أكد Shopify منح read_products وwrite_orders.",
    "Shopify confirmed read_products and write_orders.",
    "Shopify a confirmé read_products et write_orders.",
  ],
  REQUIRED_SCOPES_MISSING: [
    "لم يؤكد Shopify جميع الصلاحيات المطلوبة.",
    "Shopify did not confirm all required scopes.",
    "Shopify n’a pas confirmé toutes les autorisations requises.",
  ],
  DZD_ZERO_ADDITIONAL_TAX_POLICY: [
    "هوية المتجر صحيحة والعملـة DZD وسياسة الضرائب مدعومة.",
    "Store identity, DZD currency and tax policy are supported.",
    "Identité, devise DZD et politique fiscale prises en charge.",
  ],
  SHOP_CURRENCY_OR_TAX_UNSUPPORTED: [
    "هوية المتجر أو العملة أو الضرائب لا تطابق السياسة المدعومة؛ لا تغيّر الضرائب لتجاوز الفحص.",
    "Store identity, currency or taxes do not match supported policy; do not change taxes to bypass this check.",
    "Identité, devise ou taxes incompatibles ; ne changez pas les taxes pour contourner ce contrôle.",
  ],
  API_2026_10_PAYLOAD_AND_LOOKUP_VALIDATED: [
    "توافق مخطط 2026-10 وبيانات الطلب واستعلام المطابقة مؤكّد بالقراءة.",
    "2026-10 schema, order payload and lookup selection validated read-only.",
    "Schéma 2026-10, données de commande et recherche validés en lecture seule.",
  ],
  PROTECTED_ADDRESS_READ_OBSERVED: [
    "لوحظ وصول مقروء لحقول عنوان محمية؛ هذا لا يثبت موافقة الكتابة.",
    "Protected address read access observed; this does not prove write approval.",
    "Lecture de champs d’adresse protégés observée ; cela ne prouve pas l’autorisation d’écriture.",
  ],
  PROTECTED_DATA_NOT_PROVEN: [
    "لم توجد بيانات غير محجوبة تثبت الوصول؛ لا يُعد ذلك نجاحًا للفحص.",
    "No unredacted data proved access; the check is not passed.",
    "Aucune donnée non masquée ne prouve l’accès ; contrôle non réussi.",
  ],
  PROTECTED_DATA_READ_DENIED_OR_UNAVAILABLE: [
    "رُفضت قراءة البيانات المحمية أو تعذر الاتصال للتحقق منها.",
    "Protected-data read denied or unavailable.",
    "Lecture de données protégées refusée ou indisponible.",
  ],
  API_VERSION_MISMATCH: [
    "لم يؤكد Shopify إصدار API 2026-10 المطلوب.",
    "Shopify did not confirm required API version 2026-10.",
    "Shopify n’a pas confirmé la version API 2026-10 requise.",
  ],
  THROTTLED: [
    "بلغ الفحص حد طلبات Shopify؛ أعد المحاولة لاحقًا.",
    "Shopify rate limit reached; retry later.",
    "Limite de requêtes Shopify atteinte ; réessayez plus tard.",
  ],
  SHOPIFY_ACCESS_DENIED: [
    "رفض Shopify التوكن أو الوصول؛ راجع تفويض المتجر.",
    "Shopify rejected the token or access; review store authorization.",
    "Shopify a refusé le jeton ou l’accès ; vérifiez l’autorisation.",
  ],
  PROTECTED_DATA_OR_SCOPE_DENIED: [
    "رفض Shopify الوصول إلى حقل أو صلاحية مطلوبة.",
    "Shopify denied a required field or scope.",
    "Shopify a refusé un champ ou une autorisation requis.",
  ],
  SHOPIFY_HTTP_FAILURE: [
    "أعاد Shopify فشل اتصال HTTP؛ أعد المحاولة لاحقًا.",
    "Shopify returned an HTTP failure; retry later.",
    "Échec HTTP Shopify ; réessayez plus tard.",
  ],
  SHOPIFY_GRAPHQL_REJECTED: [
    "رفض Shopify استعلام GraphQL؛ يلزم مراجعة توافق الاستعلام.",
    "Shopify rejected the GraphQL query; review compatibility.",
    "Shopify a refusé la requête GraphQL ; vérifiez sa compatibilité.",
  ],
  SHOPIFY_RESPONSE_INVALID: [
    "استجابة Shopify لا تكفي للتحقق الآمن.",
    "Shopify response cannot substantiate safe verification.",
    "Réponse Shopify insuffisante pour une vérification sûre.",
  ],
  SHOPIFY_READINESS_UNAVAILABLE: [
    "تعذر إكمال فحوص Shopify؛ أعد المحاولة بعد التحقق من الاتصال.",
    "Could not complete Shopify checks; verify connection and retry.",
    "Vérifications Shopify impossibles ; vérifiez la connexion puis réessayez.",
  ],
  TAX_BREAKDOWN_REQUIRED: [
    "تحتاج الضرائب إلى تفصيل موثوق غير موجود في حساب الطلب المحلي.",
    "An authoritative tax breakdown is missing from the local quote.",
    "Ventilation fiscale fiable absente du devis local.",
  ],
  INVENTORY_POLICY_UNSUPPORTED: [
    "سياسة المخزون يجب أن تكون BYPASS لهذه التجربة.",
    "Inventory policy must be BYPASS for this trial.",
    "La politique de stock doit être BYPASS pour cet essai.",
  ],
  INVALID_MONEY: [
    "مبلغ الطلب المحلي غير صالح.",
    "Local order amount is invalid.",
    "Montant de commande locale invalide.",
  ],
  INVALID_LOCATION: [
    "الولاية والبلدية غير متوافقتين مع مرجع الطلب.",
    "Order wilaya and commune do not match the geography reference.",
    "Wilaya et commune incompatibles avec le référentiel.",
  ],
  INVALID_ORDER_SNAPSHOT: [
    "بيانات المنتج أو طريقة التوصيل المحفوظة غير صالحة للمزامنة.",
    "Stored product or shipping snapshot is not eligible for sync.",
    "Données produit ou livraison stockées non éligibles à la synchronisation.",
  ],
  RECONCILIATION_INVALID: [
    "استجابة مطابقة الطلب غير متوقعة؛ لا تُنشئ بديلًا.",
    "Unexpected reconciliation response; do not create a replacement.",
    "Réponse de rapprochement inattendue ; ne créez pas de remplacement.",
  ],
  MULTIPLE_REMOTE_MATCHES: [
    "وجدت المطابقة أكثر من طلب؛ يلزم فحص يدوي دون إنشاء جديد.",
    "Multiple remote matches require review without another creation.",
    "Plusieurs correspondances nécessitent une vérification sans nouvelle création.",
  ],
  SCHEMA_UNSUPPORTED: [
    "مخطط Shopify غير متاح أو غير مدعوم.",
    "Shopify schema unavailable or unsupported.",
    "Schéma Shopify indisponible ou non pris en charge.",
  ],
  SCHEMA_ORDER_CREATE_MISSING: [
    "المخطط لا يتضمن orderCreate المتوقع.",
    "Schema lacks the expected orderCreate mutation.",
    "La mutation orderCreate attendue est absente du schéma.",
  ],
  SCHEMA_REQUIRED_ARGUMENT: [
    "المخطط يتطلب وسيطًا إضافيًا؛ يلزم تعديل مُراجع.",
    "Schema requires an additional argument; a reviewed update is needed.",
    "Un argument supplémentaire est requis ; une modification révisée est nécessaire.",
  ],
  SCHEMA_REQUIRED_FIELD: [
    "المخطط يتطلب حقلًا غير متاح في بيانات الطلب.",
    "Schema requires a field missing from the order data.",
    "Un champ requis par le schéma manque dans la commande.",
  ],
  SCHEMA_UNSUPPORTED_FIELD: [
    "بعض حقول الطلب غير مدعومة في المخطط الفعلي.",
    "Some order fields are unsupported by the actual schema.",
    "Certains champs ne sont pas pris en charge par le schéma réel.",
  ],
  SCHEMA_INVALID_ENUM: [
    "المخطط لا يدعم إحدى قيم الدفع أو العملة أو المخزون المطلوبة.",
    "Schema does not support a required payment, currency or inventory value.",
    "Une valeur de paiement, devise ou stock requise n’est pas prise en charge.",
  ],
  SCHEMA_INVALID_INPUT: [
    "بنية بيانات الطلب لا تطابق المخطط الفعلي.",
    "Order input structure does not match the actual schema.",
    "Structure de commande incompatible avec le schéma réel.",
  ],
  SCHEMA_INVALID_SCALAR: [
    "نوع أحد حقول الطلب لا يطابق المخطط الفعلي.",
    "An order field type does not match the actual schema.",
    "Type d’un champ incompatible avec le schéma réel.",
  ],
  SCHEMA_INVALID_LIST: [
    "بنية قائمة في بيانات الطلب لا تطابق المخطط الفعلي.",
    "An order list structure does not match the actual schema.",
    "Structure d’une liste incompatible avec le schéma réel.",
  ],
  UNKNOWN_DIAGNOSTIC: [
    "تعذر تفسير الاستجابة بأمان؛ أعد المحاولة أو راجع المسؤول.",
    "Could not safely interpret the response; retry or ask the operator.",
    "Interprétation sûre de la réponse impossible ; réessayez ou contactez l’opérateur.",
  ],
};
export function trialText(key: string, language: string) {
  return (copy[key] ?? copy.UNKNOWN_DIAGNOSTIC)[
    language === "en" ? 1 : language === "fr" ? 2 : 0
  ];
}
export function safeTrialCode(value: unknown) {
  return typeof value === "string" &&
    /^[A-Z_0-9]+$/.test(value) &&
    Object.hasOwn(copy, value)
    ? value
    : "UNKNOWN_DIAGNOSTIC";
}
const check = z.object({
  status: z.enum(["passed", "blocked", "unverified"]),
  code: z.unknown().transform(safeTrialCode),
});
export const trialReportSchema = z
  .object({
    readOnly: z.literal(true),
    liveOrderCreationVerified: z.literal(false),
    ready: z.boolean(),
    checks: z.object({
      postgres: check,
      databaseFence: check,
      trial: check,
      selectedJob: check,
      offline: check,
      localOrder: check,
      scopes: check,
      storedScope: check,
      shopPolicy: check,
      schema: check,
      protectedData: check,
      upstream: check.optional(),
    }),
  })
  .refine(
    (report) =>
      !report.ready ||
      Object.values(report.checks).every(
        (c) => c?.status === "passed" && c.code !== "UNKNOWN_DIAGNOSTIC",
      ),
  );
export type TrialReport = z.infer<typeof trialReportSchema>;
