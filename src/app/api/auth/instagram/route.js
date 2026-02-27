import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/instagram";

export async function GET() {
  try {
    const url = getOAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Instagram OAuth redirect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Instagram OAuth" },
      { status: 500 }
    );
  }
}
