import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Roboto } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/design-system/themes/ThemeProvider";
import { SnackbarProvider } from "@/components/vm3/Snackbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--vm3-font-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AC System",
    template: "%s · AC System",
  },
  description: "Sistem monitoring produksi — UPH, scan PO, dan master data.",
};

/* Match browser chrome to the PT GAS surface tokens. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const noFlashScript = `(function(){
  try {
    var t = localStorage.getItem("vm3-theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={roboto.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SnackbarProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </SnackbarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
