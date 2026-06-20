import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How the verbatra documentation site handles your data.",
  robots: { index: true },
};

const UMAMI_DOCS = "https://umami.is/docs/";
const GITHUB_REPO = "https://github.com/mariokreitz/verbatra";
const GITHUB_PRIVACY =
  "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement";

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-3xl px-6 py-16 prose">
      <h1>Privacy policy</h1>
      <p>
        <em>Last updated: 2026-06-21</em>
      </p>

      <h2>1. Responsible party</h2>
      <p>
        The party responsible for data processing on this site is Mario Kreitz, Germany. You can
        reach us by email at <a href="mailto:mario.kreitz@web.de">mario.kreitz@web.de</a>.
      </p>

      <h2>2. Overview</h2>
      <p>
        This site is built to respect your privacy. It sets no cookies, runs no cross-site tracking,
        and collects only the minimal data needed to operate the site and understand aggregate
        usage. The sections below explain exactly what is processed and why.
      </p>

      <h2>3. Server logs and hosting</h2>
      <p>
        The site is self-hosted on a virtual server (managed with Dokploy). When you visit, the
        server processes standard access logs that may include your IP address, the date and time of
        the request, the requested URL, the referring page, and your browser&apos;s user-agent
        string. This data is used to operate and secure the site &mdash; for example, to deliver
        pages, diagnose errors, and defend against abuse. The legal basis is Art. 6(1)(f) GDPR (our
        legitimate interest in a secure, functioning service). These logs are retained only for a
        short period.
      </p>

      <h2>4. Analytics</h2>
      <p>
        We use Umami, a privacy-friendly analytics tool that we self-host. Umami is{" "}
        <strong>
          cookieless and does not collect personal data or use cross-site fingerprinting
        </strong>
        . It records only aggregated metrics such as page views, referrers, approximate country, and
        browser, operating system, and device type. The legal basis is Art. 6(1)(f) GDPR (our
        legitimate interest in understanding how the site is used). You can read more about Umami in
        its <a href={UMAMI_DOCS}>documentation</a>.
      </p>

      <h2>5. Cookies</h2>
      <p>
        This site sets no cookies. Because nothing requiring consent is stored on your device, no
        cookie consent banner is required.
      </p>

      <h2>6. Fonts and assets</h2>
      <p>
        Fonts are self-hosted: they are bundled at build time, so no requests are made to Google
        Fonts or any other third party when you load a page. Apart from the self-hosted Umami script
        described above, no third-party scripts or embeds load at runtime.
      </p>

      <h2>7. GitHub</h2>
      <p>
        The project&apos;s source code, issues, and discussions are hosted on{" "}
        <a href={GITHUB_REPO}>GitHub</a>. If you choose to interact there (for example, by opening
        an issue or joining a discussion), GitHub processes your data as an independent controller
        and its <a href={GITHUB_PRIVACY}>privacy statement</a> applies.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Under the GDPR you have the rights of access, rectification, erasure, restriction of
        processing, objection, and data portability (Art. 15&ndash;21 GDPR). You also have the right
        to lodge a complaint with a supervisory authority. To exercise any of these rights, contact
        us using the details below.
      </p>

      <h2>9. Contact</h2>
      <p>
        For any privacy-related questions or requests, email{" "}
        <a href="mailto:mario.kreitz@web.de">mario.kreitz@web.de</a>.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this privacy policy as the site evolves or as legal requirements change. The
        date below reflects the most recent revision.
      </p>
      <p>
        <em>Last updated: 2026-06-21</em>
      </p>
    </main>
  );
}
