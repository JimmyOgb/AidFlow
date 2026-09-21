import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/Navbar";

export const metadata: Metadata = {
  title: "AidFlow — Autonomous Humanitarian Aid Escrow & Verification Protocol",
  description:
    "Donors fund humanitarian aid via on-chain escrow. GenLayer validators independently adjudicate multimodal evidence to release milestone tranches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 flex flex-col min-h-screen selection:bg-emerald-500 selection:text-slate-950">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>
              AidFlow &copy; 2026 — Built on GenLayer Intelligent Contracts. Non-deterministic consensus & verifiable humanitarian outcomes.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>StudioNet (Chain ID: 61999)</span>
              <span>•</span>
              <a
                href="https://genlayer-explorer.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-400 underline underline-offset-4"
              >
                Studio Explorer
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
