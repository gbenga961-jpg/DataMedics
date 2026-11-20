import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDataRepository } from "@/services/repository";

export async function GET(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const repo = getDataRepository();
  const reports = await repo.listReportsByUser(user.id);

  return NextResponse.json({ reports });
}
