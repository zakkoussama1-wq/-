import { LanguageProvider } from "@/components/language-provider";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DZ Lead Form Pro | مساحة التاجر",
  description: "مساحة عمل للتجارة والدفع عند الاستلام في الجزائر",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
