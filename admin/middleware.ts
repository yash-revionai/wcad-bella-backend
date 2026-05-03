import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (!hasSupabaseAuthEnv()) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js).*)"],
};
