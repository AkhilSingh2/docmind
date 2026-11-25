import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "DocMind — research that cites its sources",
  description:
    "Upload notes, ask questions, and get streamed answers with citations that jump back to the passage. Demo mode runs with no API keys.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>
        <a href="#chat" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to the conversation
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
