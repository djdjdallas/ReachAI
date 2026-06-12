"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "Do I need to be doing $50k a month?",
    answer:
      "No. Clinchd is built for coaches earning well below that. If you have more DMs than hours, you're the fit. There's no application and no minimum to clear.",
  },
  {
    question: "Is this just a chatbot with a script?",
    answer:
      "No. It reads what each person actually says, figures out intent, and responds in your tone. If someone gets hostile or asks for a refund, it steps back instead of barreling ahead.",
  },
  {
    question: "Do you fake my voice?",
    answer:
      "Never a synthetic clone of you. On the Unlimited plan you can record your own audio snippets and Clinchd uses your real voice on the replies that fit. What you record is what they hear.",
  },
  {
    question: "What does it cost? Really.",
    answer:
      "$97/month for up to 1,500 qualified conversations. $197/month for unlimited plus voice replies. The price is on this page because you shouldn't have to book a call to learn it.",
  },
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
      "Yes. Your VA can access the Clinchd dashboard to review conversations, take over chats, and check lead quality. Many coaches use Clinchd as their AI first responder and have their VA handle warm handoffs for complex conversations.",
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
