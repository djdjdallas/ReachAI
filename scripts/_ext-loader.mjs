// ESM resolver hook for the scripts/ verification runners.
//
// The app's source uses extensionless relative imports ("./anthropic") and the
// "@/..." alias, both of which Next resolves at build time but bare Node does
// not. This hook retries a failed specifier with ".js" / "/index.js" appended
// and maps "@/" to src/, so scripts can import app modules directly.
//
// Usage: node --import ./scripts/_ext-loader.mjs scripts/<script>.mjs

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./_ext-loader-hooks.mjs", pathToFileURL(import.meta.filename));
