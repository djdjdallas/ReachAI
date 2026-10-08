import { describe, it, expect } from "vitest";
import { emitCommentHandoff } from "./emit";
import { fakeDb } from "@/lib/test-utils/fake-db";

const CID = "3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c";
const setup = (hook = { enabled: true, event_types: ["handoff_requested"] }) =>
  fakeDb({
    outbound_webhooks: hook ? [{ id: "w1", user_id: "u1", ...hook }] : [],
    outbound_webhook_events: [],
  });

describe("emitCommentHandoff", () => {
  it("no thread: a comment-only lead with the username", async () => {
    const db = setup();
    expect(await emitCommentHandoff(db, { userId: "u1", classificationId: CID, instagramUsername: "jane.doe" })).toEqual({ emitted: true });
    expect(db.tables.outbound_webhook_events).toEqual([
      expect.objectContaining({
        user_id: "u1",
        event_type: "handoff_requested",
        dedupe_key: `handoff_requested:comment:${CID}`,
        conversation_id: null,
        data: { reason: "other", comment_lead: { id: CID, instagram_username: "jane.doe" } },
      }),
    ]);
  });

  it("an open thread: about that thread's lead, no comment lead", async () => {
    const db = setup();
    await emitCommentHandoff(db, { userId: "u1", classificationId: CID, conversationId: "conv-1", instagramUsername: "jane.doe" });
    expect(db.tables.outbound_webhook_events[0]).toMatchObject({ conversation_id: "conv-1", data: { reason: "other" } });
    expect(db.tables.outbound_webhook_events[0].data).not.toHaveProperty("comment_lead");
  });

  it("emits once per comment", async () => {
    const db = setup();
    await emitCommentHandoff(db, { userId: "u1", classificationId: CID });
    await emitCommentHandoff(db, { userId: "u1", classificationId: CID });
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("an invalid username is left out; an unknown reason becomes other", async () => {
    const db = setup();
    await emitCommentHandoff(db, { userId: "u1", classificationId: CID, instagramUsername: "bad name!", reason: "made_up" });
    expect(db.tables.outbound_webhook_events[0].data).toEqual({ reason: "other", comment_lead: { id: CID } });
  });

  it.each([
    ["no webhook", null],
    ["a disabled webhook", { enabled: false, event_types: ["handoff_requested"] }],
    ["a webhook not subscribed to handoff_requested", { enabled: true, event_types: ["new_inquiry"] }],
  ])("nothing for %s", async (_, hook) => {
    const db = setup(hook);
    expect(await emitCommentHandoff(db, { userId: "u1", classificationId: CID })).toEqual({ emitted: false });
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });

  it("never throws", async () => {
    const db = fakeDb({ outbound_webhooks: [{ id: "w1", user_id: "u1", enabled: true, event_types: ["handoff_requested"] }] }, { failOn: { outbound_webhook_events: { code: "XX000" } } });
    expect(await emitCommentHandoff(db, { userId: "u1", classificationId: CID })).toEqual({ emitted: false });
  });
});
