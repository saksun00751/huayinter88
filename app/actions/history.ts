"use server";

import { requireAuth } from "@/lib/session/auth";
import { apiGet, apiPost, ApiError } from "@/lib/api/client";
import { getApiToken, getLangCookie } from "@/lib/session/cookies";
import type { BetSlipDetail } from "@/lib/types/bet";

interface TicketDetailResponse {
  success: boolean;
  data?: {
    id: number;
    draw_id: number;
    draw_date: string;
    market_name: string;
    status: string;
    total_amount:          number;
    total_bet_amount?:     number;
    total_discount_amount?: number;
    total_net_amount?:     number;
    total_win_amount?:     number;
    item_count?: number;
    created_at: string;
    items: Array<{
      bet_type: string;
      bet_type_label?: string;
      number: string;
      amount: number;
      payout_at_time: number;
      potential_win_amount_at_time?: number;
      result_status: string | null;
      win_amount?: number;
    }>;
  };
}

function parseApiDate(input: string): Date {
  if (!input) return new Date(0);
  const iso = input.includes("T") ? input : input.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export async function fetchSlipDetail(slipId: string): Promise<BetSlipDetail | null> {
  await requireAuth();
  const [token, lang] = await Promise.all([getApiToken(), getLangCookie()]);
  if (!token) return null;

  const res = await apiGet<TicketDetailResponse>(`/lotto/tickets/${slipId}`, token, lang);
  const ticket = res?.data;
  if (!ticket) return null;

  const items = (ticket.items ?? []).map((item, idx) => {
    const payRate = Number(item.payout_at_time ?? 0);
    const amount = Number(item.amount ?? 0);
    const potential = Number(item.potential_win_amount_at_time ?? (amount * payRate));
    const winAmount = Number(item.win_amount ?? 0);
    return {
      id: idx + 1,
      number: item.number,
      betType: item.bet_type,
      betTypeLabel: item.bet_type_label ?? item.bet_type,
      amount,
      payRate,
      payout: potential,
      isWin: item.result_status === "win" ? true : item.result_status === "lose" ? false : null,
      actualPayout: winAmount > 0 ? winAmount : null,
    };
  });

  const totalPayout = items.reduce((sum, item) => sum + item.payout, 0);

  const totalBetAmount      = Number(ticket.total_bet_amount      ?? ticket.total_amount ?? 0);
  const totalDiscountAmount = Number(ticket.total_discount_amount ?? 0);
  const totalNetAmount      = Number(ticket.total_net_amount      ?? ticket.total_amount ?? 0);

  return {
    id: String(ticket.id),
    slipNo: String(ticket.id),
    lotteryName: ticket.market_name,
    totalAmount:         Number(ticket.total_amount ?? 0),
    totalBetAmount,
    totalDiscountAmount,
    totalNetAmount,
    totalPayout,
    status: ticket.status ?? "pending",
    itemCount: Number(ticket.item_count ?? items.length),
    createdAt: parseApiDate(ticket.created_at),
    note: null,
    confirmedAt: parseApiDate(ticket.created_at),
    items,
  };
}

interface CancelTicketResponse {
  success: boolean;
  message?: string;
}

export async function cancelSlip(slipId: string): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  const [token, lang] = await Promise.all([getApiToken(), getLangCookie()]);
  if (!token) return { ok: false, message: "ไม่พบ token" };

  try {
    const res = await apiPost<CancelTicketResponse>(`/lotto/tickets/${slipId}/cancel`, {}, token, lang);
    return { ok: Boolean(res?.success), message: res?.message ?? "ดำเนินการสำเร็จ" };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, message: err.message || "เกิดข้อผิดพลาด" };
    }
    return { ok: false, message: "เกิดข้อผิดพลาด" };
  }
}
