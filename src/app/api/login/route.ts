import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import {
  clearFailedLogins,
  createSession,
  loginRetryAfter,
  recordFailedLogin,
  verifyPassword,
} from "@/server/auth";
import { SESSION_COOKIE } from "@/server/session";

const loginInput = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const passwordHash = process.env.OWNER_PASSWORD_HASH;
  if (!passwordHash) {
    return Response.json({ error: "auth_not_configured" }, { status: 500 });
  }

  const db = await getDb();
  const ip = clientIp(request);

  // Перевіряємо ліміт ДО пароля: заблокованому навіть не кажемо, чи пароль правильний.
  const retryAfter = await loginRetryAfter(db, ip);
  if (retryAfter) {
    return Response.json(
      { error: "too_many_attempts", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const parsed = loginInput.safeParse(body);
  if (!parsed.success || !(await verifyPassword(parsed.data.password, passwordHash))) {
    await recordFailedLogin(db, ip);
    return Response.json({ error: "bad_password" }, { status: 401 });
  }

  await clearFailedLogins(db, ip);
  const { token, expiresAt } = await createSession(db);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return new Response(null, { status: 204 });
}

// На Vercel справжню адресу клієнта кладе в x-forwarded-for сам Vercel
// (перша адреса в списку). Локально заголовка немає, тож усі запити — "local".
function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
