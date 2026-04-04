import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/session/auth";
import { getApiToken, getLangCookie } from "@/lib/session/cookies";
import { apiGet } from "@/lib/api/client";
import { getTranslation } from "@/lib/i18n/getTranslation";
import TicketList from "@/components/history/TicketList";
import TicketSearch from "@/components/history/TicketSearch";

export const metadata: Metadata = { title: "โพยหวย — Lotto" };

export interface Ticket {
  id:          number;
  draw_id:     number;
  draw_date:   string;
  market_name: string;
  market_logo: string;
  market_icon: string;
  group_name:  string;
  status:      string;
  total_amount:          number;
  total_bet_amount:      number;
  total_discount_amount: number;
  total_net_amount:      number;
  created_at:            string;
}

interface TicketsResponse {
  success: boolean;
  data:    Ticket[];
}

interface Props {
  params?:      Promise<{ locale: string }>;
  searchParams?: Promise<{ status?: string; page?: string; search?: string; draw_date?: string; limit?: string }>;
}

export default async function HistoryPage({ params, searchParams }: Props) {
  const [{ locale }, , apiToken, lang, sp] = await Promise.all([
    params ?? Promise.resolve({ locale: "th" }),
    requireAuth(),
    getApiToken(),
    getLangCookie(),
    searchParams,
  ]);

  const t = getTranslation(lang, "history");

  const STATUS_TABS = [
    { id: "all",       label: t.tabAll },
    { id: "active",    label: t.tabActive },
    { id: "won",       label: t.tabWon },
    { id: "lost",      label: t.tabLost },
    { id: "cancelled", label: t.tabCancelled },
  ];

  const status    = sp?.status    ?? "all";
  const search    = sp?.search    ?? "";
  const drawDate  = sp?.draw_date ?? "";
  const limit     = [10, 30, 50].includes(Number(sp?.limit)) ? Number(sp!.limit) : 10;
  const page      = Math.max(1, Number(sp?.page ?? 1));

  let tickets: Ticket[] = [];
  try {
    const res = await apiGet<TicketsResponse>("/lotto/tickets", apiToken ?? undefined, lang);
    tickets = res?.data ?? [];
  } catch {}

  const filtered = tickets.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (search && !t.market_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (drawDate && t.draw_date !== drawDate) return false;
    return true;
  });
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageItems  = filtered.slice((page - 1) * limit, page * limit);

  function buildHref(overrides: Record<string, string | number>) {
    const q = new URLSearchParams();
    const merged = { status, search, draw_date: drawDate, limit, page, ...overrides };
    if (merged.status && merged.status !== "all") q.set("status",    String(merged.status));
    if (merged.search)                            q.set("search",    String(merged.search));
    if (merged.draw_date)                         q.set("draw_date", String(merged.draw_date));
    if (Number(merged.limit) !== 10)              q.set("limit",     String(merged.limit));
    if (Number(merged.page) > 1)                  q.set("page",      String(merged.page));
    return `/${locale}/history${q.toString() ? `?${q}` : ""}`;
  }

  const pageNums: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (page > 3) pageNums.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pageNums.push(i);
    if (page < totalPages - 2) pageNums.push("...");
    pageNums.push(totalPages);
  }

  return (
    <div className="min-h-screen bg-ap-bg pb-20 sm:pb-8">
      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard`}
            className="w-8 h-8 rounded-xl bg-white border border-ap-border flex items-center justify-center shadow-sm hover:bg-ap-bg transition-colors">
            <svg className="w-4 h-4 text-ap-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div>
            <h1 className="text-[18px] font-bold text-ap-primary leading-tight">{t.title}</h1>
            <p className="text-[12px] text-ap-tertiary">{t.found} {total.toLocaleString()} {t.items}</p>
          </div>
        </div>

        {/* Search */}
        <TicketSearch search={search} drawDate={drawDate} limit={limit} t={t} />

        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <Link key={tab.id} href={buildHref({ status: tab.id, page: 1 })}
              className={[
                "flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                status === tab.id
                  ? "bg-ap-blue text-white"
                  : "bg-white border border-ap-border text-ap-secondary hover:bg-ap-bg",
              ].join(" ")}>
              {tab.label}
            </Link>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-ap-border shadow-card overflow-hidden">
          {pageItems.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[32px] mb-3">📋</p>
              <p className="text-[14px] font-semibold text-ap-primary mb-1">{t.emptyTitle}</p>
              <p className="text-[12px] text-ap-tertiary">{t.emptyDesc}</p>
              <Link href={`/${locale}/bet`}
                className="inline-block mt-4 px-6 py-2.5 bg-ap-blue text-white rounded-full text-[13px] font-semibold hover:bg-ap-blue-h transition-colors">
                {t.gobet}
              </Link>
            </div>
          ) : (
            <TicketList tickets={pageItems} t={t} />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 py-2 flex-wrap">
            {page > 1 ? (
              <Link href={buildHref({ page: page - 1 })}
                className="px-3 py-2 bg-white border border-ap-border rounded-xl text-[13px] font-semibold text-ap-secondary hover:bg-ap-bg transition-colors">←</Link>
            ) : (
              <span className="px-3 py-2 rounded-xl text-[13px] text-ap-border select-none">←</span>
            )}
            {pageNums.map((n, i) =>
              n === "..." ? (
                <span key={`dots-${i}`} className="px-2 py-2 text-[13px] text-ap-tertiary">…</span>
              ) : (
                <Link key={n} href={buildHref({ page: n })}
                  className={[
                    "min-w-[36px] h-9 flex items-center justify-center rounded-xl text-[13px] font-semibold transition-colors",
                    page === n ? "bg-ap-blue text-white" : "bg-white border border-ap-border text-ap-secondary hover:bg-ap-bg",
                  ].join(" ")}>
                  {n}
                </Link>
              )
            )}
            {page < totalPages ? (
              <Link href={buildHref({ page: page + 1 })}
                className="px-3 py-2 bg-white border border-ap-border rounded-xl text-[13px] font-semibold text-ap-secondary hover:bg-ap-bg transition-colors">→</Link>
            ) : (
              <span className="px-3 py-2 rounded-xl text-[13px] text-ap-border select-none">→</span>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
