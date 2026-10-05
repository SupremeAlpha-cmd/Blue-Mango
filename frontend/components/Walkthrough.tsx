"use client";

import { IconLock, IconCheck, IconMango, IconArrowRight, IconShield, MANGO_STATE_COLORS } from "@/components/icons";

/** Mini filled-form mockups for the landing walkthrough. Pure JSX/CSS, wooden theme. */

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="wt-field">
      <span className="wt-label">{label}</span>
      <span className={`wt-value${mono ? " mono" : ""}`}>{value}</span>
    </div>
  );
}

function StepShell({
  n,
  title,
  text,
  children,
}: {
  n: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wt-step">
      <div className="wt-copy">
        <span className="wt-num">{n}</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <div className="wt-mock">{children}</div>
    </div>
  );
}

export default function Walkthrough() {
  return (
    <section id="walkthrough" className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <h2 className="section-title">See exactly how a deal grows.</h2>
        <p className="section-sub">
          A real deal, step by step — with the forms filled in, so you know what to expect
          before you plant your first one.
        </p>

        <div className="wt-list">
          {/* 1 — CREATE */}
          <StepShell
            n="01"
            title="Create the deal"
            text="The payer fills one form: who gets paid, who arbitrates, and what each milestone is worth. No legalese."
          >
            <div className="wt-card">
              <Field label="Deal title" value="Website redesign" />
              <Field label="Payee" value="0x2aC2…D3b8" mono />
              <Field label="Arbiter" value="0x7099…79C8" mono />
              <div className="wt-milestones">
                <div className="wt-ms">
                  <span>Design logo</span>
                  <b>20 USDG</b>
                </div>
                <div className="wt-ms">
                  <span>Build landing page</span>
                  <b>30 USDG</b>
                </div>
              </div>
              <div className="wt-total">
                <span>Locked total</span>
                <b>50 USDG</b>
              </div>
              <div className="wt-btn">Plant the deal</div>
            </div>
          </StepShell>

          {/* 2 — LOCK */}
          <StepShell
            n="02"
            title="Lock the funds"
            text="The payer approves the contract to pull 50 USDG, then funds the deal. The money leaves the wallet and sits in the tree trunk — visible to everyone, touchable by no one."
          >
            <div className="wt-card wt-center">
              <div className="wt-lockrow">
                <span className="wt-ico">
                  <IconCheck size={18} />
                </span>
                <span>
                  Approved <b className="mono">50 USDG</b>
                </span>
              </div>
              <div className="wt-trunk">
                <IconLock size={26} />
                <b>50 USDG</b>
                <span>locked in contract</span>
              </div>
              <div className="wt-note">0x3943…CaBec · Robinhood testnet</div>
            </div>
          </StepShell>

          {/* 3 — DELIVER */}
          <StepShell
            n="03"
            title="Deliver branch by branch"
            text="The payee ships the logo and marks the branch done. The mango turns vivid blue — everyone can see progress ripening in real time."
          >
            <div className="wt-card">
              <div className="wt-branch done">
                <span className="wt-mango-ico" style={{ color: MANGO_STATE_COLORS[1] }}>
                  <IconMango size={22} />
                </span>
                <span className="wt-binfo">
                  <b>Design logo</b>
                  <span>20 USDG · marked done</span>
                </span>
                <span className="wt-pill done">Done</span>
              </div>
              <div className="wt-branch">
                <span className="wt-mango-ico" style={{ color: MANGO_STATE_COLORS[0] }}>
                  <IconMango size={22} />
                </span>
                <span className="wt-binfo">
                  <b>Build landing page</b>
                  <span>30 USDG · in progress</span>
                </span>
                <span className="wt-pill">Pending</span>
              </div>
              <div className="wt-btn ghost">Mark done</div>
            </div>
          </StepShell>

          {/* 4 — RELEASE */}
          <StepShell
            n="04"
            title="Release the mango"
            text="The payer approves the finished logo. 20 USDG flows straight to the payee — no invoices, no waiting, no stories. The mango turns gold."
          >
            <div className="wt-card wt-center">
              <div className="wt-flow">
                <span className="wt-mango-ico" style={{ color: MANGO_STATE_COLORS[3] }}>
                  <IconMango size={26} />
                </span>
                <IconArrowRight size={20} />
                <span className="wt-amt">
                  <b>20 USDG</b>
                  <span>to 0x2aC2…D3b8</span>
                </span>
              </div>
              <div className="wt-lockrow">
                <span className="wt-ico">
                  <IconShield size={18} />
                </span>
                <span>Disagree? The arbiter rules — the contract enforces it.</span>
              </div>
              <div className="wt-btn">Approve &amp; release</div>
            </div>
          </StepShell>
        </div>
      </div>
    </section>
  );
}
