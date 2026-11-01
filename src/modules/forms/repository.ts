import { productFormSettings } from "./product-form";
import { authDb } from "../auth/store";
import { defaultFormSettings, formSettingsSchema } from "./settings";
export async function getFormSettings(merchant: string, productId?: string) {
  const db = await authDb();
  try {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS form_settings(merchant_id TEXT PRIMARY KEY,settings TEXT NOT NULL)",
    );
    const row = await db
      .prepare("SELECT settings FROM form_settings WHERE merchant_id=?")
      .get(merchant);
    return productFormSettings(
      row
        ? formSettingsSchema.parse(JSON.parse(String(row.settings)))
        : defaultFormSettings,
      productId,
    );
  } finally {
    await db.close();
  }
}
