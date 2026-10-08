// The picker's state for one post: this session's change, else the saved
// monitoring row, else (managed accounts) watched with the defaults,
// because a post with no row is auto-watched from its first comment
// (src/lib/comment-auto-watch.js). Otherwise not watched.

export const AUTO_WATCH_STATE = Object.freeze({ enabled: true, actions_per_class: null, treatment_key: null });

/**
 * @param {string} mediaId
 * @param {{overrides: object, monitoringByMediaId: object, autoWatch: boolean}} args
 * @returns {{enabled: boolean, actions_per_class: object|null, treatment_key: string|null}|null}
 */
export function postStateFor(mediaId, { overrides, monitoringByMediaId, autoWatch }) {
  return overrides?.[mediaId] ?? monitoringByMediaId?.[mediaId] ?? (autoWatch ? AUTO_WATCH_STATE : null);
}
