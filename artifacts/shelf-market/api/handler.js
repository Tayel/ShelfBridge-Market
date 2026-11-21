// Vercel function for every /api/* request (see the rewrite in vercel.json). The real code is in server/,
// bundled into server-dist/ by `npm run build`.
export { default } from "../server-dist/handler.mjs";
