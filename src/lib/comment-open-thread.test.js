import { describe, it, expect } from "vitest";
import { findOpenThread, OPEN_THREAD_WINDOW_MS } from "./comment-open-thread";
import { fakeDb } from "@/lib/test-utils/fake-db";

const NOW = Date.parse("2026-10-08T12:00:00.000Z");
const at = (msAgo) => new Date(NOW - msAgo).toISOString();
const setup = (conv, messages = []) =>
  fakeDb({ conversations: conv ? [{ id: "c1", user_id: "u1", instagram_sender_id: "lead", ai_paused: false, ...conv }] : [], messages });
const check = (db, igsid = "lead") => findOpenThread(db, { userId: "u1", igsid, now: NOW });

describe("findOpenThread", () => {
  it("paused wins, even with no messages", async () => {
    expect(await check(setup({ ai_paused: true }))).toEqual({ conversationId: "c1", reason: "paused" });
  });
  it("a message from either side within 7 days", async () => {
    const db = setup({}, [{ id: "m1", conversation_id: "c1", role: "assistant", created_at: at(OPEN_THREAD_WINDOW_MS - 60_000) }]);
    expect(await check(db)).toEqual({ conversationId: "c1", reason: "recent" });
  });
  it("exactly 7 days ago still counts; older does not", async () => {
    expect(await check(setup({}, [{ id: "m1", conversation_id: "c1", created_at: at(OPEN_THREAD_WINDOW_MS) }]))).toEqual({ conversationId: "c1", reason: "recent" });
    expect(await check(setup({}, [{ id: "m1", conversation_id: "c1", created_at: at(OPEN_THREAD_WINDOW_MS + 1000) }]))).toBeNull();
  });
  it("another conversation's recent message doesn't count", async () => {
    expect(await check(setup({}, [{ id: "m1", conversation_id: "c-other", created_at: at(1000) }]))).toBeNull();
  });
  it("no thread, no igsid, or a read error: not open", async () => {
    expect(await check(setup(null))).toBeNull();
    expect(await check(setup({ ai_paused: true }), null)).toBeNull();
    const broken = fakeDb({ conversations: [] }, { failOn: { conversations: { code: "57014" } } });
    expect(await check(broken)).toBeNull();
  });
});
