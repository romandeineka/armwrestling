// Друкує OWNER_PASSWORD_HASH для .env.local і Vercel.
// Запуск: node scripts/hash-password.mjs
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Пароль: ");
rl.close();

if (password.length < 8) {
  console.error("Пароль має бути не коротшим за 8 символів");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`\nOWNER_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
