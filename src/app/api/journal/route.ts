import { getDb } from "@/db";
import { getJournal } from "@/server/journal";
import { isOwner } from "@/server/session";

export async function GET() {
  const [journal, owner] = await Promise.all([getJournal(await getDb()), isOwner()]);
  return Response.json({ ...journal, isOwner: owner });
}
