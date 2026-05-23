import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics?period=7D|30D|3M
 *
 * Returns real stats for the authed user over the requested window, plus a
 * matched previous-period comparison for KPI deltas.
 */
export async function GET(request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30D";

  const { start, end, prevStart, prevEnd, days } = resolvePeriod(period);

  const userId = user.id;

  const [
    { data: profile },
    { data: conversationsCurrent },
    { data: conversationsPrev },
    { data: bookingsCurrent },
    { data: bookingsPrev },
    { data: messagesCurrent },
    { data: recentBookings },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("avg_deal_value")
      .eq("id", userId)
      .single(),
    supabase
      .from("conversations")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("conversations")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString()),
    // Filter bookings by booked_at (when the call was scheduled), not
    // start_time (when the call happens). Otherwise future-dated bookings
    // are excluded from the "last N days" KPIs.
    supabase
      .from("bookings")
      .select("id, booked_at, start_time, status, source")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("booked_at", start.toISOString())
      .lte("booked_at", end.toISOString()),
    supabase
      .from("bookings")
      .select("id, booked_at, status")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("booked_at", prevStart.toISOString())
      .lte("booked_at", prevEnd.toISOString()),
    // RLS on messages restricts to conversations owned by the authed user.
    supabase
      .from("messages")
      .select("id, role, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("bookings")
      .select("id, invitee_name, invitee_email, event_name, start_time, status, source")
      .eq("user_id", userId)
      .order("start_time", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  const avgDealValue =
    profile?.avg_deal_value != null ? Number(profile.avg_deal_value) : null;

  const cur = conversationsCurrent || [];
  const prev = conversationsPrev || [];
  const bCur = bookingsCurrent || [];
  const bPrev = bookingsPrev || [];
  const msgs = messagesCurrent || [];

  const totalConvCur = cur.length;
  const totalConvPrev = prev.length;

  // A conversation counts as "booked" in the period if it has a matching
  // booking row. Fall back to the conversation.status for users who aren't
  // on Calendly yet.
  const bookedCur = bCur.length || cur.filter((c) => c.status === "booked").length;
  const bookedPrev = bPrev.length || prev.filter((c) => c.status === "booked").length;

  const conversionCur = totalConvCur > 0 ? (bookedCur / totalConvCur) * 100 : 0;
  const conversionPrev = totalConvPrev > 0 ? (bookedPrev / totalConvPrev) * 100 : 0;

  const revenueCur = avgDealValue != null ? bookedCur * avgDealValue : null;
  const revenuePrev = avgDealValue != null ? bookedPrev * avgDealValue : null;

  const leadQuality = {
    hot: cur.filter((c) => c.status === "interested").length,
    warm: cur.filter((c) => c.status === "qualifying").length,
    cold: cur.filter((c) =>
      ["not_a_fit", "not a fit"].includes((c.status || "").toLowerCase())
    ).length,
    booked: cur.filter((c) => c.status === "booked").length,
  };

  const dailyActivity = buildDailySeries(start, days, (dayStart, dayEnd) =>
    msgs.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length
  );

  const bookingsOverTime = buildDailySeries(start, days, (dayStart, dayEnd) =>
    bCur.filter((b) => {
      if (!b.booked_at) return false;
      const t = new Date(b.booked_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length
  );

  return NextResponse.json({
    period: {
      label: period,
      start: start.toISOString(),
      end: end.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
      days,
    },
    kpis: {
      bookings: buildKpi(bookedCur, bookedPrev),
      conversionRate: buildKpi(conversionCur, conversionPrev, {
        isPercent: true,
      }),
      revenue:
        avgDealValue != null
          ? { ...buildKpi(revenueCur, revenuePrev), available: true }
          : { available: false },
      avgDealValue:
        avgDealValue != null
          ? { value: avgDealValue, available: true }
          : { available: false },
    },
    totalConversations: totalConvCur,
    leadQuality,
    dailyActivity,
    bookingsOverTime,
    recentBookings: recentBookings || [],
  });
}

function resolvePeriod(period) {
  const end = new Date();
  let days;

  switch (period) {
    case "7D":
      days = 7;
      break;
    case "3M":
      days = 90;
      break;
    case "30D":
    default:
      days = 30;
      break;
  }

  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);

  return { start, end, prevStart, prevEnd, days };
}

function buildKpi(current, previous, { isPercent = false } = {}) {
  const value = Number(current) || 0;
  const prev = Number(previous) || 0;

  let deltaPct = null;
  if (prev === 0) {
    deltaPct = value > 0 ? 100 : 0;
  } else {
    deltaPct = ((value - prev) / prev) * 100;
  }

  return {
    value: isPercent ? Number(value.toFixed(1)) : value,
    previous: isPercent ? Number(prev.toFixed(1)) : prev,
    deltaPct: Number(deltaPct.toFixed(1)),
    deltaPositive: deltaPct >= 0,
  };
}

function buildDailySeries(start, days, countFn) {
  const out = [];
  const day = 24 * 60 * 60 * 1000;
  const anchor = new Date(start);
  anchor.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const dayStart = anchor.getTime() + i * day;
    const dayEnd = dayStart + day;
    out.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      count: countFn(dayStart, dayEnd),
    });
  }
  return out;
}
