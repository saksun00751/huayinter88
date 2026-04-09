"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import Toast from "@/components/ui/Toast";
import BetClassicForm  from "./BetClassicForm";
import BetStandardForm from "./BetStandardForm";
import { useLang } from "@/lib/i18n/context";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  BetTypeId, TabId, BillRow,
  MAX_DIGITS, TABS, DOUBLED, TRIPLED,
  genId, genSlipNo, permutations, nineteenDoor, addUnique, isValid3Perm, isValid6Perm,
} from "./types";
import type { NumberLimitRow, BettingContext } from "@/lib/types/bet";

const SPECIAL_FUNCTION_TYPES = ["2perm", "3perm", "6perm", "19door"] as const;
type SpecialFunctionType = (typeof SPECIAL_FUNCTION_TYPES)[number];
const isSpecialFunctionType = (id: BetTypeId): id is SpecialFunctionType =>
  (SPECIAL_FUNCTION_TYPES as readonly string[]).includes(id);

const DB_BET_TYPE: Record<BetTypeId, string> = {
  "3top": "top3", "3tod": "tod3", "2top": "top2", "2bot": "bot2",
  "run": "run_top", "winlay": "run_bot", "2perm": "top2", "3perm": "top3", "6perm": "top3", "19door": "top2", "winnum": "top2",
};

function isBlocked(number: string, betType: BetTypeId, limits: NumberLimitRow[]): boolean {
  const db = DB_BET_TYPE[betType];
  return limits.some(
    (l) => l.number === number && l.isClosed && (l.betType === null || l.betType === db)
  );
}

// bet type ที่ตรงกับ input ล่าง/โต๊ด ของแต่ละ bet type
const BOT_BET_TYPE: Partial<Record<BetTypeId, BetTypeId>> = {
  "3top": "3tod", "3perm": "3tod", "6perm": "3tod",
  "2top": "2bot", "2perm": "2bot", "19door": "2bot",
  "run": "winlay",
};

interface Props {
  betType:            BetTypeId;
  baseBetType?:       BetTypeId;
  selected3?:         BetTypeId[];
  selected2?:         BetTypeId[];
  selectedRun?:       BetTypeId[];
  lotteryName:        string;
  lotteryFlag?:       string;
  lotteryLogo?:       string;
  closeAt?:           string;
  bills:              BillRow[];
  totalAmount:        number;
  numberLimits:       NumberLimitRow[];
  bettingContext?:    BettingContext;
  onAddBills:         (rows: BillRow[]) => void;
  onClearAll:         () => void;
  tripleTrigger?:     number;
  doubleTrigger?:     number;
  onTabChange?:       (tab: TabId) => void;
}

export default function BetQuickForm({
  betType,
  baseBetType,
  selected3,
  selected2,
  selectedRun,
  lotteryName,
  lotteryFlag,
  lotteryLogo,
  bills,
  totalAmount,
  numberLimits,
  bettingContext,
  onAddBills,
  onClearAll,
  tripleTrigger,
  doubleTrigger,
  onTabChange,
}: Props) {
  const { lang } = useLang();
  const t = useTranslation("bet");
  const localeByLang: Record<string, string> = { th: "th-TH", en: "en-US", kh: "km-KH", la: "lo-LA" };
  const dateLocale = localeByLang[lang] ?? "th-TH";
  const today = new Date().toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" });

  const maxDigits = MAX_DIGITS[betType];
  const pairingType: BetTypeId = (() => {
    if (isSpecialFunctionType(betType) && baseBetType) return baseBetType;
    if (betType === "3perm" || betType === "6perm") return "3top";
    if (betType === "2perm" || betType === "19door") return "2top";
    return betType;
  })();

  // 3top/3tod → เปิดทั้ง บน(3top) และ โต๊ด(3tod) พร้อมกัน
  // 2top/2bot → เปิดทั้ง บน(2top) และ ล่าง(2bot) พร้อมกัน
  const is3DigitPair = pairingType === "3top" || pairingType === "3tod";
  const is2DigitPair = pairingType === "2top" || pairingType === "2bot";
  const isRunPair    = pairingType === "run"  || pairingType === "winlay";

  const topBillType: BetTypeId = is3DigitPair ? "3top" : is2DigitPair ? "2top" : isRunPair ? "run"    : pairingType;
  const botBillType: BetTypeId = is3DigitPair ? "3tod" : is2DigitPair ? "2bot" : isRunPair ? "winlay" : (BOT_BET_TYPE[pairingType] ?? pairingType);

  const topCtx = is3DigitPair
    ? bettingContext?.["3top"]
    : is2DigitPair
    ? bettingContext?.["2top"]
    : isRunPair
    ? bettingContext?.["run"]
    : bettingContext?.[topBillType];
  const botCtx = is3DigitPair
    ? bettingContext?.["3tod"]
    : is2DigitPair
    ? bettingContext?.["2bot"]
    : isRunPair
    ? bettingContext?.["winlay"]
    : bettingContext?.[botBillType];

  const TOP_TYPES: BetTypeId[] = ["3top", "3perm", "6perm", "2top", "2perm", "19door", "run"];
  const BOT_TYPES: BetTypeId[] = ["3perm", "6perm", "3tod", "2perm", "19door", "2bot", "winlay"];
  const showTop = is3DigitPair
    ? (selected3?.includes("3top") ?? true)
    : is2DigitPair
      ? (selected2?.includes("2top") ?? true)
    : isRunPair
      ? (selectedRun?.includes("run") ?? true)
    : (is2DigitPair || isRunPair || TOP_TYPES.includes(betType));
  const showBot = is3DigitPair
    ? (selected3?.includes("3tod") ?? true)
    : is2DigitPair
      ? (selected2?.includes("2bot") ?? true)
    : isRunPair
      ? (selectedRun?.includes("winlay") ?? true)
    : (is2DigitPair || isRunPair || BOT_TYPES.includes(betType));

  const bottomAmountLabel = (is3DigitPair || maxDigits === 3) ? t.tod : t.bottom;

  type Ctx = typeof topCtx;
  const validateAmount = (amt: number, ctx: Ctx): string | null => {
    if (!ctx || !(amt > 0)) return null;
    if (amt < ctx.minBet)
      return (t.amountTooLow ?? "ยอดขั้นต่ำ {min}").replace("{min}", String(ctx.minBet));
    if (amt > ctx.maxBet)
      return (t.amountTooHigh ?? "ยอดสูงสุด {max}").replace("{max}", ctx.maxBet.toLocaleString());
    if (ctx.maxPerNumber && amt > ctx.maxPerNumber)
      return (t.amountPerNumberExceeded ?? "ยอดต่อเลขสูงสุด {max}").replace("{max}", ctx.maxPerNumber.toLocaleString());
    return null;
  };

  const tabLabels: Record<TabId, string> = {
    standard: t.tabStandard,
    quick: t.tabQuick,
    classic: t.tabClassic,
    slip: t.tabSlip,
  };

  const [activeTab,   setActiveTab]   = useState<TabId>("standard");
  const [inputBuf,    setInputBuf]    = useState("");
  const [preview,     setPreview]     = useState<string[]>([]);
  const [dupWarning,  setDupWarning]  = useState("");
  const [topAmt,      setTopAmt]      = useState("");
  const [botAmt,      setBotAmt]      = useState("");
  const [note,        setNote]        = useState("");
  const [slipText,    setSlipText]    = useState("");
  const pendingAddRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tripleTrigger && tripleTrigger > 0) {
      setPreview((prev) => addUnique(prev, TRIPLED));
      setToastMsg({ text: `✅ ${t.tripleNumbers} ${TRIPLED.join(", ")}`, type: "warning" });
    }
  }, [tripleTrigger]);

  useEffect(() => {
    if (doubleTrigger && doubleTrigger > 0) {
      setPreview((prev) => addUnique(prev, DOUBLED));
      setToastMsg({ text: `✅ ${t.doubleNumbers} ${DOUBLED.join(", ")}`, type: "warning" });
    }
  }, [doubleTrigger]);

  const handleSlipChange = (val: string) => {
    const hasDelimiter = /[\s,]/.test(val[val.length - 1] ?? "");
    const tokens = val.split(/[\s,]+/).map((t) => t.replace(/\D/g, "")).filter(Boolean);
    const complete = hasDelimiter ? tokens : tokens.slice(0, -1);
    const inProgress = hasDelimiter ? "" : (tokens[tokens.length - 1] ?? "");

    const valid = complete.filter((t) => t.length === maxDigits);
    if (betType === "3perm") {
      const invalid3p = valid.filter((n) => !isValid3Perm(n));
      if (invalid3p.length > 0)
        setToastMsg({ text: `⚠️ ${invalid3p.join(", ")} ${t.not3permMessage}`, type: "error" });
      const valid3p = valid.filter((n) => isValid3Perm(n));
      if (valid3p.length > 0) {
        const blockedNums = valid3p.filter((n) => isBlocked(n, topBillType, numberLimits));
        const allowedNums = valid3p.filter((n) => !isBlocked(n, topBillType, numberLimits));
        if (blockedNums.length > 0)
          setToastMsg({ text: `🔒 ${t.numberLabel} ${blockedNums.join(", ")} ${t.blockedNumberMessage}`, type: "error" });
        if (allowedNums.length > 0)
          setPreview((prev) => addUnique(prev, allowedNums));
      }
      setSlipText(inProgress);
      return;
    }
    if (betType === "6perm") {
      const invalid6p = valid.filter((n) => !isValid6Perm(n));
      if (invalid6p.length > 0)
        setToastMsg({ text: `⚠️ ${invalid6p.join(", ")} ${t.not6permMessage}`, type: "error" });
      const valid6p = valid.filter((n) => isValid6Perm(n));
      if (valid6p.length > 0) {
        const blockedNums = valid6p.filter((n) => isBlocked(n, topBillType, numberLimits));
        const allowedNums = valid6p.filter((n) => !isBlocked(n, topBillType, numberLimits));
        if (blockedNums.length > 0)
          setToastMsg({ text: `🔒 ${t.numberLabel} ${blockedNums.join(", ")} ${t.blockedNumberMessage}`, type: "error" });
        if (allowedNums.length > 0)
          setPreview((prev) => addUnique(prev, allowedNums));
      }
      setSlipText(inProgress);
      return;
    }
    if (betType === "19door") {
      const expanded = valid.flatMap((n) => nineteenDoor(n));
      const blockedNums = expanded.filter((n) => isBlocked(n, topBillType, numberLimits));
      const allowedNums = expanded.filter((n) => !isBlocked(n, topBillType, numberLimits));
      if (blockedNums.length > 0)
        setToastMsg({ text: `🔒 ${t.numberLabel} ${blockedNums.join(", ")} ${t.blockedNumberMessage}`, type: "error" });
      if (allowedNums.length > 0)
        setPreview((prev) => addUnique(prev, allowedNums));
      setSlipText(inProgress);
      return;
    }
    if (valid.length > 0) {
      const blockedNums = valid.filter((n) => isBlocked(n, topBillType, numberLimits));
      const allowedNums = valid.filter((n) => !isBlocked(n, topBillType, numberLimits));
      if (blockedNums.length > 0)
        setToastMsg({ text: `🔒 ${t.numberLabel} ${blockedNums.join(", ")} ${t.blockedNumberMessage}`, type: "error" });
      if (allowedNums.length > 0)
        setPreview((prev) => addUnique(prev, allowedNums));
    }
    setSlipText(inProgress);
  };

  function expandNumber(digits: string): string[] {
    if (betType === "2perm") {
      const rev = digits.split("").reverse().join("");
      return rev === digits ? [digits] : [digits, rev];
    }
    if (betType === "3perm") {
      return permutations(digits);
    }
    if (betType === "6perm")  return permutations(digits);
    if (betType === "19door") return nineteenDoor(digits);
    return [digits];
  }

  const handleNumberInput = (val: string) => {
    if (pendingAddRef.current) return;

    const digits = val.replace(/\D/g, "").slice(0, maxDigits);
    setInputBuf(digits);
    if (digits.length === maxDigits) {
      if (betType === "3perm" && !isValid3Perm(digits)) {
        setToastMsg({ text: `⚠️ ${digits} ${t.not3permMessage}`, type: "error" });
        setInputBuf("");
        return;
      }
      if (betType === "6perm" && !isValid6Perm(digits)) {
        setToastMsg({ text: `⚠️ ${digits} ${t.not6permMessage}`, type: "error" });
        setInputBuf("");
        return;
      }

      const expanded = expandNumber(digits);
      const commitExpanded = () => {
        const blockedNums = expanded.filter((n) => isBlocked(n, topBillType, numberLimits));
        const allowedNums = expanded.filter((n) => !isBlocked(n, topBillType, numberLimits));
        const dups = allowedNums.filter((n) => preview.includes(n));

        if (blockedNums.length > 0) {
          setToastMsg({ text: `🔒 ${t.numberLabel} ${blockedNums.join(", ")} ${t.blockedNumberMessage}`, type: "error" });
        } else if (dups.length > 0) {
          setDupWarning(`${t.numberLabel} ${dups.join(", ")} ${t.duplicatePreviewMessage}`);
          setTimeout(() => setDupWarning(""), 2500);
        } else {
          setDupWarning("");
        }

        if (allowedNums.length > 0)
          setPreview((prev) => addUnique(prev, allowedNums));
        setInputBuf("");
      };

      if (betType === "19door") {
        pendingAddRef.current = setTimeout(() => {
          commitExpanded();
          pendingAddRef.current = null;
        }, 500);
        return;
      }

      commitExpanded();
    }
  };

  const resetKey = baseBetType ?? betType;

  useEffect(() => {
    if (pendingAddRef.current) {
      clearTimeout(pendingAddRef.current);
      pendingAddRef.current = null;
    }
    setPreview([]);
    setInputBuf("");
    setSlipText("");
    setDupWarning("");
    setTopAmt("");
    setBotAmt("");
  }, [resetKey]);

  useEffect(() => {
    return () => {
      if (pendingAddRef.current) {
        clearTimeout(pendingAddRef.current);
        pendingAddRef.current = null;
      }
    };
  }, []);

  const clearPreview = useCallback(() => {
    setPreview([]);
    setInputBuf("");
    setTopAmt("");
    setBotAmt("");
    setNote("");
  }, []);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: "warning" | "error" } | null>(null);

  const handleAmountBlur = (field: "top" | "bot", rawValue: string, ctx: Ctx, label: string) => {
    const parsed = parseFloat(rawValue);
    const err = validateAmount(parsed, ctx);
    if (err) setToastMsg({ text: err, type: "warning" });
  };

  const canAddBill = preview.length > 0 && (
    (showTop && parseFloat(topAmt) > 0) ||
    (showBot && parseFloat(botAmt) > 0)
  );

  const addBill = useCallback(() => {
    if (!canAddBill) return;
    const top = showTop ? (parseFloat(topAmt) || 0) : 0;
    const bot = showBot ? (parseFloat(botAmt) || 0) : 0;

    // validate min/max/per-number
    if (top > 0) {
      const err = validateAmount(top, topCtx);
      if (err) { setToastMsg({ text: err, type: "warning" }); return; }
      if (topCtx?.maxPerNumber) {
        const overLimit = preview.find((num) => {
          const existing = bills.filter((b) => b.number === num && b.betType === topBillType).reduce((s, b) => s + b.top, 0);
          return existing + top > topCtx.maxPerNumber;
        });
        if (overLimit) { setToastMsg({ text: `${t.numberLabel} ${overLimit}: ${t.amountPerNumberExceeded.replace("{max}", String(topCtx.maxPerNumber))}`, type: "warning" }); return; }
      }
    }
    // 3 ตัวโต๊ด: dedup กลุ่ม permutation ให้เหลือชุดเดียว
    // เช่น กรอก 123 กับ 321 → เป็นกลุ่มเดียวกัน เหลือแค่ตัวแรก
    const todNums = (bot > 0 && botBillType === "3tod")
      ? preview.filter((num, idx) => {
          const key = num.split("").sort().join("");
          return preview.findIndex((n) => n.split("").sort().join("") === key) === idx;
        })
      : preview;

    if (bot > 0) {
      const err = validateAmount(bot, botCtx);
      if (err) { setToastMsg({ text: err, type: "warning" }); return; }
      if (botCtx?.maxPerNumber) {
        const overLimit = todNums.find((num) => {
          const existing = bills.filter((b) => b.number === num && b.betType === botBillType).reduce((s, b) => s + b.bot + b.top, 0);
          return existing + bot > botCtx.maxPerNumber;
        });
        if (overLimit) { setToastMsg({ text: `${t.numberLabel} ${overLimit}: ${t.amountPerNumberExceeded.replace("{max}", String(botCtx.maxPerNumber))}`, type: "warning" }); return; }
      }
    }

    // เช็ค duplicate แยกตาม betType ของ top แ���ะ bot
    if (top > 0) {
      const dupes = preview.filter((num) =>
        bills.some((b) => b.number === num && b.betType === topBillType && b.top > 0)
      );
      if (dupes.length > 0) {
        setToastMsg({ text: `${t.numberLabel} ${dupes.join(", ")} ${t.duplicateSlipMessage}`, type: "warning" });
        return;
      }
    }
    if (bot > 0) {
      const dupes = todNums.filter((num) =>
        bills.some((b) => b.number === num && b.betType === botBillType && b.top > 0)
      );
      if (dupes.length > 0) {
        setToastMsg({ text: `${t.numberLabel} ${dupes.join(", ")} ${t.duplicateSlipMessage}`, type: "warning" });
        return;
      }
    }

    const slipNo = genSlipNo();
    const time   = new Date().toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
    const newBills: BillRow[] = [];
    preview.forEach((num) => {
      if (top > 0) newBills.push({ id: genId(), slipNo, number: num, betType: topBillType, top, bot: 0, note, time });
    });
    todNums.forEach((num) => {
      if (bot > 0) newBills.push({ id: genId(), slipNo, number: num, betType: botBillType, top: bot, bot: 0, note, time });
    });
    onAddBills(newBills);
    clearPreview();
  }, [canAddBill, topAmt, botAmt, preview, topBillType, botBillType, bills, note, clearPreview, onAddBills, dateLocale, topCtx, botCtx, validateAmount, showTop, showBot, t]);

  return (
    <>
    {toastMsg && <Toast message={toastMsg.text} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
    <div className="bg-white rounded-2xl overflow-hidden shadow-card border border-ap-border">

      {/* Tabs */}
      <div className="flex border-b border-ap-border">
        {TABS.map((tab, i) => (
          <button key={tab.id}
            onClick={() => {
              if (!tab.disabled && tab.id !== activeTab) {
                setActiveTab(tab.id);
                onTabChange?.(tab.id);
                setPreview([]);
                setInputBuf("");
                setSlipText("");
                setDupWarning("");
              }
            }}
            disabled={tab.disabled}
            className={["flex-1 py-2.5 text-[12px] sm:text-[13px] font-bold transition-all",
              i < TABS.length - 1 ? "border-r border-ap-border" : "",
              tab.disabled
                ? "bg-ap-bg text-ap-tertiary cursor-not-allowed"
                : activeTab === tab.id
                  ? "bg-ap-blue text-white"
                  : "bg-ap-bg text-ap-secondary hover:bg-white hover:text-ap-primary",
            ].join(" ")}>
            {tabLabels[tab.id]}
          </button>
        ))}
      </div>

      {/* Standard tab */}
      {activeTab === "standard" && (
        <BetStandardForm
          betType={betType}
          baseBetType={baseBetType}
          selected3={selected3}
          selected2={selected2}
          selectedRun={selectedRun}
          bills={bills}
          numberLimits={numberLimits}
          bettingContext={bettingContext}
          tripleTrigger={tripleTrigger}
          doubleTrigger={doubleTrigger}
          onAddBills={onAddBills}
        />
      )}

      {/* Classic tab */}
      {activeTab === "classic" && (
        <BetClassicForm
          lotteryName={lotteryName}
          lotteryFlag={lotteryFlag}
          lotteryLogo={lotteryLogo}
          bills={bills}
          numberLimits={numberLimits}
          bettingContext={bettingContext}
          onAddBills={onAddBills}
        />
      )}

      {activeTab !== "classic" && activeTab !== "standard" && <div className="p-4">
        {/* Title */}
        <div className="mb-3">
          <p className="text-[16px] font-bold text-ap-primary">{tabLabels[activeTab]}</p>
          <p className="text-[12px] text-ap-primary font-medium mt-0.5">{lotteryName} • {today}</p>
        </div>

        {/* Input area */}
        {activeTab === "slip" ? (
          <div className="bg-ap-bg/70 rounded-2xl border border-ap-border p-4 mb-3">
            <label className="text-[12px] text-ap-primary font-bold mb-1.5 block uppercase tracking-wide">
              {t.pasteSlipLabel.replace("{digits}", String(maxDigits))}
            </label>
            <textarea
              value={slipText}
              onChange={(e) => handleSlipChange(e.target.value)}
              placeholder={`${t.pasteSlipPlaceholder.replace("{digits}", String(maxDigits))}\n${t.exampleLabel} ${maxDigits === 3 ? t.pasteSlipExample3 : t.pasteSlipExample2}`}
              rows={4}
              className="w-full border-2 border-ap-blue/40 rounded-xl px-3 py-3 text-[15px] font-bold text-ap-primary outline-none focus:border-ap-blue focus:ring-4 focus:ring-ap-blue/15 bg-white shadow-sm transition-all resize-none leading-relaxed"
            />
            <p className="mt-1.5 text-[12px] text-ap-secondary font-medium">{t.pasteSlipHint}</p>
          </div>
        ) : (
          <div className="bg-ap-bg/70 rounded-2xl border border-ap-border p-4 mb-3">
            <label className="text-[12px] text-ap-primary font-bold mb-1 block uppercase tracking-wide">
              {t.inputNumberLabel.replace("{digits}", String(maxDigits))}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={inputBuf}
              onChange={(e) => handleNumberInput(e.target.value)}
              maxLength={maxDigits}
              placeholder={"·".repeat(maxDigits)}
              className="w-full border-2 border-ap-blue/40 rounded-xl px-3 py-3 text-[22px] text-center font-extrabold text-ap-primary outline-none focus:border-ap-blue focus:ring-4 focus:ring-ap-blue/15 bg-white shadow-sm transition-all placeholder:text-ap-tertiary/40"
            />
          </div>
        )}

        {/* Preview card */}
        <div className="rounded-2xl border border-ap-border bg-white mb-3 overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between border-b border-ap-border bg-ap-bg/80">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-ap-primary uppercase tracking-wide">{t.previewTitle}</span>
              <span className="text-[13px] font-bold text-ap-blue tabular-nums">{preview.length} {t.countUnit}</span>
            </div>
            <div className="flex items-center gap-1.5">
            </div>
          </div>

          {dupWarning && (
            <div className="px-4 py-1.5 bg-yellow-50 border-b border-yellow-200 text-[12px] text-yellow-700 font-semibold">
              ⚠ {dupWarning}
            </div>
          )}

          <div className="p-3 min-h-[52px] flex flex-wrap gap-1.5">
            {preview.length === 0 ? (
              <span className="text-[13px] text-ap-secondary font-medium self-center">— {t.previewEmpty} —</span>
            ) : (
              preview.map((n, idx) => (
                <span key={idx}
                  className="inline-flex items-center gap-1 text-white text-[14px] font-bold px-2.5 py-1 rounded-lg tabular-nums tracking-wider bg-ap-green">
                  {n}
                  <button onClick={() => setPreview((prev) => prev.filter((_, i) => i !== idx))}
                    className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-[10px] font-black transition-colors leading-none">
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          {preview.length > 0 && (
            <div className="px-3 pb-3 flex justify-center">
              <button onClick={() => { setPreview([]); setInputBuf(""); setDupWarning(""); }}
                className="text-[12px] font-bold px-4 py-1.5 rounded-lg bg-ap-red/10 border border-ap-red/30 text-ap-red hover:bg-ap-red hover:text-white active:scale-95 transition-all">
                ✕ {t.clearAll}
              </button>
            </div>
          )}
        </div>

        {/* บน / ล่าง / หมายเหตุ / เพิ่มบิล */}
        <div className="bg-ap-bg/70 rounded-2xl border border-ap-border p-4 mb-3">
          {/* บน + ล่าง/โต๊ด */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={`text-[12px] font-bold mb-1 flex items-center gap-1 uppercase tracking-wide ${showTop ? "text-ap-primary" : "text-ap-tertiary"}`}>
                {t.top}
                {showTop && topCtx?.payout ? <span className="text-ap-green font-bold normal-case">×{topCtx.payout}</span> : null}
              </label>
              <input
                type="number"
                value={topAmt}
                disabled={!showTop}
                onChange={(e) => setTopAmt(e.target.value)}
                onBlur={() => handleAmountBlur("top", topAmt, topCtx, t.top)}
                placeholder="—"
                min={topCtx?.minBet ?? 1}
                max={topCtx?.maxBet}
                className="w-full border-2 border-ap-blue/30 rounded-xl px-3 py-3 text-[16px] text-center font-extrabold text-ap-blue outline-none focus:border-ap-blue focus:ring-4 focus:ring-ap-blue/15 bg-blue-50/40 shadow-sm transition-all disabled:bg-ap-bg disabled:text-ap-tertiary disabled:cursor-not-allowed disabled:border-ap-border disabled:shadow-none"
              />
              {showTop && topCtx && (
                <p className="mt-0.5 text-[11px] text-ap-secondary font-medium text-center">
                  {topCtx.minBet}–{topCtx.maxBet.toLocaleString()}
                  {topCtx.maxPerNumber ? ` • /เลข ≤${topCtx.maxPerNumber.toLocaleString()}` : ""}
                </p>
              )}
            </div>
            <div>
              <label className={`text-[12px] font-bold mb-1 flex items-center gap-1 uppercase tracking-wide ${showBot ? "text-ap-primary" : "text-ap-tertiary"}`}>
                {bottomAmountLabel}
                {showBot && botCtx?.payout ? <span className="text-ap-green font-bold normal-case">×{botCtx.payout}</span> : null}
              </label>
              <input
                type="number"
                value={botAmt}
                disabled={!showBot}
                onChange={(e) => setBotAmt(e.target.value)}
                onBlur={() => handleAmountBlur("bot", botAmt, botCtx, bottomAmountLabel)}
                placeholder="—"
                min={botCtx?.minBet ?? 1}
                max={botCtx?.maxBet}
                className="w-full border-2 border-green-400/40 rounded-xl px-3 py-3 text-[16px] text-center font-extrabold text-ap-green outline-none focus:border-ap-green focus:ring-4 focus:ring-green-500/15 bg-green-50/40 shadow-sm transition-all disabled:bg-ap-bg disabled:text-ap-tertiary disabled:cursor-not-allowed disabled:border-ap-border disabled:shadow-none"
              />
              {showBot && botCtx && (
                <p className="mt-0.5 text-[11px] text-ap-secondary font-medium text-center">
                  {botCtx.minBet}–{botCtx.maxBet.toLocaleString()}
                  {botCtx.maxPerNumber ? ` • /เลข ≤${botCtx.maxPerNumber.toLocaleString()}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* หมายเหตุ */}
          <div className="mb-3">
            <label className="text-[12px] text-ap-primary font-bold mb-1 block uppercase tracking-wide">{t.note}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              className="w-full border border-ap-border bg-white rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-ap-blue transition-all"
            />
          </div>

          {/* Hint */}
          {preview.length > 0 && !(showTop && parseFloat(topAmt) > 0) && !(showBot && parseFloat(botAmt) > 0) && (
            <p className="mb-2 text-[11px] text-ap-red font-medium">⚠ {t.fillAmountHint.replace("{bottom}", bottomAmountLabel)}</p>
          )}

          {/* + เพิ่มบิล */}
          <div className="flex justify-center">
            <button onClick={addBill} disabled={!canAddBill}
              className={["text-[13px] font-bold px-8 py-2 rounded-xl transition-all",
                canAddBill
                  ? "bg-ap-primary hover:bg-black text-white active:scale-95 shadow-md"
                  : "bg-ap-bg border-2 border-dashed border-ap-border text-ap-tertiary cursor-not-allowed",
              ].join(" ")}>
              + {t.addBill}
            </button>
          </div>
        </div>
      </div>}
    </div>
    </>
  );
}
