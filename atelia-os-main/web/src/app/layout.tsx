import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  // wichtig: damit thin/extralight wirklich verfügbar ist
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "ATELIA OS",
  description: "ATELIA OS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}