import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

const SIZES = [32, 192, 512];

// Next.js малює PNG-іконки з коду: /icon/32 для вкладки браузера, 192 і 512 для маніфесту.
export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    contentType: "image/png",
    size: { width: size, height: size },
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(<AppIconArt size={size} />, { width: size, height: size });
}
