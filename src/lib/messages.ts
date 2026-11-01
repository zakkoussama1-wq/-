export const messages: Record<string, { en: string; fr: string }> = {
  "زيارة الصفحة": { en: "Page view", fr: "Visite de page" },
  "عرض المنتج": { en: "Product view", fr: "Vue du produit" },
  "بدء الطلب": { en: "Checkout started", fr: "Début de commande" },
  "طلب COD محفوظ — Lead": {
    en: "Saved COD order — Lead",
    fr: "Commande COD enregistrée — Lead",
  },
  "طلب مؤكد": { en: "Order confirmed", fr: "Commande confirmée" },
  "طلب مسلّم": { en: "Order delivered", fr: "Commande livrée" },
  "شراء حسب التعريف التجريبي": {
    en: "Purchase under the simulation definition",
    fr: "Achat selon la définition de simulation",
  },
  "تعذر تحميل سجل المحاكاة.": {
    en: "Could not load simulation logs.",
    fr: "Impossible de charger le journal de simulation.",
  },
  "تم تحديث المحاكاة المحلية.": {
    en: "Local simulation updated.",
    fr: "Simulation locale mise à jour.",
  },
  "تعذر تنفيذ اختبار المحاكاة.": {
    en: "Could not run the simulation test.",
    fr: "Impossible d’exécuter le test de simulation.",
  },
  "محاكاة الإعلانات والتحويلات": {
    en: "Advertising and conversion simulation",
    fr: "Simulation des publicités et conversions",
  },
  "محاكاة محلية فقط": {
    en: "Local simulation only",
    fr: "Simulation locale uniquement",
  },
  "تحديث السجل": { en: "Refresh logs", fr: "Actualiser le journal" },
  "لا توجد اتصالات بمنصات الإعلانات أو مفاتيح مطلوبة. الحمولات والسجلات هنا تجريبية وليست تأكيد تسليم من المزوّد.":
    {
      en: "No advertising platforms are contacted and no keys are required. Payloads and logs are simulated, without provider delivery confirmation.",
      fr: "Aucune plateforme publicitaire n’est contactée et aucune clé n’est nécessaire. Les charges utiles et journaux sont simulés, sans confirmation du fournisseur.",
    },
  "جارٍ تحميل سجل المحاكاة…": {
    en: "Loading simulation logs…",
    fr: "Chargement du journal de simulation…",
  },
  "تفعيل المحاكاة المحلية": {
    en: "Enable local simulation",
    fr: "Activer la simulation locale",
  },
  "محاكاة Purchase عند نقل الطلب إلى تم التسليم": {
    en: "Simulate Purchase when an order is marked delivered",
    fr: "Simuler Purchase lorsqu’une commande est marquée livrée",
  },
  "الافتراضي: حفظ COD يولد Lead، والتأكيد والتسليم حدثان منفصلان. تفعيل Purchase هنا تعريف تجريبي للتسليم، وليس إثبات تحصيل أموال.":
    {
      en: "Default: saving COD creates a Lead; confirmation and delivery are separate events. Purchase mapping here is a simulated delivery definition, without proof of payment.",
      fr: "Par défaut, l’enregistrement COD génère un Lead ; confirmation et livraison sont distinctes. Le mappage Purchase est une définition de livraison simulée, sans preuve d’encaissement.",
    },
  "حفظ إعدادات المحاكاة": {
    en: "Save simulation settings",
    fr: "Enregistrer les paramètres de simulation",
  },
  "اختبار الحمولة ومنع التكرار": {
    en: "Test payloads and deduplication",
    fr: "Tester les charges utiles et la déduplication",
  },
  "هذا الاختبار لا ينشئ طلبًا. قناتا Meta وTikTok تشتركان في event_id واحد، وتحسب المحاكاة حدثًا واحدًا لكل منصة.":
    {
      en: "This test creates no order. Browser and server channels share an event_id, and the simulation counts one event per platform.",
      fr: "Ce test ne crée aucune commande. Les canaux navigateur et serveur partagent un event_id et la simulation compte un événement par plateforme.",
    },
  "نوع الحدث": { en: "Event type", fr: "Type d’événement" },
  "محاكاة فشل المحاولة الأولى": {
    en: "Simulate first-attempt failure",
    fr: "Simuler l’échec de la première tentative",
  },
  "إنشاء حدث تجريبي": {
    en: "Create test event",
    fr: "Créer un événement de test",
  },
  "سجل الأحداث التجريبية": {
    en: "Simulated event logs",
    fr: "Journal des événements simulés",
  },
  المنصة: { en: "Platform", fr: "Plateforme" },
  "يعرض السجل آخر 200 صف. لا يحتوي على أسماء العملاء أو أرقامهم أو عناوينهم؛ تظهر أسماء معرّفات النقر فقط دون قيمها.":
    {
      en: "Shows the latest 200 rows. Logs contain no customer names, phone numbers or addresses; only click identifier names appear, without their values.",
      fr: "Affiche les 200 dernières lignes. Aucun nom, téléphone ni adresse client ; seuls les noms des identifiants de clic apparaissent, sans leurs valeurs.",
    },
  الحدث: { en: "Event", fr: "Événement" },
  القناة: { en: "Channel", fr: "Canal" },
  المحاولات: { en: "Attempts", fr: "Tentatives" },
  "رقم الطلب": { en: "Order reference", fr: "Référence de commande" },
  الوقت: { en: "Time", fr: "Heure" },
  المتصفح: { en: "Browser", fr: "Navigateur" },
  الخادم: { en: "Server", fr: "Serveur" },
  "فشل تجريبي": { en: "Simulated failure", fr: "Échec simulé" },
  "مكرر — لم يُحسب ثانية": {
    en: "Duplicate — not counted again",
    fr: "Doublon — non recompté",
  },
  "تمت المحاكاة": { en: "Simulated", fr: "Simulé" },
  "عرض الحمولة": { en: "View payload", fr: "Voir la charge utile" },
  "إعادة محاولة نفس الحدث": {
    en: "Retry same event",
    fr: "Réessayer le même événement",
  },
  "لا توجد أحداث محاكاة بعد. فعّلها واختبر حدثًا أو أرسل طلبًا بعد الموافقة.": {
    en: "No simulated events yet. Enable simulation and test an event or submit an order after consent.",
    fr: "Aucun événement simulé. Activez la simulation et testez un événement ou envoyez une commande après consentement.",
  },
  "حمولة محاكاة — لم تُرسل خارجيًا": {
    en: "Simulated payload — not sent externally",
    fr: "Charge utile simulée — aucun envoi externe",
  },
  "هذه معاينة محلية. providerConfirmed=false دائمًا.": {
    en: "Local preview. providerConfirmed is always false.",
    fr: "Aperçu local. providerConfirmed reste toujours false.",
  },
  "تعليمات نقطة الاستلام (اختياري)": {
    en: "Pickup instructions (optional)",
    fr: "Instructions de retrait (facultatif)",
  },
  "السعر السابق:": { en: "Previous price:", fr: "Ancien prix :" },
  "نفد هذا الخيار من المخزون.": {
    en: "This variant is out of stock.",
    fr: "Cette variante est en rupture de stock.",
  },
  "متوفر للطلب": { en: "Available to order", fr: "Disponible à la commande" },
  "سيؤكد المتجر نقطة الاستلام معك.": {
    en: "The store will confirm the pickup location with you.",
    fr: "La boutique confirmera le point de retrait avec vous.",
  },
  "أوافق على محاكاة أحداث الزيارة والطلب محليًا، دون إرسال بيانات إلى منصات الإعلانات.":
    {
      en: "I agree to locally simulate visit and order events without sending data to advertising platforms.",
      fr: "J’accepte la simulation locale des visites et commandes, sans envoi aux plateformes publicitaires.",
    },
  "سعر الوحدة": { en: "Unit price", fr: "Prix unitaire" },
  "تعليمات الاستلام": {
    en: "Pickup instructions",
    fr: "Instructions de retrait",
  },
  "فتح نموذج المنتج": {
    en: "Open product form",
    fr: "Ouvrir le formulaire produit",
  },
  "نسخ رابط المنتج": { en: "Copy product link", fr: "Copier le lien produit" },
  "تم نسخ رابط نموذج المنتج.": {
    en: "Product form link copied.",
    fr: "Lien du formulaire produit copié.",
  },
  "تعذر نسخ الرابط. افتح النموذج وانسخ العنوان.": {
    en: "Could not copy the link. Open the form and copy its address.",
    fr: "Impossible de copier le lien. Ouvrez le formulaire et copiez son adresse.",
  },
  "نسخ الرابط": { en: "Copy link", fr: "Copier le lien" },
  "عرض الصورة": { en: "Show image", fr: "Afficher l’image" },
  "الإعلانات والتحويلات": {
    en: "Advertising & conversions",
    fr: "Publicités et conversions",
  },
  "اختبر أحداث الإعلان محليًا وراجع الحمولات ومنع التكرار دون إرسال خارجي.": {
    en: "Test advertising events locally and inspect payloads and deduplication without external delivery.",
    fr: "Testez les événements localement et vérifiez les charges utiles et doublons sans envoi externe.",
  },
  "تغيرت إعدادات المحاكاة. حدّث الصفحة.": {
    en: "Simulation settings changed. Reload the page.",
    fr: "Les paramètres de simulation ont changé. Actualisez la page.",
  },
  "فعّل المحاكاة المحلية أولًا.": {
    en: "Enable local simulation first.",
    fr: "Activez d’abord la simulation locale.",
  },
  "حدث المحاكاة غير موجود.": {
    en: "Simulation event not found.",
    fr: "Événement de simulation introuvable.",
  },
  "أضف منتجًا نشطًا لاختبار المحاكاة.": {
    en: "Add an active product to test simulation.",
    fr: "Ajoutez un produit actif pour tester la simulation.",
  },
  "تعذر تسجيل حدث المحاكاة.": {
    en: "Could not record the simulated event.",
    fr: "Impossible d’enregistrer l’événement simulé.",
  },
  "معرف المنتج غير صالح.": {
    en: "Invalid product ID.",
    fr: "Identifiant produit invalide.",
  },

  "اختيار الصور": { en: "Choose images", fr: "Choisir des images" },

  "استورد رابط الصورة أولًا للتحقق منه وحفظ نسخة محلية.": {
    en: "Import the image URL first to validate it and save a local copy.",
    fr: "Importez d’abord l’URL de l’image pour la vérifier et en conserver une copie locale.",
  },

  "صور المنتج": { en: "Product images", fr: "Images du produit" },
  "PNG أو JPG أو WebP. الحد لكل صورة:": {
    en: "PNG, JPG or WebP. Per-image limit:",
    fr: "PNG, JPG ou WebP. Limite par image :",
  },
  "حتى 12 صورة.": { en: "Up to 12 images.", fr: "Jusqu’à 12 images." },
  "الصورة الرئيسية": { en: "Main image", fr: "Image principale" },
  "تعيين صورة رئيسية": {
    en: "Set main image",
    fr: "Définir l’image principale",
  },
  "تقديم الصورة": { en: "Move image earlier", fr: "Avancer l’image" },
  "تأخير الصورة": { en: "Move image later", fr: "Reculer l’image" },
  "استبدال الصورة": { en: "Replace image", fr: "Remplacer l’image" },
  "إزالة الصورة": { en: "Remove image", fr: "Retirer l’image" },
  "معاينة الصورة المختارة": {
    en: "Selected image preview",
    fr: "Aperçu de l’image sélectionnée",
  },
  "جارٍ رفع الصور…": {
    en: "Uploading images…",
    fr: "Téléversement des images…",
  },
  "رفع صور من الجهاز": {
    en: "Upload images from device",
    fr: "Téléverser des images depuis l’appareil",
  },
  "ملف الصورة البديلة": {
    en: "Replacement image file",
    fr: "Fichier image de remplacement",
  },
  "استيراد الصورة": { en: "Import image", fr: "Importer l’image" },
  "نطاقات الاستيراد المعتمدة:": {
    en: "Approved import domains:",
    fr: "Domaines d’importation autorisés :",
  },
  "إزالة الصورة تفصلها عن المنتج ولا تمسح ملفها التاريخي.": {
    en: "Removing an image detaches it from the product and keeps its historical file.",
    fr: "Retirer une image la détache du produit et conserve son fichier historique.",
  },
  "يمكن إضافة 12 صورة كحد أقصى للمنتج.": {
    en: "A product can have up to 12 images.",
    fr: "Un produit peut contenir jusqu’à 12 images.",
  },
  "حجم الصورة يتجاوز الحد المسموح.": {
    en: "The image exceeds the size limit.",
    fr: "L’image dépasse la taille autorisée.",
  },
  "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP.": {
    en: "Unsupported image format. Use PNG, JPG or WebP.",
    fr: "Format d’image non pris en charge. Utilisez PNG, JPG ou WebP.",
  },
  "أبعاد الصورة يجب أن تكون بين 16 و8192 بكسل، دون صور متحركة.": {
    en: "Image dimensions must be 16–8192 pixels. Animated images are not supported.",
    fr: "Les dimensions doivent être comprises entre 16 et 8192 pixels. Les images animées ne sont pas acceptées.",
  },
  "محتوى الصورة غير صالح أو أبعادها كبيرة جدًا.": {
    en: "The image content is invalid or its dimensions are too large.",
    fr: "Le contenu de l’image est invalide ou ses dimensions sont trop grandes.",
  },
  "ملف الصورة فارغ.": {
    en: "The image file is empty.",
    fr: "Le fichier image est vide.",
  },
  "أدخل رابط صورة HTTPS صالحًا.": {
    en: "Enter a valid HTTPS image URL.",
    fr: "Saisissez une URL d’image HTTPS valide.",
  },
  "مصدر الصورة غير مسموح. استخدم الرفع أو نطاقًا معتمدًا.": {
    en: "Image source not allowed. Upload a file or use an approved domain.",
    fr: "Source d’image non autorisée. Téléversez un fichier ou utilisez un domaine autorisé.",
  },
  "تعذر التحقق من نطاق الصورة العام.": {
    en: "Could not verify the public image domain.",
    fr: "Impossible de vérifier le domaine public de l’image.",
  },
  "تعذر تنزيل الصورة. استخدم ملفًا من جهازك.": {
    en: "Could not download the image. Use a file from your device.",
    fr: "Impossible de télécharger l’image. Utilisez un fichier de votre appareil.",
  },
  "تعذر حفظ الصورة. أعد المحاولة.": {
    en: "Could not save the image. Try again.",
    fr: "Impossible d’enregistrer l’image. Réessayez.",
  },
  "الصورة غير موجودة أو لا تنتمي إلى متجرك.": {
    en: "The image is missing or does not belong to your store.",
    fr: "L’image est introuvable ou n’appartient pas à votre boutique.",
  },
  "الصورة غير موجودة.": { en: "Image not found.", fr: "Image introuvable." },
  "تعذر عرض الصورة.": { en: "Image unavailable.", fr: "Image indisponible." },
  "رمز المنتج SKU": { en: "Product SKU", fr: "SKU du produit" },
  "وصف المنتج": { en: "Product description", fr: "Description du produit" },
  "سعر المقارنة بالدينار (اختياري)": {
    en: "Compare-at price in DZD (optional)",
    fr: "Prix de comparaison en DZD (facultatif)",
  },
  "رمز الخيار SKU": { en: "Variant SKU", fr: "SKU de la variante" },
  "صورة الخيار": { en: "Variant image", fr: "Image de la variante" },
  "نسخ المنتج": { en: "Duplicate product", fr: "Dupliquer le produit" },
  نسخة: { en: "Copy", fr: "Copie" },
  "حذف المنتج": { en: "Delete product", fr: "Supprimer le produit" },
  "تأكيد حذف المنتج": {
    en: "Confirm product deletion",
    fr: "Confirmer la suppression du produit",
  },
  "هل تريد حذف هذا المنتج؟": {
    en: "Delete this product?",
    fr: "Supprimer ce produit ?",
  },
  "حذف المنتج يخفيه ويحفظ خياراته وصوره لاستمرار سجل الطلبات والمخزون.": {
    en: "Deletion hides the product and preserves its variants and images for order and stock history.",
    fr: "La suppression masque le produit et conserve ses variantes et images pour l’historique des commandes et du stock.",
  },
  "تم حذف المنتج مع الاحتفاظ بسجله وصوره.": {
    en: "Product deleted; its history and images are preserved.",
    fr: "Produit supprimé ; son historique et ses images sont conservés.",
  },
  "المنتج محذوف. أنشئ نسخة بمعرف جديد.": {
    en: "This product was deleted. Create a copy with a new ID.",
    fr: "Ce produit a été supprimé. Créez une copie avec un nouvel identifiant.",
  },

  "تُطبق التغييرات على الطلبات الجديدة بعد الحفظ.": {
    en: "Changes apply to new orders after saving.",
    fr: "Les modifications s’appliquent aux nouvelles commandes après l’enregistrement.",
  },
  متصل: { en: "Connected", fr: "Connecté" },
  "غير متصل": { en: "Not connected", fr: "Non connecté" },
  "جارٍ تحميل حالة الربط…": {
    en: "Loading connection status…",
    fr: "Chargement de l’état de connexion…",
  },
  "تحديث حالة الربط": {
    en: "Refresh connection status",
    fr: "Actualiser l’état de connexion",
  },

  "رقم طلبك:": {
    en: "Your order reference:",
    fr: "Référence de votre commande :",
  },
  "جارٍ حساب التوصيل…": {
    en: "Calculating delivery…",
    fr: "Calcul de la livraison…",
  },
  "جارٍ حفظ طلبك…": {
    en: "Saving your order…",
    fr: "Enregistrement de votre commande…",
  },
  "مرّر داخل الإعدادات لعرض بقية الخيارات.": {
    en: "Scroll within settings to see more options.",
    fr: "Faites défiler les paramètres pour voir les autres options.",
  },
  "التراجع عن التعديلات": {
    en: "Undo unsaved changes",
    fr: "Annuler les modifications",
  },
  "انتقل إلى المعاينة": { en: "Go to preview", fr: "Aller à l’aperçu" },
  "تم حفظ تصميم النموذج.": {
    en: "Form design saved.",
    fr: "Design du formulaire enregistré.",
  },
  "إعادة تحميل الإعدادات": {
    en: "Reload settings",
    fr: "Recharger les paramètres",
  },
  "جارٍ تحميل إعدادات المنشئ…": {
    en: "Loading builder settings…",
    fr: "Chargement des paramètres de l’éditeur…",
  },
  "إعادة تحميل القوائم": {
    en: "Reload region lists",
    fr: "Recharger les listes des zones",
  },
  "اكتب النصوص واختر المنتج المعروض.": {
    en: "Edit text and choose the featured product.",
    fr: "Modifiez les textes et choisissez le produit affiché.",
  },
  "اختر الأجزاء الظاهرة ورتّب حقول العميل.": {
    en: "Choose visible sections and arrange customer fields.",
    fr: "Choisissez les sections visibles et l’ordre des champs client.",
  },
  "اضبط ألوان متجرك وكثافة النموذج.": {
    en: "Set your store colors and form density.",
    fr: "Réglez les couleurs de votre boutique et la densité du formulaire.",
  },
  "حدد طرق التوصيل والمنطقة المستخدمة للتسعير.": {
    en: "Choose delivery methods and the region used for pricing.",
    fr: "Choisissez les modes de livraison et la zone utilisée pour les tarifs.",
  },
  "سيُستبدل التصميم الحالي بالقيم الافتراضية في المحرر فقط. لن يتغير النموذج المحفوظ حتى تضغط حفظ النموذج.":
    {
      en: "This replaces the draft with default settings in the editor only. Your saved form changes only when you save the form.",
      fr: "Les valeurs par défaut remplaceront le brouillon dans l’éditeur uniquement. Le formulaire enregistré ne changera qu’après enregistrement.",
    },
  "استعادة في المحرر": { en: "Reset draft", fr: "Réinitialiser le brouillon" },
  الخصم: { en: "Discount", fr: "Remise" },
  "تعذر تحميل أسماء المناطق.": {
    en: "Unable to load region names.",
    fr: "Impossible de charger les noms des zones.",
  },
  "جارٍ تحميل المناطق…": {
    en: "Loading regions…",
    fr: "Chargement des zones…",
  },
  "أدر الأسعار والخيارات والمخزون من مكان واحد.": {
    en: "Manage prices, variants and stock in one place.",
    fr: "Gérez les prix, options et stocks au même endroit.",
  },
  "بحث المنتجات": { en: "Search products", fr: "Rechercher les produits" },
  "اسم المنتج أو الخيار أو المعرف": {
    en: "Product, variant or ID",
    fr: "Produit, option ou identifiant",
  },
  "حالة المنتج": { en: "Product status", fr: "Statut du produit" },
  "جدول المنتجات": { en: "Products table", fr: "Tableau des produits" },
  الخيارات: { en: "Variants", fr: "Options" },
  "السعر من": { en: "Price from", fr: "Prix à partir de" },
  "المخزون المتتبع": { en: "Tracked stock", fr: "Stock suivi" },
  "منتج تجريبي": { en: "Demo product", fr: "Produit de démonstration" },
  "مع خيارات دون تتبع": {
    en: "Includes untracked variants",
    fr: "Avec des options non suivies",
  },
  "لا توجد منتجات مطابقة.": {
    en: "No matching products.",
    fr: "Aucun produit correspondant.",
  },
  "أضف منتجًا أو غيّر البحث والتصفية.": {
    en: "Add a product or change your filters.",
    fr: "Ajoutez un produit ou modifiez les filtres.",
  },
  "جدول الطلبات": { en: "Orders table", fr: "Tableau des commandes" },
  "تم تحديث حالة الطلب.": {
    en: "Order status updated.",
    fr: "Statut de commande mis à jour.",
  },
  "صف CSV رقم": { en: "CSV row", fr: "Ligne CSV n°" },
  "غير صالح أو مكرر. تحقق من المعرف والأسعار وحالات التفعيل.": {
    en: "is invalid or duplicated. Check the ID, prices and enabled statuses.",
    fr: "invalide ou dupliquée. Vérifiez l’identifiant, les prix et les statuts d’activation.",
  },
  "مرّر الجدول أفقيًا لعرض جميع الأعمدة.": {
    en: "Scroll the table horizontally to see all columns.",
    fr: "Faites défiler le tableau horizontalement pour voir toutes les colonnes.",
  },
  "أسعار الشحن بالدينار للمنزل والمكتب": {
    en: "Home and office shipping rates in DZD",
    fr: "Tarifs domicile et bureau en DZD",
  },
  "أسعار مستقلة لكل نظام. استثناءات البلديات لها الأولوية.": {
    en: "Rates are separate for each regional system. Commune overrides take priority.",
    fr: "Tarifs indépendants par découpage. Les exceptions communales sont prioritaires.",
  },
  "إضافة تجاوز بلدية": {
    en: "Add commune override",
    fr: "Ajouter une exception communale",
  },
  "إعداد السعر الافتراضي": {
    en: "Set default rate",
    fr: "Configurer le tarif par défaut",
  },
  "إغلاق النافذة": { en: "Close dialog", fr: "Fermer la fenêtre" },
  إلغاء: { en: "Cancel", fr: "Annuler" },
  "إلغاء التحديد": { en: "Clear selection", fr: "Effacer la sélection" },
  "إلغاء التعديلات": { en: "Discard changes", fr: "Annuler les modifications" },
  "استيراد CSV": { en: "Import CSV", fr: "Importer CSV" },
  "استيراد وحفظ": { en: "Import and save", fr: "Importer et enregistrer" },
  "اسم الولاية أو رمزها": {
    en: "Wilaya name or code",
    fr: "Nom ou code de la wilaya",
  },
  الإجراءات: { en: "Actions", fr: "Actions" },
  التالي: { en: "Next", fr: "Suivant" },
  "التغييرات تحتاج إلى حفظ": {
    en: "Changes must be saved",
    fr: "Modifications à enregistrer",
  },
  الرمز: { en: "Code", fr: "Code" },
  السابق: { en: "Previous", fr: "Précédent" },
  "السعر صفر يعني توصيلًا مجانيًا. الحفظ يطبّق القاعدة في النظام المختار فقط.":
    {
      en: "Zero means free delivery. Saving applies this rule only to the selected regional system.",
      fr: "Zéro signifie livraison gratuite. La règle s’applique uniquement au découpage choisi.",
    },
  "المحدد:": { en: "Selected:", fr: "Sélectionnées :" },
  "المكتب متاح": { en: "Office available", fr: "Bureau disponible" },
  "المنطقة غير متاحة؛ عدّل القاعدة لتفعيلها.": {
    en: "Region unavailable; edit the rule to enable it.",
    fr: "Zone indisponible ; modifiez la règle pour l’activer.",
  },
  "النتائج:": { en: "Results:", fr: "Résultats :" },
  الولايات: { en: "Wilayas", fr: "Wilayas" },
  "تجاوزات البلديات": { en: "Commune overrides", fr: "Exceptions communales" },
  "تحديد كل نتائج البحث": {
    en: "Select all search results",
    fr: "Sélectionner tous les résultats",
  },
  "تسبق أسعار الولاية والافتراضي، ولا تتغير بتعديل جدول الولايات.": {
    en: "These take priority over wilaya and default rates, and remain unchanged when editing the table.",
    fr: "Prioritaires sur les tarifs de wilaya et par défaut, elles restent inchangées lors de la modification du tableau.",
  },
  "تعديل الولايات المحددة": {
    en: "Edit selected wilayas",
    fr: "Modifier les wilayas sélectionnées",
  },
  "تعديل جماعي": { en: "Bulk edit", fr: "Modification groupée" },
  "تعديل قاعدة الشحن": {
    en: "Edit shipping rule",
    fr: "Modifier la règle de livraison",
  },
  "تعديلات غير محفوظة": {
    en: "Unsaved changes",
    fr: "Modifications non enregistrées",
  },
  "تفعيل المكتب": { en: "Enable office", fr: "Activer le bureau" },
  "تفعيل المنزل": { en: "Enable home", fr: "Activer le domicile" },
  "جدول أسعار الشحن": {
    en: "Shipping rates table",
    fr: "Tableau des tarifs de livraison",
  },
  "حالة المكتب": { en: "Office status", fr: "Statut bureau" },
  "حالة المنزل": { en: "Home status", fr: "Statut domicile" },
  "حفظ التعديلات": { en: "Save changes", fr: "Enregistrer les modifications" },
  "ستفقد تعديلات الجدول غير المحفوظة. هل تريد المتابعة؟": {
    en: "Unsaved table changes will be lost. Continue?",
    fr: "Les modifications non enregistrées seront perdues. Continuer ?",
  },
  "سعر المكتب بالدينار": {
    en: "Office price in DZD",
    fr: "Prix bureau en DZD",
  },
  "سعر المنزل بالدينار": {
    en: "Home price in DZD",
    fr: "Prix domicile en DZD",
  },
  "سيُطبّق كامل هذه القاعدة على الولايات المحددة فقط. تبقى تجاوزات البلديات كما هي.":
    {
      en: "This entire rule replaces the rules for selected wilayas only. Commune overrides remain unchanged.",
      fr: "Cette règle complète remplace celles des wilayas sélectionnées uniquement. Les exceptions communales sont conservées.",
    },
  "صفوف لكل صفحة": { en: "Rows per page", fr: "Lignes par page" },
  "عدّل السعر أو الحالة، ثم احفظ التعديلات. لا تتغير استثناءات البلديات.": {
    en: "Edit prices or statuses, then save. Commune overrides are preserved.",
    fr: "Modifiez les prix ou statuts, puis enregistrez. Les exceptions communales sont conservées.",
  },
  "فعّل المكتب العام من إعدادات الشحن.": {
    en: "Enable the generic office in shipping settings.",
    fr: "Activez le bureau générique dans les paramètres de livraison.",
  },
  "لا توجد تجاوزات بلديات محفوظة.": {
    en: "No saved commune overrides.",
    fr: "Aucune exception communale enregistrée.",
  },
  "مسح التصفية": { en: "Clear filters", fr: "Effacer les filtres" },
  "يسمح المكتب العام باختيار التوصيل إلى المكتب دون قائمة مكاتب ناقل.": {
    en: "Generic office delivery works without a carrier office directory.",
    fr: "Le bureau générique permet la livraison sans annuaire de bureaux de transporteur.",
  },
  تحديث: { en: "Refresh", fr: "Actualiser" },
  "إعادة المحاولة": { en: "Try again", fr: "Réessayer" },
  الإجمالي: { en: "Total", fr: "Total" },
  العميل: { en: "Customer", fr: "Client" },
  المنتج: { en: "Product", fr: "Produit" },
  "حالات الطلبات": { en: "Order statuses", fr: "Statuts des commandes" },
  "عدد الطلبات": { en: "Order count", fr: "Nombre de commandes" },
  "كل الحالات": { en: "All statuses", fr: "Tous les statuts" },
  "بيانات الطلبات المحفوظة": {
    en: "Saved order data",
    fr: "Données des commandes enregistrées",
  },
  "الفترة الزمنية": { en: "Date range", fr: "Période" },
  "كل الفترات": { en: "All time", fr: "Toutes les périodes" },
  "آخر 7 أيام": { en: "Last 7 days", fr: "7 derniers jours" },
  "آخر 30 يومًا": { en: "Last 30 days", fr: "30 derniers jours" },
  "تحقق من الاتصال ثم أعد المحاولة. لم تتغير بياناتك.": {
    en: "Check your connection and try again. Your data is unchanged.",
    fr: "Vérifiez votre connexion et réessayez. Vos données sont conservées.",
  },
  "جميع الحالات": { en: "All statuses", fr: "Tous les statuts" },
  "باستثناء الملغاة، وليست إيرادات محصّلة": {
    en: "Excludes cancellations; not collected revenue",
    fr: "Hors annulations ; pas des recettes encaissées",
  },
  "بانتظار التأكيد": { en: "Awaiting confirmation", fr: "À confirmer" },
  "طلبات تحتاج إلى مراجعتك": {
    en: "Orders that need your review",
    fr: "Commandes à examiner",
  },
  "طلبات مسلّمة": { en: "Delivered orders", fr: "Commandes livrées" },
  "حسب الحالة المحفوظة": {
    en: "Based on saved status",
    fr: "Selon le statut enregistré",
  },
  "نشاط الطلبات": { en: "Order activity", fr: "Activité des commandes" },
  "التوقيت العالمي UTC": { en: "UTC time", fr: "Heure UTC" },
  "عدد الطلبات اليومية": {
    en: "Daily order count",
    fr: "Nombre de commandes par jour",
  },
  "يشمل المخطط جميع حالات الطلبات خلال الفترة الموضحة.": {
    en: "Chart includes all order statuses in the period shown.",
    fr: "Le graphique inclut tous les statuts sur la période affichée.",
  },
  "لا توجد طلبات خلال هذه الأيام. سيظهر النشاط عند حفظ طلب.": {
    en: "No orders during these days. Activity will appear when an order is saved.",
    fr: "Aucune commande sur ces jours. L’activité apparaîtra après enregistrement.",
  },
  "الأعداد من طلباتك الفعلية فقط.": {
    en: "Counts reflect your actual orders only.",
    fr: "Les chiffres proviennent uniquement de vos commandes réelles.",
  },
  "أحدث الطلبات": { en: "Recent orders", fr: "Commandes récentes" },
  "آخر 5 نتائج ضمن الفترة المحددة": {
    en: "Up to 5 results in the selected period",
    fr: "Jusqu’à 5 résultats sur la période choisie",
  },
  "إدارة الطلبات": { en: "Manage orders", fr: "Gérer les commandes" },
  "البحث في أحدث الطلبات": {
    en: "Search recent orders",
    fr: "Rechercher les commandes récentes",
  },
  "تصفية حسب الحالة": { en: "Filter by status", fr: "Filtrer par statut" },
  "جار تحميل الطلبات": { en: "Loading orders", fr: "Chargement des commandes" },
  "لا توجد نتائج مطابقة": {
    en: "No matching results",
    fr: "Aucun résultat correspondant",
  },
  "ابدأ بطلبك الأول": {
    en: "Start with your first order",
    fr: "Commencez par votre première commande",
  },
  "غيّر البحث أو الحالة أو الفترة الزمنية.": {
    en: "Change your search, status or date range.",
    fr: "Modifiez la recherche, le statut ou la période.",
  },
  "افتح نموذج الطلب وأرسل طلبًا تجريبيًا؛ سيظهر هنا بعد حفظه.": {
    en: "Open the order form and submit a test order; it will appear here once saved.",
    fr: "Ouvrez le formulaire et envoyez une commande test ; elle apparaîtra ici après enregistrement.",
  },
  "إدارة المنتجات": { en: "Manage products", fr: "Gérer les produits" },
  "إغلاق الإشعار": { en: "Dismiss notification", fr: "Fermer la notification" },
  "تم تحديث بيانات النظرة العامة": {
    en: "Overview data refreshed",
    fr: "Données du récapitulatif actualisées",
  },
  "05 XX XX XX XX أو +213": {
    en: "05 XX XX XX XX or +213",
    fr: "05 XX XX XX XX ou +213",
  },
  "DZ Lead Form Pro | مساحة التاجر": {
    en: "DZ Lead Form Pro · Merchant workspace",
    fr: "DZ Lead Form Pro · Espace marchand",
  },
  "Meta وTikTok": {
    en: "Meta and TikTok",
    fr: "Meta et TikTok",
  },
  "· البلدية": {
    en: "· Commune",
    fr: "· Commune",
  },
  "· الخصم": {
    en: "· Discount",
    fr: "· Remise",
  },
  "· الشحن": {
    en: "· Shipping",
    fr: "· Livraison",
  },
  "· الكمية": {
    en: "· Quantity",
    fr: "· Quantité",
  },
  "· المؤكدة:": {
    en: "· Confirmed:",
    fr: "· Confirmées :",
  },
  "· المسلّمة:": {
    en: "· Delivered:",
    fr: "· Livrées :",
  },
  "· الولاية المختارة خارج نتائج البحث": {
    en: "· Selected wilaya outside search results",
    fr: "· Wilaya sélectionnée hors des résultats",
  },
  "· تجريبي": {
    en: "· Demo",
    fr: "· Démo",
  },
  "· قيد التطوير": {
    en: "· In development",
    fr: "· En développement",
  },
  "أخضر زيتوني · مقاس واحد": {
    en: "Olive green · One size",
    fr: "Vert olive · Taille unique",
  },
  "أدخل اسم متجر صحيحًا.": {
    en: "Enter a valid store name.",
    fr: "Saisissez un nom de boutique valide.",
  },
  "أدخل اسمك ولقبك": {
    en: "Enter your full name",
    fr: "Saisissez votre nom complet",
  },
  "أدخل اسمًا صحيحًا دون رموز أو وسوم": {
    en: "Enter a valid name without markup",
    fr: "Saisissez un nom valide sans balises",
  },
  "أدخل الاسم الكامل (٣ أحرف على الأقل)": {
    en: "Enter your full name (at least 3 characters)",
    fr: "Saisissez votre nom complet (3 caractères minimum)",
  },
  "أدخل رقم هاتف جزائري صحيحًا من ١٠ أرقام": {
    en: "Enter a valid 10-digit Algerian phone number",
    fr: "Saisissez un numéro algérien valide à 10 chiffres",
  },
  "أدخل رقم هاتف جزائري صحيحًا: ٠٥ أو ٠٦ أو ٠٧": {
    en: "Enter a valid Algerian phone number starting with 05, 06 or 07",
    fr: "Saisissez un numéro algérien valide commençant par 05, 06 ou 07",
  },
  "أدخل سعر الطريقة المفعّلة": {
    en: "Enter a price for the enabled delivery method",
    fr: "Saisissez un prix pour le mode de livraison activé",
  },
  "أدخل عنوان منزل واضحًا (٨ أحرف على الأقل)": {
    en: "Enter a clear home address (at least 8 characters)",
    fr: "Saisissez une adresse complète (8 caractères minimum)",
  },
  "أدخل قيمة خصم صحيحة حتى منزلتين عشريتين.": {
    en: "Enter a valid discount with up to two decimal places.",
    fr: "Saisissez une remise valide avec deux décimales maximum.",
  },
  "أدخل نطاق المتجر فقط.": {
    en: "Enter only the store domain.",
    fr: "Saisissez uniquement le domaine de la boutique.",
  },
  "أدخل نطاق متجر myshopify.com صحيحًا دون مسار أو بروتوكول.": {
    en: "Enter a valid myshopify.com domain without a protocol or path.",
    fr: "Saisissez un domaine myshopify.com valide sans protocole ni chemin.",
  },
  "أسعار الشحن": {
    en: "Shipping rates",
    fr: "Tarifs de livraison",
  },
  "أسعار الولايات الفعلية": {
    en: "Effective wilaya rates",
    fr: "Tarifs effectifs par wilaya",
  },
  "أسود · مقاس واحد": {
    en: "Black · One size",
    fr: "Noir · Taille unique",
  },
  "أضف منتجاتك وأسعار الشحن قبل مشاركة النموذج. تُحفظ الطلبات عند تأكيدها، وتحتاج تأكيد الاستلام والتسليم من لوحة الطلبات.":
    {
      en: "Add your products and shipping rates before sharing the form. Orders are saved when submitted; manage confirmation and delivery in Orders.",
      fr: "Ajoutez vos produits et tarifs avant de partager le formulaire. Les commandes sont enregistrées à leur envoi ; gérez leur confirmation et livraison dans Commandes.",
    },
  "أكمل معلومات طلبك": {
    en: "Complete your order details",
    fr: "Complétez votre commande",
  },
  "أنشئ حساب متجر مستقلًا أو سجّل الدخول. للحساب المحلي القديم اترك البريد فارغًا.":
    {
      en: "Create an independent store account or sign in. Leave email blank for a legacy local owner account.",
      fr: "Créez un compte boutique ou connectez-vous. Laissez l’e-mail vide pour un ancien compte propriétaire local.",
    },
  "إدارة أسعار الشحن": {
    en: "Manage shipping rates",
    fr: "Gérer les tarifs de livraison",
  },
  "إدارة الدفع عند الاستلام": {
    en: "Cash on delivery management",
    fr: "Gestion du paiement à la livraison",
  },
  "إدارة الطلبات المحفوظة": {
    en: "Saved orders",
    fr: "Commandes enregistrées",
  },
  "إدارة منتجات متجرك": {
    en: "Manage your products",
    fr: "Gérer vos produits",
  },
  "إصدار Meta غير صالح.": {
    en: "Invalid Meta API version.",
    fr: "Version API Meta invalide.",
  },
  "إضافة خيار": {
    en: "Add variant",
    fr: "Ajouter une variante",
  },
  "إضافة منتج": {
    en: "Add product",
    fr: "Ajouter un produit",
  },
  "إعادة تحميل الشحن": {
    en: "Reload shipping",
    fr: "Recharger la livraison",
  },
  "إعادة تحميل المنتج": {
    en: "Reload product",
    fr: "Recharger le produit",
  },
  "إعادة تحميل المواقع": {
    en: "Reload locations",
    fr: "Recharger les localités",
  },
  "إعادة حساب السعر": {
    en: "Recalculate price",
    fr: "Recalculer le prix",
  },
  "إعادة ضبط المحدد": {
    en: "Reset selected",
    fr: "Réinitialiser la sélection",
  },
  "إعداد حساب مالك المتجر المحلي": {
    en: "Set up the local store owner",
    fr: "Configurer le propriétaire local",
  },
  "إعدادات OAuth ناقصة.": {
    en: "OAuth settings are incomplete.",
    fr: "Les paramètres OAuth sont incomplets.",
  },
  "إعدادات تبادل الاعتماد ناقصة.": {
    en: "Token exchange settings are incomplete.",
    fr: "Les paramètres d’échange du jeton sont incomplets.",
  },
  "إعدادات تطبيق Shopify وURL العودة غير متوفرة على الخادم.": {
    en: "Shopify app credentials and callback URL are missing on the server.",
    fr: "Les identifiants Shopify et l’URL de retour manquent sur le serveur.",
  },
  "إغلاق القائمة": {
    en: "Close menu",
    fr: "Fermer le menu",
  },
  "إلغاء التعديل": {
    en: "Cancel editing",
    fr: "Annuler la modification",
  },
  "إنشاء الحساب": {
    en: "Create account",
    fr: "Créer le compte",
  },
  "إنشاء حساب المالك": {
    en: "Create owner account",
    fr: "Créer le compte propriétaire",
  },
  "إنشاء حساب متجر": {
    en: "Create store account",
    fr: "Créer un compte boutique",
  },
  "إنشاء حساب متجر جديد": {
    en: "Create a new store account",
    fr: "Créer un nouveau compte boutique",
  },
  "ابحث ضمن الولاية المختارة": {
    en: "Search within the selected wilaya",
    fr: "Rechercher dans la wilaya sélectionnée",
  },
  "اختبار السعر الفعلي من الخادم": {
    en: "Test the effective server price",
    fr: "Tester le prix calculé par le serveur",
  },
  "اختر البلدية": {
    en: "Choose a commune",
    fr: "Choisissez une commune",
  },
  "اختر الولاية": {
    en: "Choose a wilaya",
    fr: "Choisissez une wilaya",
  },
  "اختر الولاية أولًا": {
    en: "Choose a wilaya first",
    fr: "Choisissez d’abord une wilaya",
  },
  "اختر الولاية والبلدية": {
    en: "Choose a wilaya and commune",
    fr: "Choisissez une wilaya et une commune",
  },
  "اختر الولاية والبلدية لحساب الشحن وإتاحة التأكيد.": {
    en: "Choose a wilaya and commune to calculate shipping and enable confirmation.",
    fr: "Choisissez une wilaya et une commune pour calculer la livraison et confirmer.",
  },
  "اختر كمية بين ١ و١٠": {
    en: "Choose a quantity between 1 and 10",
    fr: "Choisissez une quantité de 1 à 10",
  },
  "اختر منطقة واحدة على الأقل.": {
    en: "Select at least one region.",
    fr: "Sélectionnez au moins une région.",
  },
  "اختيار ملف CSV": {
    en: "Choose CSV file",
    fr: "Choisir un fichier CSV",
  },
  "استجابة اعتماد Shopify غير صالحة.": {
    en: "Invalid Shopify token response.",
    fr: "Réponse de jeton Shopify invalide.",
  },
  "استجابة تحقق غير متوقعة.": {
    en: "Unexpected validation response.",
    fr: "Réponse de validation inattendue.",
  },
  "استخدم منزلتين عشريتين كحد أقصى": {
    en: "Use at most two decimal places",
    fr: "Utilisez deux décimales maximum",
  },
  "استعادة التصميم الافتراضي": {
    en: "Restore default design",
    fr: "Restaurer le modèle par défaut",
  },
  "استكشاف منشئ النموذج": {
    en: "Explore the form builder",
    fr: "Découvrir l’éditeur de formulaire",
  },
  "استيراد CSV (يحدّث القواعد الموجودة في الملف فقط)": {
    en: "Import CSV (updates only rules in the file)",
    fr: "Importer CSV (met à jour uniquement les règles du fichier)",
  },
  "اسم الخيار": {
    en: "Variant name",
    fr: "Nom de la variante",
  },
  "اسم المتجر": {
    en: "Store name",
    fr: "Nom de la boutique",
  },
  "اسم المنتج": {
    en: "Product name",
    fr: "Nom du produit",
  },
  "اعتماد المتجر غير متاح.": {
    en: "Store credentials are unavailable.",
    fr: "Les identifiants de la boutique sont indisponibles.",
  },
  "اعتماد المنصة غير متاح.": {
    en: "Platform credentials are unavailable.",
    fr: "Les identifiants de la plateforme sont indisponibles.",
  },
  افتراضي: {
    en: "Default",
    fr: "Par défaut",
  },
  "اقتباس CSV غير مغلق.": {
    en: "Unclosed CSV quote.",
    fr: "Guillemet CSV non fermé.",
  },
  "الأساس أولًا، ثم النمو": {
    en: "Build your store, step by step",
    fr: "Construisez votre boutique, étape par étape",
  },
  "الأسعار بالدينار؛ المخزون هو الكمية المتاحة بعد الحجوزات. تُحجز الكمية عند حفظ الطلب وتُعاد مرة واحدة عند إلغائه. المنتجات الموقوفة لا تظهر للعميل. لا تُحذف الخيارات المحفوظة حفاظًا على سجل المخزون.":
    {
      en: "Prices are in DZD. Stock shows availability after reservations. Submitting an order reserves stock; cancellation restores it once. Inactive products are hidden. Saved variants cannot be removed to preserve inventory history.",
      fr: "Les prix sont en DZD. Le stock indique la quantité disponible après réservation. Une commande réserve le stock ; son annulation le restitue une seule fois. Les produits inactifs sont masqués. Les variantes enregistrées sont conservées pour l’historique.",
    },
  "الإجمالي النهائي": {
    en: "Final total",
    fr: "Total final",
  },
  "الإجمالي بالدينار": {
    en: "Total in DZD",
    fr: "Total en DZD",
  },
  "الإرسال الخارجي معطّل.": {
    en: "External sending is disabled.",
    fr: "Les envois externes sont désactivés.",
  },
  الإعدادات: {
    en: "Settings",
    fr: "Paramètres",
  },
  الاسم: {
    en: "Name",
    fr: "Nom",
  },
  "الاسم الكامل": {
    en: "Full name",
    fr: "Nom complet",
  },
  "الاسم طويل جدًا": {
    en: "Name is too long",
    fr: "Le nom est trop long",
  },
  الافتراضي: {
    en: "Default",
    fr: "Par défaut",
  },
  "البحث عن بلدية بالعربية أو الفرنسية": {
    en: "Search communes in Arabic or French",
    fr: "Rechercher une commune en arabe ou en français",
  },
  "البحث عن ولاية بالعربية أو الفرنسية": {
    en: "Search wilayas in Arabic or French",
    fr: "Rechercher une wilaya en arabe ou en français",
  },
  "البريد الإلكتروني": {
    en: "Email address",
    fr: "Adresse e-mail",
  },
  "البلديات في كل نظام": {
    en: "Communes in each mode",
    fr: "Communes dans chaque découpage",
  },
  البلدية: {
    en: "Commune",
    fr: "Commune",
  },
  "البلدية المختارة": {
    en: "Selected commune",
    fr: "Commune sélectionnée",
  },
  "البلدية المختارة خارج نتائج البحث": {
    en: "Selected commune outside search results",
    fr: "Commune sélectionnée hors des résultats",
  },
  "البلدية لا تنتمي إلى الولاية المحددة في هذا النظام.": {
    en: "This commune does not belong to the selected wilaya in this mode.",
    fr: "Cette commune n’appartient pas à la wilaya sélectionnée dans ce découpage.",
  },
  التاريخ: {
    en: "Date",
    fr: "Date",
  },
  التحليلات: {
    en: "Analytics",
    fr: "Statistiques",
  },
  "التصدير يشمل القواعد المضبوطة فقط. لا يستورد الملف تفعيل المكتب العام. تُرفض العملية كاملة عند وجود صف خاطئ أو مكرر.":
    {
      en: "Exports contain configured rules only. CSV does not enable generic office delivery. Any invalid or duplicate row rejects the entire import.",
      fr: "L’export contient uniquement les règles configurées. Le CSV n’active pas la livraison au bureau générique. Une ligne invalide ou dupliquée annule tout l’import.",
    },
  "التطبيق غير مُعد للربط.": {
    en: "The app is not configured for integration.",
    fr: "L’application n’est pas configurée pour l’intégration.",
  },
  "التقسيم الإداري": {
    en: "Administrative divisions",
    fr: "Découpage administratif",
  },
  التكاملات: {
    en: "Integrations",
    fr: "Intégrations",
  },
  "التكاملات الخارجية": {
    en: "External integrations",
    fr: "Intégrations externes",
  },
  التوصيل: {
    en: "Shipping",
    fr: "Livraison",
  },
  "التوصيل إلى المكتب": {
    en: "Office delivery",
    fr: "Livraison au bureau",
  },
  "التوصيل إلى المكتب العام مفعّل حسب إعدادات التاجر. لا توجد قائمة مكاتب استلام مسماة، ولا يُطلب عنوان منزل.":
    {
      en: "Generic office delivery is enabled by the merchant. No named pickup offices are configured; a home address is not required.",
      fr: "La livraison au bureau générique est activée par le marchand. Aucun bureau nommé n’est configuré ; l’adresse du domicile n’est pas nécessaire.",
    },
  "التوصيل إلى المكتب غير مفعّل؛ يجب إعداد وضع المكتب العام صراحةً.": {
    en: "Office delivery is disabled; enable generic office mode explicitly.",
    fr: "La livraison au bureau est désactivée ; activez explicitement le mode bureau générique.",
  },
  "التوصيل إلى المنزل": {
    en: "Home delivery",
    fr: "Livraison à domicile",
  },
  "التوصيل غير متاح لهذه المنطقة.": {
    en: "Delivery is unavailable for this region.",
    fr: "La livraison est indisponible pour cette région.",
  },
  الحالة: {
    en: "Status",
    fr: "Statut",
  },
  "الحد الأقصى ١٠ قطع": {
    en: "The maximum quantity is 10",
    fr: "La quantité maximale est 10",
  },
  الحدود: {
    en: "Borders",
    fr: "Bordures",
  },
  "الخصم يجب أن يكون غير سالب، وبحد أقصى ١٠٠٪ أو ١٠ ملايين دينار.": {
    en: "Discount must be nonnegative and at most 100% or 10 million DZD.",
    fr: "La remise doit être positive ou nulle et limitée à 100 % ou 10 millions de DZD.",
  },
  الخلفية: {
    en: "Background",
    fr: "Arrière-plan",
  },
  "الخيار الأساسي": {
    en: "Main variant",
    fr: "Variante principale",
  },
  "الدفع عند الاستلام · طلب محفوظ عند التأكيد": {
    en: "Cash on delivery · Saved on confirmation",
    fr: "Paiement à la livraison · Enregistrée à la confirmation",
  },
  "الدفع عند الاستلام، بتجربة أبسط": {
    en: "Cash on delivery, made simpler",
    fr: "Le paiement à la livraison simplifié",
  },
  "الربط الحالي يطلب قراءة المنتجات فقط. لا توجد مزامنة منتجات أو إنشاء طلب Shopify تلقائي بعد. نجاح الربط ليس دليلًا على عمل تلك الميزات.":
    {
      en: "The current connection requests product read access only. Shopify product sync and automatic order creation are not implemented.",
      fr: "La connexion actuelle demande uniquement la lecture des produits. La synchronisation Shopify et la création automatique de commandes ne sont pas encore disponibles.",
    },
  "السعر الافتراضي": {
    en: "Default price",
    fr: "Prix par défaut",
  },
  "السعر بالدينار": {
    en: "Price in DZD",
    fr: "Prix en DZD",
  },
  "السعر يتجاوز الحد المسموح": {
    en: "Price exceeds the permitted limit",
    fr: "Le prix dépasse la limite autorisée",
  },
  "السعر يجب أن يكون غير سالب": {
    en: "Price must not be negative",
    fr: "Le prix ne peut pas être négatif",
  },
  "السماح بتوصيل المكتب العام دون قائمة مكاتب": {
    en: "Allow generic office delivery without an office list",
    fr: "Autoriser la livraison au bureau générique sans liste de bureaux",
  },
  "الشارع، الحي، رقم المنزل": {
    en: "Street, district, house number",
    fr: "Rue, quartier, numéro de maison",
  },
  "الصفر يعني توصيلًا مجانيًا. تعطيل المنطقة أو الطريقة يمنع التوصيل، ولا يستبدله السعر الافتراضي. تفعيل المكتب يتطلب أيضًا تمكين وضع المكتب العام.":
    {
      en: "Zero means free delivery. Disabling a region or method blocks delivery without falling back to the default price. Office delivery also requires generic office mode.",
      fr: "Zéro signifie livraison gratuite. Désactiver une région ou un mode bloque la livraison sans utiliser le tarif par défaut. Le bureau nécessite aussi le mode bureau générique.",
    },
  الطريقة: {
    en: "Method",
    fr: "Mode",
  },
  "الطلب غير موجود.": {
    en: "Order not found.",
    fr: "Commande introuvable.",
  },
  "الطلب يتجاوز الحجم المسموح.": {
    en: "Order exceeds the size limit.",
    fr: "La commande dépasse la taille autorisée.",
  },
  الطلبات: {
    en: "Orders",
    fr: "Commandes",
  },
  "الطلبات المقدمة:": {
    en: "Submitted orders:",
    fr: "Commandes reçues :",
  },
  العنوان: {
    en: "Address",
    fr: "Adresse",
  },
  "العنوان طويل جدًا": {
    en: "Address is too long",
    fr: "L’adresse est trop longue",
  },
  "العنوان يحتوي على رموز غير صالحة": {
    en: "Address contains invalid characters",
    fr: "L’adresse contient des caractères invalides",
  },
  "القائمة الرئيسية": {
    en: "Main navigation",
    fr: "Navigation principale",
  },
  الكل: {
    en: "All",
    fr: "Tous",
  },
  الكمية: {
    en: "Quantity",
    fr: "Quantité",
  },
  "الكمية المتاحة (فارغ: دون تتبع)": {
    en: "Available stock (blank: untracked)",
    fr: "Stock disponible (vide : non suivi)",
  },
  "الكمية المطلوبة غير متوفرة في المخزون.": {
    en: "The requested quantity is out of stock.",
    fr: "La quantité demandée n’est pas disponible.",
  },
  "الكمية غير صالحة": {
    en: "Invalid quantity",
    fr: "Quantité invalide",
  },
  "الكمية يجب أن تكون عددًا صحيحًا": {
    en: "Quantity must be a whole number",
    fr: "La quantité doit être un nombre entier",
  },
  "المتجر المحلي": {
    en: "Local store",
    fr: "Boutique locale",
  },
  "المتجر غير مربوط.": {
    en: "The store is not connected.",
    fr: "La boutique n’est pas connectée.",
  },
  "المتجر غير موجود.": {
    en: "Store not found.",
    fr: "Boutique introuvable.",
  },
  "المحفوظ:": {
    en: "Saved:",
    fr: "Enregistré :",
  },
  "المدة التقديرية (اختياري)": {
    en: "Estimated delivery time (optional)",
    fr: "Délai estimé (facultatif)",
  },
  "المدة التقديرية:": {
    en: "Estimated delivery time:",
    fr: "Délai estimé :",
  },
  المعرف: {
    en: "ID",
    fr: "Identifiant",
  },
  "المعروض هو سعر الولاية أو الافتراضي. تجاوز البلدية يسبق هذا السعر عند الحساب. تُحفظ القواعد في النظام المختار فقط.":
    {
      en: "Shown prices use the wilaya rule or default. Commune overrides take priority. Rules are saved only for the selected administrative mode.",
      fr: "Les prix affichés utilisent la règle de wilaya ou le tarif par défaut. Les exceptions communales sont prioritaires. Les règles concernent uniquement le découpage sélectionné.",
    },
  المكتب: {
    en: "Office",
    fr: "Bureau",
  },
  "المكتب والتبادل عبر CSV": {
    en: "Office delivery and CSV",
    fr: "Livraison au bureau et CSV",
  },
  "المكتب:": {
    en: "Office:",
    fr: "Bureau :",
  },
  "الملف يتجاوز الحجم المسموح.": {
    en: "File exceeds the size limit.",
    fr: "Le fichier dépasse la taille autorisée.",
  },
  "المنتج أو الخيار المحدد غير متاح.": {
    en: "The selected product or variant is unavailable.",
    fr: "Le produit ou la variante est indisponible.",
  },
  "المنتج أو الخيار المختار غير متاح. أعد تحميل الصفحة.": {
    en: "The selected product or variant is unavailable. Reload the page.",
    fr: "Le produit ou la variante est indisponible. Rechargez la page.",
  },
  "المنتج المطلوب": {
    en: "Requested product",
    fr: "Produit demandé",
  },
  "المنتج نشط": {
    en: "Product active",
    fr: "Produit actif",
  },
  المنتجات: {
    en: "Products",
    fr: "Produits",
  },
  المنزل: {
    en: "Home",
    fr: "Domicile",
  },
  "المنزل غير متاح": {
    en: "Home delivery unavailable",
    fr: "Domicile indisponible",
  },
  "المنزل متاح": {
    en: "Home delivery available",
    fr: "Domicile disponible",
  },
  "المنزل:": {
    en: "Home:",
    fr: "Domicile :",
  },
  "المنطقة متاحة للتوصيل": {
    en: "Region available for delivery",
    fr: "Région livrable",
  },
  الموقع: {
    en: "Location",
    fr: "Localité",
  },
  "النتيجة تستخدم تجاوز البلدية ثم الولاية ثم الافتراضي. لا يتم إنشاء طلب.": {
    en: "The result applies commune, then wilaya, then default rules. No order is created.",
    fr: "Le calcul applique la commune, puis la wilaya, puis le tarif par défaut. Aucune commande n’est créée.",
  },
  النطاق: {
    en: "Scope",
    fr: "Portée",
  },
  الهاتف: {
    en: "Phone",
    fr: "Téléphone",
  },
  "الولايات والبلديات": {
    en: "Wilayas and communes",
    fr: "Wilayas et communes",
  },
  الولاية: {
    en: "Wilaya",
    fr: "Wilaya",
  },
  "الولاية لا تنتمي إلى النظام الإداري المحدد.": {
    en: "The wilaya does not belong to the selected administrative mode.",
    fr: "Cette wilaya n’appartient pas au découpage sélectionné.",
  },
  "الولاية والبلدية": {
    en: "Wilaya and commune",
    fr: "Wilaya et commune",
  },
  "انتظر حساب السعر واختر طريقة توصيل متاحة.": {
    en: "Wait for pricing and choose an available delivery method.",
    fr: "Attendez le calcul du prix et choisissez un mode disponible.",
  },
  "انتقل إلى المحتوى": {
    en: "Skip to content",
    fr: "Aller au contenu",
  },
  "انتهت جلسة الربط أو استُخدمت مسبقًا.": {
    en: "The connection session expired or has already been used.",
    fr: "La session de connexion a expiré ou a déjà été utilisée.",
  },
  بالدينار: {
    en: "in DZD",
    fr: "en DZD",
  },
  "بحث الطلبات": {
    en: "Search orders",
    fr: "Rechercher des commandes",
  },
  "بحث الولايات": {
    en: "Search wilayas",
    fr: "Rechercher des wilayas",
  },
  "بدء ربط المتجر": {
    en: "Start store connection",
    fr: "Démarrer la connexion",
  },
  "بداية رحلتك نحو تجارة أفضل": {
    en: "Start building your store",
    fr: "Commencez votre boutique",
  },
  "بدون خصم": {
    en: "No discount",
    fr: "Sans remise",
  },
  بسيطة: {
    en: "Plain",
    fr: "Simples",
  },
  بلدية: {
    en: "Commune",
    fr: "Commune",
  },
  "بلدية اختبار الشحن": {
    en: "Shipping test commune",
    fr: "Commune de test",
  },
  "بلدية التجاوز": {
    en: "Override commune",
    fr: "Commune de l’exception",
  },
  "بلدية غير معروفة": {
    en: "Unknown commune",
    fr: "Commune inconnue",
  },
  "بيئة تطوير محلية": {
    en: "Local development",
    fr: "Développement local",
  },
  "بيانات JSON غير صالحة.": {
    en: "Invalid JSON data.",
    fr: "Données JSON invalides.",
  },
  "بيانات الدخول غير صحيحة.": {
    en: "Invalid login details.",
    fr: "Identifiants incorrects.",
  },
  "بيانات المنتج": {
    en: "Product details",
    fr: "Détails du produit",
  },
  "بيانات المنتج كبيرة جدًا.": {
    en: "Product data is too large.",
    fr: "Les données du produit sont trop volumineuses.",
  },
  "تأكيد الطلب وحفظه": {
    en: "Confirm and save order",
    fr: "Confirmer et enregistrer la commande",
  },
  "تابع الطلب من الاستلام إلى التأكيد والتسليم. تقديم طلب دفع عند الاستلام لا يعني تحصيل قيمته.":
    {
      en: "Track orders from submission to confirmation and delivery. A cash-on-delivery order is not proof of payment.",
      fr: "Suivez les commandes de leur réception à la confirmation et la livraison. Une commande à la livraison n’est pas une preuve de paiement.",
    },
  "تاريخ الطلب (UTC)": {
    en: "Order date (UTC)",
    fr: "Date de commande (UTC)",
  },
  "تجارة أقرب. طلبات أسهل.": {
    en: "Closer commerce. Easier orders.",
    fr: "Un commerce plus proche. Des commandes plus simples.",
  },
  "تجاوز بلدية": {
    en: "Commune override",
    fr: "Exception communale",
  },
  "تجاوزات البلديات المحفوظة": {
    en: "Saved commune overrides",
    fr: "Exceptions communales enregistrées",
  },
  "تجربة تحمل هويتك": {
    en: "Make the form your own",
    fr: "Un formulaire à votre image",
  },
  "تجربة عربية بسيطة ومناسبة للهاتف": {
    en: "A simple experience for every device",
    fr: "Une expérience simple sur tous les écrans",
  },
  "تحديث إعدادات الخصم": {
    en: "Update discount settings",
    fr: "Actualiser la remise",
  },
  "تحديث الطلبات": {
    en: "Refresh orders",
    fr: "Actualiser les commandes",
  },
  "تحديث حالة الطلب": {
    en: "Update order status",
    fr: "Modifier le statut",
  },
  "تحديد الولايات الظاهرة": {
    en: "Select visible wilayas",
    fr: "Sélectionner les wilayas visibles",
  },
  "تحقق من إعدادات النموذج.": {
    en: "Check the form settings.",
    fr: "Vérifiez les paramètres du formulaire.",
  },
  "تحقق من الأسعار والمعرفات؛ يجب ضبط سعر غير سالب لكل طريقة مفعّلة.": {
    en: "Check prices and IDs; every enabled method needs a nonnegative price.",
    fr: "Vérifiez les prix et identifiants ; chaque mode activé nécessite un prix positif ou nul.",
  },
  "تحقق من الاسم والأسعار والمخزون ومعرفات الخيارات.": {
    en: "Check name, prices, stock and variant IDs.",
    fr: "Vérifiez le nom, les prix, le stock et les identifiants de variantes.",
  },
  "تحقق من البريد وكلمة المرور (١٢ حرفًا على الأقل).": {
    en: "Check email and password (at least 12 characters).",
    fr: "Vérifiez l’e-mail et le mot de passe (12 caractères minimum).",
  },
  "تحقق من بيانات الطلب أو حاول مجددًا.": {
    en: "Check the order data or try again.",
    fr: "Vérifiez les données de commande ou réessayez.",
  },
  "تحقق من بيانات المنتج وأسعاره ومخزونه.": {
    en: "Check product data, prices and stock.",
    fr: "Vérifiez le produit, ses prix et son stock.",
  },
  "تحقق من بيانات المنتج والخيارات.": {
    en: "Check product and variant details.",
    fr: "Vérifiez les détails du produit et des variantes.",
  },
  "تحقق من حقول الطلب المطلوبة.": {
    en: "Check the required order fields.",
    fr: "Vérifiez les champs obligatoires.",
  },
  "تحليلات الطلبات المحفوظة": {
    en: "Saved order analytics",
    fr: "Statistiques des commandes enregistrées",
  },
  "تخصيص نموذج الطلب": {
    en: "Customize the order form",
    fr: "Personnaliser le formulaire",
  },
  "ترتيب الحقول": {
    en: "Field order",
    fr: "Ordre des champs",
  },
  "تسجيل الخروج": {
    en: "Sign out",
    fr: "Se déconnecter",
  },
  "تسجيل دخول المالك": {
    en: "Owner sign in",
    fr: "Connexion propriétaire",
  },
  "تسمية الاسم": {
    en: "Name label",
    fr: "Libellé du nom",
  },
  "تسمية العنوان": {
    en: "Address label",
    fr: "Libellé de l’adresse",
  },
  "تسمية الهاتف": {
    en: "Phone label",
    fr: "Libellé du téléphone",
  },
  "تصدير أسعار CSV": {
    en: "Export rates CSV",
    fr: "Exporter les tarifs CSV",
  },
  "تصدير جميع الطلبات CSV": {
    en: "Export all orders CSV",
    fr: "Exporter toutes les commandes CSV",
  },
  "تصفية الأسعار": {
    en: "Filter rates",
    fr: "Filtrer les tarifs",
  },
  "تصميم متجاوب لكل الشاشات": {
    en: "Responsive on all screens",
    fr: "Adapté à tous les écrans",
  },
  "تطبيق القاعدة على الولايات المحددة (": {
    en: "Apply rule to selected wilayas (",
    fr: "Appliquer aux wilayas sélectionnées (",
  },
  تعديل: {
    en: "Edit",
    fr: "Modifier",
  },
  "تعديل سعر أو تطبيق جماعي": {
    en: "Edit a rate or apply in bulk",
    fr: "Modifier un tarif ou appliquer en lot",
  },
  "تعذر إتمام عملية الشحن. أعد المحاولة.": {
    en: "Could not complete the shipping operation. Try again.",
    fr: "Impossible de terminer l’opération. Réessayez.",
  },
  "تعذر إعادة المخزون: الكمية تتجاوز الحد المسموح.": {
    en: "Cannot restore stock: quantity exceeds the limit.",
    fr: "Impossible de restituer le stock : limite dépassée.",
  },
  "تعذر إكمال الربط. ابدأ جلسة ربط جديدة من لوحة متجرك.": {
    en: "Could not complete the connection. Start again from your dashboard.",
    fr: "Connexion impossible. Recommencez depuis le tableau de bord.",
  },
  "تعذر إنشاء الحساب بهذا البريد.": {
    en: "Cannot create an account with this email.",
    fr: "Impossible de créer un compte avec cet e-mail.",
  },
  "تعذر استعادة المخزون؛ المنتج أو الخيار غير موجود.": {
    en: "Cannot restore stock: product or variant is missing.",
    fr: "Impossible de restituer le stock : produit ou variante absent.",
  },
  "تعذر التحقق أو حساب الطلب. أعد المحاولة.": {
    en: "Could not validate or price the order. Try again.",
    fr: "Impossible de valider ou chiffrer la commande. Réessayez.",
  },
  "تعذر التحقق من الطلب.": {
    en: "Could not validate the order.",
    fr: "Impossible de valider la commande.",
  },
  "تعذر التحقق من الطلب. أعد المحاولة.": {
    en: "Could not validate the order. Try again.",
    fr: "Impossible de valider la commande. Réessayez.",
  },
  "تعذر التحقق من توقيع Shopify أو انتهت صلاحية الطلب.": {
    en: "Shopify signature is invalid or the request has expired.",
    fr: "La signature Shopify est invalide ou la demande a expiré.",
  },
  "تعذر الحفظ.": {
    en: "Could not save.",
    fr: "Enregistrement impossible.",
  },
  "تعذر الدخول.": {
    en: "Could not sign in.",
    fr: "Connexion impossible.",
  },
  "تعذر الربط.": {
    en: "Could not connect.",
    fr: "Connexion impossible.",
  },
  "تعذر بدء الربط.": {
    en: "Could not start the connection.",
    fr: "Impossible de démarrer la connexion.",
  },
  "تعذر تحميل أسعار الشحن. أعد المحاولة.": {
    en: "Could not load shipping rates. Try again.",
    fr: "Impossible de charger les tarifs. Réessayez.",
  },
  "تعذر تحميل الإعدادات.": {
    en: "Could not load settings.",
    fr: "Impossible de charger les paramètres.",
  },
  "تعذر تحميل البيانات الجغرافية. أعد المحاولة، أو تواصل مع مسؤول المتجر.": {
    en: "Could not load locations. Try again or contact the store.",
    fr: "Impossible de charger les localités. Réessayez ou contactez la boutique.",
  },
  "تعذر تحميل الطلبات.": {
    en: "Could not load orders.",
    fr: "Impossible de charger les commandes.",
  },
  "تعذر تحميل القائمة. أعد المحاولة.": {
    en: "Could not load the list. Try again.",
    fr: "Impossible de charger la liste. Réessayez.",
  },
  "تعذر تحميل المنتج وإعدادات الخصم. أعد المحاولة.": {
    en: "Could not load product and discount settings. Try again.",
    fr: "Impossible de charger le produit et la remise. Réessayez.",
  },
  "تعذر تحميل المنتجات.": {
    en: "Could not load products.",
    fr: "Impossible de charger les produits.",
  },
  "تعذر تحميل بلديات الاختبار.": {
    en: "Could not load test communes.",
    fr: "Impossible de charger les communes de test.",
  },
  "تعذر تحميل بلديات الاختبار. أعد اختيار الولاية.": {
    en: "Could not load test communes. Select the wilaya again.",
    fr: "Impossible de charger les communes de test. Resélectionnez la wilaya.",
  },
  "تعذر تحميل بلديات التجاوز.": {
    en: "Could not load override communes.",
    fr: "Impossible de charger les communes d’exception.",
  },
  "تعذر تحميل حالة الحساب.": {
    en: "Could not load account status.",
    fr: "Impossible de charger l’état du compte.",
  },
  "تعذر تحميل حالة الربط.": {
    en: "Could not load connection status.",
    fr: "Impossible de charger l’état de connexion.",
  },
  "تعذر حساب الشحن.": {
    en: "Could not calculate shipping.",
    fr: "Impossible de calculer la livraison.",
  },
  "تعذر حساب الطلب.": {
    en: "Could not calculate the order.",
    fr: "Impossible de calculer la commande.",
  },
  "تعذر حساب الطلب. أعد المحاولة.": {
    en: "Could not calculate the order. Try again.",
    fr: "Impossible de calculer la commande. Réessayez.",
  },
  "تعذر حفظ أسعار الشحن.": {
    en: "Could not save shipping rates.",
    fr: "Impossible d’enregistrer les tarifs.",
  },
  "تعذر حفظ التصميم.": {
    en: "Could not save the design.",
    fr: "Impossible d’enregistrer le modèle.",
  },
  "تعذر حفظ الخصم.": {
    en: "Could not save the discount.",
    fr: "Impossible d’enregistrer la remise.",
  },
  "تعذر حفظ حالة الطلب.": {
    en: "Could not save the order status.",
    fr: "Impossible d’enregistrer le statut.",
  },
  "تعذر قراءة البيانات الجغرافية. أعد المحاولة.": {
    en: "Could not read locations. Try again.",
    fr: "Impossible de lire les localités. Réessayez.",
  },
  "تعذر قراءة الملف.": {
    en: "Could not read the file.",
    fr: "Impossible de lire le fichier.",
  },
  "تغير الخصم في جلسة أخرى. أعد تحميل الإعدادات.": {
    en: "The discount changed in another session. Reload settings.",
    fr: "La remise a changé dans une autre session. Rechargez les paramètres.",
  },
  "تغير الكتالوج. أعد تحميل المنتجات.": {
    en: "The catalog changed. Reload products.",
    fr: "Le catalogue a changé. Rechargez les produits.",
  },
  "تغيرت الأسعار أو الإعدادات. حدّث الحساب وراجع الإجمالي ثم أكد مجددًا.": {
    en: "Prices or settings changed. Recalculate, review the total, then confirm again.",
    fr: "Les prix ou paramètres ont changé. Recalculez, vérifiez le total puis confirmez à nouveau.",
  },
  "تغيرت الأسعار في جلسة أخرى. أعد تحميل البيانات قبل الحفظ.": {
    en: "Prices changed in another session. Reload before saving.",
    fr: "Les prix ont changé dans une autre session. Rechargez avant d’enregistrer.",
  },
  "تفاصيل الطلب": {
    en: "Order details",
    fr: "Détails de la commande",
  },
  "تفاصيل قاعدة الشحن": {
    en: "Shipping rule details",
    fr: "Détails de la règle de livraison",
  },
  "تفعيل توصيل": {
    en: "Enable delivery",
    fr: "Activer la livraison",
  },
  "تقليل الكمية": {
    en: "Decrease quantity",
    fr: "Diminuer la quantité",
  },
  "تلميح الاسم": {
    en: "Name placeholder",
    fr: "Texte indicatif du nom",
  },
  "تلميح العنوان": {
    en: "Address placeholder",
    fr: "Texte indicatif de l’adresse",
  },
  "تلميح الهاتف": {
    en: "Phone placeholder",
    fr: "Texte indicatif du téléphone",
  },
  "تم إعداد حساب المالك مسبقًا.": {
    en: "The owner account is already configured.",
    fr: "Le compte propriétaire est déjà configuré.",
  },
  "تم استلام طلبك للمراجعة.": {
    en: "Your order has been received for review.",
    fr: "Votre commande a été reçue pour vérification.",
  },
  "تم التحقق من بيانات الطلب وتسعيره على الخادم. لم يُنشأ أو يُحفظ طلب؛ الحفظ متاح في المرحلة الخامسة.":
    {
      en: "Order validated and priced only; it has not been saved.",
      fr: "Commande validée et chiffrée uniquement ; elle n’est pas enregistrée.",
    },
  "تم التسليم": {
    en: "Delivered",
    fr: "Livrée",
  },
  "تم تجاوز محاولات الإرسال لهذا الرقم. حاول بعد دقيقة.": {
    en: "Too many orders for this phone number. Try again in a minute.",
    fr: "Trop de commandes pour ce numéro. Réessayez dans une minute.",
  },
  "تم حفظ إعدادات الشحن.": {
    en: "Shipping settings saved.",
    fr: "Paramètres de livraison enregistrés.",
  },
  "تم حفظ المنتج وتحديث النموذج.": {
    en: "Product saved and form updated.",
    fr: "Produit enregistré et formulaire actualisé.",
  },
  "تم حفظ تصميم النموذج. المعاينة أدناه تستخدم الإعدادات المحفوظة.": {
    en: "Form design saved. The preview uses the saved settings.",
    fr: "Modèle enregistré. L’aperçu utilise les paramètres enregistrés.",
  },
  "تم حفظ خصم التاجر وتحديث نموذج الطلب.": {
    en: "Merchant discount saved and order form updated.",
    fr: "Remise enregistrée et formulaire actualisé.",
  },
  "تم حفظ طلبك بنجاح. الطلب قيد المراجعة وليس عملية شراء مدفوعة.": {
    en: "Your order was saved successfully. It is under review and is not a paid purchase.",
    fr: "Votre commande est enregistrée. Elle est en attente de vérification et n’est pas un achat payé.",
  },
  "تُحمّل القوائم من قاعدة بيانات محلية. تم فحص الأعداد والمعرّفات وعلاقات الآباء، ومراجعة قوائم نقل ١٠٨ بلديات. المعرّفات الداخلية ثابتة بين النظامين وليست رموزًا رسمية للبلديات.":
    {
      en: "Lists load from a local database. Counts, IDs and parent relationships were checked, including 108 transferred communes. Internal IDs are stable across modes and are not official commune codes.",
      fr: "Les listes proviennent d’une base locale. Les nombres, identifiants et rattachements ont été vérifiés, dont 108 communes transférées. Les identifiants internes sont stables et ne sont pas des codes officiels.",
    },
  "جارٍ الإعداد…": {
    en: "Preparing…",
    fr: "Préparation…",
  },
  "جارٍ التحقق على الخادم…": {
    en: "Validating on the server…",
    fr: "Validation sur le serveur…",
  },
  "جارٍ التحقق…": {
    en: "Checking…",
    fr: "Vérification…",
  },
  "جارٍ الحساب…": {
    en: "Calculating…",
    fr: "Calcul…",
  },
  "جارٍ الحفظ…": {
    en: "Saving…",
    fr: "Enregistrement…",
  },
  "جارٍ تحديث السعر من الخادم…": {
    en: "Updating server price…",
    fr: "Actualisation du prix…",
  },
  "جارٍ تحميل أسعار الشحن…": {
    en: "Loading shipping rates…",
    fr: "Chargement des tarifs…",
  },
  "جارٍ تحميل إعدادات الخصم…": {
    en: "Loading discount settings…",
    fr: "Chargement de la remise…",
  },
  "جارٍ تحميل البلديات…": {
    en: "Loading communes…",
    fr: "Chargement des communes…",
  },
  "جارٍ تحميل الطلبات…": {
    en: "Loading orders…",
    fr: "Chargement des commandes…",
  },
  "جارٍ تحميل المنتجات…": {
    en: "Loading products…",
    fr: "Chargement des produits…",
  },
  "جارٍ تحميل المنتج…": {
    en: "Loading product…",
    fr: "Chargement du produit…",
  },
  "جارٍ تحميل الولايات…": {
    en: "Loading wilayas…",
    fr: "Chargement des wilayas…",
  },
  "جارٍ حفظ الخصم…": {
    en: "Saving discount…",
    fr: "Enregistrement de la remise…",
  },
  حاسوب: {
    en: "Desktop",
    fr: "Ordinateur",
  },
  "حالة OAuth غير صالحة.": {
    en: "Invalid OAuth state.",
    fr: "État OAuth invalide.",
  },
  "حالة الطلب": {
    en: "Order status",
    fr: "Statut de commande",
  },
  "حجم الطلب كبير.": {
    en: "Request is too large.",
    fr: "La demande est trop volumineuse.",
  },
  "حجم المعاينة": {
    en: "Preview size",
    fr: "Taille de l’aperçu",
  },
  "حذف القاعدة الحالية": {
    en: "Delete current rule",
    fr: "Supprimer la règle actuelle",
  },
  "حساب الشحن": {
    en: "Calculate shipping",
    fr: "Calculer la livraison",
  },
  "حسب الحالة": {
    en: "By status",
    fr: "Par statut",
  },
  "حسب المنتج": {
    en: "By product",
    fr: "Par produit",
  },
  "حسب الولاية": {
    en: "By wilaya",
    fr: "Par wilaya",
  },
  "حسب طريقة التوصيل": {
    en: "By delivery method",
    fr: "Par mode de livraison",
  },
  "حفظ القاعدة": {
    en: "Save rule",
    fr: "Enregistrer la règle",
  },
  "حفظ المنتج": {
    en: "Save product",
    fr: "Enregistrer le produit",
  },
  "حفظ النموذج": {
    en: "Save form",
    fr: "Enregistrer le formulaire",
  },
  "حفظ خصم التاجر": {
    en: "Save merchant discount",
    fr: "Enregistrer la remise",
  },
  "حقول تنفيذ الطلب إلزامية ولا يمكن إخفاؤها. يختفي عنوان المنزل تلقائيًا عند اختيار المكتب.":
    {
      en: "Fulfilment fields are required and cannot be hidden. The home address is hidden automatically for office delivery.",
      fr: "Les champs nécessaires à la livraison sont obligatoires. L’adresse du domicile est masquée automatiquement pour la livraison au bureau.",
    },
  "حقيبة يومية عصرية": {
    en: "Everyday bag",
    fr: "Sac quotidien",
  },
  "خريطة التطوير": {
    en: "Development roadmap",
    fr: "Étapes de développement",
  },
  "خريطة ٦٩ ولاية مبنية على قوائم قانون منقولة في مرجع مفتوح. المطابقة المباشرة مع ملف الجريدة الرسمية لا تزال معلّقة؛ لا تستخدمها لتنفيذ طلبات فعلية قبل إتمام المراجعة.":
    {
      en: "The 69-wilaya map uses a secondary legal reference. Direct verification against the official gazette PDF is pending; use for local tests only.",
      fr: "La carte des 69 wilayas utilise une référence juridique secondaire. La vérification directe du PDF officiel reste en attente ; utilisez-la uniquement pour les essais locaux.",
    },
  "خريطة ٦٩ ولاية مبنية على مرجع ثانوي، والمطابقة الرسمية المباشرة معلّقة. أسعار هذا النظام مستقلة عن نظام ٥٨ ولا تُنقل تلقائيًا.":
    {
      en: "The 69-wilaya map uses a secondary reference pending official verification. Its rates are independent of the 58-wilaya mode.",
      fr: "La carte des 69 wilayas reste à vérifier officiellement. Ses tarifs sont indépendants du mode 58 wilayas.",
    },
  "خصم اختياري على مجموع المنتجات فقط، ولا يخفض تكلفة الشحن. يقتصر الخصم الثابت على قيمة المنتجات، ولا يصبح الإجمالي سالبًا.":
    {
      en: "Optional discount on products only, excluding shipping. Fixed discounts cannot exceed product value; the total never becomes negative.",
      fr: "Remise facultative sur les produits uniquement, hors livraison. La remise fixe est limitée à la valeur des produits ; le total ne devient jamais négatif.",
    },
  "خصم التاجر على المنتجات": {
    en: "Merchant product discount",
    fr: "Remise du marchand sur les produits",
  },
  "خصم نموذج الطلب": {
    en: "Order form discount",
    fr: "Remise du formulaire",
  },
  "خيار المنتج": {
    en: "Product variant",
    fr: "Variante du produit",
  },
  "خيار جديد": {
    en: "New variant",
    fr: "Nouvelle variante",
  },
  "د.ج. ثابت": {
    en: "DZD fixed",
    fr: "DZD fixe",
  },
  دخول: {
    en: "Sign in",
    fr: "Se connecter",
  },
  "دي زد ليد فورم برو · معاينة تطويرية": {
    en: "DZ Lead Form Pro · Development preview",
    fr: "DZ Lead Form Pro · Aperçu de développement",
  },
  "دي زد ليد فورم برو · منتج تجريبي · التأكيد يحفظ طلبًا محليًا": {
    en: "DZ Lead Form Pro · Demo · Confirmation saves a local order",
    fr: "DZ Lead Form Pro · Démo · La confirmation enregistre une commande locale",
  },
  "رابط صورة HTTPS (اختياري)": {
    en: "HTTPS image URL (optional)",
    fr: "URL d’image HTTPS (facultative)",
  },
  "رابط نموذج متجرك:": {
    en: "Your store form link:",
    fr: "Lien du formulaire de votre boutique :",
  },
  "راجع أسعار الشحن والمخزون قبل قبول الطلبات، وتابع التأكيد والتسليم من لوحة الطلبات.":
    {
      en: "Check shipping rates and stock before accepting orders, then manage confirmation and delivery in Orders.",
      fr: "Vérifiez les tarifs et le stock avant d’accepter les commandes, puis gérez confirmation et livraison dans Commandes.",
    },
  "رسالة النجاح": {
    en: "Success message",
    fr: "Message de confirmation",
  },
  "رسم توضيحي لحقيبة تجريبية": {
    en: "Illustration of a demo bag",
    fr: "Illustration d’un sac de démonstration",
  },
  "رفض Shopify استعلام GraphQL.": {
    en: "Shopify rejected the GraphQL query.",
    fr: "Shopify a refusé la requête GraphQL.",
  },
  "رقم الهاتف": {
    en: "Phone number",
    fr: "Numéro de téléphone",
  },
  "رقم الهاتف طويل جدًا": {
    en: "Phone number is too long",
    fr: "Le numéro est trop long",
  },
  "زيادة الكمية": {
    en: "Increase quantity",
    fr: "Augmenter la quantité",
  },
  "سجل البيانات الجغرافية": {
    en: "Geographic data reference",
    fr: "Référentiel géographique",
  },
  سعر: {
    en: "Price",
    fr: "Prix",
  },
  "سعر أو كمية غير صالحة.": {
    en: "Invalid price or quantity.",
    fr: "Prix ou quantité invalide.",
  },
  "صيغة اقتباس CSV غير صالحة.": {
    en: "Invalid CSV quoting.",
    fr: "Guillemets CSV invalides.",
  },
  "صيغة الطلب يجب أن تكون JSON.": {
    en: "Request body must be JSON.",
    fr: "La demande doit être au format JSON.",
  },
  "صُمّم للتجارة في الجزائر 🇩🇿": {
    en: "Made for commerce in Algeria 🇩🇿",
    fr: "Conçu pour le commerce en Algérie 🇩🇿",
  },
  "طريقة اختبار الشحن": {
    en: "Shipping test method",
    fr: "Mode de livraison à tester",
  },
  "طريقة التوصيل": {
    en: "Delivery method",
    fr: "Mode de livraison",
  },
  "طريقة التوصيل معطّلة لهذه المنطقة.": {
    en: "This delivery method is disabled for the region.",
    fr: "Ce mode de livraison est désactivé pour cette région.",
  },
  "طلب كبير.": {
    en: "Request too large.",
    fr: "Demande trop volumineuse.",
  },
  "عرض الأسعار بالدينار الجزائري": {
    en: "Prices in Algerian dinars",
    fr: "Prix en dinars algériens",
  },
  "عناوين CSV غير مطابقة. استخدم ملف التصدير قالبًا.": {
    en: "CSV headers do not match. Use an exported file as a template.",
    fr: "Les en-têtes CSV ne correspondent pas. Utilisez un export comme modèle.",
  },
  "عنوان OAuth يتطلب HTTPS.": {
    en: "OAuth callback must use HTTPS.",
    fr: "L’URL de retour OAuth doit utiliser HTTPS.",
  },
  "عنوان المنزل": {
    en: "Home address",
    fr: "Adresse du domicile",
  },
  "عنوان النموذج": {
    en: "Form title",
    fr: "Titre du formulaire",
  },
  "غير متاح": {
    en: "Unavailable",
    fr: "Indisponible",
  },
  "فتح القائمة": {
    en: "Open menu",
    fr: "Ouvrir le menu",
  },
  "قاعدة ولاية خاصة": {
    en: "Custom wilaya rule",
    fr: "Règle spécifique à la wilaya",
  },
  "قواعد ولاية مضبوطة": {
    en: "Configured wilaya rules",
    fr: "Règles de wilaya configurées",
  },
  "قيد المراجعة": {
    en: "Under review",
    fr: "En attente",
  },
  "قيمة الخصم بالدينار": {
    en: "Discount value in DZD",
    fr: "Valeur de remise en DZD",
  },
  "قيمة الطلبات المقدمة:": {
    en: "Submitted order value:",
    fr: "Valeur des commandes reçues :",
  },
  "قيمة الطلبات ليست إيرادًا محصلًا أو إثبات دفع.": {
    en: "Order value is not collected revenue or proof of payment.",
    fr: "La valeur des commandes n’est ni un revenu encaissé ni une preuve de paiement.",
  },
  "كل الولايات": {
    en: "All wilayas",
    fr: "Toutes les wilayas",
  },
  "كل ما تحتاجه لتجربة طلب سلسة، من مكان واحد.": {
    en: "Everything you need for a smooth order experience, in one place.",
    fr: "Tout pour une commande simple, au même endroit.",
  },
  "كلمة المرور (١٢ حرفًا على الأقل)": {
    en: "Password (at least 12 characters)",
    fr: "Mot de passe (12 caractères minimum)",
  },
  "كلمة المرور يجب أن تتكون من ١٢–٢٠٠ حرف.": {
    en: "Password must contain 12–200 characters.",
    fr: "Le mot de passe doit contenir 12 à 200 caractères.",
  },
  "لا تحذف خيارات منتج محفوظ؛ أوقف المنتج للاحتفاظ بسجل المخزون.": {
    en: "Do not remove saved variants; archive the product to retain inventory history.",
    fr: "Ne supprimez pas les variantes enregistrées ; archivez le produit pour conserver l’historique.",
  },
  "لا توجد بلدية مطابقة ضمن هذه الولاية.": {
    en: "No matching commune in this wilaya.",
    fr: "Aucune commune correspondante dans cette wilaya.",
  },
  "لا توجد صورة": {
    en: "No image",
    fr: "Aucune image",
  },
  "لا توجد طلبات مطابقة.": {
    en: "No matching orders.",
    fr: "Aucune commande correspondante.",
  },
  "لا توجد مكاتب استلام مسماة أو عناوين مختلقة. يظل المكتب معطّلًا حتى تفعّل هذا الإعداد وتحدد سعرًا مفعّلًا.":
    {
      en: "No named pickup offices or invented addresses are provided. Office delivery remains disabled until you enable this setting and configure a price.",
      fr: "Aucun bureau nommé ni adresse fictive n’est fourni. La livraison au bureau reste désactivée jusqu’à activation de ce mode et configuration d’un prix.",
    },
  "لا توجد ولايات تطابق البحث والتصفية.": {
    en: "No wilayas match the search and filters.",
    fr: "Aucune wilaya ne correspond aux filtres.",
  },
  "لا توجد ولاية مطابقة للبحث.": {
    en: "No matching wilaya.",
    fr: "Aucune wilaya correspondante.",
  },
  "لا تُحصَّل دفعة عند الإرسال. تُستخدم بياناتك لمعالجة الطلب والتوصيل.": {
    en: "No payment is collected on submission. Your details are used to process and deliver the order.",
    fr: "Aucun paiement n’est encaissé à l’envoi. Vos coordonnées servent au traitement et à la livraison.",
  },
  "لا يمكن إعادة استخدام معرف الإرسال لطلب مختلف.": {
    en: "An idempotency key cannot be reused for a different order.",
    fr: "Un identifiant d’envoi ne peut pas être réutilisé pour une autre commande.",
  },
  "لا يمكن إعادة فتح طلب ملغى أو مسلّم أو إرجاعه إلى المراجعة.": {
    en: "Cancelled or delivered orders cannot be reopened or returned to review.",
    fr: "Une commande annulée ou livrée ne peut pas être rouverte ni remise en attente.",
  },
  "لا يوجد متجر مربوط لهذا الحساب.": {
    en: "No store is connected to this account.",
    fr: "Aucune boutique n’est connectée à ce compte.",
  },
  "لدي حساب بالفعل": {
    en: "I already have an account",
    fr: "J’ai déjà un compte",
  },
  للأعلى: {
    en: "Move up",
    fr: "Monter",
  },
  "لم تؤكد Meta استلام الحدث.": {
    en: "Meta did not confirm receipt of the event.",
    fr: "Meta n’a pas confirmé la réception de l’événement.",
  },
  "لم تؤكد TikTok استلام الحدث.": {
    en: "TikTok did not confirm receipt of the event.",
    fr: "TikTok n’a pas confirmé la réception de l’événement.",
  },
  "لم يُضبط سعر شحن لهذه المنطقة أو سعر افتراضي.": {
    en: "No shipping rate is configured for this region or as default.",
    fr: "Aucun tarif n’est configuré pour cette région ni par défaut.",
  },
  "لم يُضبط سعر طريقة التوصيل.": {
    en: "No price is configured for this delivery method.",
    fr: "Aucun prix n’est configuré pour ce mode de livraison.",
  },
  "لوحة إدارة التاجر": {
    en: "Merchant dashboard",
    fr: "Tableau de bord marchand",
  },
  "لون الزر": {
    en: "Button color",
    fr: "Couleur du bouton",
  },
  م: {
    en: "M",
    fr: "M",
  },
  مؤكد: {
    en: "Confirmed",
    fr: "Confirmée",
  },
  "مبلغ ثابت بالدينار": {
    en: "Fixed amount in DZD",
    fr: "Montant fixe en DZD",
  },
  "مبلغ شحن غير صالح.": {
    en: "Invalid shipping amount.",
    fr: "Montant de livraison invalide.",
  },
  "متابعة التفويض على Shopify": {
    en: "Continue authorization on Shopify",
    fr: "Continuer l’autorisation sur Shopify",
  },
  متاح: {
    en: "Available",
    fr: "Disponible",
  },
  "مثال: المسيلة أو M’Sila": {
    en: "Example: M’Sila",
    fr: "Exemple : M’Sila",
  },
  "مجموع المنتجات": {
    en: "Product subtotal",
    fr: "Sous-total des produits",
  },
  "محاولات كثيرة. حاول بعد دقيقة.": {
    en: "Too many attempts. Try again in a minute.",
    fr: "Trop de tentatives. Réessayez dans une minute.",
  },
  "محاولات كثيرة. حاول لاحقًا.": {
    en: "Too many attempts. Try again later.",
    fr: "Trop de tentatives. Réessayez plus tard.",
  },
  "محولات إرسال أحداث اختبار خادمية موجودة مع التحقق من الموافقة ومعرف الحدث، لكنها غير موصولة تلقائيًا بالطلبات. لا يتم إرسال أحداث حقيقية، ولا يُعتبر طلب COD عملية شراء مدفوعة.":
    {
      en: "Server test-event transports exist with consent and event-ID checks but are not connected to orders automatically. No real events are sent; a COD order is not a paid purchase.",
      fr: "Des envois d’événements de test existent avec vérification du consentement et de l’identifiant, sans lien automatique avec les commandes. Aucun événement réel n’est envoyé ; une commande COD n’est pas un achat payé.",
    },
  "مخزون غير متتبّع": {
    en: "Untracked stock",
    fr: "Stock non suivi",
  },
  "مرحبًا بك في مساحة متجرك": {
    en: "Welcome to your store workspace",
    fr: "Bienvenue dans votre espace boutique",
  },
  "مساحة العمل": {
    en: "Workspace",
    fr: "Espace de travail",
  },
  "مساحة عمل للتجارة والدفع عند الاستلام في الجزائر": {
    en: "Workspace for commerce and cash on delivery in Algeria",
    fr: "Espace pour le commerce et le paiement à la livraison en Algérie",
  },
  "مساحة متجرك": {
    en: "Your store workspace",
    fr: "Votre espace boutique",
  },
  "مصدر الطلب غير مسموح.": {
    en: "Request origin is not allowed.",
    fr: "L’origine de la demande n’est pas autorisée.",
  },
  "مصدر غير مسموح.": {
    en: "Origin not allowed.",
    fr: "Origine non autorisée.",
  },
  "معاينة نموذج الطلب": {
    en: "Preview order form",
    fr: "Aperçu du formulaire",
  },
  "معايير البحث أو نظام التقسيم الإداري غير صالحة.": {
    en: "Invalid search parameters or administrative mode.",
    fr: "Paramètres de recherche ou découpage invalides.",
  },
  "معايير الطلب غير صالحة.": {
    en: "Invalid order parameters.",
    fr: "Paramètres de commande invalides.",
  },
  "معايير حساب الشحن غير صالحة.": {
    en: "Invalid shipping parameters.",
    fr: "Paramètres de livraison invalides.",
  },
  "معرف المتجر غير صالح.": {
    en: "Invalid store ID.",
    fr: "Identifiant de boutique invalide.",
  },
  "معرف منصة غير صالح.": {
    en: "Invalid platform ID.",
    fr: "Identifiant de plateforme invalide.",
  },
  "معرف منطقة الشحن غير صالح للنظام المحدد.": {
    en: "Invalid shipping region for this mode.",
    fr: "Région de livraison invalide pour ce découpage.",
  },
  "معرف منع التكرار غير صالح.": {
    en: "Invalid idempotency key.",
    fr: "Identifiant d’envoi invalide.",
  },
  "معرفات الخيارات مكررة": {
    en: "Duplicate variant IDs",
    fr: "Identifiants de variantes dupliqués",
  },
  "مكتب عام": {
    en: "Generic office",
    fr: "Bureau générique",
  },
  ملغى: {
    en: "Cancelled",
    fr: "Annulée",
  },
  "ملف CSV أكبر من الحجم المسموح.": {
    en: "CSV file exceeds the size limit.",
    fr: "Le fichier CSV dépasse la taille autorisée.",
  },
  "ملف CSV غير صالح.": {
    en: "Invalid CSV file.",
    fr: "Fichier CSV invalide.",
  },
  "منتج تجريبي · ليس مخزونًا تجاريًا": {
    en: "Demo product · Not commercial inventory",
    fr: "Produit de démonstration · Pas un stock commercial",
  },
  "منزل مجاني للمحدد": {
    en: "Free home delivery for selected",
    fr: "Domicile gratuit pour la sélection",
  },
  "منشئ النموذج": {
    en: "Form builder",
    fr: "Éditeur de formulaire",
  },
  "منطقة الشحن مكررة في العملية.": {
    en: "Duplicate shipping region in this operation.",
    fr: "Région de livraison dupliquée dans cette opération.",
  },
  موقوف: {
    en: "Inactive",
    fr: "Inactif",
  },
  ناعمة: {
    en: "Soft",
    fr: "Douces",
  },
  "نبنيها خطوة بخطوة": {
    en: "Build your store step by step",
    fr: "Construisez votre boutique progressivement",
  },
  "نسبة الخصم (٪)": {
    en: "Discount percentage (%)",
    fr: "Pourcentage de remise (%)",
  },
  "نسبة مئوية": {
    en: "Percentage",
    fr: "Pourcentage",
  },
  نشط: {
    en: "Active",
    fr: "Actif",
  },
  "نطاق القاعدة": {
    en: "Rule scope",
    fr: "Portée de la règle",
  },
  "نطاق متجر Shopify": {
    en: "Shopify store domain",
    fr: "Domaine de la boutique Shopify",
  },
  "نظام أسعار الشحن غير مطابق.": {
    en: "Shipping mode mismatch.",
    fr: "Découpage de livraison incompatible.",
  },
  "نظام إداري غير صالح.": {
    en: "Invalid administrative mode.",
    fr: "Découpage administratif invalide.",
  },
  "نظام مناطق الشحن": {
    en: "Shipping administrative mode",
    fr: "Découpage des zones de livraison",
  },
  "نظرة عامة": {
    en: "Overview",
    fr: "Vue d’ensemble",
  },
  "نموذج طلبك، كما يراه العميل": {
    en: "Your order form, as customers see it",
    fr: "Votre formulaire, tel que le client le voit",
  },
  "نموذج واضح، تفاصيل منظمة، وتصميم يضع راحة عميلك أولًا.": {
    en: "Clear details and a design that puts customers first.",
    fr: "Des détails clairs et une présentation pensée pour le client.",
  },
  "نوع خصم التاجر": {
    en: "Merchant discount type",
    fr: "Type de remise du marchand",
  },
  هاتف: {
    en: "Mobile",
    fr: "Téléphone",
  },
  "هذه إعدادات تاجر التطوير المحلي، وليست نظام دخول أو إدارة منتجات كاملة.": {
    en: "Local merchant settings.",
    fr: "Paramètres du marchand local.",
  },
  "هذه واجهة تنقل؛ وظائف هذا القسم في مراحل لاحقة. وظائف هذا القسم لم تُنفذ بعد. لا توجد بيانات محفوظة أو إجراءات تجارية مفعّلة.":
    {
      en: "This section is not implemented yet.",
      fr: "Cette section n’est pas encore disponible.",
    },
  "هل تريد حذف القواعد المحددة والرجوع إلى السعر الأقل أولوية إن وجد؟": {
    en: "Delete selected rules and fall back to lower-priority prices where available?",
    fr: "Supprimer les règles sélectionnées et utiliser les tarifs de priorité inférieure disponibles ?",
  },
  "واجهة عربية من اليمين إلى اليسار": {
    en: "Arabic right-to-left interface",
    fr: "Interface arabe de droite à gauche",
  },
  "ولايات النظام الافتراضي": {
    en: "Default-mode wilayas",
    fr: "Wilayas du mode par défaut",
  },
  "ولايات النظام المحدّث": {
    en: "Updated-mode wilayas",
    fr: "Wilayas du mode actualisé",
  },
  ولاية: {
    en: "Wilaya",
    fr: "Wilaya",
  },
  "ولاية اختبار الشحن": {
    en: "Shipping test wilaya",
    fr: "Wilaya de test",
  },
  "ولاية القاعدة": {
    en: "Rule wilaya",
    fr: "Wilaya de la règle",
  },
  "ولاية تجاوز البلدية": {
    en: "Commune override wilaya",
    fr: "Wilaya de l’exception communale",
  },
  "يجب أن يحتوي CSV على ١–١٦١١ صفًا.": {
    en: "CSV must contain 1–1611 rows.",
    fr: "Le CSV doit contenir de 1 à 1611 lignes.",
  },
  "يرث الافتراضي إن وُجد": {
    en: "Inherits default if configured",
    fr: "Hérite du tarif par défaut si configuré",
  },
  "يلزم تسجيل الدخول.": {
    en: "Sign in required.",
    fr: "Connexion requise.",
  },
  "يلزم ضبط معرّف تطبيق Shopify وسره وURL عودة HTTPS ومفتاح تشفير الاعتمادات في إعدادات الخادم الآمنة. لا تدخل الرموز في المحادثة.":
    {
      en: "Configure the Shopify client ID, secret, HTTPS callback and encryption key in secure server settings. Do not enter tokens in chat.",
      fr: "Configurez l’identifiant Shopify, le secret, l’URL HTTPS de retour et la clé de chiffrement dans les paramètres sécurisés du serveur. Ne partagez pas de jetons dans la conversation.",
    },
  "يلزم مفتاح تشفير تكاملات من ٣٢ بايت في الإعدادات الآمنة.": {
    en: "A 32-byte integration encryption key is required in secure settings.",
    fr: "Une clé de chiffrement de 32 octets est requise dans les paramètres sécurisés.",
  },
  "يمكنك تجربة البحث وتبديل النظام في النموذج أدناه.": {
    en: "Try search and mode selection in the form below.",
    fr: "Essayez la recherche et le changement de découpage ci-dessous.",
  },
  "يوجد نص بعد إغلاق اقتباس CSV.": {
    en: "Text found after closing a CSV quote.",
    fr: "Texte présent après un guillemet CSV fermé.",
  },
  "يُحفظ طلبك بعد التحقق من السعر وتوفر المنتج. الدفع عند الاستلام.": {
    en: "Your order is saved after price and availability checks. Payment is on delivery.",
    fr: "Votre commande est enregistrée après vérification du prix et du stock. Le paiement se fait à la livraison.",
  },
  "١٥٤١ بلدية محفوظة محليًا. تظهر بلديات الولاية المحددة فقط؛ يُمسح اختيار البلدية عند تغيير الولاية أو النظام. لا يُحفظ اختيار العميل كطلب.":
    {
      en: "1541 communes are stored locally. Only communes in the selected wilaya are shown. Changing wilaya or mode clears the commune. Selection alone does not save an order.",
      fr: "1541 communes sont stockées localement. Seules celles de la wilaya choisie sont affichées. Changer de wilaya ou de mode efface la commune. Une sélection seule n’enregistre pas de commande.",
    },
  "٥٨ ولاية": {
    en: "58 wilayas",
    fr: "58 wilayas",
  },
  "٥٨ ولاية · الافتراضي": {
    en: "58 wilayas · Default",
    fr: "58 wilayas · Par défaut",
  },
  "٦٩ ولاية · مراجعة رسمية معلّقة": {
    en: "69 wilayas · Official verification pending",
    fr: "69 wilayas · Vérification officielle en attente",
  },
  "٦٩ ولاية · مرجع ثانوي قيد المطابقة الرسمية": {
    en: "69 wilayas · Secondary reference awaiting verification",
    fr: "69 wilayas · Référence secondaire à vérifier",
  },
  "٪": {
    en: "%",
    fr: "%",
  },
  "فتح نموذج الطلب": {
    en: "Open order form",
    fr: "Ouvrir le formulaire",
  },
  "فتح لوحة التحكم": {
    en: "Open dashboard",
    fr: "Ouvrir le tableau de bord",
  },
  "متجر التجربة المحلي": {
    en: "Local demo store",
    fr: "Boutique de démonstration locale",
  },
  "تجربة محلية ببيانات وهمية · لا يلزم تسجيل الدخول · أسعار أولية تجريبية: المنزل 500 دج والمكتب 350 دج · لا نشر أو ربط خارجي":
    {
      en: "Local demo with fictitious data · No sign-in needed · Initial test rates: home500DZD, office350DZD · No deployment or external connection",
      fr: "Démo locale avec données fictives · Sans connexion · Tarifs initiaux de test : domicile500DZD, bureau350DZD · Aucun déploiement ni connexion externe",
    },
  "عدّل أسعار التوصيل بالدينار لكل الولايات أو ولاية أو بلدية محددة. أسعار وضع التجربة أمثلة وهمية قابلة للتعديل وليست أسعار ناقل.":
    {
      en: "Edit delivery rates in DZD for all wilayas, a specific wilaya or commune. Demo rates are editable examples, not carrier prices.",
      fr: "Modifiez les tarifs en DZD pour toutes les wilayas, une wilaya ou une commune. Les tarifs de démonstration sont des exemples modifiables, pas ceux d’un transporteur.",
    },
  "التكاملات الخارجية معطلة في التجربة المحلية.": {
    en: "External integrations are disabled in the local demo.",
    fr: "Les intégrations externes sont désactivées dans la démo locale.",
  },
  "المصدران مفتوحان بترخيص MIT. خريطة ٦٩ ولاية مصالَحة مع نص قانون منقول في المرجع الثاني، بعد رصد اختلافات في المصدر الأول. المطابقة المباشرة مع ملف الجريدة الرسمية معلّقة بسبب الوصول الشبكي. يمكن حفظ الطلبات الوهمية للتجربة المحلية.":
    {
      en: "Both sources use the MIT license. The 69-wilaya map has been reconciled against a secondary legal reference; direct official-PDF verification is pending. Fictitious orders can be saved locally.",
      fr: "Les deux sources sont sous licence MIT. La carte des 69 wilayas a été rapprochée d’une référence juridique secondaire ; la vérification directe du PDF officiel reste en attente. Les commandes fictives peuvent être enregistrées localement.",
    },
  تحديد: {
    en: "Select",
    fr: "Sélectionner",
  },
  "سعر الخيار": {
    en: "Variant price",
    fr: "Prix de variante",
  },
  "مخزون الخيار": {
    en: "Variant stock",
    fr: "Stock de variante",
  },
  "متجر مربوط:": {
    en: "Connected store:",
    fr: "Boutique connectée :",
  },
  "السعر الفعلي:": {
    en: "Effective price:",
    fr: "Prix effectif :",
  },
  "المصدر:": {
    en: "Source:",
    fr: "Source :",
  },
  "قائمة اختيار المنتج": {
    en: "Product selector",
    fr: "Sélecteur de produit",
  },
  "قائمة خيارات المنتج": {
    en: "Variant selector",
    fr: "Sélecteur de variante",
  },
  "صورة المنتج": {
    en: "Product image",
    fr: "Image du produit",
  },
  "سعر المنتج": {
    en: "Product price",
    fr: "Prix du produit",
  },
  "وصف النموذج": {
    en: "Form description",
    fr: "Description du formulaire",
  },
  "شريط الدفع عند الاستلام": {
    en: "Cash-on-delivery banner",
    fr: "Bandeau de paiement à la livraison",
  },
  "ملخص الأسعار": {
    en: "Price summary",
    fr: "Récapitulatif des prix",
  },
  "النص أسفل الزر": {
    en: "Text below the button",
    fr: "Texte sous le bouton",
  },
  "اختيار الكمية": {
    en: "Quantity selector",
    fr: "Sélecteur de quantité",
  },
  "اختيار الولاية والبلدية": {
    en: "Wilaya and commune selectors",
    fr: "Sélection de wilaya et commune",
  },
  "اختيار طريقة التوصيل": {
    en: "Delivery method selector",
    fr: "Choix du mode de livraison",
  },
  "حقول البحث عن المناطق": {
    en: "Location search fields",
    fr: "Champs de recherche des localités",
  },
  "اختيار التقسيم الإداري": {
    en: "Administrative mode selector",
    fr: "Sélecteur de découpage administratif",
  },
  أخضر: {
    en: "Green",
    fr: "Vert",
  },
  أحمر: {
    en: "Red",
    fr: "Rouge",
  },
  أصفر: {
    en: "Yellow",
    fr: "Jaune",
  },
  أزرق: {
    en: "Blue",
    fr: "Bleu",
  },
  برتقالي: {
    en: "Orange",
    fr: "Orange",
  },
  المحتوى: {
    en: "Content",
    fr: "Contenu",
  },
  الحقول: {
    en: "Fields",
    fr: "Champs",
  },
  التصميم: {
    en: "Design",
    fr: "Apparence",
  },
  "تحكم في المحتوى والحقول والألوان، وشاهد النتيجة فورًا.": {
    en: "Control content, fields and colors, and preview changes instantly.",
    fr: "Personnalisez le contenu, les champs et les couleurs avec un aperçu instantané.",
  },
  محفوظ: {
    en: "Saved",
    fr: "Enregistré",
  },
  "تغييرات غير محفوظة": {
    en: "Unsaved changes",
    fr: "Modifications non enregistrées",
  },
  "إعدادات النموذج": {
    en: "Form settings",
    fr: "Paramètres du formulaire",
  },
  "نصوص النموذج": {
    en: "Form text",
    fr: "Textes du formulaire",
  },
  "نص زر التأكيد": {
    en: "Confirmation button text",
    fr: "Texte du bouton de confirmation",
  },
  "نص الشريط العلوي": {
    en: "Top banner text",
    fr: "Texte du bandeau supérieur",
  },
  "تسميات الحقول": {
    en: "Field labels",
    fr: "Libellés des champs",
  },
  "المنتج المعروض": {
    en: "Featured product",
    fr: "Produit affiché",
  },
  "أول منتج متاح": {
    en: "First available product",
    fr: "Premier produit disponible",
  },
  "الخيار المعروض": {
    en: "Featured variant",
    fr: "Variante affichée",
  },
  "إظهار وإخفاء الأجزاء": {
    en: "Show or hide sections",
    fr: "Afficher ou masquer les sections",
  },
  "بيانات العميل": {
    en: "Customer details",
    fr: "Coordonnées du client",
  },
  "ظاهر وإلزامي": {
    en: "Visible and required",
    fr: "Visible et obligatoire",
  },
  "ظاهر واختياري": {
    en: "Visible and optional",
    fr: "Visible et facultatif",
  },
  مخفي: {
    en: "Hidden",
    fr: "Masqué",
  },
  "إخفاء الهاتف يحفظ الطلب دون رقم اتصال. تأكد أن لديك وسيلة أخرى للتواصل.": {
    en: "Hiding the phone field saves orders without a contact number. Make sure you have another way to reach the customer.",
    fr: "Masquer le téléphone enregistre des commandes sans numéro. Assurez-vous de disposer d’un autre moyen de contact.",
  },
  للأسفل: {
    en: "Move down",
    fr: "Descendre",
  },
  "ألوان الأزرار": {
    en: "Button colors",
    fr: "Couleurs des boutons",
  },
  "لون النص": {
    en: "Text color",
    fr: "Couleur du texte",
  },
  "تصميم مختصر": {
    en: "Compact layout",
    fr: "Disposition compacte",
  },
  "توزيع الحقول": {
    en: "Field layout",
    fr: "Disposition des champs",
  },
  "عمودان للاسم والهاتف": {
    en: "Two columns for name and phone",
    fr: "Deux colonnes pour le nom et le téléphone",
  },
  "عمود واحد": {
    en: "One column",
    fr: "Une colonne",
  },
  "طرق التوصيل في النموذج": {
    en: "Delivery methods on this form",
    fr: "Modes de livraison du formulaire",
  },
  "المنزل والمكتب — يختار العميل": {
    en: "Home and office — customer chooses",
    fr: "Domicile et bureau — au choix du client",
  },
  "الاختيار الافتراضي": {
    en: "Default selection",
    fr: "Sélection par défaut",
  },
  "دون تحديد — يختار العميل": {
    en: "No selection — customer chooses",
    fr: "Aucune sélection — au choix du client",
  },
  "فعّل أسعار المنزل والمكتب من أسعار الشحن. لا يظهر خيار متاح للعميل دون سعر مفعّل لمنطقته.":
    {
      en: "Enable home and office rates in Shipping. A method is available only when an enabled rate exists for the customer's region.",
      fr: "Activez les tarifs domicile et bureau dans Livraison. Un mode est disponible uniquement avec un tarif actif pour la région du client.",
    },
  "حدد المنطقة الثابتة التي ستُستخدم لحساب الشحن عند إخفاء حقول المنطقة.": {
    en: "Choose the fixed region used for pricing when location fields are hidden.",
    fr: "Choisissez la région fixe utilisée pour le calcul lorsque les champs de localité sont masqués.",
  },
  "الولاية الثابتة": {
    en: "Fixed wilaya",
    fr: "Wilaya fixe",
  },
  "البلدية الثابتة": {
    en: "Fixed commune",
    fr: "Commune fixe",
  },
  "معاينة مباشرة": {
    en: "Live preview",
    fr: "Aperçu en direct",
  },
  "المعاينة لا تحفظ طلبًا. احفظ التصميم وافتح النموذج لتجربته.": {
    en: "Preview does not save orders. Save your design and open the form to try it.",
    fr: "L’aperçu n’enregistre pas de commande. Enregistrez le modèle et ouvrez le formulaire pour l’essayer.",
  },
  "اختر طريقة التوصيل المناسبة لك.": {
    en: "Choose the delivery method that suits you.",
    fr: "Choisissez le mode de livraison qui vous convient.",
  },
  "اختر طريقة التوصيل": {
    en: "Choose a delivery method",
    fr: "Choisissez un mode de livraison",
  },
  "DZ Lead Form Pro | تجربة محلية": {
    en: "DZ Lead Form Pro · Local demo",
    fr: "DZ Lead Form Pro · Démonstration locale",
  },
  اللغة: {
    en: "Language",
    fr: "Langue",
  },
  "Language / اللغة / Langue": {
    en: "Language / اللغة / Langue",
    fr: "Language / اللغة / Langue",
  },
  "ابحث بالاسم أو الهاتف أو رقم الطلب": {
    en: "Search by name, phone or order ID",
    fr: "Rechercher par nom, téléphone ou numéro de commande",
  },
  "ستظهر الطلبات هنا بعد إرسالها من النموذج. يمكنك تغيير البحث أو التصفية.": {
    en: "Orders will appear here after submission. Try changing your search or filters.",
    fr: "Les commandes apparaîtront ici après leur envoi. Vous pouvez modifier la recherche ou les filtres.",
  },
  "عميل بدون اسم": {
    en: "Unnamed customer",
    fr: "Client sans nom",
  },
  "إجمالي الطلبات": {
    en: "Total orders",
    fr: "Total des commandes",
  },
  "قيمة الطلبات": {
    en: "Order value",
    fr: "Valeur des commandes",
  },
  "بانتظار أول طلب": {
    en: "Waiting for the first order",
    fr: "En attente de la première commande",
  },
  "فعّل المكتب وحدد سعره ليتمكن العميل من اختياره بدل التوصيل إلى المنزل.": {
    en: "Enable office delivery and set its price so customers can choose it instead of home delivery.",
    fr: "Activez la livraison au bureau et fixez son tarif pour permettre ce choix au client.",
  },
  "استيراد وتصدير الأسعار": {
    en: "Import and export rates",
    fr: "Importer et exporter les tarifs",
  },
  "نزّل جدول الأسعار أو ارفع ملف CSV لتحديث مجموعة من المناطق دفعة واحدة.": {
    en: "Download the rate table or upload a CSV to update multiple regions at once.",
    fr: "Téléchargez les tarifs ou importez un CSV pour actualiser plusieurs régions à la fois.",
  },
  "تنزيل الأسعار الحالية": {
    en: "Download current rates",
    fr: "Télécharger les tarifs actuels",
  },
  "تحديث الأسعار من ملف": {
    en: "Update rates from a file",
    fr: "Actualiser les tarifs depuis un fichier",
  },
  "استخدم ملف التصدير قالبًا. تُرفض الصفوف المكررة أو غير الصالحة دون تغيير أسعارك.":
    {
      en: "Use an exported file as a template. Invalid or duplicate rows are rejected without changing your rates.",
      fr: "Utilisez un export comme modèle. Les lignes invalides ou dupliquées sont refusées sans modifier vos tarifs.",
    },
  "ملخص أداء متجرك وأحدث الطلبات في مكان واحد.": {
    en: "Your store's performance and latest orders in one place.",
    fr: "Les performances de votre boutique et ses commandes au même endroit.",
  },
  "راجع الطلبات وتابع تأكيدها وتجهيزها وتسليمها.": {
    en: "Review orders and track confirmation, preparation and delivery.",
    fr: "Consultez les commandes et suivez confirmation, préparation et livraison.",
  },
  "أدر منتجاتك وأسعارها وخياراتها ومخزونها.": {
    en: "Manage products, prices, variants and inventory.",
    fr: "Gérez vos produits, prix, variantes et stocks.",
  },
  "صمّم نموذج طلب يناسب متجرك وعميلك.": {
    en: "Design an order form that fits your store and your customers.",
    fr: "Créez un formulaire adapté à votre boutique et à vos clients.",
  },
  "أسعار منظمة لكل ولاية وبلدية، للمنزل والمكتب.": {
    en: "Organized home and office rates for every wilaya and commune.",
    fr: "Des tarifs domicile et bureau organisés par wilaya et commune.",
  },
  "أرقام واضحة تساعدك على متابعة نشاط متجرك.": {
    en: "Clear numbers to help you track your store's activity.",
    fr: "Des chiffres clairs pour suivre l’activité de votre boutique.",
  },
  "إعدادات الخدمات المتاحة لمتجرك.": {
    en: "Settings for services available to your store.",
    fr: "Paramètres des services disponibles pour votre boutique.",
  },
  "خصومات المتجر والإعدادات الإضافية.": {
    en: "Store discounts and additional settings.",
    fr: "Remises de la boutique et paramètres supplémentaires.",
  },
  "فتح النموذج": {
    en: "Open form",
    fr: "Ouvrir le formulaire",
  },
  "أضف منتجاتك وصورها وأسعارها.": {
    en: "Add your products, images and prices.",
    fr: "Ajoutez vos produits, images et prix.",
  },
  "تخصيص النموذج": {
    en: "Customize form",
    fr: "Personnaliser le formulaire",
  },
  "اختر الحقول والألوان التي تناسب متجرك.": {
    en: "Choose fields and colors that fit your store.",
    fr: "Choisissez les champs et couleurs adaptés à votre boutique.",
  },
  "ضبط أسعار التوصيل": {
    en: "Set delivery rates",
    fr: "Configurer les tarifs de livraison",
  },
  "حدد أسعار المنزل والمكتب لكل مناطقك.": {
    en: "Set home and office rates for your regions.",
    fr: "Fixez les tarifs domicile et bureau pour vos régions.",
  },
  "مرجع الولايات والبلديات": {
    en: "Wilaya and commune reference",
    fr: "Référentiel des wilayas et communes",
  },
  "تستخدم هذه البيانات لربط عنوان العميل بسعر الشحن. لا تحتاج تعديلها لإدارة أسعار التوصيل.":
    {
      en: "This data connects customer locations to shipping prices. You do not need to edit it to manage rates.",
      fr: "Ces données relient l’adresse du client au tarif de livraison. Leur modification n’est pas nécessaire pour gérer vos prix.",
    },
  "إغلاق المعاينة": {
    en: "Close preview",
    fr: "Fermer l’aperçu",
  },
  "الكمية ثابتة في هذا النموذج.": {
    en: "Quantity is fixed on this form.",
    fr: "La quantité est fixe sur ce formulaire.",
  },
  "منطقة التوصيل ثابتة في هذا النموذج.": {
    en: "The delivery region is fixed on this form.",
    fr: "La région de livraison est fixe sur ce formulaire.",
  },
  "المنتج غير مخصص لهذا النموذج.": {
    en: "This product is not configured for this form.",
    fr: "Ce produit n’est pas prévu pour ce formulaire.",
  },
  "الخيار غير مخصص لهذا النموذج.": {
    en: "This variant is not configured for this form.",
    fr: "Cette variante n’est pas prévue pour ce formulaire.",
  },
  "أدخل معلوماتك وسنتواصل معك لتأكيد الطلب.": {
    en: "Enter your details and we will contact you to confirm.",
    fr: "Saisissez vos coordonnées, nous vous contacterons pour confirmer.",
  },
  "بياناتك آمنة وتُستخدم لتوصيل طلبك فقط.": {
    en: "Your details are kept safe and used only to deliver your order.",
    fr: "Vos coordonnées sont protégées et utilisées uniquement pour livrer votre commande.",
  },
  "الدفع عند الاستلام": {
    en: "Cash on delivery",
    fr: "Paiement à la livraison",
  },
  "حدد ولاية وبلدية ثابتتين قبل إخفاء المنطقة.": {
    en: "Choose a fixed wilaya and commune before hiding location fields.",
    fr: "Choisissez une wilaya et une commune fixes avant de masquer la localité.",
  },
  "اختر طريقة توصيل واحدة قبل إخفاء اختيار التوصيل.": {
    en: "Select one delivery method before hiding the method selector.",
    fr: "Choisissez un seul mode avant de masquer le sélecteur de livraison.",
  },
  "الاسم واللقب": {
    en: "First and last name",
    fr: "Nom et prénom",
  },
  "طريقة التوصيل غير متاحة في هذا النموذج.": {
    en: "This delivery method is not available on this form.",
    fr: "Ce mode de livraison n’est pas disponible sur ce formulaire.",
  },
  تسمية: { en: "Label", fr: "Libellé" },
  "نصوص القوائم وملخص الأسعار": {
    en: "Selector and price summary labels",
    fr: "Libellés des listes et du récapitulatif",
  },
};
