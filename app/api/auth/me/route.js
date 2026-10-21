// In /app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";

// Returns the signed-in admin's name and *current* permissions (reloaded from the database,
// so the UI reflects permission changes and deactivation without a new login)
export async function GET(request) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const admin = await verifyJWT(token);

    return NextResponse.json({
      name: admin.name || admin.username || "User",
      permissions: admin.permissions,
    });
  } catch (error) {
    if (error.message === "Token expired") {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    if (error.message === "Invalid token" || error.message === "Token verification failed") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.error("Error in /api/auth/me:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
