import { describe, it, expect } from "vitest";
import { findLeadThread, ACTIVE_LEAD_WINDOW_MS } from "./comment-open-thread";
import { fakeDb } from "@/lib/test-utils/fake-db";

const NOW = Date.parse("2026-10-08T12:00:00.000Z");
const at = (msAgo) => new Date(NOW - msAgo).toISOString();
const lead = (msAgo, conversation_id = "c1") => ({ id: `m${msAgo}`, conversation_id, role: "user", source: "lead", created_at: at(msAgo) });
const setup = (conv, messages = []) =>
  fakeDb({ conversations: conv ? [{ id: "c1", user_id: "u1", instagram_sender_id: "lead", ai_paused: false, status: "interested", ...conv }] : [], messages });
const check = (db, igsid = "lead") => findLeadThread(db, { userId: "u1", igsid, now: NOW });
const state = async (db) => (await check(db))?.state;

describe("findLeadThread", () => {
  it("paused: ai_paused, or taken over (status manual)", async () => {
    expect(await state(setup({ ai_paused: true }, [lead(60_000)]))).toBe("paused");
    expect(await state(setup({ status: "manual" }))).toBe("paused");
  });
  it("active: the lead sent a message within 6 hours (boundary included)", async () => {
    expect(await state(setup({}, [lead(60 * 60_000)]))).toBe("active");
    expect(await state(setup({}, [lead(ACTIVE_LEAD_WINDOW_MS)]))).toBe("active");
  });
  it("quiet: the lead's last message is older than 6 hours", async () => {
    expect(await state(setup({}, [lead(ACTIVE_LEAD_WINDOW_MS + 1000)]))).toBe("quiet");
    expect(await state(setup({}, [lead(2 * 86_400_000)]))).toBe("quiet");
  });
  it("our own recent messages, the owner's, or another thread's don't make it active", async () => {
    const db = setup({}, [
      { id: "a", conversation_id: "c1", role: "assistant", source: "agent", created_at: at(1000) },
      { id: "b", conversation_id: "c1", role: "assistant", source: "manual", created_at: at(1000) },
      lead(1000, "c-other"),
    ]);
    expect(await state(db)).toBe("quiet");
  });
  it("returns the conversation", async () => {
    expect((await check(setup({}))).conversation).toMatchObject({ id: "c1", ai_paused: false });
  });
  it("no thread, no igsid, or a read error: null", async () => {
    expect(await check(setup(null))).toBeNull();
    expect(await check(setup({}), null)).toBeNull();
    expect(await check(fakeDb({ conversations: [] }, { failOn: { conversations: { code: "57014" } } }))).toBeNull();
  });
});
