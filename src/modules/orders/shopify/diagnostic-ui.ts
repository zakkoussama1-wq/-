import type { DiagnosticReport } from "./diagnostic-contract";
const words: Record<string, readonly [string, string, string]> = {
  diagnose: [
    "تشخيص التجربة للقراءة فقط",
    "Read-only trial diagnostics",
    "Diagnostic de l’essai en lecture seule",
  ],
  diagnosing: [
    "جارٍ تشخيص التجربة…",
    "Diagnosing trial…",
    "Diagnostic en cours…",
  ],
  completed: [
    "اكتمل التشخيص المحلي دون تعديل أو اتصال بـShopify.",
    "Local diagnostics completed without writes or Shopify requests.",
    "Diagnostic local terminé sans écriture ni requête Shopify.",
  ],
  yes: ["نعم", "Yes", "Oui"],
  no: ["لا", "No", "Non"],
  unknown: ["غير متحقق", "Not determined", "Non déterminé"],
  job: [
    "حالة مهمة الطلب المثبت",
    "Bound order job",
    "Tâche de la commande liée",
  ],
  credentials: [
    "تشخيص اعتماد Offline",
    "Offline credential diagnostics",
    "Diagnostic des identifiants hors ligne",
  ],
  exists: ["هل المهمة موجودة؟", "Job exists?", "Tâche présente ?"],
  state: ["حالة المهمة (state)", "Job state", "État de tâche"],
  dispatched: [
    "علامة الإرسال (dispatched)",
    "Dispatch marker",
    "Marqueur d’envoi",
  ],
  attempts: ["عدد المحاولات (attempts)", "Attempts", "Tentatives"],
  errorCode: [
    "رمز خطأ المهمة (error_code)",
    "Job error code",
    "Code d’erreur de tâche",
  ],
  hasShopifyOrderId: [
    "هل يوجد Shopify Order ID؟",
    "Shopify Order ID exists?",
    "Identifiant de commande Shopify présent ?",
  ],
  connectionPresent: [
    "هل سجل الاتصال موجود؟",
    "Connection record exists?",
    "Connexion enregistrée ?",
  ],
  sessionMetadataPresent: [
    "هل بيانات الجلسة موجودة؟",
    "Session metadata exists?",
    "Métadonnées de session présentes ?",
  ],
  encryptionKeyFormatValid: [
    "هل تنسيق مفتاح التشفير صالح؟",
    "Encryption key format valid?",
    "Format de clé de chiffrement valide ?",
  ],
  connectionTokenPresent: [
    "هل Access Token موجود في سجل الاتصال بعد فكّه؟",
    "Access token present in decrypted connection?",
    "Jeton d’accès présent dans la connexion déchiffrée ?",
  ],
  accessTokenPresent: [
    "هل Access Token موجود في الجلسة؟",
    "Access token present in session?",
    "Jeton d’accès présent dans la session ?",
  ],
  offlineSession: [
    "هل الجلسة Offline؟",
    "Session is offline?",
    "Session hors ligne ?",
  ],
  connectionDecryptionSucceeded: [
    "هل نجح فك سجل التوكن؟",
    "Token record decrypted?",
    "Enregistrement du jeton déchiffré ?",
  ],
  sessionDecryptionSucceeded: [
    "هل نجح فك بيانات الجلسة؟",
    "Session metadata decrypted?",
    "Métadonnées de session déchiffrées ?",
  ],
  decryptionSucceeded: [
    "هل نجح فك السجلين؟",
    "Both records decrypted?",
    "Les deux enregistrements sont déchiffrés ?",
  ],
  shopMatches: [
    "هل المتجر مطابق؟",
    "Store matches?",
    "Boutique correspondante ?",
  ],
  accessTokenExpired: [
    "هل Access Token منتهي الصلاحية؟",
    "Access token expired?",
    "Jeton d’accès expiré ?",
  ],
  refreshTokenPresent: [
    "هل Refresh Token موجود؟",
    "Refresh token present?",
    "Jeton de renouvellement présent ?",
  ],
  refreshTokenTimeValid: [
    "هل Refresh Token موجود وغير منتهٍ زمنيًا؟",
    "Refresh token present and time-valid?",
    "Jeton de renouvellement présent et non expiré ?",
  ],
  CONNECTION_MISSING: [
    "سجل الاتصال مفقود؛ لا يُعاد إنشاؤه بهذا الفحص.",
    "Connection record missing; this check does not recreate it.",
    "Connexion absente ; ce contrôle ne la recrée pas.",
  ],
  ENCRYPTION_KEY_INVALID: [
    "مفتاح التشفير مفقود أو ليس 64 خانة سداسية؛ لا تولّد مفتاحًا بديلًا عشوائيًا.",
    "Encryption key absent or not 64 hex characters; do not generate a random replacement.",
    "Clé absente ou non composée de 64 caractères hexadécimaux ; ne générez pas de remplacement aléatoire.",
  ],
  SESSION_METADATA_MISSING: [
    "بيانات الجلسة المشفرة مفقودة؛ لا يمكن إثبات اعتماد Offline.",
    "Encrypted session metadata missing; offline provenance cannot be confirmed.",
    "Métadonnées de session absentes ; provenance hors ligne non confirmée.",
  ],
  CONNECTION_TOKEN_MISSING: [
    "التوكن مفقود في سجل الاتصال؛ لا تُستنتج حالة الجلسة منه وحده.",
    "Connection token missing; this alone does not establish session state.",
    "Jeton de connexion absent ; cela seul ne détermine pas l’état de session.",
  ],
  TOKEN_DECRYPTION_FAILED: [
    "فشل فك سجل التوكن؛ قد يكون المفتاح غير مطابق أو السجل غير صالح.",
    "Token record decryption failed; key mismatch or invalid record is possible.",
    "Échec du déchiffrement du jeton ; clé différente ou enregistrement invalide possible.",
  ],
  SESSION_DECRYPTION_FAILED: [
    "فشل فك بيانات الجلسة؛ لا يمكن تحديد وجود التوكن أو انتهائه.",
    "Session decryption failed; token presence and expiry cannot be determined.",
    "Échec du déchiffrement de session ; présence et expiration du jeton indéterminées.",
  ],
  SESSION_METADATA_INVALID: [
    "فُكّت الجلسة لكن بنيتها أو تواريخها غير صالحة.",
    "Session decrypted but its structure or dates are invalid.",
    "Session déchiffrée mais structure ou dates invalides.",
  ],
  OFFLINE_SESSION_REQUIRED: [
    "الجلسة ليست Offline؛ لا يُغيّر التشخيص التفويض.",
    "Session is not offline; diagnostics do not change authorization.",
    "Session non hors ligne ; le diagnostic ne change pas l’autorisation.",
  ],
  ACCESS_TOKEN_MISSING: [
    "لا يوجد Access Token في الجلسة المفكوكة.",
    "Decrypted session has no access token.",
    "Aucun jeton d’accès dans la session déchiffrée.",
  ],
  SHOP_BINDING_MISMATCH: [
    "المتجر داخل الجلسة لا يطابق ربط التاجر؛ لا تُستخدم هذه الجلسة.",
    "Session shop differs from merchant binding; do not use this session.",
    "Boutique de session différente de la liaison marchand ; ne l’utilisez pas.",
  ],
  ACCESS_TOKEN_EXPIRED: [
    "انتهى Access Token؛ هذا لا يثبت إلغاء التفويض. لم يُنفّذ أي تجديد.",
    "Access token expired; authorization is not necessarily revoked. No refresh was performed.",
    "Jeton d’accès expiré ; autorisation pas nécessairement révoquée. Aucun renouvellement effectué.",
  ],
  REFRESH_TOKEN_UNUSABLE: [
    "لا يوجد Refresh Token صالح زمنيًا؛ هذا لا يثبت إلغاء Access Token الحالي.",
    "No time-valid refresh token; this does not prove current access token revocation.",
    "Aucun jeton de renouvellement valide dans le temps ; cela ne prouve pas la révocation du jeton d’accès.",
  ],
  LOCAL_CREDENTIAL_CHECKS_PASSED: [
    "اجتاز الاعتماد الفحص المحلي فقط؛ لم يُختبر قبوله لدى Shopify.",
    "Credential passed local checks only; Shopify acceptance was not tested.",
    "Identifiants valides localement seulement ; acceptation Shopify non testée.",
  ],
  missing: [
    "لا توجد مهمة لهذا الطلب. التحضير يثبت الربط فقط؛ لم تُنشأ مهمة بديلة.",
    "No job exists. Preparation only binds the trial; no replacement job was created.",
    "Aucune tâche. La préparation crée seulement la liaison ; aucune tâche de remplacement créée.",
  ],
  remote: [
    "يوجد معرّف Shopify محفوظ. لا تُنشئ طلبًا بديلًا؛ يلزم فحص الطلب المرتبط.",
    "A Shopify ID is recorded. Do not create a replacement; inspect the linked order.",
    "Identifiant Shopify enregistré. Ne créez pas de remplacement ; vérifiez la commande liée.",
  ],
  uncertain: [
    "الإرسال محتمل أو النتيجة غير مؤكدة. لا تمسح dispatched؛ المطابقة فقط هي المسار الآمن.",
    "Dispatch is possible or outcome uncertain. Keep dispatched; reconcile only.",
    "Envoi possible ou résultat incertain. Conservez dispatched ; rapprochement uniquement.",
  ],
  unsent: [
    "المهمة غير معلّمة بالإرسال. هذه القراءة وحدها لا تفعّل المزامنة ولا تثبت تاريخ كل المحاولات.",
    "Job is not marked dispatched. This read neither enables sending nor proves all attempt history.",
    "Tâche non marquée envoyée. Cette lecture n’active aucun envoi ni ne prouve l’historique complet.",
  ],
  unknownJob: [
    "حالة المهمة غير متوقعة؛ يلزم فحص مخوّل دون تعديلها.",
    "Unexpected job state; authorized review is needed without modifying it.",
    "État de tâche inattendu ; vérification autorisée nécessaire sans modification.",
  ],
  caveat: [
    "الفحص محلي للقراءة فقط؛ لا يتحقق من الشبكة أو قبول Shopify للتوكن، ولا يجدّد الاعتماد أو يعيد محاولة المهمة.",
    "Local read-only check: no network or Shopify token-acceptance test, credential refresh, or job retry.",
    "Contrôle local en lecture seule : aucun test réseau ou d’acceptation Shopify, renouvellement ou nouvelle tentative.",
  ],
  none: ["لا يوجد", "None", "Aucun"],
};
export function diagnosticText(key: string, language: string) {
  return (words[key] ?? words.unknown)[
    language === "en" ? 1 : language === "fr" ? 2 : 0
  ];
}
export function jobExplanation(job: DiagnosticReport["job"]) {
  if (!job.exists) return "missing";
  if (job.hasShopifyOrderId) return "remote";
  if (job.dispatched === 1 || job.state === "uncertain") return "uncertain";
  return job.dispatched === 0 ? "unsent" : "unknownJob";
}
export const offlineFields = [
  "connectionPresent",
  "sessionMetadataPresent",
  "offlineSession",
  "accessTokenPresent",
  "connectionTokenPresent",
  "encryptionKeyFormatValid",
  "connectionDecryptionSucceeded",
  "sessionDecryptionSucceeded",
  "decryptionSucceeded",
  "shopMatches",
  "accessTokenExpired",
  "refreshTokenPresent",
  "refreshTokenTimeValid",
] as const;
