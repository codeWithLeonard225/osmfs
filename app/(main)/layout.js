// app/(main)layout.jsx
"use client";

import { AuthProvider } from "@/app/context/AuthContext";

export default function MainLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
