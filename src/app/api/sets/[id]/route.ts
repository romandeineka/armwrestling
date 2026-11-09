import { getDb } from "@/db";
import { removeVideo } from "@/server/blob";
import { attachVideo, deleteSet, JournalError, updateSet } from "@/server/journal";
import { requireOwner } from "@/server/session";

type Context = RouteContext<"/api/sets/[id]">;

// PATCH: часткова зміна, тут лише прикріпити відео.
export async function PATCH(request: Request, ctx: Context) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await readJson(request);
  if (body instanceof Response) return body;

  try {
    await attachVideo(await getDb(), id, body);
    return new Response(null, { status: 204 });
  } catch (error) {
    return journalError(error);
  }
}

// PUT: повна заміна запису, тобто редагування з форми.
export async function PUT(request: Request, ctx: Context) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await readJson(request);
  if (body instanceof Response) return body;

  try {
    const { set, previousVideoUrl } = await updateSet(await getDb(), id, body);
    if (previousVideoUrl !== set.videoUrl) {
      await removeVideo(previousVideoUrl);
    }
    return Response.json(set);
  } catch (error) {
    return journalError(error);
  }
}

export async function DELETE(_request: Request, ctx: Context) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    const { videoUrl } = await deleteSet(await getDb(), id);
    await removeVideo(videoUrl);
    return new Response(null, { status: 204 });
  } catch (error) {
    return journalError(error);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
}

function journalError(error: unknown) {
  if (error instanceof JournalError) {
    const status = error.message === "not_found" ? 404 : 400;
    return Response.json({ error: error.message }, { status });
  }
  throw error;
}
