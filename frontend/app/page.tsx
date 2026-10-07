import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import HeroTree from "@/components/HeroTree";
import Walkthrough from "@/components/Walkthrough";
import {
  IconLock,
  IconSprout,
  IconMango,
  IconCheck,
  IconShield,
  IconArrowRight,
} from "@/components/icons";

function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <img src="/logo.webp" alt="Blue-Mango logo" />
          Blue<em>-</em>Mango
        </Link>
        <div className="nav-links">
          <Link href="#how">How it works</Link>
          <Link href="#arbiter">Arbiter</Link>
          <Link href="/app" className="btn btn-primary btn-sm">
            Launch app
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

const STEPS = [
  {
    icon: <IconLock size={22} />,
    title: "Lock",
    text: "The payer creates a deal — payee, milestones with set amounts, and a trusted arbiter — then locks the full amount in SOL or SPL tokens. The tree is planted.",
  },
  {
    icon: <IconSprout size={22} />,
    title: "Deliver",
    text: "The payee ships work milestone by milestone and marks each branch done. Progress is visible to everyone, onchain, in real time.",
  },
  {
    icon: <IconMango size={22} />,
    title: "Release",
    text: "The payer approves each finished milestone and funds release instantly. Silent for 7 days? The payee can claim. Disagree? The arbiter decides.",
  },
];

export default function Landing() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <img src="/logo.webp" alt="Blue mango" className="hero-logo" />
            <h1>
              Deals grow <span className="mango-word">on trees.</span>
            </h1>
            <p className="sub">
              Blue-Mango is milestone escrow for crypto deals. Lock SOL or SPL tokens in a Solana program,
              release it branch by branch as work gets done. No middlemen, no chargebacks,
              no &ldquo;trust me bro&rdquo;.
            </p>
            <div className="hero-ctas">
              <Link href="/app" className="btn btn-primary">
                Launch the app <IconArrowRight size={17} />
              </Link>
              <a href="#how" className="btn btn-ghost">
                How it works
              </a>
            </div>
            <div className="trust-strip">
              {["No middlemen", "No chargebacks", "Arbiter-backed", "Onchain & transparent"].map((t) => (
                <span key={t}>
                  <IconCheck size={15} /> {t}
                </span>
              ))}
            </div>
          </div>
          <HeroTree />
        </div>
      </header>

      {/* HOW IT WORKS */}
      <section id="how" className="section">
        <div className="wrap">
          <h2 className="section-title">Three steps. Zero trust issues.</h2>
          <p className="section-sub">
            Every deal is a tree: the locked funds are the trunk, each milestone a branch
            bearing a blue mango. The mango ripens only when both sides agree.
          </p>
          <div className="grid-3">
            {STEPS.map((s, i) => (
              <div className="card" key={s.title}>
                <div className="step-icon">{s.icon}</div>
                <h3>
                  <span style={{ color: "var(--faint)", fontSize: 14, marginRight: 8 }}>0{i + 1}</span>
                  {s.title}
                </h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISUAL WALKTHROUGH */}
      <Walkthrough />

      {/* ARBITER */}
      <section id="arbiter" className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="band">
            <h2>
              <IconShield size={30} /> A human you both trust.
            </h2>
            <p>
              When a milestone is disputed, it goes to the arbiter you both picked when the
              deal was created. They rule — release to the payee or refund the payer — and
              the smart contract enforces it. No courts, no chargeback windows, no stories.
            </p>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2 className="section-title">Built for deals with strangers.</h2>
          <p className="section-sub">
            Freelancers and clients. OTC traders. DAOs paying contributors. Bounty hunters.
            Anyone moving crypto with people they can&rsquo;t fully trust — yet.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-final">
        <div className="wrap">
          <h2 className="section-title">Stop doing deals on trust.</h2>
          <p className="section-sub">Plant your first deal in under a minute.</p>
          <Link href="/app" className="btn btn-primary" style={{ fontSize: 17, padding: "15px 34px" }}>
            Launch Blue-Mango <IconArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <span className="fbrand">
            <IconMango size={17} style={{ color: "var(--fruit)" }} /> Blue-Mango — milestone escrow on Solana
          </span>
          <span>Settled in SOL & SPL · Secured by Solana program</span>
        </div>
      </footer>
    </>
  );
}
