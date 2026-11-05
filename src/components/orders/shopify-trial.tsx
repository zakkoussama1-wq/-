"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../language-provider";
import { Button } from "../ui/button";
import {
  safeTrialCode,
  trialText,
  trialReportSchema,
  type TrialReport,
} from "@/modules/orders/shopify/trial-ui";
export function ShopifyTrialPanel({
  orderId,
  canPrepare,
  disabled,
  onBusyChange,
}: {
  orderId: string;
  canPrepare: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { language } = useLanguage();
  const [pending, setPending] = useState<"prepare" | "readiness" | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [report, setReport] = useState<TrialReport | null>(null);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  async function run(action: "prepare" | "readiness") {
    if (disabled || active.current || (action === "prepare" && !canPrepare))
      return;
    const controller = new AbortController();
    active.current = controller;
    setPending(action);
    onBusyChange(true);
    setError("");
    setReport(null);
    setPrepared(false);
    try {
      const response = await fetch(
        action === "prepare"
          ? "/api/orders/shopify-sync/trial"
          : `/api/orders/shopify-sync/readiness?id=${encodeURIComponent(orderId)}`,
        {
          method: action === "prepare" ? "POST" : "GET",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
          ...(action === "prepare"
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: orderId }),
              }
            : {}),
        },
      );
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        if (!controller.signal.aborted) setError("UNKNOWN_DIAGNOSTIC");
        return;
      }
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const code =
          typeof data === "object" && data !== null && "code" in data
            ? data.code
            : undefined;
        setError(
          response.status === 401 ? "AUTH_REQUIRED" : safeTrialCode(code),
        );
        return;
      }
      if (action === "prepare") {
        if (
          typeof data !== "object" ||
          data === null ||
          !("prepared" in data) ||
          data.prepared !== true ||
          !("orderId" in data) ||
          data.orderId !== orderId
        ) {
          setError("UNKNOWN_DIAGNOSTIC");
          return;
        }
        setPrepared(true);
      } else {
        const parsed = trialReportSchema.safeParse(data);
        if (!parsed.success) {
          setError("UNKNOWN_DIAGNOSTIC");
          return;
        }
        setReport(parsed.data);
      }
    } catch {
      if (!controller.signal.aborted) setError("network");
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setPending(null);
      onBusyChange(false);
    }
  }
  return (
    <section
      className="mb-4 space-y-3 rounded-lg border border-slate-200 p-3 text-xs"
      aria-label={trialText("title", language)}
      aria-busy={pending !== null}
    >
      <h3 className="font-bold">{trialText("title", language)}</h3>
      <p>{trialText("explanation", language)}</p>
      <div className="flex flex-wrap gap-2">
        {canPrepare && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || pending !== null}
            onClick={() => void run("prepare")}
          >
            {trialText(
              pending === "prepare" ? "preparing" : "prepare",
              language,
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || pending !== null}
          onClick={() => void run("readiness")}
        >
          {trialText(
            pending === "readiness" ? "checking" : "readiness",
            language,
          )}
        </Button>
      </div>
      {prepared && <p role="status">{trialText("prepared", language)}</p>}
      {error && (
        <div role="alert">
          <p>{trialText(error, language)}</p>
          {error === "AUTH_REQUIRED" && (
            <a className="underline" href="/login">
              {trialText("login", language)}
            </a>
          )}
        </div>
      )}
      {report && (
        <div className="space-y-3">
          <p role="status" className="font-bold">
            {trialText(report.ready ? "ready" : "blocked", language)}
          </p>
          <dl className="space-y-3">
            {Object.entries(report.checks).map(
              ([name, check]) =>
                check && (
                  <div key={name}>
                    <dt className="font-semibold">
                      {trialText(name, language)}
                    </dt>
                    <dd>
                      <span>
                        {trialText(
                          check.status === "blocked"
                            ? "blockedStatus"
                            : check.status,
                          language,
                        )}
                      </span>
                      {" — "}
                      {trialText(check.code, language)}{" "}
                      <code dir="ltr" className="break-all">
                        {check.code}
                      </code>
                    </dd>
                  </div>
                ),
            )}
          </dl>
          <p>{trialText("caveat", language)}</p>
        </div>
      )}
    </section>
  );
}
