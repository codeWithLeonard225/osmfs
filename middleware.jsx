import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("userRole")?.value;
  const authPath = request.cookies.get("authPath")?.value;

  // 🛡️ ADMIN / STAFF PROTECTION
  if (pathname.startsWith("/Dashboard")) {
    if (!role || (role !== "admin" && role !== "staff")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // 🔐 URL GUESSING LOCK:
    // If they are admin, ensure the URL path matches their assigned dashboardPath
    const currentUrlPath = pathname.split("/")[2]; // e.g., "AdminDashboard1"
    if (role === "admin" && currentUrlPath && currentUrlPath !== authPath) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 🛡️ OWNER PROTECTION
  if (pathname.startsWith("/owner") || pathname.startsWith("/ceopage")) {
    if (role !== "owner") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    
    // Ensure owners stay in their assigned route
    if (pathname.startsWith("/owner")) {
        const currentUrlPath = pathname.split("/")[2];
        if (currentUrlPath && currentUrlPath !== authPath) {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }
  }

  return NextResponse.next();
}