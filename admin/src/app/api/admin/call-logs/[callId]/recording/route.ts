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

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Recording not available" }, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
