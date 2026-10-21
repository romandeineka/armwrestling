export async function ensureSchema(exec: (statement: string) => Promise<unknown>) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS handles (
      id text PRIMARY KEY,
      name text NOT NULL,
      vector text NOT NULL,
      image text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS sets (
      id text PRIMARY KEY,
      handle_id text NOT NULL REFERENCES handles(id),
      arm text NOT NULL,
      weight_grams integer NOT NULL,
      reps integer NOT NULL,
      set_count integer NOT NULL DEFAULT 1,
      trained_on date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      exercise text,
      block_height text,
      band text,
      hold_seconds integer
    )`,
    `ALTER TABLE handles ADD COLUMN IF NOT EXISTS image text`,
    `ALTER TABLE sets ADD COLUMN IF NOT EXISTS exercise text`,
    `ALTER TABLE sets ADD COLUMN IF NOT EXISTS block_height text`,
    `ALTER TABLE sets ADD COLUMN IF NOT EXISTS band text`,
    `ALTER TABLE sets ADD COLUMN IF NOT EXISTS hold_seconds integer`,
    `ALTER TABLE sets ADD COLUMN IF NOT EXISTS set_count integer NOT NULL DEFAULT 1`,
    `ALTER TABLE sets DROP COLUMN IF EXISTS elbow_pain`,
    `UPDATE sets SET exercise = 'imitation_wrestling' WHERE exercise = 'imitation'`,
  ];

  for (const statement of statements) {
    await exec(statement);
  }
}
