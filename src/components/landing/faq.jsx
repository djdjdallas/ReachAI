"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "Is this compliant with Instagram's API?",
    answer:
      "Yes. Clinchd uses the official Meta Graph API and only responds to inbound messages. We never send unsolicited spam or cold outreach. We follow all of Instagram's platform policies.",
  },
  {
    question: "Will my followers know it's AI?",
    answer:
      "In our testing, over 95% of leads don't realize they're talking to AI. You provide your tone and sales script. Clinchd matches your specific coaching voice, with human-like delays so conversations feel natural.",
  },
  {
    question: "How is this different from ManyChat?",
    answer:
      "ManyChat uses rigid decision-tree flows and charges per contact. Clinchd is an AI-native setter that understands context, handles objections dynamically, and qualifies leads like a real sales rep for a flat $97/mo. No flows to build, no per-contact fees.",
  },
  {
    question: "What if someone asks something my AI isn't trained on?",
    answer:
      "Clinchd gracefully handles unknown topics by steering the conversation back to qualification, or it flags the lead for human takeover. You can jump into any conversation with one click and pick up exactly where the AI left off.",
  },
  {
    question: "Do I need a business Instagram account?",
    answer:
      "Yes, you'll need an Instagram Business or Creator account connected to a Facebook Page. This is required by Meta's API. If you're currently on a personal account, switching takes about 2 minutes in your Instagram settings.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Most coaches are fully set up in under 30 minutes. Connect your Instagram, describe your offer and ideal client, review the AI's conversation script, and flip the switch. No flow builders, no coding.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. No contracts, no commitments. Cancel with one click from your dashboard. You'll keep access through the end of your billing period. We also offer a 7-day free trial so you can test everything risk-free.",
  },
  {
    question: "What if I have a VA already, can they use this too?",
    answer:
      "Yes. Your VA can access the Clinchd dashboard to monitor conversations, take over chats, and review lead quality. Many coaches use Clinchd as their AI first responder and have their VA handle warm handoffs for complex conversations.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" className="py-32 bg-[#fafaf9]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20 reveal-up">
          <h2 className="text-4xl font-black mb-4 text-stone-900">
            Common Questions
          </h2>
          <p className="text-stone-500 font-medium">
            Everything you need to know about your AI setter.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={faq.question}
              className={`faq-item bg-white rounded-3xl p-6 soft-shadow transition-all border cursor-pointer ${
                openIndex === i
                  ? "border-[#ff7e67]/20"
                  : "border-transparent"
              } ${openIndex === i ? "open" : ""} reveal-up`}
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
            >
              <div className="flex justify-between items-center">
                <h4 className="font-black text-stone-900">{faq.question}</h4>
                <ChevronDown
                  className={`w-5 h-5 text-[#ff7e67] faq-icon flex-shrink-0 ml-4`}
                />
              </div>
              <div className="faq-answer text-stone-500 font-medium text-sm leading-relaxed">
                {faq.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
