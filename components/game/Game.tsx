"use client";

import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { AudioPlayer } from "./AudioPlayer";
import { CATEGORIES, type Category } from "@/lib/categories";
import { DURATIONS, scoreForAttempt } from "@/lib/game";
import type { DailyStats } from "@/lib/daily-stats";

type Song = { id: number; artist: string; title: string };
type Answer = { artist: string; title: string; sourceUrl?: string | null; soundcloudUrl?: string | null };
type DailyResponse = { error?: string; ready: boolean; development: boolean; date: string; challengeNumber: number };
type GuessResponse = { error?: string; correct: boolean; artistMatch: boolean; answer?: Answer };
type Entry = { type: "wrong" | "skip" | "artist" | "correct"; song?: Song };
type Saved = {
  attempt: number;
  guesses: number[];
  entries: Entry[];
  completed: boolean;
  won: boolean;
  answer?: Answer;
};

const empty: Saved = { attempt: 0, guesses: [], entries: [], completed: false, won: false };

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
function ResultDialog({ game, number, stats, statsLoading, onClose, onShare }: {
  game: Saved;
  number?: number;
  stats?: DailyStats;
  statsLoading: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const answer = game.answer;
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
      {embedUrl && <iframe
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
  const [game, setGame] = useState<Saved>(empty);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Song>();
  const [highlight, setHighlight] = useState(-1);
  const [error, setError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [stats, setStats] = useState<DailyStats>();
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/daily?category=${category}`).then(response => response.json() as Promise<DailyResponse>).then(data => {
      if (data.error) throw new Error(data.error);
      setReady(data.ready);
      setDevelopment(data.development);
      setDate(data.date);
      setNumber(data.challengeNumber);
      const raw = localStorage.getItem(`balkanguess:v2:${category}:${data.date}`);
      if (raw) setGame(JSON.parse(raw));
    }).catch(() => setError("Could not load today’s challenge."));
  }, [category]);

  useEffect(() => {
    if (date) localStorage.setItem(`balkanguess:v2:${category}:${date}`, JSON.stringify(game));
  }, [date, game, category]);

  useEffect(() => {
    if (!date || !game.completed || game.answer) return;
    fetch("/api/daily/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, category }),
    }).then(response => response.json() as Promise<{ answer?: Answer }>).then(data => {
      if (data.answer) setGame(previous => ({ ...previous, answer: data.answer }));
    }).catch(() => setError("Could not reveal the answer."));
  }, [date, game.completed, game.answer, category]);

  useEffect(() => {
    if (game.completed && game.answer) setResultOpen(true);
  }, [game.completed, game.answer]);

  useEffect(() => {
    if (!date || !game.completed || development) return;
    setStatsLoading(true);
    let playerId = localStorage.getItem("balkanguess:player-id");
    if (!playerId) {
      playerId = crypto.randomUUID();
      localStorage.setItem("balkanguess:player-id", playerId);
    }

    fetch("/api/daily/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, category, playerId, won: game.won, attempt: game.attempt }),
    }).then(response => {
      if (!response.ok) throw new Error("Could not load stats.");
      return response.json() as Promise<DailyStats>;
    }).then(setStats).catch(() => undefined).finally(() => setStatsLoading(false));
  }, [date, game.completed, game.won, game.attempt, category, development]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/songs/search?category=${category}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(response => response.json() as Promise<Song[]>)
        .then(items => {
          setResults(items.filter(song => !game.guesses.includes(song.id)));
          setHighlight(-1);
        }).catch(() => undefined);
    }, 150);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, game.guesses, category]);

  const duration = DURATIONS[Math.min(game.attempt, 5)];

  const consume = (entry: Entry, answer?: Answer) => setGame(previous => {
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
    };
  });

  const guess = async () => {
    if (!selected || !ready || game.completed) return;
    setError("");
    try {
      const response = await fetch("/api/daily/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, category, guessedSongId: selected.id }),
      });
      const data = await response.json() as GuessResponse;
      if (!response.ok) throw new Error(data.error || "Could not validate guess.");
      const type: Entry["type"] = data.correct ? "correct" : data.artistMatch ? "artist" : "wrong";
      consume({ type, song: selected }, data.answer);
      setQuery("");
      setSelected(undefined);
      setResults([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit guess.");
    }
  };

  const skip = () => { if (ready && !game.completed) consume({ type: "skip" }); };

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
      {development && <div className="dev-notice"><p className="muted">Development preview · progress saved on this device · shared statistics disabled</p><button className="secondary" onClick={() => { setGame(empty); setQuery(""); setSelected(undefined); setResults([]); setError(""); setResultOpen(false); }}>RESET TEST ROUND</button></div>}
      {!ready && date && <p className="error" role="status">No prepared song in this category yet. Choose another category.</p>}
      <div className="card">
        <div className="card-kicker"><span>Mystery track</span><span>6 tries</span></div>
        <div className="mystery" aria-label="Hidden song title">?????</div>
        <p className="muted">Attempt {Math.min(game.attempt + 1, 6)} of 6 · {duration} second snippet</p>
        <AudioPlayer category={category} date={date} duration={duration} disabled={!date || !ready || game.completed} onError={setError} />
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
            <button className="secondary" onClick={skip}>SKIP</button>
            <button className="secondary" disabled={!selected} onClick={() => void guess()}>SUBMIT GUESS</button>
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
    {game.completed && resultOpen && <ResultDialog game={game} number={number} stats={stats} statsLoading={statsLoading} onClose={() => setResultOpen(false)} onShare={() => void share()} />}
  </>;
}
