import { getDb } from "@/db";
import { getJournal } from "@/server/journal";
import { kyivToday } from "@/server/catalog";

export async function GET() {
  const journal = await getJournal(await getDb(), kyivToday());
  return Response.json(journal);
}
