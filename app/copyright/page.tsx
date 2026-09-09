import type { Metadata } from "next";
import Link from "next/link";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export const metadata: Metadata = {
  title: "Copyright & Takedowns | BalkanGuess",
  description: "How to report copyright concerns on BalkanGuess.",
};

export default function CopyrightPage() {
  return <main className="legal-page">
    <Link className="legal-back" href="/">← Back to BalkanGuess</Link>
    <p className="eyebrow">Legal</p>
    <h1>Copyright & takedown policy</h1>
    <p className="legal-updated">Last updated: September 9, 2026</p>

    <section>
      <h2>Our approach</h2>
      <p>We respect intellectual-property rights. If a rights holder tells us that material on BalkanGuess infringes their rights, we will review the report and may promptly remove or disable access to the identified material.</p>
    </section>
    <section>
      <h2>How to send a takedown request</h2>
      {contactEmail ? <p>Email your request to <a href={`mailto:${contactEmail}`}>{contactEmail}</a> with the subject line “Copyright takedown request.”</p> : <p>The contact email has not yet been configured. The site operator must publish a monitored copyright-contact address before launch.</p>}
      <p>Please include:</p>
      <ul>
        <li>Your full name, organisation (if applicable), and a way to contact you;</li>
        <li>Identification of the copyrighted work or other right you believe has been infringed;</li>
        <li>The exact BalkanGuess page, track, or URL to be reviewed;</li>
        <li>A statement that you have a good-faith belief the use is not authorised by the rightsholder, its agent, or the law;</li>
        <li>A statement that the information is accurate and that you are the rightsholder or authorised to act for them; and</li>
        <li>Your physical or electronic signature.</li>
      </ul>
    </section>
    <section>
      <h2>What happens next</h2>
      <p>We will acknowledge a complete request when reasonably possible, investigate it, and take appropriate action. We may request more information where a notice is incomplete or unclear. Repeatedly abusive or fraudulent reports may be rejected.</p>
    </section>
    <section>
      <h2>Counter-notices</h2>
      <p>If you believe material was removed in error, contact us with the relevant URL, an explanation, your contact information, and a signed statement supporting your position. We will review it in line with applicable law.</p>
    </section>
  </main>;
}
