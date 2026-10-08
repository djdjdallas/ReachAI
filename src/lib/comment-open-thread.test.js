import { describe, it, expect } from "vitest";
import { findLeadThread, ACTIVE_LEAD_WINDOW_MS, AWAITING_REPLY_WINDOW_MS } from "./comment-open-thread";
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
  it("only the lead's own messages make it active; another thread's don't count", async () => {
    expect(await state(setup({}, [lead(1000, "c-other")]))).toBe("quiet");
  });

  describe("awaiting_reply: we sent something in the last 24h and they haven't replied since", () => {
    const out = (msAgo, source = "agent") => ({ id: `o${msAgo}${source}`, conversation_id: "c1", role: "assistant", source, created_at: at(msAgo) });
    const H = 3_600_000;
    it.each([
      ["our comment DM 4 minutes ago, no reply (the 2026-10-08 double DM)", [out(4 * 60_000)]],
      ["a drip 20h ago", [out(20 * H, "drip")]],
      ["the owner's own message 2h ago", [out(2 * H, "manual")]],
      ["they wrote 30h ago, we answered 20h ago", [lead(30 * H), out(20 * H)]],
    ])("%s", async (_l, messages) => {
      expect(await state(setup({}, messages))).toBe("awaiting_reply");
    });
    it("they replied after our message, more than 6h ago: quiet", async () => {
      expect(await state(setup({}, [out(20 * H), lead(10 * H)]))).toBe("quiet");
    });
    it("they replied after our message within 6h: active", async () => {
      expect(await state(setup({}, [out(3 * H), lead(2 * H)]))).toBe("active");
    });
    it("our last message over 24h ago: quiet", async () => {
      expect(await state(setup({}, [out(25 * H)]))).toBe("quiet");
      expect(await state(setup({}, [out(AWAITING_REPLY_WINDOW_MS + 1000)]))).toBe("quiet");
    });
    it("paused wins over awaiting_reply", async () => {
      expect(await state(setup({ ai_paused: true }, [out(60_000)]))).toBe("paused");
    });
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
