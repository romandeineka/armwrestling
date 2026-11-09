import type { MetadataRoute } from "next";

// Маніфест каже телефону, як показувати сайт після «Додати на головний екран»:
// назва під іконкою, іконки, кольори і запуск на весь екран без адресного рядка.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Журнал рекордів",
    short_name: "Рекорди",
    description: "Рекорди у вправах для армреслінгу з відео виконання",
    start_url: "/",
    display: "standalone",
    background_color: "#12100e",
    theme_color: "#12100e",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
