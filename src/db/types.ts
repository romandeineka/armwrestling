import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export type JournalDb = PgliteDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;
