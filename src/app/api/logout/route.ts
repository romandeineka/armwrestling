import { cookies } from "next/headers";
import { getDb } from "@/db";
import { deleteSession } from "@/server/auth";
import { SESSION_COOKIE } from "@/server/session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSession(await getDb(), token);
  }
  cookieStore.delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
