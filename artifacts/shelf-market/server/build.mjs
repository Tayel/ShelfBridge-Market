// Bundle the API (server/handler.ts plus the shared business rules in src/lib) into one ES module that the
// Vercel function in api/handler.js loads. esbuild comes with Vite, so nothing extra is installed.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const esbuild = createRequire(createRequire(import.meta.url).resolve("vite"))("esbuild");

await esbuild.build({
  entryPoints: [path.join(here, "handler.ts")],
  outfile: path.join(here, "..", "server-dist", "handler.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["pg-native"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "info",
});
