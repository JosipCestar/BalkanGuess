import Link from "next/link";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export function SiteFooter() {
  return <footer className="site-footer">
    <p>Independent, non-commercial music-guessing project. Artist names, recordings, artwork, and other third-party material belong to their respective owners.</p>
    <nav aria-label="Legal and contact links">
      <Link href="/terms">Terms</Link>
      <Link href="/copyright">Copyright & takedowns</Link>
      {contactEmail && <a href={`mailto:${contactEmail}`}>Contact</a>}
    </nav>
  </footer>;
}
