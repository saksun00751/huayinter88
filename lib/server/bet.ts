import { apiGet } from "@/lib/api/client";
import type { BetRateRow, BetSlipSummary, NumberLimitRow, PastResultRow } from "@/lib/types/bet";

interface TicketItem {
  id: number;
  status: string;
  total_amount: number;
  created_at: string;
}

interface TicketsResponse {
  success: boolean;
  data: TicketItem[] | TicketItem | null;
}

function parseTicketDate(input: string): Date {
  if (!input) return new Date(0);
  const isoLike = input.includes("T") ? input : input.replace(" ", "T");
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

async function getMyBetHistoryFromApi(token?: string, lang?: string): Promise<BetSlipSummary[]> {
  try {
    const res = await apiGet<TicketsResponse>("/lotto/tickets", token, lang);
    const raw = res?.data;
    const tickets = Array.isArray(raw) ? raw : raw ? [raw] : [];

    return tickets
      .sort((a, b) => parseTicketDate(b.created_at).getTime() - parseTicketDate(a.created_at).getTime())
      .slice(0, 15)
      .map((ticket) => ({
        id: String(ticket.id),
        slipNo: String(ticket.id),
        lotteryName: "",
        totalAmount:         Number(ticket.total_amount ?? 0),
        totalBetAmount:      Number(ticket.total_amount ?? 0),
        totalDiscountAmount: 0,
        totalNetAmount:      Number(ticket.total_amount ?? 0),
        totalPayout: 0,
        status: String(ticket.status ?? "pending"),
        itemCount: 0,
        createdAt: parseTicketDate(ticket.created_at),
      }));
  } catch {
    return [];
  }
}

export async function getBetPageData(_lottery: string, token?: string, lang?: string) {
  const myBetHistory = await getMyBetHistoryFromApi(token, lang);

  // DB-backed data has been removed from the bet page flow.
  const numberLimits: NumberLimitRow[] = [];
  const betRates: BetRateRow[] = [];
  const pastResults: PastResultRow[] = [];
  const drawId: number | null = null;

  return {
    drawId,
    numberLimits,
    betRates,
    myBetHistory,
    pastResults,
  };
}
