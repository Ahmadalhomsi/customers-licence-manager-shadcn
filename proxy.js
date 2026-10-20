import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  const publicRoutes = ["/login", "/api/login", "/api/external", "/admins", "/api/cron"];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  let token = req.cookies.get("token")?.value;
  const authHeader = req.headers.get("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    console.log("No token found");
    
    // For API routes, return JSON error instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: "Not authenticated", message: "No token provided" },
        { status: 401 }
      );
    }
    
    // For page routes, redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    req.nextUrl.searchParams.set("user", JSON.stringify(payload));

    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    
    // For API routes, return JSON error instead of redirect
    if (pathname.startsWith('/api/')) {
      let errorMessage = "Invalid token";
      if (err.code === 'ERR_JWT_EXPIRED') {
        errorMessage = "Token expired";
      }
      
      return NextResponse.json(
        { error: errorMessage, message: "Authentication failed" },
        { status: 401 }
      );
    }
    
    // For page routes, create response that clears the invalid token and redirects
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("token");
    
    // Set headers to help client-side error handling
    if (err.code === 'ERR_JWT_EXPIRED') {
      response.headers.set('X-Auth-Error', 'token-expired');
    } else {
      response.headers.set('X-Auth-Error', 'invalid-token');
    }
    
    return response;
  }
}

export const config = {
  matcher: ["/api/:path*", "/", "/login", "/services", "/log", "/customers"],
};
