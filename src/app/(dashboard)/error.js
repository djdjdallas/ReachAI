"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
        <span className="text-red-600 text-xl font-bold">!</span>
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        We ran into an issue loading this page. Please try again or return to
        your dashboard.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          Try Again
        </Button>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
