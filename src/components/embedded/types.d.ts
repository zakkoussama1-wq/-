import type { DetailedHTMLProps, HTMLAttributes } from "react";
declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "ui-nav-menu": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
