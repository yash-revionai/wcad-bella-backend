import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireLiveAdminAccountId } from "@/lib/admin-auth";
import { getBackendAdminHeaders, getBackendEnvIssue, getBackendUrl, hasBackendEnv } from "@/lib/env";

const googleAuthUrlResponseSchema = z.object({
  url: z.string().url(),
});

function settingsRedirect(request: NextRequest, saved: "config-error" | "google-error" | "backend-url-error") {
  return NextResponse.redirect(new URL(`/dashboard/settings?saved=${saved}`, request.url));
}

function backendConfigRedirect(request: NextRequest) {
  return settingsRedirect(request, getBackendEnvIssue() === "localhost-backend-url" ? "backend-url-error" : "config-error");
}

export async function GET(request: NextRequest) {
  const accountId = await requireLiveAdminAccountId("/dashboard/settings");
  if (!hasBackendEnv()) {
    return backendConfigRedirect(request);
  }

  const backendUrl = getBackendUrl()!;
  const backendHeaders = getBackendAdminHeaders();
  if (!backendHeaders) {
    return backendConfigRedirect(request);
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/auth/google/url?accountId=${encodeURIComponent(accountId)}`, {
      cache: "no-store",
      headers: backendHeaders,
    });
  } catch {
    return settingsRedirect(request, "google-error");
  }

  if (!response.ok) {
    return settingsRedirect(request, "google-error");
  }

  const parsed = googleAuthUrlResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return settingsRedirect(request, "google-error");
  }

  return NextResponse.redirect(parsed.data.url);
}
