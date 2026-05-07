import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();
    const { data: adminUser, error } = await supabase
      .from("admin_users")
      .select("id,email,password_hash,account_id,is_super_admin")
      .eq("email", email)
      .maybeSingle();

    if (error || !adminUser || !adminUser.password_hash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isPasswordValid = await compare(password, adminUser.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isSuperAdmin = Boolean(adminUser.is_super_admin);
    const sessionToken = await createSession({
      email: adminUser.email,
      accountId: adminUser.account_id || null,
      isSuperAdmin,
    });

    await setSessionCookie(sessionToken);

    const redirectTo = isSuperAdmin ? "/dashboard/users" : "/dashboard";
    return NextResponse.json({ success: true, redirectTo });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
