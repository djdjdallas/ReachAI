import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Calendar, BarChart3, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ReachAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Turn Instagram DMs into
          <span className="text-primary"> Booked Calls</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          ReachAI is your AI sales agent that qualifies leads, handles objections,
          and books calls — all through Instagram DMs, on autopilot.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="text-base px-8">
              Start Free Trial
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          7-day free trial &middot; $97/month after &middot; Cancel anytime
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border bg-card">
            <MessageSquare className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI-Powered DMs</h3>
            <p className="text-muted-foreground">
              Your AI agent reads every incoming DM, qualifies the lead, and
              responds with your personalized sales script instantly.
            </p>
          </div>
          <div className="p-6 rounded-xl border bg-card">
            <Calendar className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Auto-Book Calls</h3>
            <p className="text-muted-foreground">
              When a lead is qualified and interested, the AI drops your
              Calendly or Cal.com link at the perfect moment.
            </p>
          </div>
          <div className="p-6 rounded-xl border bg-card">
            <BarChart3 className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Real-Time Dashboard</h3>
            <p className="text-muted-foreground">
              Watch every conversation live. See who&apos;s qualifying, who booked,
              and jump into any thread to take over manually.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="p-12 rounded-2xl bg-primary/5 border border-primary/20">
          <h2 className="text-3xl font-bold mb-4">
            Ready to automate your Instagram sales?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join hundreds of businesses using ReachAI to convert DM conversations
            into booked sales calls, without lifting a finger.
          </p>
          <Link href="/signup">
            <Button size="lg" className="text-base px-8">
              Start Your 7-Day Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>ReachAI</span>
          </div>
          <p>&copy; {new Date().getFullYear()} ReachAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
