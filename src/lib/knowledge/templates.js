// Starter templates for the Business knowledge page. Leaf module (browser +
// server). Each one becomes a DISABLED draft with an empty answer: the owner
// fills it in and turns it on. `hint` is placeholder text in the editor and
// is never stored. `key` is stored as template_key ("<vertical>:<key>"), which
// is unique per user, so adding a starter twice can never duplicate a draft
// (even if the owner has since edited its question).
//
// Offer name, price and offer link are deliberately absent: they live in
// creator_offers (Settings → Offer) and the booking link in
// users.calendly_url, and both already ground every reply. The knowledge page
// shows them read-only instead of duplicating them here.

export const KNOWLEDGE_TEMPLATES = {
  coaching: {
    label: "Coaching",
    entries: [
      {
        type: "faq",
        key: "included",
        question: "What's included in the program?",
        hint: "e.g. Weekly 1:1 call, a custom training plan, daily chat support in the app.",
      },
      {
        type: "faq",
        key: "length_format",
        question: "How long is the program and how does it work?",
        hint: "e.g. 12 weeks. You get a new plan every Monday and check in every Friday.",
      },
      {
        type: "faq",
        key: "who_for",
        question: "Who is this for, and who is it not for?",
        hint: "e.g. Busy professionals who want to lose 10-30 lbs. Not for competitive athletes.",
      },
      {
        type: "faq",
        key: "payment_plans",
        question: "Do you offer payment plans?",
        hint: "e.g. Yes, 3 monthly payments. Or: No, it's paid in full.",
      },
      {
        type: "faq",
        key: "booking_call",
        question: "How do I book a call and what happens on it?",
        hint: "e.g. 20 minute call with me. We look at your goals and see if it's a fit. No pressure.",
      },
      {
        type: "policy",
        key: "refund_policy",
        question: "What's your refund policy?",
        hint: "e.g. Full refund within 14 days if you've done the work and aren't happy.",
      },
    ],
  },
  med_spa: {
    label: "Med spa",
    entries: [
      {
        type: "faq",
        key: "services",
        question: "What services do you offer?",
        hint: "e.g. Botox, fillers, HydraFacials, laser hair removal.",
      },
      {
        type: "faq",
        key: "pricing",
        question: "How much do treatments cost?",
        hint: 'List prices, or write "Pricing is given at your consultation."',
      },
      {
        type: "faq",
        key: "booking",
        question: "How do I book an appointment?",
        hint: "e.g. Book online with the link, or call the front desk.",
      },
      {
        type: "faq",
        key: "hours_location",
        question: "What are your hours and where are you located?",
        hint: "e.g. Tue-Sat 9am-6pm, 123 Main St, Austin. Parking behind the building.",
      },
      {
        type: "policy",
        key: "cancellation_policy",
        question: "What's your cancellation policy?",
        hint: "e.g. 24 hours notice, or a $50 fee.",
      },
      {
        type: "policy",
        key: "requires_consultation",
        question: "Which treatments require a consultation first?",
        hint: "e.g. All injectables and laser treatments need a consultation before booking.",
      },
    ],
  },
};
