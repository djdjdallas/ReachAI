import Link from "next/link";
import { notFound } from "next/navigation";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

const NICHE_DATA = {
  "fitness-coaches": {
    title: "AI Instagram DM Automation for Fitness Coaches (2026)",
    description:
      "Automate your Instagram DMs as a fitness coach. Clinchd qualifies leads, handles objections, and books discovery calls 24/7 so you never lose a client to a slow reply.",
    nicheLabel: "Fitness Coaches",
    heroHeadline: "Your Reels Go Viral at 11 PM. Who Is Answering Those DMs?",
    heroSub:
      "Clinchd is the AI DM setter built for fitness coaches. It qualifies leads, handles pricing objections, and books discovery calls while you sleep, train, or coach.",
    painHeadline: "The Fitness Coach DM Problem",
    painParagraphs: [
      "You posted a transformation Reel at 8 PM. By midnight it has 200K views and your DMs are flooded with people asking about your program. You are asleep. By 9 AM when you finally open your inbox, half those leads have already found another trainer who responded faster.",
      "Fitness coaching is uniquely time-sensitive. Your audience is emotionally motivated in the moment they see a result, a workout, or a transformation. That motivation fades fast. A lead who DMs you at 11 PM after watching your client's before-and-after is not going to feel the same urgency at 10 AM tomorrow.",
      "Hiring a human setter costs $2,000-$4,000/month, and they still only work during business hours. You need something that handles every DM, every hour, with the same quality you would bring to the conversation yourself.",
    ],
    features: [
      {
        title: "AI Qualification for Fitness Leads",
        description:
          "The AI asks about their current fitness level, goals, timeline, and budget before you ever get on a call. No more wasting 30-minute consultations on people who want a free workout plan.",
      },
      {
        title: "Objection Handling for Training Programs",
        description:
          "When leads say they cannot afford your $500-$2K program or need to think about it, the AI responds with empathy and value framing specific to fitness coaching. It handles pricing hesitation, partner approval, and past bad experiences with trainers.",
      },
      {
        title: "Auto-Booking via Calendly or Cal.com",
        description:
          "Once a lead is qualified, the AI drops your booking link at the right moment in the conversation. No awkward transitions, no premature pitches. The lead feels ready, and the call gets booked.",
      },
    ],
    faqs: [
      {
        q: "Will it work for my online personal training program?",
        a: "Yes. Clinchd is designed for coaches selling programs priced at $500 and above. You describe your training program, ideal client, and qualification criteria during setup. The AI uses that to have natural conversations that qualify leads and book calls for your specific offer.",
      },
      {
        q: "What if leads ask about my workout programs?",
        a: "The AI is trained on your program details during setup. It can explain your methodology, coaching structure, and what results clients typically see without giving away your entire program. It frames your offer in a way that builds curiosity and drives toward a discovery call.",
      },
      {
        q: "How does it handle price objections for $500-$2K programs?",
        a: "The AI uses proven objection-handling frameworks tailored to fitness coaching. When a lead says your program is too expensive, it reframes the investment in terms of results, time saved, and the cost of staying stuck. It knows when to address the objection and when to redirect to a call where you can handle it personally.",
      },
      {
        q: "Can it tell the difference between someone who wants a free tip and a real buyer?",
        a: "That is exactly what the qualification flow does. The AI asks about goals, timeline, budget range, and past experience with coaching. A lead looking for free advice gets filtered out naturally. A serious buyer gets moved toward a booking. You only spend time on calls with qualified prospects.",
      },
    ],
  },

  "business-coaches": {
    title: "AI Instagram DM Automation for Business Coaches (2026)",
    description:
      "Automate your Instagram DMs as a business coach. Clinchd qualifies high-ticket prospects, handles objections, and books discovery calls for your $5K-$25K programs.",
    nicheLabel: "Business Coaches",
    heroHeadline: "Your $15K Prospects Expect a Fast, Professional Response",
    heroSub:
      "Clinchd is the AI DM setter built for business coaches. It qualifies high-ticket prospects, handles ROI objections, and books discovery calls around the clock.",
    painHeadline: "The Business Coach DM Problem",
    painParagraphs: [
      "You are selling a $5K-$25K program. The prospects who DM you are business owners, founders, and executives. They are evaluating you from the first message. A slow reply does not just lose the sale, it signals that you are not operating at the level you are coaching others to reach.",
      "High-ticket business coaching has a narrow conversion window. A prospect who DMs you after watching your content about scaling revenue is in decision mode right now. If you reply six hours later, they have already moved on to the next coach, or worse, talked themselves out of investing entirely.",
      "Your DMs are not a casual inbox. They are your highest-converting sales channel. Every hour a qualified prospect sits unread is revenue left on the table.",
    ],
    features: [
      {
        title: "AI Qualification for High-Ticket Prospects",
        description:
          "The AI qualifies prospects on revenue level, business stage, investment readiness, and specific goals. It filters out people who are not a fit for a $5K+ program and fast-tracks serious buyers to your calendar.",
      },
      {
        title: "Objection Handling for Premium Programs",
        description:
          "When a prospect asks about ROI guarantees or says they need to discuss with a business partner, the AI handles it with the professionalism your price point demands. It addresses investment hesitation, timing concerns, and comparison shopping with confidence.",
      },
      {
        title: "Auto-Booking via Calendly or Cal.com",
        description:
          "The AI sends your booking link when the prospect is ready, not a moment too soon. It reads the conversation for buying signals and presents the call as the logical next step, keeping your close rate high.",
      },
    ],
    faqs: [
      {
        q: "Can it handle questions about my $15K mastermind?",
        a: "Yes. During setup you provide details about your program, pricing tiers, and what is included. The AI explains your offer with the right level of detail to build interest without giving away your entire framework. It positions the discovery call as the place to go deeper.",
      },
      {
        q: "How does it qualify for high-ticket readiness?",
        a: "The AI asks about current revenue, business model, team size, and investment timeline. You define what a qualified lead looks like during setup, and the AI filters accordingly. Leads who do not meet your criteria get a polite response. Qualified leads get fast-tracked to your calendar.",
      },
      {
        q: "What if prospects ask about ROI guarantees?",
        a: "The AI is trained to handle ROI conversations without making claims you cannot back up. It reframes the discussion around client results, your methodology, and what makes your program different. It acknowledges the question honestly and moves toward a call where you can address specifics.",
      },
      {
        q: "Will the AI sound professional enough for executive-level prospects?",
        a: "The AI matches the tone and professionalism of your brand. During setup you provide example messages and your communication style. The AI adapts its language to fit your audience, whether that is startup founders, agency owners, or corporate executives exploring coaching.",
      },
    ],
  },

  "life-coaches": {
    title: "AI Instagram DM Automation for Life Coaches (2026)",
    description:
      "Automate your Instagram DMs as a life coach. Clinchd responds with warmth and empathy, qualifies leads, and books discovery calls for your transformation programs.",
    nicheLabel: "Life Coaches",
    heroHeadline: "Your Leads DM After a Vulnerable Post. They Need a Warm Response Now.",
    heroSub:
      "Clinchd is the AI DM setter built for life coaches. It responds with empathy, qualifies leads gently, and books discovery calls for your transformation programs.",
    painHeadline: "The Life Coach DM Problem",
    painParagraphs: [
      "Life coaching leads are different. They do not DM you because they saw a case study about revenue growth. They DM you because something you said made them feel seen. Maybe it was a post about overcoming self-doubt, a Story about boundaries, or a Reel about finding purpose after burnout. They are reaching out from an emotional place, and they need to feel met with warmth immediately.",
      "A generic chatbot response kills that moment. A delayed reply loses it entirely. By the time you respond the next morning, the vulnerability that drove them to reach out has been replaced by doubt, embarrassment, or distraction. The window is gone.",
      "Life coaches need an AI that can hold space in a DM conversation, that responds with empathy before it qualifies, and that moves toward a discovery call without feeling transactional. That is exactly what Clinchd was built to do.",
    ],
    features: [
      {
        title: "AI Qualification with Empathy",
        description:
          "The AI opens with warmth and acknowledgment before asking any qualifying questions. It mirrors the emotional tone of the lead's message and gently explores their goals, readiness for change, and what they are looking for in a coaching relationship.",
      },
      {
        title: "Objection Handling for Transformation Programs",
        description:
          "When leads say they are not sure if coaching is right for them or worry about the investment, the AI responds with understanding. It addresses fear of commitment, past disappointments, and uncertainty about change with language that feels human and supportive.",
      },
      {
        title: "Auto-Booking via Calendly or Cal.com",
        description:
          "The AI introduces the discovery call as a safe, pressure-free conversation. It frames the booking as an opportunity for the lead to explore whether the program feels right, not a sales pitch. The result is higher show-up rates and warmer conversations.",
      },
    ],
    faqs: [
      {
        q: "Will the AI sound warm and empathetic?",
        a: "Yes. During setup you provide your communication style, example messages, and the emotional tone you want in conversations. Clinchd adapts its language to match. The AI leads with acknowledgment and empathy before qualifying, which is critical for life coaching leads who reach out from vulnerable places.",
      },
      {
        q: "Can it handle sensitive conversations?",
        a: "The AI is designed to respond thoughtfully to emotionally charged messages. It does not diagnose, give therapy-style advice, or overstep boundaries. It acknowledges what the lead shares, validates their feelings, and gently explores whether your coaching program could help. Conversations that need a human touch are flagged for immediate handoff.",
      },
      {
        q: "How does it qualify leads for my 90-day transformation program?",
        a: "The AI asks about where the lead is now, where they want to be, what they have already tried, and their readiness to invest in change. You define your qualification criteria during setup. Leads who match get moved toward a discovery call. Those who are not ready yet receive a warm, supportive response that keeps the door open.",
      },
      {
        q: "What if someone DMs in crisis?",
        a: "Clinchd includes safeguards for sensitive situations. If a message indicates a mental health crisis, the AI responds with care and provides a gentle redirect. It does not attempt to coach or qualify. These conversations are immediately flagged for your personal review so you can respond directly or point them to appropriate resources.",
      },
    ],
  },

  "relationship-coaches": {
    title: "AI Instagram DM Automation for Relationship Coaches (2026)",
    description:
      "Automate your Instagram DMs as a relationship coach. Clinchd responds with empathy, qualifies leads sensitively, and books discovery calls for your couples and dating programs.",
    nicheLabel: "Relationship Coaches",
    heroHeadline: "Your DMs Land at 1 AM After a Breakup. Who's Responding?",
    heroSub:
      "Clinchd is the AI DM setter built for relationship coaches. It responds with empathy, qualifies leads gently, and books discovery calls for your transformation programs while you sleep.",
    painHeadline: "The Relationship Coach DM Problem",
    painParagraphs: [
      "Relationship coaching leads don't DM you because they saw a marketing funnel. They DM you because you said something on a Reel that made them feel seen, usually right after a fight, a breakup, or a hard conversation. The window for connection is open at 1 AM, not 9 AM.",
      "By the time you reply the next morning, the vulnerability is gone. The lead has either patched it up, talked themselves out of needing help, or found another coach who answered while the moment was still raw. The opportunity to actually help them is gone with the moment.",
      "A relationship coach needs an AI that can respond with warmth in the first message, hold space for emotionally loaded conversations, and only move toward booking once the lead feels met. A generic chatbot does the opposite. Clinchd does this exact job for under $200/mo.",
    ],
    features: [
      {
        title: "Empathy-first qualification",
        description:
          "The AI acknowledges the moment first, asks gently about what's going on, and only ladders to qualifying questions once the lead feels heard. No transactional energy in the first 3 messages.",
      },
      {
        title: "Objection handling for couples programs",
        description:
          "When leads say their partner isn't on board or they aren't sure if it's the right time, the AI responds with the kind of language a relationship coach would use. No hard close, no pressure.",
      },
      {
        title: "Sensitive-topic safeguards",
        description:
          "Crisis-language flags trigger immediate escalation to your inbox without an automated reply. The AI never tries to coach through abuse, mental health crises, or DV scenarios.",
      },
    ],
    faqs: [
      {
        q: "Will the AI sound warm enough for relationship coaching?",
        a: "Yes. During setup you provide example messages and your tone preferences. Clinchd matches the warmth your audience expects. The AI leads with acknowledgment before any qualifying question, which is exactly what relationship leads need in their first message.",
      },
      {
        q: "What if a lead DMs about something serious like abuse?",
        a: "Clinchd has crisis-language detection built in. If a message indicates DV, abuse, or mental health crisis, the AI does not auto-reply. It flags the conversation for your immediate review so you can respond personally or point them to appropriate resources.",
      },
      {
        q: "Can it handle objections specific to couples programs?",
        a: "Yes. The AI handles the most common objections in couples coaching: my partner isn't on board, we can't afford it, we tried therapy and it didn't work, I'm not sure we are ready. Each objection has a coach-flavored response framework that builds trust instead of pushing.",
      },
      {
        q: "Will it understand my dating coaching offer differently from couples coaching?",
        a: "Yes. During setup you describe your specific offer and ICP. The AI qualifies dating coaching leads on different criteria (single-person mindset, willingness to do inner work, urgency around dating goals) than couples coaching leads.",
      },
    ],
  },

  "health-coaches": {
    title: "AI Instagram DM Automation for Health Coaches (2026)",
    description:
      "Automate your Instagram DMs as a health coach. Clinchd qualifies leads, handles compliance edges, and books discovery calls for your wellness and integrative health programs.",
    nicheLabel: "Health Coaches",
    heroHeadline: "Health DMs Are High-Stakes. Your Reply Time Shouldn't Be.",
    heroSub:
      "Clinchd is the AI DM setter built for health coaches. It qualifies leads, navigates scope-of-practice carefully, and books discovery calls for your programs around the clock.",
    painHeadline: "The Health Coach DM Problem",
    painParagraphs: [
      "Health coaching leads come in two flavors. The first is genuinely curious about working with you. The second is looking for free medical advice, often with a specific diagnosis they want validated. Sorting them by hand takes hours per week and burns you out.",
      "Compliance is also a real concern. Health coaches operate inside scope-of-practice rules that vary by certification and state. A lead who DMs about a specific symptom needs a careful, compliant response that doesn't drift into medical territory you can't legally cover.",
      "Hiring a setter at $2,000-$4,000/month doesn't solve this either, because they need to be trained on your specific scope and offer. Clinchd handles both: scope-aware responses, qualification for real coaching prospects, and 24/7 coverage for under $200/mo.",
    ],
    features: [
      {
        title: "Scope-of-practice aware responses",
        description:
          "The AI is trained to respond compliantly to symptom-specific questions, redirect to medical professionals when appropriate, and never make diagnostic or treatment claims outside your coaching scope.",
      },
      {
        title: "Qualification for serious health-program buyers",
        description:
          "The AI asks about goals, current health context, what they have already tried, and investment readiness. It filters free-advice seekers from coaching prospects in the first 3-4 message exchanges.",
      },
      {
        title: "Auto-booking via Calendly or Cal.com",
        description:
          "When a lead is qualified, the AI sends your booking link with one sentence about what the call covers. Lead picks a time, the call lands on your calendar with full context.",
      },
    ],
    faqs: [
      {
        q: "Will the AI stay inside my scope of practice?",
        a: "Yes. During setup you define your scope, certification, and what you can and cannot legally address. The AI redirects medical-advice questions and only engages on coaching-appropriate topics. You stay compliant without monitoring every conversation.",
      },
      {
        q: "How does it handle leads asking about specific health conditions?",
        a: "The AI acknowledges the lead's concern, offers what you do (lifestyle coaching, behavior change, accountability), and clearly states what it doesn't do (diagnose, treat, prescribe). It can recommend the lead consult a medical provider for diagnosis-specific questions, then return to coaching qualification.",
      },
      {
        q: "Can it qualify leads for my $1,500 program?",
        a: "Yes. The AI qualifies on goals, timeline, past attempts, and investment readiness. It handles {'this is too expensive'} and {'I need to talk to my partner'} with the kind of empathy a health coach would use. Filters free-advice seekers from real prospects.",
      },
      {
        q: "What if a lead is in crisis (eating disorder, severe symptoms)?",
        a: "Clinchd has crisis-language detection. Conversations indicating crisis are flagged for your immediate review with no automated reply. You stay in control of the most sensitive cases.",
      },
    ],
  },

  "mindset-coaches": {
    title: "AI Instagram DM Automation for Mindset Coaches (2026)",
    description:
      "Automate your Instagram DMs as a mindset coach. Clinchd handles emotionally rich conversations, qualifies leads on readiness, and books calls for your transformation programs.",
    nicheLabel: "Mindset Coaches",
    heroHeadline: "Mindset DMs Need Depth, Not Scripts",
    heroSub:
      "Clinchd is the AI DM setter built for mindset coaches. It handles emotionally rich conversations, qualifies on readiness for change, and books discovery calls for your transformation programs.",
    painHeadline: "The Mindset Coach DM Problem",
    painParagraphs: [
      "Mindset coaching leads are uniquely sensitive. They DM you because something you said about limiting beliefs, self-doubt, or fear hit them in the chest. They are not in shopping mode. They are in a {'maybe this is finally my moment'} mode.",
      "A scripted chatbot kills that moment instantly. The lead asked a vulnerable question. The bot answered with a sales line. The vulnerability shuts down, and the lead never DMs back.",
      "What mindset coaches need is an AI that can stay in the emotional register the lead opened, ask thoughtful follow-up questions, and only move toward booking when the lead has shown clear readiness. Clinchd is built for exactly this.",
    ],
    features: [
      {
        title: "Reads emotional register",
        description:
          "The AI matches the depth of the lead's opening message. A vulnerable opener gets a thoughtful, slow response. A casual opener gets a casual reply. No tone mismatches.",
      },
      {
        title: "Qualifies on readiness, not just budget",
        description:
          "Mindset coaching is about commitment to inner work. The AI asks about what they have tried, what they have changed, and what they are willing to do differently. Filters out leads who want a quick fix from leads ready for transformation.",
      },
      {
        title: "Books calls when the lead is actually ready",
        description:
          "The AI doesn't push the booking link in message 3. It waits for clear readiness signals (specific goal, willingness to invest, a triggering event), then sends the link with context.",
      },
    ],
    faqs: [
      {
        q: "Will the AI feel authentic in deep emotional conversations?",
        a: "Yes. During setup you provide your tone, your typical phrasings, and how you respond to common emotional opens. The AI matches your voice. It doesn't sound like a generic empathy script. It sounds like you on a thoughtful day.",
      },
      {
        q: "How does it qualify for mindset work specifically?",
        a: "Mindset qualification is about commitment, not just budget. The AI asks about what the lead has changed, what they keep getting stuck on, and what they would be willing to do differently. Filters out quick-fix seekers from people ready for the work.",
      },
      {
        q: "Can it handle leads who are skeptical of coaching?",
        a: "Yes. The AI handles {'I don't really believe in mindset work'} or {'I've tried therapy and it didn't help'} with curiosity instead of defensiveness. It asks what specifically didn't work, builds nuance, and lets the lead come to their own readiness.",
      },
      {
        q: "What if someone DMs in crisis or shares trauma?",
        a: "Clinchd has crisis-language detection. Heavy trauma or crisis content is flagged for your immediate review with no auto-reply. You stay in control of the most sensitive cases.",
      },
    ],
  },

  "dating-coaches": {
    title: "AI Instagram DM Automation for Dating Coaches (2026)",
    description:
      "Automate your Instagram DMs as a dating coach. Clinchd handles vulnerable openers, qualifies on readiness, and books discovery calls for your dating and confidence programs.",
    nicheLabel: "Dating Coaches",
    heroHeadline: "Dating DMs Are Vulnerable. Your AI Should Treat Them That Way.",
    heroSub:
      "Clinchd is the AI DM setter built for dating coaches. It handles vulnerable openers with care, qualifies on readiness, and books discovery calls for your dating and confidence programs.",
    painHeadline: "The Dating Coach DM Problem",
    painParagraphs: [
      "Dating coaching leads DM you after the worst nights of their dating lives. A bad date, a ghosting, a relationship that ended badly. They are reaching out from a place of self-doubt, and the first message they get back determines whether they trust you with the next 90 days.",
      "Manual replies miss the moment. By morning, the lead is back to numbing scrolls and the urgency is gone. A scripted bot makes it worse. They open up and get a salesy reply. They never DM back.",
      "Dating coaches need an AI that can lead with empathy, qualify gently, and only book calls with leads who are actually ready to do the work. Clinchd handles all of this for under $200/mo. No human setter, no missed midnight DMs, no scripted chatbot vibes.",
    ],
    features: [
      {
        title: "Empathy-first responses",
        description:
          "The AI opens with acknowledgment, never with a sales pitch. {'That sounds really hard'} hits different than {'Tell me more about your goals'} when someone DMs after a breakup.",
      },
      {
        title: "Qualifies on inner-work readiness",
        description:
          "Dating coaching converts when the lead is ready to look inward. The AI qualifies on willingness to do mindset work, take action between sessions, and commit to a 90-day timeline.",
      },
      {
        title: "Auto-booking when the lead is ready",
        description:
          "The AI reads buying signals (specific goals, urgency, financial readiness) and sends your Calendly or Cal.com link only when the lead is genuinely ready, not on message 3.",
      },
    ],
    faqs: [
      {
        q: "Will it sound warm enough for dating coaching?",
        a: "Yes. The AI matches the tone your audience needs. During setup you provide your voice, sample messages, and the kind of warmth you bring to first conversations. The AI doesn't sound corporate. It sounds like a coach who cares.",
      },
      {
        q: "How does it handle leads who feel embarrassed or self-conscious?",
        a: "The AI acknowledges what the lead shares, normalizes their experience without minimizing, and gently moves the conversation forward. It doesn't push, doesn't lecture, doesn't use shame language. Sounds like the kind of friend who happens to be a coach.",
      },
      {
        q: "Can it handle conversations about past trauma in dating contexts?",
        a: "The AI is built to respond thoughtfully to past relationship trauma. It does not coach through serious abuse or assault contexts. Those conversations are flagged for your immediate review.",
      },
      {
        q: "Will it recognize when a lead is actually a paid client opportunity vs just venting?",
        a: "Yes. The qualifying flow asks about what they have changed, what they want to be different in 90 days, and what they would invest to make it happen. Vent-only conversations get warm closure. Real prospects get moved toward a discovery call.",
      },
    ],
  },

  "nutrition-coaches": {
    title: "AI Instagram DM Automation for Nutrition Coaches (2026)",
    description:
      "Automate your Instagram DMs as a nutrition coach. Clinchd qualifies leads, navigates scope, and books discovery calls for your nutrition and habit-change programs.",
    nicheLabel: "Nutrition Coaches",
    heroHeadline: "You Posted a Reel About Cutting Sugar. Now You Have 200 DMs.",
    heroSub:
      "Clinchd is the AI DM setter built for nutrition coaches. It qualifies leads, handles scope-of-practice questions, and books discovery calls for your programs while you actually live your life.",
    painHeadline: "The Nutrition Coach DM Problem",
    painParagraphs: [
      "Nutrition content goes viral fast. A single Reel about gut health, hormones, or cutting sugar can pull 100+ DMs in a night. Most of them are looking for a free meal plan or a quick answer, but a few are real coaching prospects.",
      "Sorting them by hand is a part-time job, and the longer you wait, the colder every lead gets. Hiring a setter is $2,000-$4,000/month and they only work daytime. Your viral Reel hit at 9 PM. The DMs are sitting unread.",
      "What nutrition coaches need is an AI that can answer common questions correctly inside scope, filter free-advice seekers from real coaching prospects, and book discovery calls only with leads ready to invest. Clinchd does this for under $200/mo, 24/7.",
    ],
    features: [
      {
        title: "Scope-aware nutrition responses",
        description:
          "The AI handles common questions about macros, food sensitivities, or supplements with scope-aware responses. It redirects to medical professionals on diagnostic-specific questions and never makes prescriptive claims outside your scope.",
      },
      {
        title: "Filters free-advice seekers",
        description:
          "Most nutrition DMs are looking for a free answer. The AI provides one piece of value, then qualifies on whether the lead wants real coaching or just a one-off question answered.",
      },
      {
        title: "Books high-intent leads automatically",
        description:
          "When a lead signals readiness for actual coaching (specific goal, willingness to invest, timeline urgency), the AI sends your Calendly link inside the conversation.",
      },
    ],
    faqs: [
      {
        q: "Will it stay inside my scope of practice?",
        a: "Yes. During setup you define your scope, certification, and what you can and cannot legally address. The AI redirects diagnostic questions and only engages on nutrition-coaching-appropriate topics.",
      },
      {
        q: "Can it answer common nutrition questions correctly?",
        a: "The AI is trained on common nutrition questions: macros, hydration, supplements, fasting basics, food sensitivities. It provides accurate one-line answers and then pivots to qualifying whether the lead wants real coaching or just a one-off answer.",
      },
      {
        q: "How does it handle people asking about specific diets (keto, carnivore, vegan)?",
        a: "The AI acknowledges the dietary approach, asks about the lead's goal, and frames your coaching as the answer to {'how do I make this actually work for my body and lifestyle.'} It never trashes other approaches and stays neutral on diet ideology.",
      },
      {
        q: "Can it qualify on $1K+ nutrition programs?",
        a: "Yes. The AI qualifies on goal specificity, past attempts, willingness to do the work, and investment readiness. Filters out tire-kickers from real prospects in 3-5 message exchanges.",
      },
    ],
  },

  "career-coaches": {
    title: "AI Instagram DM Automation for Career Coaches (2026)",
    description:
      "Automate your Instagram DMs as a career coach. Clinchd qualifies professional prospects, handles ROI questions, and books discovery calls for your career-transition programs.",
    nicheLabel: "Career Coaches",
    heroHeadline: "Career DMs Land at 6 PM Sundays. They Need a Sharp Reply.",
    heroSub:
      "Clinchd is the AI DM setter built for career coaches. It qualifies professional prospects, handles ROI-focused questions, and books discovery calls for your career-transition programs.",
    painHeadline: "The Career Coach DM Problem",
    painParagraphs: [
      "Career coaching leads are unique. They DM you on Sunday evening, the night before a Monday they are dreading. They are at a peak moment of professional dissatisfaction. By Monday morning at the office, the urgency has faded under the weight of meetings, and the lead has talked themselves into staying.",
      "Manual replies miss the Sunday-evening window. Hiring a setter doesn't help because most setters work 9-5 weekdays, exactly when career-coaching leads are too busy at work to DM.",
      "Career coaches need an AI that can engage at the moments career-doubt peaks (evenings, weekends, Sunday nights), qualify on professional context (current role, salary range, target outcome), and book discovery calls before the urgency fades. Clinchd does this for under $200/mo.",
    ],
    features: [
      {
        title: "Always on at peak career-doubt hours",
        description:
          "The AI works evenings, weekends, and Sunday nights. The exact hours career coaching leads are most likely to reach out, and the exact hours human setters are off the clock.",
      },
      {
        title: "Professional-context qualification",
        description:
          "The AI asks about current role, target outcome, salary range, and timeline. It filters out leads who are just venting from leads ready to invest in a real career transition.",
      },
      {
        title: "ROI-focused objection handling",
        description:
          "Career coaching prospects often think in ROI. {'Will this actually get me a higher salary?'} The AI handles ROI conversations honestly, citing client outcomes without making guarantees you can't back up.",
      },
    ],
    faqs: [
      {
        q: "Can the AI handle ROI-focused conversations?",
        a: "Yes. Career coaching leads often want to understand expected outcomes (salary increase, role change, time-to-new-job). The AI handles ROI questions honestly, references client outcomes, and acknowledges what it can't promise. It doesn't make claims you can't back up.",
      },
      {
        q: "Will it sound professional enough for executive-level prospects?",
        a: "Yes. The tone preset can be calibrated for executive audiences. The AI uses precise, professional language for senior leaders and warmer language for early-career prospects.",
      },
      {
        q: "How does it qualify on career-transition readiness?",
        a: "The AI asks about current role, target role, timeline, and what they have tried so far. A lead who has already started networking and updating their resume is at a different stage than someone who is just thinking about a change.",
      },
      {
        q: "What if my offer is for early-career professionals vs C-suite?",
        a: "The qualification flow adapts. During setup you define your ICP, and the AI's questions adjust. Early-career qualification looks at first-job navigation; senior qualification looks at compensation expectations and exit timelines.",
      },
    ],
  },

  "online-course-creators": {
    title: "AI Instagram DM Automation for Online Course Creators (2026)",
    description:
      "Automate your Instagram DMs as an online course creator. Clinchd qualifies leads, handles common course objections, and books discovery calls or routes to your course pages.",
    nicheLabel: "Online Course Creators",
    heroHeadline: "Your Course Cart Opens in 3 Days. Your DMs Are on Fire.",
    heroSub:
      "Clinchd is the AI DM setter built for online course creators. It qualifies leads, handles common course objections, and routes high-intent prospects to your launch funnel automatically.",
    painHeadline: "The Course Creator DM Problem",
    painParagraphs: [
      "Course launches generate brutal DM volume. The 7-day cart-open window is when 80% of DMs hit, all asking variations of the same questions: who is it for, what's included, can I see results, do you have a payment plan, will it work for my situation.",
      "Answering each one personally takes 10-12 hours per day during launch. Outsourcing it to a $2K-$4K/month setter only works if you launch monthly. Most creators launch quarterly, which makes hiring a setter overkill.",
      "What course creators need is an AI that wakes up for launches, handles 90% of common questions accurately, and routes high-intent leads to checkout or a discovery call. Clinchd does this for $97-$197/mo and handles every launch with the same depth.",
    ],
    features: [
      {
        title: "Trained on your course details",
        description:
          "The AI is trained on your course curriculum, pricing, payment plans, bonuses, and FAQs during setup. It answers common questions accurately and consistently, every time.",
      },
      {
        title: "Cart-open mode",
        description:
          "During launch windows, the AI shifts into cart-open mode: it sends your checkout link inside the conversation when the lead signals buying intent, with one sentence about what to expect after purchase.",
      },
      {
        title: "Launch-specific objection handling",
        description:
          "The AI handles {'is the price going up?'} {'can I get a payment plan?'} {'will the lessons be evergreen?'} and {'will it work for my level?'} with consistent, on-brand answers.",
      },
    ],
    faqs: [
      {
        q: "Will it know all the details of my course accurately?",
        a: "Yes. During setup you paste in your full course details: modules, lessons, pricing, payment plans, bonuses, refund policy, and FAQs. The AI answers using only the information you've provided. No hallucinations, no made-up promises.",
      },
      {
        q: "Can it handle cart-close urgency without sounding desperate?",
        a: "Yes. The AI references cart deadlines as a fact (your course closes Friday) without high-pressure language. It can mention the deadline once per conversation, then pivot to value or qualifying questions.",
      },
      {
        q: "Will it distinguish course buyers from coaching prospects?",
        a: "Yes. If you offer both a course ($497) and 1:1 coaching ($5K+), the AI qualifies based on the lead's signals. Self-paced learners go to the course funnel; high-touch buyers get routed to a coaching discovery call.",
      },
      {
        q: "What about students asking technical platform questions?",
        a: "The AI handles common platform questions (login, access, course structure) and escalates to your inbox or a support ticket for anything specific to a paid student's account.",
      },
    ],
  },

  "wellness-coaches": {
    title: "AI Instagram DM Automation for Wellness Coaches (2026)",
    description:
      "Automate your Instagram DMs as a wellness coach. Clinchd qualifies leads holistically, navigates scope, and books discovery calls for your integrative wellness programs.",
    nicheLabel: "Wellness Coaches",
    heroHeadline: "Wellness DMs Need a Calm, Considered Reply.",
    heroSub:
      "Clinchd is the AI DM setter built for wellness coaches. It qualifies leads holistically, navigates scope-of-practice carefully, and books discovery calls for your integrative wellness programs.",
    painHeadline: "The Wellness Coach DM Problem",
    painParagraphs: [
      "Wellness coaching is a wide field. Your audience could be DMing about stress, sleep, gut health, energy, hormones, or relationships, sometimes all in one message. The qualifying conversation is more nuanced than a quick {'what's your goal?'}",
      "Manual replies have to slow down to do justice to those conversations. The result: most DMs sit for hours, the leads cool, and the moment that drove the reach-out fades.",
      "What wellness coaches need is an AI that can hold space for multi-dimensional health conversations, ask thoughtful follow-up questions, navigate scope carefully, and book discovery calls only with leads ready to invest in a real program. Clinchd does this for under $200/mo.",
    ],
    features: [
      {
        title: "Multi-dimensional qualification",
        description:
          "The AI asks about the full picture (sleep, stress, energy, mood, body) and helps the lead surface the through-line in their own situation. Filters surface-level seekers from people ready for a holistic program.",
      },
      {
        title: "Scope-aware responses",
        description:
          "The AI navigates scope-of-practice rules carefully. It engages on lifestyle, behavior, and habits, and redirects diagnostic questions to medical professionals.",
      },
      {
        title: "Books leads ready for a real program",
        description:
          "Wellness program buyers want commitment. The AI qualifies on willingness to do the work, timeline, and investment readiness before sending your booking link.",
      },
    ],
    faqs: [
      {
        q: "Will it stay inside my scope of practice?",
        a: "Yes. During setup you define your scope and certification. The AI engages on lifestyle, behavior, and coaching topics, and redirects diagnostic or treatment questions to medical professionals.",
      },
      {
        q: "Can it handle multi-dimensional conversations?",
        a: "Yes. The AI is built to read complex messages and ask the right follow-up question. If a lead shares sleep, stress, and gut health in one message, the AI surfaces the through-line and explores the most pressing area first.",
      },
      {
        q: "How does it qualify for $2K-$5K wellness programs?",
        a: "Qualification looks at goal specificity, what the lead has already tried, time commitment available, and investment readiness. The AI filters surface-level seekers from people ready for a real holistic program.",
      },
      {
        q: "What if a lead is in crisis (mental health, severe symptoms)?",
        a: "Crisis-language flags trigger immediate escalation. The AI does not auto-reply on crisis content. You stay in control of the most sensitive conversations.",
      },
    ],
  },

  "spiritual-coaches": {
    title: "AI Instagram DM Automation for Spiritual Coaches (2026)",
    description:
      "Automate your Instagram DMs as a spiritual coach. Clinchd handles soul-led conversations, qualifies on resonance, and books discovery calls for your transformation programs.",
    nicheLabel: "Spiritual Coaches",
    heroHeadline: "Your Reels Touch Hearts at 3 AM. Your AI Should Honor That.",
    heroSub:
      "Clinchd is the AI DM setter built for spiritual coaches. It handles soul-led conversations with care, qualifies on resonance and readiness, and books discovery calls without breaking the energy.",
    painHeadline: "The Spiritual Coach DM Problem",
    painParagraphs: [
      "Spiritual coaching leads DM you in moments of awakening, doubt, or transition. The energy of those conversations is delicate. A canned chatbot reply breaks it instantly. A delayed reply lets it dissipate.",
      "Hiring a human setter doesn't really fit spiritual coaching either. The voice, the language, the way a coach holds space, all of it is hard to outsource without losing the thread.",
      "What spiritual coaches need is an AI that can hold the energy, mirror the lead's language without forcing it, and only move toward booking when the lead is grounded enough to commit. Clinchd is built to handle exactly this.",
    ],
    features: [
      {
        title: "Energy-matched responses",
        description:
          "The AI matches the spiritual register the lead opens with. Reflective, grounded, soul-led language for soul-led messages. No corporate sales energy.",
      },
      {
        title: "Qualification by resonance",
        description:
          "Spiritual coaching qualification is about resonance, not just budget. The AI asks about what called them to reach out, what they have been working through, and what they are ready to step into.",
      },
      {
        title: "Books with care",
        description:
          "The AI sends your booking link only when the lead is grounded and clear. No hard close, no premature pitches. The booking experience feels consistent with the conversation.",
      },
    ],
    faqs: [
      {
        q: "Will the AI sound aligned with my spiritual brand?",
        a: "Yes. During setup you provide your voice, your typical phrasings, and your preferred way of holding space. The AI adapts. It doesn't impose a generic empathy script. It learns your specific energy.",
      },
      {
        q: "Can it handle conversations about deep transformation?",
        a: "Yes. The AI is comfortable with soul-led language, archetypal references, and conversations about awakening, grief, or transition. It asks the kind of follow-up question a coach would, not the kind a sales rep would.",
      },
      {
        q: "What if a lead is in spiritual crisis or dark night?",
        a: "Crisis-language detection flags conversations indicating crisis or severe mental health concerns. The AI does not auto-reply on those. You stay in control of the most sensitive conversations.",
      },
      {
        q: "Will it pressure my audience the way a chatbot would?",
        a: "No. The AI is calibrated for spiritual coaching specifically. No artificial scarcity, no hard close, no premature pitches. The booking happens when the lead is clear and ready, not when an algorithm thinks they should be.",
      },
    ],
  },

  "financial-coaches": {
    title: "AI Instagram DM Automation for Financial Coaches (2026)",
    description:
      "Automate your Instagram DMs as a financial coach. Clinchd qualifies leads, navigates compliance carefully, and books discovery calls for your money and wealth-building programs.",
    nicheLabel: "Financial Coaches",
    heroHeadline: "Money DMs Are High-Stakes. Compliance Is Non-Negotiable.",
    heroSub:
      "Clinchd is the AI DM setter built for financial coaches. It qualifies leads, navigates compliance and scope carefully, and books discovery calls for your wealth-building programs.",
    painHeadline: "The Financial Coach DM Problem",
    painParagraphs: [
      "Financial coaching has the most regulatory edge of any coaching niche. The line between coaching and licensed advice is real, and crossing it (even accidentally in a DM) is a problem. A scripted chatbot or untrained setter is a compliance risk.",
      "On top of that, money DMs are high-stakes for the lead. They are sharing real numbers, real shame, real anxiety. A bad first reply burns the trust instantly. A delayed reply lets the courage that drove them to DM dissipate.",
      "What financial coaches need is an AI that knows where the compliance line is, responds with empathy without minimizing, and qualifies on income and investment readiness without sounding transactional. Clinchd is built for exactly this job.",
    ],
    features: [
      {
        title: "Compliance-aware responses",
        description:
          "The AI is trained to coach on behavior, habits, and money mindset, and to never give specific investment advice, tax recommendations, or financial planning that requires a license. Stays inside the legal coaching scope.",
      },
      {
        title: "Money-conversation empathy",
        description:
          "Financial coaching leads DM with shame. The AI acknowledges the courage it takes to reach out, normalizes the situation, and qualifies gently. No transactional energy, no judgment.",
      },
      {
        title: "Income and readiness qualification",
        description:
          "The AI asks about income range, current financial situation, and what they have tried, in a way that feels like a coaching conversation rather than a loan application.",
      },
    ],
    faqs: [
      {
        q: "Will the AI stay compliant with financial coaching scope?",
        a: "Yes. During setup you define your certification, jurisdiction, and the scope you operate within. The AI coaches on behavior, habits, and mindset, and refuses to give specific investment advice, tax recommendations, or anything that requires a financial advisor license. You stay compliant without monitoring every conversation.",
      },
      {
        q: "How does it handle leads asking about specific stocks, crypto, or investments?",
        a: "The AI redirects investment-specific questions clearly: {'I'm not licensed to give specific investment advice, but I can help you build the habits and mindset that make smart investing possible.'} It pivots to behavior-coaching questions and qualifies for your program.",
      },
      {
        q: "Can it handle leads who are in real financial distress (debt, bankruptcy)?",
        a: "Yes, with care. The AI acknowledges the situation without minimizing, and depending on severity, either qualifies for your program or recommends the lead consult appropriate licensed professionals. Crisis-level financial situations are flagged for your direct response.",
      },
      {
        q: "Will it qualify on $1K-$10K coaching programs?",
        a: "Yes. The AI qualifies on income range, current financial situation, and willingness to invest. It handles {'I can't afford it'} with empathy and reframes the investment in terms of long-term outcomes, only when appropriate.",
      },
    ],
  },
};

const VALID_NICHES = Object.keys(NICHE_DATA);

export function generateStaticParams() {
  return VALID_NICHES.map((niche) => ({ niche }));
}

export async function generateMetadata({ params }) {
  const { niche } = await params;
  const data = NICHE_DATA[niche];
  if (!data) return {};

  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      url: `https://www.clinchd.io/for/${niche}`,
      siteName: "Clinchd",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
    },
  };
}

export default async function NichePage({ params }) {
  const { niche } = await params;
  const data = NICHE_DATA[niche];
  if (!data) notFound();

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Clinchd",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.clinchd.io",
    description: data.description,
    offers: [
      {
        "@type": "Offer",
        price: "97",
        priceCurrency: "USD",
        name: "Base Plan",
        description: "500 DM conversations per month",
      },
      {
        "@type": "Offer",
        price: "197",
        priceCurrency: "USD",
        name: "Unlimited Plan",
        description: "Unlimited DM conversations",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            {data.nicheLabel}
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            {data.heroHeadline}
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            {data.heroSub}
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center bg-stone-900 text-white px-8 py-4 rounded-full font-bold hover:bg-[#ff7e67] transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Pain section */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            {data.painHeadline}
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            {data.painParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            How Clinchd works for {data.nicheLabel.toLowerCase()}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-4">
            Built for {data.nicheLabel.toLowerCase()}
          </p>
          <p className="text-xl md:text-2xl font-medium text-stone-700 leading-relaxed">
            Clinchd's {data.nicheLabel.toLowerCase()} playbook is designed around the qualification patterns, objection scripts, and tone preferences we see across coaching DM conversations in this niche. We're in early access. Be among the first {data.nicheLabel.toLowerCase()} to share public results.
          </p>
          <div className="mt-8">
            <a
              href="/signup"
              className="inline-flex items-center text-sm font-bold text-[#ff7e67] hover:underline"
            >
              Join early access &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Pricing reference */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6">
            Simple, flat pricing
          </h2>
          <p className="text-lg text-stone-500 font-medium mb-10 max-w-2xl mx-auto">
            No per-message fees. No contact limits that spike your bill when a Reel goes viral.
            Just flat monthly pricing that stays the same whether you get 50 DMs or 5,000.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">Base</p>
              <p className="text-4xl font-black text-stone-900 mb-2">$97<span className="text-lg font-bold text-stone-400">/mo</span></p>
              <p className="text-sm text-stone-500">500 DM conversations/month</p>
            </div>
            <div className="bg-stone-900 rounded-[2rem] p-8 text-white">
              <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">Unlimited</p>
              <p className="text-4xl font-black mb-2">$197<span className="text-lg font-bold text-stone-400">/mo</span></p>
              <p className="text-sm text-stone-300">Unlimited DM conversations</p>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href="/#pricing"
              className="text-sm font-bold text-[#ff7e67] hover:underline"
            >
              See full pricing details &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            FAQ for {data.nicheLabel.toLowerCase()}
          </h2>
          <div className="space-y-6">
            {data.faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-2xl p-8 border border-stone-100 soft-shadow">
                <h3 className="text-lg font-extrabold text-stone-900 mb-3">{faq.q}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline={`Ready to handle your DMs with AI assistance as a ${data.nicheLabel.toLowerCase().replace("coaches", "coach")}?`}
            subheadline="Start your 7-day free trial — no credit card required. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>
    </>
  );
}
