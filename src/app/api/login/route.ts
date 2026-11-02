import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { createSession, verifyPassword } from "@/server/auth";
import { SESSION_COOKIE } from "@/server/session";

const loginInput = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const passwordHash = process.env.OWNER_PASSWORD_HASH;
  if (!passwordHash) {
    return Response.json({ error: "auth_not_configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const parsed = loginInput.safeParse(body);
  if (!parsed.success || !(await verifyPassword(parsed.data.password, passwordHash))) {
    return Response.json({ error: "bad_password" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(await getDb());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return new Response(null, { status: 204 });
}
