"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { nextZagrebMidnight, parsePersonalResult, summarizePersonalResults, type PersonalResult } from "@/lib/personal-stats";

export function NextSongCountdown({ date }: { date?: string }) {
  const [remaining, setRemaining] = useState<number>();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let boundary = nextZagrebMidnight(new Date());
    const update = () => {
      const now = new Date();
      if (now.getTime() >= boundary) boundary = nextZagrebMidnight(now);
      setRemaining(Math.ceil((boundary - now.getTime()) / 1000));
      setAvailable(Boolean(date && getCurrentChallengeDate(now) > date));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [date]);
  const time = remaining === undefined ? "--:--:--" : [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60].map(value => String(value).padStart(2, "0")).join(":");
  return <div className="next-song">{available ? <button className="secondary" onClick={() => window.location.reload()}>LOAD TODAY’S CHALLENGE</button> : <><span>Next song · Zagreb midnight</span><strong>{time}</strong></>}</div>;
}

export function PersonalStats({ category, date, development, result, inline = false }: {
  category: Category; date?: string; development: boolean; result?: PersonalResult; inline?: boolean;
}) {
  const [results, setResults] = useState<PersonalResult[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [today, setToday] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = `balkanguess:personal:v1:${development ? "preview:" : ""}${category}:`;
  const resultDate = result?.date, won = result?.won, attempt = result?.attempt;
  useEffect(() => {
    const refresh = () => {
      setToday(getCurrentChallengeDate());
      try {
        if (resultDate && won !== undefined && attempt !== undefined) {
          const key = prefix + resultDate;
          if (!parsePersonalResult(localStorage.getItem(key))) localStorage.setItem(key, JSON.stringify({ date: resultDate, won, attempt }));
        }
        const saved: PersonalResult[] = [];
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (!key?.startsWith(prefix)) continue;
          const value = parsePersonalResult(localStorage.getItem(key));
          if (value && key === prefix + value.date) saved.push(value);
        }
        setResults(saved);
        setStorageAvailable(true);
      } catch { setStorageAvailable(false); }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); clearInterval(timer); };
  }, [prefix, resultDate, won, attempt]);
  const stats = summarizePersonalResults(results, today);
  const maximum = Math.max(1, ...stats.attempts);
  const panel = <section className="personal-stats" aria-label="Your statistics">
    <p className="eyebrow">{CATEGORIES.find(item => item.id === category)?.label}</p>
    <h2>Your stats</h2>
    <dl className="personal-metrics">{[[stats.played, "Played"], [`${stats.winRate}%`, "Win rate"], [stats.currentStreak, "Current streak"], [stats.bestStreak, "Best streak"]].map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h3>Guess distribution</h3>
    <div className="stats-chart">{stats.attempts.map((count, index) => <div className="stat-row" key={index} aria-label={`${count} wins in ${index + 1} guesses`}><span>{index + 1}</span><span className="stat-track"><span className="stat-fill" style={{ width: `${count / maximum * 100}%` }} /></span><strong>{count}</strong></div>)}</div>
    {!stats.played && <p className="muted">Finish a daily challenge to start your stats.</p>}
    <p className="stats-note">{storageAvailable ? `${development ? "Preview stats. " : ""}Saved in this browser. Win on consecutive days to build a streak.` : "Browser storage is unavailable. Your stats cannot be saved."}</p>
    <NextSongCountdown date={date} />
  </section>;
  if (inline) return panel;
  return <><div className="stats-toolbar"><NextSongCountdown date={date} /><button className="secondary" onClick={() => dialog.current?.showModal()}>YOUR STATS</button></div><dialog ref={dialog} className="dialog personal-dialog" aria-label="Your personal statistics">{panel}<form method="dialog"><button className="secondary">CLOSE</button></form></dialog></>;
}
