import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateScript } from "@/lib/openai";

export async function POST(request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { offer, targetCustomer, objections } = await request.json();

    if (!offer || !targetCustomer) {
      return NextResponse.json(
        { error: "offer and targetCustomer are required" },
        { status: 400 }
      );
    }

    const script = await generateScript(
      offer,
      targetCustomer,
      objections || ""
    );

    return NextResponse.json({ script }, { status: 200 });
  } catch (error) {
    console.error("Generate script error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
