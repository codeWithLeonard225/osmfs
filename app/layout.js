import "./globals.css";
// app/layout.js

export const metadata = {
  title: "Online Salone Finance – Microfinance Management System",
  description:
    "Online Salone Finance is a modern microfinance management system for managing loans, staff, branches, transactions, and financial reports efficiently.",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      { url: "/icons/logo-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/logo-192x192.png",
    apple: "/icons/logo-192x192.png",
  },

  keywords: [
    "Online Salone Finance",
    "Microfinance Management System",
    "Loan Management System",
    "Financial Management Software Sierra Leone",
    "Microfinance Software",
    "Branch Banking System",
    "Loan Tracking System",
    "Finance Management Platform",
  ],

  authors: [{ name: "Online Salone Finance" }],
  creator: "Online Salone Finance",
  publisher: "Online Salone Finance",

  metadataBase: new URL("https://www.onlinesalonefinance.com"),
  applicationName: "Online Salone Finance",
  classification: "Microfinance Management Software",

  robots: { index: true, follow: true },
  referrer: "strict-origin-when-cross-origin",

  alternates: {
    canonical: "https://www.onlinesalonefinance.com",
  },

  openGraph: {
    title: "Online Salone Finance",
    description:
      "A secure and efficient microfinance management system for loans, staff, branches, and financial reporting.",
    url: "https://www.onlinesalonefinance.com",
    siteName: "Online Salone Finance",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/icons/logo-512x512.png",
        width: 512,
        height: 512,
        alt: "Online Salone Finance Logo",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "Online Salone Finance",
    description:
      "Smart microfinance management system for modern financial institutions.",
    images: ["/icons/logo-512x512.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b5e20",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#1b5e20" />
        <meta name="color-scheme" content="light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
