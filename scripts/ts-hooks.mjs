import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const src = path.join(root, "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return resolveFile(path.join(src, specifier.slice(2)), context, nextResolve);
  }

  if (specifier.startsWith(".")) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      const parent = context.parentURL ? fileURLToPath(context.parentURL) : root;
      return resolveFile(path.resolve(path.dirname(parent), specifier), context, nextResolve);
    }
  }

  return nextResolve(specifier, context);
}

async function resolveFile(base, context, nextResolve) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(base, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const filename = fileURLToPath(url);
    const source = await readFile(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    return { format: "module", source: output.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
