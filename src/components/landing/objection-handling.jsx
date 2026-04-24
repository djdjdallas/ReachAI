import { ShieldAlert } from "lucide-react";
import { objections } from "@/lib/objections";
import ObjectionChatAnimation from "@/components/landing/objection-chat-animation";

export default function ObjectionHandling() {
  return (
    <section className="py-32 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20 reveal-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6 border border-[#ff7e67]/15">
            <ShieldAlert className="w-4 h-4" />
            Trained on your sales script
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-stone-900 leading-[1.05]">
            Generic AI gives generic replies.
            <br />
            Clinchd handles the real{" "}
            <span className="text-[#ff7e67]">objections.</span>
          </h2>
          <p className="text-stone-500 text-lg md:text-xl font-medium leading-relaxed">
            Most Instagram AI tools train on broad templates. Clinchd is trained on your exact
            sales script — so when a lead says &ldquo;I can&apos;t afford it,&rdquo; your AI
            answers the way you would on a discovery call. Not the way a chatbot would.
          </p>
        </div>

        <ObjectionChatAnimation />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {objections.map((item) => (
            <div
              key={item.objection}
              className="bg-white rounded-[1.75rem] border border-stone-100 p-8 soft-shadow reveal-up"
            >
              <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                Lead says
              </div>
              <p className="text-xl font-extrabold text-stone-900 leading-snug mb-6">
                &ldquo;{item.objection}&rdquo;
              </p>

              <div className="rounded-2xl bg-stone-50 border border-stone-100 p-5 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    Generic AI
                  </span>
                </div>
                <p className="text-sm text-stone-500 leading-relaxed line-through decoration-stone-300/70">
                  {item.generic}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fff5f2] border border-[#ff7e67]/15 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff7e67]">
                    Clinchd (your script)
                  </span>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed font-medium">
                  {item.clinchd}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16 reveal-up">
          <p className="text-stone-500 font-medium max-w-2xl mx-auto">
            You paste in your offer, your pricing, and the objections you hear most.
            Clinchd&apos;s AI handles them on the spot — every DM, 24/7, in your voice.
          </p>
        </div>
      </div>
    </section>
  );
}
