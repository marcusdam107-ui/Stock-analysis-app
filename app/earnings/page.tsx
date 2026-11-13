"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import EarningsWeek from "@/components/EarningsWeek";

/** This week's most anticipated earnings and US economic events. */
export default function EarningsPage() {
  const router = useRouter();
  useEffect(() => {
    document.title = "Anticipated Earnings & Events · Malachi Wealth";
  }, []);

  return (
    <div className="app app--wide">
      <Header onSearch={(s) => router.push(`/t/${encodeURIComponent(s)}`)} />
      <div className="toolbar">
        <div className="chips">
          <Link href="/" className="btn-ghost">← Dashboard</Link>
        </div>
      </div>
      <EarningsWeek />
      <footer className="foot">
        Malachi Wealth · for personal research, not investment advice · quotes may be delayed by the data source
      </footer>
    </div>
  );
}
