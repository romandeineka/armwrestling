import { cookies } from "next/headers";
import { getDb } from "@/db";
import { isValidSession } from "./auth";

export const SESSION_COOKIE = "session";

export async function isOwner() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return isValidSession(await getDb(), token);
}

// Викликається першим рядком у кожному маршруті, який щось змінює.
// Повертає готову відповідь 401, якщо входу немає, або null, якщо все гаразд.
export async function requireOwner() {
  if (await isOwner()) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
