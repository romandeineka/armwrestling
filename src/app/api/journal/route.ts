import { getDb } from "@/db";
import { getJournal } from "@/server/journal";

export async function GET() {
  const journal = await getJournal(await getDb());
  return Response.json(journal);
}
