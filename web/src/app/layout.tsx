import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FactNews Bangladesh • ফ্যাক্টনিউজ বাংলাদেশ",
    template: "%s | FactNews Bangladesh",
  },
  description:
    "FactNews Bangladesh — Independent bilingual digital newspaper delivering verified national, economic, political, sports, and international news from Bangladesh.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"),
  openGraph: {
    type: "website",
    siteName: "FactNews Bangladesh",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,600;6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("color-scheme");var m=document.querySelector('meta[name="color-scheme"]');if(m){m.setAttribute("content",s||"light dark");}var d=s==="dark"||((!s||s==="light dark")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased selection:bg-primary/20">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
