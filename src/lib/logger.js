/**
 * Minimal logger wrapper. In production, `log.info` / `log.debug` are no-ops
 * so hot paths (webhooks, OAuth callbacks) don't flood Vercel logs with
 * state dumps that are expensive and leak PII. `log.warn` / `log.error`
 * always go to `console` so on-call can actually see problems.
 *
 * In development everything passes through so local debugging is unchanged.
 */

const isProd = process.env.NODE_ENV === "production";

function forward(level, args) {
  console[level](...args);
}

export const log = {
  debug: (...args) => {
    if (!isProd) forward("log", args);
  },
  info: (...args) => {
    if (!isProd) forward("log", args);
  },
  warn: (...args) => forward("warn", args),
  error: (...args) => forward("error", args),
};
