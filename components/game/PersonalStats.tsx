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

export function PersonalStats({ category, date, development, result }: {
  category: Category; date?: string; development: boolean; result?: PersonalResult;
}) {
  const [results, setResults] = useState<Partial<Record<Category, PersonalResult[]>>>({});
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [today, setToday] = useState("");
  const [closing, setClosing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>(category);
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
        const saved: Partial<Record<Category, PersonalResult[]>> = {};
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          const owner = CATEGORIES.find(item => key?.startsWith(`balkanguess:personal:v1:${development ? "preview:" : ""}${item.id}:`));
          if (!owner || !key) continue;
          const value = parsePersonalResult(localStorage.getItem(key));
          if (value && key === `balkanguess:personal:v1:${development ? "preview:" : ""}${owner.id}:${value.date}`) (saved[owner.id] ??= []).push(value);
        }
        setResults(saved);
        setStorageAvailable(true);
      } catch { setStorageAvailable(false); }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [prefix, resultDate, won, attempt, development]);
  const open = () => { setActiveCategory(category); setClosing(false); dialog.current?.showModal(); };
  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => { dialog.current?.close(); setClosing(false); }, 180);
  };
  const active = CATEGORIES.find(item => item.id === activeCategory) ?? CATEGORIES[0];
  return <><div className="stats-toolbar"><button className="secondary" onClick={open}>YOUR STATS</button></div><dialog ref={dialog} className={`dialog personal-dialog all-category-stats${closing ? " is-closing" : ""}`} aria-labelledby="personal-stats-title" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="stats-dialog-head">
      <div><h2 id="personal-stats-title">Your stats</h2><p className="muted">Switch category to compare your progress.</p></div>
      <button type="button" className="stats-close" onClick={close} aria-label="Close stats">×</button>
    </div>
    <div className="stats-category-tabs" role="tablist" aria-label="Statistics category">
      {CATEGORIES.map(item => <button key={item.id} id={`stats-tab-${item.id}`} type="button" role="tab" aria-selected={activeCategory === item.id} aria-controls="stats-category-panel" onClick={() => setActiveCategory(item.id)}>{item.label}</button>)}
    </div>
    <div id="stats-category-panel" role="tabpanel" aria-labelledby={`stats-tab-${active.id}`}>
      <CategoryStats label={active.label} results={results[active.id] ?? []} today={today} />
    </div>
    <div className="stats-dialog-footer">
      <p className="stats-note">{storageAvailable ? `${development ? "Preview stats · " : ""}Saved on this device.` : "Browser storage is unavailable."}</p>
      <NextSongCountdown date={date} />
      <form><button type="button" className="secondary" onClick={close}>DONE</button></form>
    </div>
  </dialog></>;
}

function CategoryStats({ label, results, today }: { label: string; results: PersonalResult[]; today: string }) {
  const stats = summarizePersonalResults(results, today);
  const maximum = Math.max(1, ...stats.attempts);
  return <section className="personal-stats" aria-label={`${label} statistics`}>
    <h3 className="category-stats-title">{label}</h3>
    <dl className="personal-metrics">{[[stats.played, "Played"], [`${stats.winRate}%`, "Win rate"], [stats.currentStreak, "Current streak"], [stats.bestStreak, "Best streak"]].map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>Guess distribution</h4>
    <div className="stats-chart">{stats.attempts.map((count, index) => <div className="stat-row" key={index} aria-label={`${count} wins in ${index + 1} guesses`}><span>{index + 1}</span><span className="stat-track"><span className="stat-fill" style={{ width: `${count / maximum * 100}%` }} /></span><strong>{count}</strong></div>)}</div>
    {!stats.played && <p className="muted">Finish a daily challenge to start your stats.</p>}
  </section>;
}
