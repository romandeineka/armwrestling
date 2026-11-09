import { getDb } from "@/db";
import { addSet, checkRecord, JournalError } from "@/server/journal";
import { requireOwner } from "@/server/session";

export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const created = await addSet(db, body);
    const record = await checkRecord(db, created);
    return Response.json({ ...created, record }, { status: 201 });
  } catch (error) {
    if (error instanceof JournalError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
