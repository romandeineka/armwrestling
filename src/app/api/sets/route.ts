import { getDb } from "@/db";
import { addSet, JournalError } from "@/server/journal";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    const created = await addSet(await getDb(), body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof JournalError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
