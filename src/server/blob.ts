import { del } from "@vercel/blob";

// Видаляє файл зі сховища, коли запис з ним видалили або відео замінили.
// Якщо це не вдалося, запис у базі вже змінено, тож запит не валимо, лише пишемо в лог.
export async function removeVideo(url: string | null) {
  if (!url) return;
  try {
    await del(url);
  } catch (error) {
    console.error("blob delete failed", url, error);
  }
}
