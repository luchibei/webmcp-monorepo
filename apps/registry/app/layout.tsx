import Link from "next/link";

import "./globals.css";

export const metadata = {
  title: "WebMCP Registry",
  description: "Directory and verification portal for WebMCP-enabled websites."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container header-inner">
            <strong>WebMCP Registry</strong>
            <nav className="nav">
              <Link className="nav-link" href="/">
                Home
              </Link>
              <Link className="nav-link" href="/submit">
                Submit
              </Link>
              <Link className="nav-link" href="/sites">
                Sites
              </Link>
            </nav>
          </div>
        </header>
        <main className="container main">{children}</main>
      </body>
    </html>
  );
}
