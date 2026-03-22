"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Calculator, Clock3, Download, Save, Shield, Trash2 } from "lucide-react";

const STORAGE_KEY = "smc-trade-planner-journal-v1";

type Direction = "long" | "short";
type SessionBias = "london" | "new-york" | "asia" | "any";
type TabKey = "planner" | "journal" | "stats";
type AssetClass = "forex" | "gold" | "crypto";

type JournalTrade = {
  id: string;
  createdAt: string;
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  balance: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  rewardAmount: number;
  rr: number;
  positionUnits: number;
  lotSize: number;
  coinSize: number;
  checklistScore: number;
  sessionBias: SessionBias;
  notes: string;
};

type ChecklistState = {
  htfBias: boolean;
  liquiditySweep: boolean;
  chochBos: boolean;
  fvgOb: boolean;
  sessionConfluence: boolean;
  cleanInvalidation: boolean;
};

const defaultChecklist: ChecklistState = {
  htfBias: true,
  liquiditySweep: false,
  chochBos: false,
  fvgOb: false,
  sessionConfluence: true,
  cleanInvalidation: true,
};

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(digits);
}

function getPipSize(pair: string) {
  const upper = pair.toUpperCase();
  return upper.includes("JPY") ? 0.01 : 0.0001;
}

function getForexLotSize(pair: string, riskAmount: number, entry: number, stopLoss: number) {
  const pipSize = getPipSize(pair);
  const stopPips = Math.abs(entry - stopLoss) / pipSize;

  if (!Number.isFinite(stopPips) || stopPips <= 0) {
    return { lots: 0, stopPips: 0 };
  }

  const upper = pair.toUpperCase();
  const pipValuePerLot = upper.endsWith("USD") ? 10 : 10;
  const lots = riskAmount / (stopPips * pipValuePerLot);

  return { lots, stopPips };
}

function getGoldLotSize(riskAmount: number, entry: number, stopLoss: number) {
  const stopDistance = Math.abs(entry - stopLoss);

  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return { lots: 0 };
  }

  const lots = riskAmount / (stopDistance * 100);
  return { lots };
}

function getCryptoCoinSize(riskAmount: number, entry: number, stopLoss: number) {
  const stopDistance = Math.abs(entry - stopLoss);

  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return { coins: 0 };
  }

  const coins = riskAmount / stopDistance;
  return { coins };
}

function exportCSV(trades: JournalTrade[]) {
  const headers = [
    "Date",
    "Pair",
    "Asset Class",
    "Direction",
    "Balance",
    "Risk %",
    "Entry",
    "Stop Loss",
    "Take Profit",
    "Risk Amount",
    "Reward Amount",
    "R:R",
    "Position Units",
    "Lot Size",
    "Coin Size",
    "Checklist Score",
    "Session",
    "Notes",
  ];

  const rows = trades.map((t) => [
    t.createdAt,
    t.pair,
    t.assetClass,
    t.direction,
    t.balance,
    t.riskPercent,
    t.entry,
    t.stopLoss,
    t.takeProfit,
    t.riskAmount,
    t.rewardAmount,
    t.rr,
    t.positionUnits,
    t.lotSize,
    t.coinSize,
    t.checklistScore,
    t.sessionBias,
    (t.notes || "").replace(/\n/g, " "),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "smc-trade-journal.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl ${className}`}>{children}</div>;
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-5 pt-5 pb-3 md:px-6 md:pt-6">{children}</div>;
}

function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 pb-5 md:px-6 md:pb-6 ${className}`}>{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-slate-100 outline-none transition focus:border-sky-500 ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-slate-100 outline-none transition focus:border-sky-500 ${props.className || ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition focus:border-sky-500 ${props.className || ""}`}
    />
  );
}

export default function Page() {
  const [tab, setTab] = useState<TabKey>("planner");
  const [pair, setPair] = useState("XAUUSD");
  const [assetClass, setAssetClass] = useState<AssetClass>("gold");
  const [direction, setDirection] = useState<Direction>("long");
  const [balance, setBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entry, setEntry] = useState(3000);
  const [stopLoss, setStopLoss] = useState(2988);
  const [takeProfit, setTakeProfit] = useState(3024);
  const [sessionBias, setSessionBias] = useState<SessionBias>("london");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistState>(defaultChecklist);
  const [journal, setJournal] = useState<JournalTrade[]>([]);
  const [isPro] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setJournal(JSON.parse(raw));
      } catch {
        setJournal([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  }, [journal]);

  const checklistScore = useMemo(() => Object.values(checklist).filter(Boolean).length, [checklist]);

  const calculations = useMemo(() => {
    const riskAmount = balance * (riskPercent / 100);
    const stopDistance = Math.abs(entry - stopLoss);
    const targetDistance = Math.abs(takeProfit - entry);

    if (!stopDistance || stopDistance <= 0) {
      return {
        valid: false,
        riskAmount,
        stopDistance: 0,
        targetDistance,
        rr: 0,
        rewardAmount: 0,
        positionUnits: 0,
        tradeValidDirection: false,
        lotSize: 0,
        coinSize: 0,
        stopPips: 0,
      };
    }

    const tradeValidDirection =
      direction === "long"
        ? stopLoss < entry && takeProfit > entry
        : stopLoss > entry && takeProfit < entry;

    const rr = targetDistance / stopDistance;
    const rewardAmount = riskAmount * rr;
    const positionUnits = riskAmount / stopDistance;

    let lotSize = 0;
    let coinSize = 0;
    let stopPips = 0;

    if (assetClass === "forex") {
      const forex = getForexLotSize(pair, riskAmount, entry, stopLoss);
      lotSize = forex.lots;
      stopPips = forex.stopPips;
    }

    if (assetClass === "gold") {
      const gold = getGoldLotSize(riskAmount, entry, stopLoss);
      lotSize = gold.lots;
    }

    if (assetClass === "crypto") {
      const crypto = getCryptoCoinSize(riskAmount, entry, stopLoss);
      coinSize = crypto.coins;
    }

    return {
      valid: true,
      riskAmount,
      stopDistance,
      targetDistance,
      rr,
      rewardAmount,
      positionUnits,
      tradeValidDirection,
      lotSize,
      coinSize,
      stopPips,
    };
  }, [assetClass, balance, riskPercent, pair, entry, stopLoss, takeProfit, direction]);

  const setupGrade = useMemo(() => {
    const rrOk = calculations.rr >= 2;
    const checklistOk = checklistScore >= 4;
    const directionOk = calculations.tradeValidDirection;

    if (rrOk && checklistOk && directionOk && checklistScore >= 5) return "A setup";
    if (rrOk && checklistOk && directionOk) return "B setup";
    if (directionOk) return "Needs more confluence";
    return "Invalid structure";
  }, [calculations.rr, calculations.tradeValidDirection, checklistScore]);

  const saveTrade = () => {
    if (!isPro) return;
    if (!calculations.valid || !calculations.tradeValidDirection) return;

    const trade: JournalTrade = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      pair,
      assetClass,
      direction,
      balance,
      riskPercent,
      entry,
      stopLoss,
      takeProfit,
      riskAmount: calculations.riskAmount,
      rewardAmount: calculations.rewardAmount,
      rr: calculations.rr,
      positionUnits: calculations.positionUnits,
      lotSize: calculations.lotSize,
      coinSize: calculations.coinSize,
      checklistScore,
      sessionBias,
      notes,
    };

    setJournal((prev) => [trade, ...prev]);
  };

  const deleteTrade = (id: string) => {
    setJournal((prev) => prev.filter((t) => t.id !== id));
  };

  const winRateNeeded = calculations.rr > 0 ? 100 / (1 + calculations.rr) : 0;
  const totalTrades = journal.length;
  const avgRR = totalTrades ? journal.reduce((sum, trade) => sum + trade.rr, 0) / totalTrades : 0;
  const avgChecklist = totalTrades ? journal.reduce((sum, trade) => sum + trade.checklistScore, 0) / totalTrades : 0;

  const checklistItems: Array<{ key: keyof ChecklistState; label: string }> = [
    { key: "htfBias", label: "Higher-timeframe bias aligned" },
    { key: "liquiditySweep", label: "Liquidity sweep confirmed" },
    { key: "chochBos", label: "CHoCH / BOS confirmed" },
    { key: "fvgOb", label: "FVG / Order block confluence" },
    { key: "sessionConfluence", label: "London or New York session confluence" },
    { key: "cleanInvalidation", label: "Clean invalidation level" },
  ];

  const sizeLabel = assetClass === "crypto" ? "Coin Size" : "Lot Size";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
              MVP • Smart Money Tool
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">SMC Trade Planner</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Plan trades, calculate risk, score confluence, and save your setups locally.
            </p>

            {!isPro && (
  <>
    <div className="mt-4">
      <a
        href="https://techviralhub.gumroad.com/l/cllide"
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded-xl bg-orange-500 px-6 py-3 font-semibold text-black transition hover:bg-orange-400"
      >
        🔓 Unlock Pro — One-time €9
      </a>
    </div>

    <div className="mt-4 text-sm text-slate-300 space-y-1">
      <p>✔ Save trade setups</p>
      <p>✔ Trade journal</p>
      <p>✔ CSV export</p>
      <p>✔ Stats dashboard</p>
    </div>
  </>
)}
          </div>

          <div className="grid w-full grid-cols-2 gap-3 md:w-auto md:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-400">Risk Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(calculations.riskAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-400">R:R</p>
                <p className="text-lg font-semibold">1 : {formatNumber(calculations.rr)}</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="pt-5">
                <p className="text-xs text-slate-400">Setup Grade</p>
                <p className="text-lg font-semibold">{setupGrade}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2">
          {(["planner", "journal", "stats"] as TabKey[]).map((item) => {
            const locked = !isPro && (item === "journal" || item === "stats");

            return (
              <button
                key={item}
                onClick={() => !locked && setTab(item)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                  locked
                    ? "cursor-not-allowed bg-slate-800 text-slate-500"
                    : tab === item
                    ? "bg-sky-500 text-slate-950"
                    : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item} {locked && "🔒"}
              </button>
            );
          })}
        </section>

        {tab === "planner" && (
          <section className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Calculator className="h-5 w-5" />
                  Trade Calculator
                </h2>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Asset Class</label>
                    <Select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
                      <option value="forex">Forex</option>
                      <option value="gold">Gold (XAUUSD)</option>
                      <option value="crypto">Crypto</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Pair / Asset</label>
                    <Input value={pair} onChange={(e) => setPair(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Direction</label>
                    <Select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Account Balance</label>
                    <Input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Risk %</label>
                    <Input type="number" step="0.1" value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Entry</label>
                    <Input type="number" step="0.01" value={entry} onChange={(e) => setEntry(Number(e.target.value))} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Stop Loss</label>
                    <Input type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm text-slate-300">Take Profit</label>
                    <Input type="number" step="0.01" value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="rounded-2xl bg-slate-950">
                    <CardContent className="pt-5">
                      <p className="text-sm text-slate-400">Stop Distance</p>
                      <p className="text-2xl font-semibold">{formatNumber(calculations.stopDistance)}</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-slate-950">
                    <CardContent className="pt-5">
                      <p className="text-sm text-slate-400">Target Distance</p>
                      <p className="text-2xl font-semibold">{formatNumber(calculations.targetDistance)}</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-slate-950">
                    <CardContent className="pt-5">
                      <p className="text-sm text-slate-400">{sizeLabel}</p>
                      <p className="text-2xl font-semibold">
                        {assetClass === "crypto"
                          ? formatNumber(calculations.coinSize, 4)
                          : formatNumber(calculations.lotSize, 3)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-slate-950">
                    <CardContent className="pt-5">
                      <p className="text-sm text-slate-400">Est. Reward</p>
                      <p className="text-2xl font-semibold">{formatCurrency(calculations.rewardAmount)}</p>
                    </CardContent>
                  </Card>

                  {assetClass === "forex" && (
                    <Card className="rounded-2xl bg-slate-950 md:col-span-2 xl:col-span-4">
                      <CardContent className="pt-5">
                        <p className="text-sm text-slate-400">Stop Distance (Pips)</p>
                        <p className="text-2xl font-semibold">{formatNumber(calculations.stopPips, 1)}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="rounded-2xl bg-slate-950">
                    <CardContent className="pt-5">
                      <p className="mb-1 text-sm text-slate-400">Trade Logic</p>
                      <p className={`font-medium ${calculations.tradeValidDirection ? "text-emerald-400" : "text-rose-400"}`}>
                        {calculations.tradeValidDirection
                          ? "Structure is valid for selected direction"
                          : "Check entry / stop / take profit for the selected direction"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-slate-950">
                    <CardContent className="pt-5">
                      <p className="mb-1 text-sm text-slate-400">Minimum Win Rate Needed</p>
                      <p className="font-medium text-sky-400">{formatNumber(winRateNeeded)}%</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Shield className="h-5 w-5" />
                    SMC Checklist
                  </h2>
                </CardHeader>

                <CardContent className="space-y-4">
                  {checklistItems.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                      <input
                        type="checkbox"
                        checked={checklist[item.key]}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        className="h-4 w-4 accent-sky-500"
                      />
                      <span className="text-sm text-slate-200">{item.label}</span>
                    </label>
                  ))}

                  <div className="rounded-2xl border border-sky-900 bg-sky-950/40 p-4">
                    <p className="text-sm text-slate-400">Checklist Score</p>
                    <p className="text-2xl font-semibold">{checklistScore} / 6</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Clock3 className="h-5 w-5" />
                    Session + Notes
                  </h2>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Preferred Session</label>
                    <Select value={sessionBias} onChange={(e) => setSessionBias(e.target.value as SessionBias)}>
                      <option value="london">London</option>
                      <option value="new-york">New York</option>
                      <option value="asia">Asia</option>
                      <option value="any">Any</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Why this setup makes sense, liquidity target, HTF bias, invalidation..."
                      className="min-h-[120px]"
                    />
                  </div>

                  <button
                    onClick={saveTrade}
                    disabled={!isPro}
                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-500 px-4 text-base font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Trade Setup
                  </button>

                  {!isPro && (
                    <p className="mt-2 text-center text-sm text-orange-400">
                      🔒 Save & Journal available in Pro (€9)
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {tab === "journal" && isPro && (
          <section>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-xl font-semibold">Trade Journal</h2>

                  <button
                    onClick={() => isPro && exportCSV(journal)}
                    disabled={!isPro}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-4 font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </CardHeader>

              <CardContent>
                {journal.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
                    No saved trades yet. Plan one in the Planner tab and save it.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {journal.map((trade) => (
                      <div key={trade.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 md:p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-300">{trade.pair}</span>
                              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{trade.assetClass}</span>
                              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{trade.direction}</span>
                              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{trade.sessionBias}</span>
                            </div>
                            <p className="text-sm text-slate-400">{new Date(trade.createdAt).toLocaleString()}</p>
                          </div>

                          <button
                            onClick={() => deleteTrade(trade.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-900 hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">Entry:</span> {trade.entry}</div>
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">SL:</span> {trade.stopLoss}</div>
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">TP:</span> {trade.takeProfit}</div>
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">R:R:</span> 1:{formatNumber(trade.rr)}</div>
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">Risk:</span> {formatCurrency(trade.riskAmount)}</div>
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">Reward:</span> {formatCurrency(trade.rewardAmount)}</div>
                          <div className="rounded-xl bg-slate-900 p-3">
                            <span className="text-slate-400">Lot/Coin:</span>{" "}
                            {trade.assetClass === "crypto" ? formatNumber(trade.coinSize, 4) : formatNumber(trade.lotSize, 3)}
                          </div>
                          <div className="rounded-xl bg-slate-900 p-3"><span className="text-slate-400">Checklist:</span> {trade.checklistScore}/6</div>
                        </div>

                        {trade.notes ? (
                          <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-sm text-slate-300">
                            {trade.notes}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {tab === "stats" && isPro && (
          <section className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <BarChart3 className="h-5 w-5" />
                  Total Trades
                </h2>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{totalTrades}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Average R:R</h2>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">1:{formatNumber(avgRR)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Average Checklist</h2>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{formatNumber(avgChecklist)}</p>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}