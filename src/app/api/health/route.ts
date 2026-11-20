import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "datamedics",
    timestamp: new Date().toISOString(),
  });
}
