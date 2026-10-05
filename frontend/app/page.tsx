import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

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

export default function Landing() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <header className="hero">
        <div className="wrap">
          <img src="/logo.webp" alt="Blue mango" className="hero-logo" />
          <h1>
            Deals grow <span className="mango-word">on trees.</span>
          </h1>
          <p className="sub">
            Blue-Mango is milestone escrow for crypto deals. Lock USDG in a smart contract,
            release it branch by branch as work gets done. No middlemen, no chargebacks,
            no “trust me bro”.
          </p>
          <div className="hero-ctas">
            <Link href="/app" className="btn btn-primary">
              Launch the app
            </Link>
            <a href="#how" className="btn btn-ghost">
              How it works
            </a>
          </div>
          <div className="trust-strip">
            <span>No middlemen</span>
            <span>No chargebacks</span>
            <span>Arbiter-backed</span>
            <span>Onchain &amp; transparent</span>
          </div>
        </div>
      </header>

      {/* HOW IT WORKS */}
      <section id="how" className="section">
        <div className="wrap">
          <h2 className="section-title">Three steps. Zero trust issues.</h2>
          <p className="section-sub">
            Every deal is a tree: the locked funds are the trunk, each milestone a branch.
            Branches turn green only when both sides agree.
          </p>
          <div className="grid-3">
            <div className="card">
              <div className="step-num">01</div>
              <h3>🔒 Lock</h3>
              <p>
                The payer creates a deal — payee, milestones with set amounts, and a trusted
                arbiter — then locks the full amount in USDG. The tree is planted.
              </p>
            </div>
            <div className="card">
              <div className="step-num">02</div>
              <h3>🌿 Deliver</h3>
              <p>
                The payee ships work milestone by milestone and marks each branch done.
                Progress is visible to everyone, onchain, in real time.
              </p>
            </div>
            <div className="card">
              <div className="step-num">03</div>
              <h3>🥭 Release</h3>
              <p>
                The payer approves each finished milestone and funds release instantly.
                Silent for 7 days? The payee can claim. Disagree? The arbiter decides.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ARBITER */}
      <section id="arbiter" className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="band">
            <h2>A human you both trust. 🤝</h2>
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
            Anyone moving crypto with people they can’t fully trust — yet.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-final">
        <div className="wrap">
          <h2 className="section-title">Stop doing deals on trust.</h2>
          <p className="section-sub">Plant your first deal in under a minute.</p>
          <Link href="/app" className="btn btn-mango" style={{ fontSize: 17, padding: "15px 34px" }}>
            Launch Blue-Mango
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 10 }}>
          <span>🥭 Blue-Mango — milestone escrow on Robinhood Chain</span>
          <span>Settled in USDG · Secured by smart contract</span>
        </div>
      </footer>
    </>
  );
}
