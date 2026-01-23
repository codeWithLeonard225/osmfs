// app/middleware.js (or wherever your middleware lives)
import { NextResponse } from "next/server";

// This middleware will run on all requests under /Dashboard or /ceopage
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Get cookies from request headers
  const role = request.cookies.get("userRole")?.value;
  const authPath = request.cookies.get("authPath")?.value;

  // 🛡️ Protect /Dashboard routes
  if (pathname.startsWith("/Dashboard")) {
    if (!role || (role !== "admin" && role !== "staff")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Admins can only access their assigned dashboard
    if (role === "admin") {
      const currentUrlPath = pathname.split("/")[2]; // e.g., "AdminDashboard1"
      if (currentUrlPath && currentUrlPath !== authPath) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  // 🛡️ Protect Owner/Ceo routes
  if (pathname.startsWith("/owner") || pathname.startsWith("/ceopage")) {
    if (role !== "owner") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Ensure owner stays on assigned path
    if (pathname.startsWith("/owner")) {
      const currentUrlPath = pathname.split("/")[2];
      if (currentUrlPath && currentUrlPath !== authPath) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  // If all checks pass, continue
  return NextResponse.next();
}

// ⚠️ This tells Next.js which paths this middleware applies to
export const config = {
  matcher: ["/Dashboard/:path*", "/ceopage/:path*", "/owner/:path*"],
};
