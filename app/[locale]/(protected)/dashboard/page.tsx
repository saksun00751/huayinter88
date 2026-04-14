import LotteryCategories from "@/components/dashboard/LotteryCategories";
import BalanceCard from "@/components/dashboard/BalanceCard";
import { requireAuth } from "@/lib/session/auth";
import type { Metadata } from "next";
import PromoBanner from "@/components/ui/PromoBanner";

export const metadata: Metadata = { title: "หน้าหลัก — Lotto" };

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-ap-bg pb-20 sm:pb-8">
      <div className="max-w-5xl mx-auto px-5 pt-6 space-y-8">

        <BalanceCard phone={user.phone} displayName={user.displayName} />

        <PromoBanner />

        {/* หวยวันนี้ — CSR */}
        <LotteryCategories />

      </div>
    </div>
  );
}
