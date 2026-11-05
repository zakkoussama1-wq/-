import { createHash } from "node:crypto";
import { Session } from "@shopify/shopify-api";
import { connectionCredential } from "../../integrations/shopify/connections";
import { shopHostname } from "../../integrations/shopify/client";
import { SHOPIFY_API_VERSION } from "../../integrations/shopify/sdk";
import { verifiedShopForMerchant } from "../../merchants/shops";
import type { StoredOrder } from "../repository";
import geography from "../../../../data/geography/catalog.json";
import { SyncFailure } from "./types";
import { OrderContract, type Graph } from "./contract";
export const ORDER_FIELDS = `id name displayFinancialStatus totalPriceSet { shopMoney { amount currencyCode } } totalOutstandingSet { shopMoney { amount currencyCode } } totalShippingPriceSet { shopMoney { amount currencyCode } } totalDiscountsSet { shopMoney { amount currencyCode } } totalTaxSet { shopMoney { amount currencyCode } } customAttributes { key value } lineItems(first:2) { nodes { quantity variant { id } originalUnitPriceSet { shopMoney { amount currencyCode } } } }`;
export const money = (minor: number) => {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new SyncFailure("INVALID_MONEY");
  return {
    shopMoney: { amount: (minor / 100).toFixed(2), currencyCode: "DZD" },
  };
};
export interface RemoteOrder {
  id: string;
  name: string;
  displayFinancialStatus: string;
  sourceIdentifier?: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  totalOutstandingSet: RemoteOrder["totalPriceSet"];
  totalShippingPriceSet: RemoteOrder["totalPriceSet"];
  totalDiscountsSet: RemoteOrder["totalPriceSet"];
  totalTaxSet: RemoteOrder["totalPriceSet"];
  customAttributes: { key: string; value: string }[];
  lineItems: {
    nodes: {
      quantity: number;
      variant: { id: string } | null;
      originalUnitPriceSet: RemoteOrder["totalPriceSet"];
    }[];
  };
}
export async function orderClient(merchant: string) {
  let credential: Awaited<ReturnType<typeof connectionCredential>>;
  try {
    credential = await connectionCredential(merchant, true);
  } catch {
    throw new SyncFailure("OFFLINE_AUTH_REQUIRED", "reauthorization");
  }
  if (
    !credential.offline ||
    !new Session({
      id: "scope-check",
      shop: credential.shop,
      state: "",
      isOnline: false,
      scope: credential.scopes.join(","),
    }).isScopeIncluded(["write_orders"])
  )
    throw new SyncFailure("WRITE_ORDERS_REQUIRED", "reauthorization");
  const shop = shopHostname(credential.shop);
  const tenant = await verifiedShopForMerchant(merchant);
  if (tenant.domain !== shop) throw new SyncFailure("SHOP_BINDING_MISMATCH");
  const graph = shopifyOrderGraph(shop, credential.accessToken);
  const identity = await graph(
    "query DzOrderAccess { shop { id currencyCode taxesIncluded } currentAppInstallation { accessScopes { handle } } }",
  );
  const actual = identity.shop as {
    id: string;
    currencyCode: string;
    taxesIncluded: boolean;
  };
  const installation = identity.currentAppInstallation as {
    accessScopes: { handle: string }[];
  };
  if (!installation?.accessScopes?.some((s) => s.handle === "write_orders"))
    throw new SyncFailure("WRITE_ORDERS_REQUIRED", "reauthorization");
  if (actual?.id !== tenant.shopId || actual.currencyCode !== "DZD")
    throw new SyncFailure("SHOP_OR_CURRENCY_MISMATCH");
  if (actual.taxesIncluded !== false)
    throw new SyncFailure("TAX_BREAKDOWN_REQUIRED");
  return { graph, contract: new OrderContract(graph), shopId: actual.id };
}
export function payloadFingerprint(
  order: Record<string, unknown>,
  options: Record<string, unknown>,
  shopId: string,
) {
  const attributes = order.customAttributes as { key: string; value: string }[];
  const normalized = {
    ...order,
    customAttributes: attributes.filter((a) => a.key !== "dz_payload_hash"),
  };
  return createHash("sha256")
    .update(JSON.stringify({ order: normalized, options, shopId }))
    .digest("hex");
}
export function buildOrderPayload(
  order: StoredOrder,
  sourceIdentifier: boolean,
  shopId: string,
) {
  const q = order.quote;
  const shipping = q.methods[order.customer.method];
  if (
    !shipping.available ||
    shipping.totalMinor === null ||
    shipping.amountMinor === null ||
    !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(order.customer.variantId)
  )
    throw new SyncFailure("INVALID_ORDER_SNAPSHOT");
  const commune = geography.communes.find(
    (c) => c.id === order.customer.communeId,
  );
  const code =
    order.customer.mode === "legacy58"
      ? commune?.legacyWilayaCode
      : commune?.updatedWilayaCode;
  const wilaya = geography.wilayas.find((w) => w.code === code);
  if (!commune || !wilaya || code !== order.customer.wilayaCode)
    throw new SyncFailure("INVALID_LOCATION");
  // Prices/taxes/discounts come only from the immutable local snapshot. No auto tax assumptions.
  const extraTax =
    shipping.totalMinor -
    (q.subtotalMinor - q.discountMinor + shipping.amountMinor);
  if (extraTax !== 0) throw new SyncFailure("TAX_BREAKDOWN_REQUIRED");
  const phone = order.customer.phone
    ? "+213" + order.customer.phone.slice(1)
    : undefined;
  const source = `dz-cod-${order.id}`;
  const payload: Record<string, unknown> = {
    currency: "DZD",
    financialStatus: "PENDING",
    taxesIncluded: false,
    taxLines: [],
    tags: [source, "DZ-COD"],
    customAttributes: [
      { key: "dz_local_order_id", value: order.id },
      { key: "dz_delivery_method", value: order.customer.method },
    ],
    ...(sourceIdentifier ? { sourceIdentifier: source } : {}),
    ...(phone ? { phone } : {}),
    lineItems: [
      {
        variantId: order.customer.variantId,
        quantity: order.customer.quantity,
        priceSet: money(q.unitPriceMinor),
      },
    ],
    shippingAddress: {
      ...(order.customer.name ? { firstName: order.customer.name } : {}),
      ...(phone ? { phone } : {}),
      countryCode: "DZ",
      province: wilaya.nameLatin,
      city: commune.nameLatin,
      ...(order.customer.address ? { address1: order.customer.address } : {}),
    },
    shippingLines: [
      {
        title:
          order.customer.method === "office"
            ? "COD office pickup"
            : "COD home delivery",
        priceSet: money(shipping.amountMinor),
      },
    ],
    ...(order.pickupInstructions ? { note: order.pickupInstructions } : {}),
    ...(q.discountMinor
      ? {
          discountCode: {
            itemFixedDiscountCode: {
              code: "DZ-COD",
              amountSet: money(q.discountMinor),
            },
          },
        }
      : {}),
  };
  const policy = process.env.DZ_SHOPIFY_ORDER_INVENTORY_POLICY ?? "BYPASS";
  if (policy !== "BYPASS")
    throw new SyncFailure("INVENTORY_POLICY_UNSUPPORTED");
  const options = {
    inventoryBehaviour: policy,
    sendReceipt: false,
    sendFulfillmentReceipt: false,
  };
  const hash = payloadFingerprint(payload, options, shopId);
  (payload.customAttributes as { key: string; value: string }[]).push({
    key: "dz_payload_hash",
    value: hash,
  });
  return { order: payload, options, hash, source, sourceIdentifier };
}
export function remoteReferenceMatches(
  remote: RemoteOrder,
  local: StoredOrder,
  hash: string,
) {
  const attributes = new Map(
    (remote.customAttributes ?? []).map((a) => [a.key, a.value]),
  );
  return (
    attributes.get("dz_local_order_id") === local.id &&
    attributes.get("dz_payload_hash") === hash &&
    (remote.sourceIdentifier === undefined ||
      remote.sourceIdentifier === `dz-cod-${local.id}`)
  );
}
function sameMoney(
  bag: RemoteOrder["totalPriceSet"] | undefined,
  minor: number | null,
) {
  const amount = bag?.shopMoney?.amount;
  return (
    minor !== null &&
    bag?.shopMoney?.currencyCode === "DZD" &&
    typeof amount === "string" &&
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Math.round(Number(amount) * 100) === minor
  );
}
export function remoteMatches(
  remote: RemoteOrder,
  local: StoredOrder,
  hash: string,
) {
  const lines = remote.lineItems?.nodes ?? [];
  const method = local.quote.methods[local.customer.method];
  return (
    /^gid:\/\/shopify\/Order\/\d+$/.test(remote.id) &&
    remoteReferenceMatches(remote, local, hash) &&
    remote.displayFinancialStatus === "PENDING" &&
    sameMoney(remote.totalPriceSet, method.totalMinor) &&
    sameMoney(remote.totalOutstandingSet, method.totalMinor) &&
    sameMoney(remote.totalShippingPriceSet, method.amountMinor) &&
    sameMoney(remote.totalDiscountsSet, local.quote.discountMinor) &&
    sameMoney(remote.totalTaxSet, 0) &&
    lines.length === 1 &&
    lines[0].quantity === local.customer.quantity &&
    lines[0].variant?.id === local.customer.variantId &&
    sameMoney(lines[0].originalUnitPriceSet, local.quote.unitPriceMinor)
  );
}
export async function findRemote(
  graph: Graph,
  source: string,
  includeSource: boolean,
) {
  const fields = ORDER_FIELDS + (includeSource ? " sourceIdentifier" : "");
  const data = await graph(
    `query DzFindCod($query:String!) { orders(first:2,query:$query) { nodes { ${fields} } pageInfo { hasNextPage } } }`,
    { query: `status:any tag:"${source}"` },
  );
  const result = data.orders as {
    nodes: RemoteOrder[];
    pageInfo: { hasNextPage: boolean };
  };
  if (!result?.nodes || !result.pageInfo)
    throw new SyncFailure("RECONCILIATION_INVALID");
  if (result.pageInfo.hasNextPage || result.nodes.length > 1)
    throw new SyncFailure("MULTIPLE_REMOTE_MATCHES");
  return result.nodes[0];
}

export function shopifyOrderGraph(shop: string, accessToken: string): Graph {
  // No SDK/HTTP automatic retries: a mutation timeout is ambiguous, not a retry signal.
  return async (query, variables = {}) => {
    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      throw new SyncFailure(
        "THROTTLED",
        "retryable",
        Math.max(
          30000,
          Math.min(3600000, Number.isFinite(seconds) ? seconds * 1000 : 30000),
        ),
        "not_created",
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new SyncFailure(
        "SHOPIFY_ACCESS_DENIED",
        "reauthorization",
        30000,
        "not_created",
      );
    if (!response.ok)
      throw new SyncFailure("SHOPIFY_HTTP_FAILURE", "retryable");
    if (response.headers.get("x-shopify-api-version") !== "2026-10")
      throw new SyncFailure("API_VERSION_MISMATCH");
    const body = await response.json();
    // Preserve a returned order ID even if Shopify also reports errors. Never recreate it.
    if (body.data?.orderCreate?.order) return body.data;
    if (body.errors?.length) {
      // GraphQL execution errors (including root/nested paths or data:null) may
      // follow a committed side effect. Only a request-level rejection with no
      // data member and no error paths can prove non-execution.
      const requestRejected =
        !Object.hasOwn(body, "data") &&
        body.errors.every(
          (e: { path?: unknown; extensions?: { code?: string } }) =>
            !Object.hasOwn(e, "path") &&
            ["ACCESS_DENIED", "THROTTLED"].includes(e.extensions?.code ?? ""),
        );
      const outcome = requestRejected ? "not_created" : "unknown";
      if (
        body.errors.every(
          (e: { extensions?: { code?: string } }) =>
            e.extensions?.code === "THROTTLED",
        )
      )
        throw new SyncFailure("THROTTLED", "retryable", 30000, outcome);
      if (
        body.errors.some(
          (e: { extensions?: { code?: string } }) =>
            e.extensions?.code === "ACCESS_DENIED",
        )
      )
        throw new SyncFailure(
          "PROTECTED_DATA_OR_SCOPE_DENIED",
          "reauthorization",
          30000,
          outcome,
        );
      throw new SyncFailure("SHOPIFY_GRAPHQL_REJECTED");
    }
    if (!body.data)
      throw new SyncFailure("SHOPIFY_RESPONSE_INVALID", "retryable");
    return body.data;
  };
}
