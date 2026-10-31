"use client";
import { useEffect, useState } from "react";
const channelName = "dz-checkout-updates";
export function notifyCheckoutChanged() {
  window.dispatchEvent(new Event(channelName));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage("refresh");
    channel.close();
  }
}
export function useCheckoutUpdates() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(channelName);
    if (channel) channel.onmessage = refresh;
    window.addEventListener(channelName, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      channel?.close();
      window.removeEventListener(channelName, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return revision;
}
