export default function Integrations() {
  return (
    <section className="py-24 md:py-32 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 reveal-up">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-stone-900 mb-4">
            Works With Your Existing Tools
          </h2>
          <p className="text-stone-500 text-lg font-medium">
            Clinchd connects to Calendly, Cal.com, and the tools you already use
            — no migration, no headaches.
          </p>
        </div>

        <div className="reveal-up">
          <div className="bg-white border border-stone-100 rounded-[2rem] p-3 md:p-4 soft-shadow overflow-hidden max-w-4xl mx-auto">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-[1.5rem]"
            >
              <source
                src="/animations/07-platform-integrations.mp4"
                type="video/mp4"
              />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
