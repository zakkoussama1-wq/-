import { localMerchantId } from "@/modules/merchants/local-context";
import { readSimulation } from "@/modules/advertising/simulation";
export async function GET(request: Request) {
  try {
    const { settings } = await readSimulation(
      await localMerchantId(request, true),
    );
    return Response.json(
      { enabled: settings.enabled, mode: "simulation" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { enabled: false, mode: "simulation" },
      { status: 503 },
    );
  }
}
