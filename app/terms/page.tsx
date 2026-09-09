import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use | BalkanGuess",
  description: "Terms of use for BalkanGuess.",
};

export default function TermsPage() {
  return <main className="legal-page">
    <Link className="legal-back" href="/">← Back to BalkanGuess</Link>
    <p className="eyebrow">Legal</p>
    <h1>Terms of use</h1>
    <p className="legal-updated">Last updated: September 9, 2026</p>

    <section>
      <h2>Using BalkanGuess</h2>
      <p>BalkanGuess is an independent, non-commercial music-guessing game. You may use it for personal, lawful, non-commercial enjoyment. Do not interfere with the service, attempt to bypass its controls, or use it to infringe anyone else’s rights.</p>
    </section>
    <section>
      <h2>Third-party material</h2>
      <p>Music recordings, artist names, cover art, trademarks, and links may belong to their respective owners. BalkanGuess does not claim ownership of that material. Links or embedded players are provided to help identify a track and do not grant you any right to copy, download, redistribute, or otherwise use third-party material.</p>
    </section>
    <section>
      <h2>Availability</h2>
      <p>The game is provided as available and may change, be suspended, or be removed without notice. We do not guarantee that every track, link, or feature will remain available or error-free.</p>
    </section>
    <section>
      <h2>Copyright concerns</h2>
      <p>If you believe material on BalkanGuess infringes your copyright or another right, please use the information in our <Link href="/copyright">Copyright & takedown policy</Link>. We review good-faith reports and may remove or disable access to material while we investigate.</p>
    </section>
  </main>;
}
