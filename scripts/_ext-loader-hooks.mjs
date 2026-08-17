// Resolver hooks loaded by _ext-loader.mjs. See that file for rationale.

import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");

export async function resolve(specifier, context, nextResolve) {
  // "@/lib/foo" → "<repo>/src/lib/foo"
  let spec = specifier;
  if (spec.startsWith("@/")) {
    spec = pathToFileURL(path.join(SRC, spec.slice(2))).href;
  }

  try {
    return await nextResolve(spec, context);
  } catch (err) {
    // ERR_UNSUPPORTED_DIR_IMPORT: the specifier matched a DIRECTORY that
    // shadows a sibling file — src/lib/anthropic/ next to src/lib/anthropic.js.
    // Webpack prefers the file, so the app builds; bare Node needs the retry.
    if (
      err?.code !== "ERR_MODULE_NOT_FOUND" &&
      err?.code !== "ERR_UNSUPPORTED_DIR_IMPORT"
    ) {
      throw err;
    }
    // Retry with the extensions Next would have inferred.
    for (const suffix of [".js", ".mjs", "/index.js"]) {
      try {
        return await nextResolve(spec + suffix, context);
      } catch {
        // try the next suffix
      }
    }
    throw err;
  }
}
