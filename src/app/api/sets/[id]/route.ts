import { getDb } from "@/db";
import { attachVideo, JournalError } from "@/server/journal";
import { requireOwner } from "@/server/session";

export async function PATCH(request: Request, ctx: RouteContext<"/api/sets/[id]">) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    await attachVideo(await getDb(), id, body);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof JournalError) {
      const status = error.message === "not_found" ? 404 : 400;
      return Response.json({ error: error.message }, { status });
    }
    throw error;
  }
}
