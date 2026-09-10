"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AudioPlayer } from "./AudioPlayer";
import { CATEGORIES, type Category } from "@/lib/categories";
import { DURATIONS, scoreForAttempt } from "@/lib/game";
import type { DailyStats } from "@/lib/daily-stats";
import { NextSongCountdown, PersonalStats } from "./PersonalStats";

type Song = { id: number; artist: string; title: string };
type Answer = { artist: string; title: string; sourceUrl?: string | null; soundcloudUrl?: string | null };
type DailyResponse = { error?: string; ready: boolean; development: boolean; date: string; challengeNumber: number; proof: string; audioUrl?: string | null };
type GuessResponse = { error?: string; correct: boolean; artistMatch: boolean; answer?: Answer; proof: string };
type Entry = { type: "wrong" | "skip" | "artist" | "correct"; song?: Song };
type Saved = {
  attempt: number;
  guesses: number[];
  entries: Entry[];
  completed: boolean;
  won: boolean;
  answer?: Answer;
  proof?: string;
};

const empty: Saved = { attempt: 0, guesses: [], entries: [], completed: false, won: false };
let dailyRequestQueue: Promise<void> = Promise.resolve();
const dailyRequests = new Map<Category, { expiresAt: number; request: Promise<DailyResponse> }>();

function proofIdentity(token: unknown) {
  if (typeof token !== "string") return null;
  try {
    const payload = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload + "=".repeat((4 - payload.length % 4) % 4))) as Record<string, unknown>;
    return typeof decoded.playerId === "string" && typeof decoded.date === "string" && typeof decoded.category === "string"
      ? { playerId: decoded.playerId, date: decoded.date, category: decoded.category }
      : null;
  } catch { return null; }
}

function restoreSaved(raw: string | null, freshProof: string, date: string, category: Category): Saved {
  const reset = { ...empty, proof: freshProof };
  if (!raw) return reset;
  try {
    const saved = JSON.parse(raw) as Partial<Saved>;
    const attempt = saved.attempt;
    const entries = saved.entries;
    const guesses = saved.guesses;
    const currentIdentity = proofIdentity(freshProof);
    const savedIdentity = proofIdentity(saved.proof);
    if (!Number.isInteger(attempt) || Number(attempt) < 0 || Number(attempt) > 6
      || !Array.isArray(entries) || entries.length !== attempt
      || !Array.isArray(guesses) || !guesses.every(Number.isInteger)
      || typeof saved.completed !== "boolean" || typeof saved.won !== "boolean"
      || !currentIdentity || !savedIdentity
      || currentIdentity.playerId !== savedIdentity.playerId
      || savedIdentity.date !== date || savedIdentity.category !== category) return reset;
    return { ...empty, ...saved, attempt: Number(attempt), entries, guesses, proof: saved.proof } as Saved;
  } catch { return reset; }
}

function loadDaily(category: Category) {
  const cached = dailyRequests.get(category);
  if (cached && cached.expiresAt > Date.now()) return cached.request;
  const request = dailyRequestQueue.then(async () => {
    const response = await fetch(`/api/daily?category=${category}`);
    const data = await response.json() as DailyResponse;
    if (!response.ok || data.error) throw new Error(data.error || "Could not load today's challenge.");
    return data;
  });
  dailyRequestQueue = request.then(() => undefined, () => undefined);
  dailyRequests.set(category, { expiresAt: Date.now() + 5_000, request });
  void request.catch(() => dailyRequests.delete(category));
  return request;
}

function DailyStatsPanel({ stats, loading }: { stats?: DailyStats; loading: boolean }) {
  if (loading) return <section className="daily-stats" aria-live="polite"><p className="muted">Loading today’s results…</p></section>;
  if (!stats) return null;

  const percentage = (count: number) => stats.totalPlayers ? `${Math.max((count / stats.totalPlayers) * 100, count ? 3 : 0)}%` : "0%";

  return <section className="daily-stats" aria-labelledby="daily-stats-title">
    <div className="daily-stats-heading">
      <h3 id="daily-stats-title">Today’s players</h3>
      <p><strong>{stats.solvedPlayers}</strong> of <strong>{stats.totalPlayers}</strong> solved</p>
    </div>
    <div className="stats-chart" aria-label="Completed rounds by attempt">
      {stats.attempts.map((count, index) => <div className="stat-row" key={index} aria-label={`${count} players solved on attempt ${index + 1}`}>
        <span>{index + 1}</span>
        <span className="stat-track"><span className="stat-fill" style={{ width: percentage(count) }} /></span>
        <strong>{count}</strong>
      </div>)}
      <div className="stat-row loss" aria-label={`${stats.losses} players did not solve today’s song`}>
        <span>×</span>
        <span className="stat-track"><span className="stat-fill" style={{ width: percentage(stats.losses) }} /></span>
        <strong>{stats.losses}</strong>
      </div>
    </div>
    <p className="stats-caption">Attempt number · completed players</p>
  </section>;
}
function ResultDialog({ game, number, stats, statsLoading, date, onClose, onShare }: {
  date?: string;
  game: Saved;
  number?: number;
  stats?: DailyStats;
  statsLoading: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const answer = game.answer;
  const [showEmbed, setShowEmbed] = useState(false);
  if (!answer) return null;
  const embedUrl = answer.soundcloudUrl
    ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(answer.soundcloudUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`
    : null;

  return <div className="dialog-backdrop">
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <p className="eyebrow">BalkanGuess #{number}</p>
      <h2 id="result-title">{game.won ? "You got it!" : "Game over"}</h2>
      <p className="song-answer">{answer.title}</p>
      <p className="muted">by {answer.artist}</p>
      {game.won && <p><strong>{scoreForAttempt(game.attempt - 1)} points</strong></p>}
      <DailyStatsPanel stats={stats} loading={statsLoading} />
      <NextSongCountdown date={date} />
      {embedUrl && !showEmbed && <button className="secondary" onClick={() => setShowEmbed(true)}>LOAD SOUNDCLOUD PLAYER</button>}
      {embedUrl && showEmbed && <iframe
        className="soundcloud-embed"
        title={`${answer.title} by ${answer.artist} on SoundCloud`}
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={embedUrl}
      />}
      {answer.sourceUrl && <a className="track-link" href={answer.sourceUrl} target="_blank" rel="noreferrer">Open original video</a>}
      {answer.soundcloudUrl && <a className="track-link" href={answer.soundcloudUrl} target="_blank" rel="noreferrer">Open track on SoundCloud</a>}
      <div className="actions">
        <button className="secondary" onClick={onShare}>SHARE RESULT</button>
        <button className="secondary" onClick={onClose}>CLOSE</button>
      </div>
    </section>
  </div>;
}
export function Game() {
  const [category, setCategory] = useState<Category>("club-mix");
  return <><nav className="category-tabs" aria-label="Music categories">{CATEGORIES.map(item => <button key={item.id} className="secondary" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</nav><CategoryGame key={category} category={category} /></>;
}
function CategoryGame({ category }: { category: Category }) {
  const [ready, setReady] = useState(false);
  const [development, setDevelopment] = useState(false);
  const [date, setDate] = useState<string>();
  const [number, setNumber] = useState<number>();
  const [audioUrl, setAudioUrl] = useState<string>();
  const [game, setGame] = useState<Saved>(empty);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Song>();
  const [highlight, setHighlight] = useState(-1);
  const [error, setError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [stats, setStats] = useState<DailyStats>();
  const [statsLoading, setStatsLoading] = useState(false);
  const [guessPending, setGuessPending] = useState(false);
  const guessPendingRef = useRef(false);
  const [initialProof, setInitialProof] = useState<string>();

  useEffect(() => {
    let active = true;
    loadDaily(category).then(data => {
      if (!active) return;
      setReady(data.ready);
      setDevelopment(data.development);
      setDate(data.date);
      setNumber(data.challengeNumber);
      setAudioUrl(data.audioUrl || undefined);
      setInitialProof(data.proof);
      const raw = localStorage.getItem(`balkanguess:v3:${category}:${data.date}`);
      setGame(restoreSaved(raw, data.proof, data.date, category));
    }).catch(() => { if (active) setError("Could not load today’s challenge."); });
    return () => { active = false; };
  }, [category]);

  useEffect(() => {
    if (date) localStorage.setItem(`balkanguess:v3:${category}:${date}`, JSON.stringify(game));
  }, [date, game, category]);

  useEffect(() => {
    if (!date || !game.completed || game.answer) return;
    fetch("/api/daily/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, category, attempt: game.attempt, proof: game.proof }),
    }).then(async response => {
      const data = await response.json() as { error?: string; answer?: Answer; proof?: string };
      if (!response.ok) {
        if (response.status === 409) setGame({ ...empty, proof: initialProof });
        throw new Error(data.error || "Could not reveal the answer.");
      }
      return data;
    }).then(data => {
      if (data.answer && data.proof) setGame(previous => ({ ...previous, answer: data.answer, proof: data.proof }));
    }).catch(() => setError("Could not reveal the answer."));
  }, [date, game.completed, game.answer, game.attempt, game.proof, category, initialProof]);

  useEffect(() => {
    if (game.completed && game.answer) setResultOpen(true);
  }, [game.completed, game.answer]);

  useEffect(() => {
    if (!date || !game.completed || !game.answer || !game.proof || development) return;
    setStatsLoading(true);
    const reportedKey = `balkanguess:stats:v1:${category}:${date}`;
    const reported = localStorage.getItem(reportedKey) === "1";
    fetch(reported ? `/api/daily/stats?category=${category}&date=${date}` : "/api/daily/stats", {
      method: reported ? "GET" : "POST",
      headers: reported ? undefined : { "Content-Type": "application/json" },
      body: reported ? undefined : JSON.stringify({ proof: game.proof }),
    }).then(response => {
      if (!response.ok) throw new Error("Could not load stats.");
      return response.json() as Promise<DailyStats>;
    }).then(value => {
      if (!reported) localStorage.setItem(reportedKey, "1");
      setStats(value);
    }).catch(() => undefined).finally(() => setStatsLoading(false));
  }, [date, game.completed, game.answer, game.proof, category, development]);

  useEffect(() => {
    if (query.trim().length < 2 || selected) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/songs/search?category=${category}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async response => {
          const data = await response.json() as Song[] | { error?: string };
          if (!response.ok || !Array.isArray(data)) throw new Error(!Array.isArray(data) && data.error ? data.error : "Search unavailable.");
          return data;
        })
        .then(items => {
          setResults(items.filter(song => !game.guesses.includes(song.id)));
          setHighlight(-1);
        }).catch(caught => {
          if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Search unavailable.");
        });
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, game.guesses, category, selected]);

  const duration = DURATIONS[Math.min(game.attempt, 5)];

  const consume = (entry: Entry, answer?: Answer, proof?: string) => setGame(previous => {
    if (previous.completed) return previous;
    const attempt = previous.attempt + 1;
    const completed = entry.type === "correct" || attempt >= 6;
    return {
      ...previous,
      attempt,
      entries: [...previous.entries, entry],
      guesses: entry.song ? [...previous.guesses, entry.song.id] : previous.guesses,
      completed,
      won: entry.type === "correct",
      answer: answer ?? previous.answer,
      proof: proof ?? previous.proof,
    };
  });

  const guess = async () => {
    if (!selected || !ready || game.completed || guessPendingRef.current) return;
    guessPendingRef.current = true;
    setGuessPending(true);
    setError("");
    try {
      const response = await fetch("/api/daily/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, category, guessedSongId: selected.id, attempt: game.attempt, proof: game.proof }),
      });
      const data = await response.json() as GuessResponse;
      if (!response.ok) {
        if (response.status === 409) setGame({ ...empty, proof: initialProof });
        throw new Error(data.error || "Could not validate guess.");
      }
      const type: Entry["type"] = data.correct ? "correct" : data.artistMatch ? "artist" : "wrong";
      consume({ type, song: selected }, data.answer, data.proof);
      setQuery("");
      setSelected(undefined);
      setResults([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit guess.");
    } finally {
      guessPendingRef.current = false;
      setGuessPending(false);
    }
  };

  const skip = () => { if (ready && !game.completed && !guessPendingRef.current) consume({ type: "skip" }); };

  const share = async () => {
    const cells = Array.from({ length: 6 }, (_, index) => {
      const entry = game.entries[index];
      return entry?.type === "correct" ? "🟩" : entry?.type === "artist" ? "🟨" : entry?.type === "wrong" ? "🟥" : entry?.type === "skip" ? "⬛" : "⬜";
    }).join("");
    const text = `BalkanGuess · ${CATEGORIES.find(item => item.id === category)?.label} #${number}\n\n${cells}\n\n${game.won ? `${scoreForAttempt(game.attempt - 1)} points` : "No score"}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setError("Result shared or copied.");
    } catch { setError("Could not share the result."); }
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setHighlight(index => Math.min(index + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight(index => Math.max(index - 1, 0)); }
    else if (event.key === "Escape") setResults([]);
    else if (event.key === "Enter") {
      event.preventDefault();
      if (highlight >= 0) {
        setSelected(results[highlight]);
        setQuery(`${results[highlight].artist} – ${results[highlight].title}`);
        setResults([]);
      } else void guess();
    }
  };

  return <>
    <section className="game" aria-label="BalkanGuess daily game">
      <header className="masthead">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>BG</span></div>
          <div>
            <div className="eyebrow">Balkan daily drop</div>
            <h1>Balkan<span>Guess</span><i aria-hidden="true">.</i></h1>
          </div>
        </div>
        <p className="daily-number"><span>EP</span> #{number ?? "…"}</p>
      </header>
      <PersonalStats category={category} date={date} development={development} result={date && game.completed && game.answer ? { date, won: game.won, attempt: game.attempt } : undefined} />
      {development && <div className="dev-notice"><p className="muted">Development preview · progress saved on this device · shared statistics disabled</p><button className="secondary" onClick={() => { setGame({ ...empty, proof: initialProof }); setQuery(""); setSelected(undefined); setResults([]); setError(""); setResultOpen(false); }}>RESET TEST ROUND</button></div>}
      {!ready && date && <p className="error" role="status">No prepared song in this category yet. Choose another category.</p>}
      <div className="card">
        <div className="card-kicker"><span>Mystery track</span><span>6 tries</span></div>
        <div className="mystery" aria-label="Hidden song title">?????</div>
        <p className="muted">Attempt {Math.min(game.attempt + 1, 6)} of 6 · {duration} second snippet</p>
        <AudioPlayer sourceUrl={audioUrl} duration={duration} disabled={!date || !ready || game.completed} onError={setError} />
        <div className="progress" aria-label={`${duration} seconds unlocked`}>
          {DURATIONS.map((_, index) => <span key={index} className={index <= game.attempt ? "on" : ""} />)}
        </div>
        {error && <p className="error" role="status">{error}</p>}

        {ready && !game.completed && <div className="search">
          <label htmlFor="song-search" className="eyebrow">Search song or artist</label>
          <input
            id="song-search"
            role="combobox"
            value={query}
            onChange={event => { setQuery(event.target.value); setSelected(undefined); }}
            onKeyDown={onKey}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="song-results"
            aria-expanded={results.length > 0}
            placeholder="Type a title or artist…"
          />
          {results.length > 0 && <ul id="song-results" className="results" role="listbox">
            {results.map((song, index) => <li key={song.id}>
              <button
                className={highlight === index ? "active" : ""}
                onMouseDown={event => event.preventDefault()}
                onClick={() => { setSelected(song); setQuery(`${song.artist} – ${song.title}`); setResults([]); }}
                role="option"
                aria-selected={highlight === index}
              >{song.artist} – {song.title}</button>
            </li>)}
          </ul>}
          <div className="actions">
            <button className="secondary" disabled={guessPending} onClick={skip}>SKIP</button>
            <button className="secondary" disabled={!selected || guessPending} onClick={() => void guess()}>{guessPending ? "SUBMITTING…" : "SUBMIT GUESS"}</button>
          </div>
        </div>}

        <div className="attempts" aria-label="Attempts">
          {Array.from({ length: 6 }, (_, index) => {
            const entry = game.entries[index];
            const className = entry?.type === "skip" ? "skip" : entry?.type === "correct" ? "win" : entry?.type === "artist" ? "artist" : entry ? "used" : "";
            const label = entry?.type === "artist" ? "Correct artist, wrong song" : undefined;
            return <div key={index} className={`attempt ${className}`} title={label} aria-label={label}>{entry?.type === "skip" ? "SKIP" : entry?.type === "correct" ? "✓" : entry?.type === "artist" ? "≈" : entry ? "×" : index + 1}</div>;
          })}
        </div>
        <ul className="history">
          {game.entries.map((entry, index) => <li key={index} className={entry.type}>{entry.type === "skip" ? "⬛ Skipped" : entry.type === "correct" ? `✓ ${entry.song?.artist} – ${entry.song?.title}` : entry.type === "artist" ? `🟨 Artist match · ${entry.song?.artist} – ${entry.song?.title}` : `✕ ${entry.song?.artist} – ${entry.song?.title}`}</li>)}
        </ul>
        {game.completed && game.answer && !resultOpen && <button className="secondary show-result" onClick={() => setResultOpen(true)}>SHOW RESULT</button>}
      </div>
    </section>
    {game.completed && resultOpen && <ResultDialog game={game} number={number} stats={stats} statsLoading={statsLoading} date={date} onClose={() => setResultOpen(false)} onShare={() => void share()} />}
  </>;
}
