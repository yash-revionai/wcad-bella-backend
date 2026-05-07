import { NextResponse, type NextRequest } from "next/server";
import { getBackendAdminHeaders, getBackendEnvIssue, getBackendUrl, hasBackendEnv } from "@/lib/env";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ callId: string }> },
) {
  if (!hasBackendEnv()) {
    return NextResponse.json(
      { error: getBackendEnvIssue() ?? "Backend is not configured" },
      { status: 503 },
    );
  }

  const backendHeaders = getBackendAdminHeaders();
  const backendUrl = getBackendUrl();
  if (!backendHeaders || !backendUrl) {
    return NextResponse.json({ error: "Backend is not configured" }, { status: 503 });
  }

  const { callId } = await context.params;
  const response = await fetch(
    `${backendUrl}/api/admin/call-logs/${encodeURIComponent(callId)}/recording`,
    {
      cache: "no-store",
      headers: backendHeaders,
    },
  );

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
