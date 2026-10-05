import { describe, it, expect, vi, beforeEach } from "vitest";

// The 24h guard lives INSIDE the send functions, so every caller inherits
// it. These assert no network request is made outside the window and that
// no message tag (HUMAN_AGENT or any other) is ever sent.

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "token" }));

const { sendInstagramMessage, sendInstagramAudio } = await import("./instagram");
const { sendVoiceMessage } = await import("./voice/sender");

const RECENT = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
const STALE = () => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ message_id: "mid.1", recipient_id: "r" }),
  }));
  globalThis.fetch = fetchMock;
});

const senders = {
  sendInstagramMessage: (w) => sendInstagramMessage("igba", "lead", "hi", "token", w),
  sendInstagramAudio: (w) => sendInstagramAudio("igba", "lead", "https://a/x.mp3", "token", w),
  sendVoiceMessage: (w) =>
    sendVoiceMessage({ igUserId: "igba", encryptedAccessToken: "enc", recipientPsid: "lead", audioUrl: "https://a/x.mp3", ...w }),
};

describe.each(Object.entries(senders))("%s window guard", (_name, send) => {
  it("sends inside the window", async () => {
    await send({ lastInboundAt: RECENT() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses outside the window without calling Meta", async () => {
    await expect(send({ lastInboundAt: STALE() })).rejects.toMatchObject({ code: "messaging_window_closed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when the caller passes no time (fails closed)", async () => {
    await expect(send({})).rejects.toMatchObject({ code: "messaging_window_closed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never sends a message tag", async () => {
    await send({ lastInboundAt: RECENT() });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("tag");
    expect(body).not.toHaveProperty("messaging_type");
    expect(JSON.stringify(body)).not.toMatch(/HUMAN_AGENT/);
  });
});
