import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Oswald({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Журнал рекордів",
  description: "Рекорди у вправах для армреслінгу з відео виконання",
  // Для iPhone: назва під іконкою і темний статус-бар у режимі «на весь екран».
  appleWebApp: {
    title: "Рекорди",
    statusBarStyle: "black-translucent",
  },
};

// Колір смужки браузера і статус-бара телефона, такий самий, як фон сайту.
export const viewport: Viewport = {
  themeColor: "#12100e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
