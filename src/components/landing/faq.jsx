"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "Is this against Instagram's rules?",
    answer:
      "No. ReachAI uses the official Meta Graph API and only responds to inbound messages. We never send unsolicited spam.",
  },
  {
    question: "Will it sound like a robot?",
    answer:
      "Not at all. You provide the tone and script. ReachAI is trained to match your specific brand voice perfectly.",
  },
  {
    question: "What happens when I hit my 500 DM limit?",
    answer:
      "Upgrade to Unlimited or wait for next month's reset. You'll receive a notification when you're at 80% and 100% of your limit.",
  },
  {
    question: "Can I use this with multiple Instagram accounts?",
    answer:
      "One account per subscription currently. We are developing an agency plan for managing multiple accounts from a single dashboard.",
  },
  {
    question: "How is this different from a chatbot?",
    answer:
      "ReachAI uses your actual sales script, handles real objections, and knows when to drop your booking link — a chatbot just answers simple FAQs with pre-set buttons.",
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
            Everything you need to know about your new AI agent.
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
