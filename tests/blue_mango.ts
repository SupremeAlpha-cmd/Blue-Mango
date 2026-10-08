/**
 * Blue-Mango Anchor program tests.
 *
 * Run with `anchor test` on a machine with the Solana/Anchor toolchain
 * (local validator). NOT runnable in this environment — no toolchain.
 *
 * Coverage mirrors the Foundry suite (22 tests) for the Solidity contract:
 * full deal lifecycle for both SOL and SPL-token deals, plus failure cases.
 *
 * NOTE: `claim_milestone_*` success needs the validator clock warped past
 * the 7-day CLAIM_TIMEOUT, which stock `solana-test-validator` cannot do
 * per-transaction. The suite asserts the pre-timeout rejection
 * (`ClaimTooEarly`); warp the validator clock to exercise the happy path.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

// Anchor workspace program (see Anchor.toml [programs.localnet]).
// The program id is a placeholder until `anchor keys sync` at deploy time.
const PROGRAM_ID = new anchor.web3.PublicKey(
  "11111111111111111111111111111111"
);

const LAMPORTS = anchor.web3.LAMPORTS_PER_SOL;

function dealPda(dealId: number): [anchor.web3.PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(dealId));
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("deal"), buf],
    PROGRAM_ID
  );
}

function registryPda(): [anchor.web3.PublicKey, number] {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    PROGRAM_ID
  );
}

function vaultPda(deal: anchor.web3.PublicKey): [anchor.web3.PublicKey, number] {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), deal.toBuffer()],
    PROGRAM_ID
  );
}

describe("blue_mango", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  // Minimal typed handle — full IDL comes from `anchor build`.
  const program = new Program({} as any, PROGRAM_ID, provider);

  const payer = anchor.web3.Keypair.generate();
  const payee = anchor.web3.Keypair.generate();
  const arbiter = anchor.web3.Keypair.generate();
  const stranger = anchor.web3.Keypair.generate();

  let mint: anchor.web3.PublicKey;
  let payerAta: anchor.web3.PublicKey;
  let payeeAta: anchor.web3.PublicKey;

  const TOKEN_DECIMALS = 6;
  const t = (whole: number) => whole * 10 ** TOKEN_DECIMALS; // token base units

  before(async () => {
    // Fund everyone.
    for (const kp of [payer, payee, arbiter, stranger]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 10 * LAMPORTS);
      await provider.connection.confirmTransaction(sig);
    }
    // SPL mint + ATAs, mint 10_000 tokens to payer.
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      TOKEN_DECIMALS
    );
    payerAta = (
      await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, payer.publicKey)
    ).address;
    payeeAta = (
      await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, payee.publicKey)
    ).address;
    await mintTo(provider.connection, payer, mint, payerAta, payer.publicKey, t(10_000));

    await program.methods
      .initializeRegistry()
      .accounts({ registry: registryPda()[0], payer: payer.publicKey })
      .signers([payer])
      .rpc();
  });

  async function fetchDeal(dealId: number) {
    return program.account.deal.fetch(dealPda(dealId)[0]);
  }

  async function createSplDeal(
    dealId: number,
    signer = payer,
    amounts = [t(20), t(30)]
  ) {
    const [deal] = dealPda(dealId);
    const [vault] = vaultPda(deal);
    await program.methods
      .createDealSpl(
        new anchor.BN(dealId),
        payee.publicKey,
        arbiter.publicKey,
        ["Logo design", "Landing page"],
        amounts.map((a) => new anchor.BN(a))
      )
      .accounts({
        registry: registryPda()[0],
        deal,
        vault,
        payerAta,
        mint,
        payer: signer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc();
    return deal;
  }

  it("creates an SPL deal and locks funds in the vault", async () => {
    const deal = await createSplDeal(0);
    const d: any = await fetchDeal(0);
    assert.equal(d.payer.toBase58(), payer.publicKey.toBase58());
    assert.equal(d.payee.toBase58(), payee.publicKey.toBase58());
    assert.equal(d.arbiter.toBase58(), arbiter.publicKey.toBase58());
    assert.equal(d.paymentMint.toBase58(), mint.toBase58());
    assert.equal(d.total.toNumber(), t(50));
    assert.equal(d.milestoneCount, 2);

    const [vault] = vaultPda(deal);
    const v = await getAccount(provider.connection, vault);
    assert.equal(Number(v.amount), t(50));
    assert.equal(v.owner.toBase58(), deal.toBase58());
  });

  it("payee marks milestone done; payer approves and releases", async () => {
    const [deal] = dealPda(0);
    await program.methods
      .markDone(new anchor.BN(0), 0)
      .accounts({ deal, signer: payee.publicKey })
      .signers([payee])
      .rpc();

    let d: any = await fetchDeal(0);
    assert.equal(d.milestones[0].state, 1); // Done

    const before = Number((await getAccount(provider.connection, payeeAta)).amount);
    await program.methods
      .approveMilestoneSpl(new anchor.BN(0), 0)
      .accounts({
        deal,
        vault: vaultPda(deal)[0],
        recipientAta: payeeAta,
        signer: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();

    const after = Number((await getAccount(provider.connection, payeeAta)).amount);
    assert.equal(after - before, t(20));
    d = await fetchDeal(0);
    assert.equal(d.milestones[0].state, 3); // Released
    assert.equal(d.released.toNumber(), t(20));
  });

  it("rejects claim before the 7-day timeout", async () => {
    const [deal] = dealPda(0);
    // milestone 1 still Pending -> mark done first
    await program.methods
      .markDone(new anchor.BN(0), 1)
      .accounts({ deal, signer: payee.publicKey })
      .signers([payee])
      .rpc();
    try {
      await program.methods
        .claimMilestoneSpl(new anchor.BN(0), 1)
        .accounts({
          deal,
          vault: vaultPda(deal)[0],
          recipientAta: payeeAta,
          signer: payee.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payee])
        .rpc();
      assert.fail("expected ClaimTooEarly");
    } catch (e: any) {
      assert.include(e.toString(), "ClaimTooEarly");
    }
  });

  it("dispute: payee raises, arbiter refunds the payer", async () => {
    const [deal] = dealPda(0);
    await program.methods
      .raiseDispute(new anchor.BN(0), 1)
      .accounts({ deal, signer: payee.publicKey })
      .signers([payee])
      .rpc();

    let d: any = await fetchDeal(0);
    assert.equal(d.milestones[1].state, 2); // Disputed

    const payerTokenAcc = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      payer.publicKey
    );
    const before = Number((await getAccount(provider.connection, payerTokenAcc.address)).amount);
    await program.methods
      .resolveDisputeSpl(new anchor.BN(0), 1, false)
      .accounts({
        deal,
        vault: vaultPda(deal)[0],
        recipientAta: payerTokenAcc.address,
        signer: arbiter.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([arbiter])
      .rpc();
    const after = Number((await getAccount(provider.connection, payerTokenAcc.address)).amount);
    assert.equal(after - before, t(30));
    d = await fetchDeal(0);
    assert.equal(d.milestones[1].state, 4); // Refunded
    assert.equal(d.refunded.toNumber(), t(30));
  });

  it("creates a SOL deal and releases via approve", async () => {
    const dealId = 1;
    const [deal] = dealPda(dealId);
    const amount = Math.floor(0.5 * LAMPORTS);
    await program.methods
      .createDealSol(
        new anchor.BN(dealId),
        payee.publicKey,
        arbiter.publicKey,
        ["Audit"],
        [new anchor.BN(amount)]
      )
      .accounts({
        registry: registryPda()[0],
        deal,
        payer: payer.publicKey,
      })
      .signers([payer])
      .rpc();

    const d: any = await fetchDeal(dealId);
    assert.equal(d.total.toNumber(), amount);
    // payment_mint == default pubkey means native SOL
    assert.ok(d.paymentMint.equals(anchor.web3.PublicKey.default));

    await program.methods
      .markDone(new anchor.BN(dealId), 0)
      .accounts({ deal, signer: payee.publicKey })
      .signers([payee])
      .rpc();

    const before = await provider.connection.getBalance(payee.publicKey);
    await program.methods
      .approveMilestoneSol(new anchor.BN(dealId), 0)
      .accounts({
        deal,
        recipient: payee.publicKey,
        signer: payer.publicKey,
      })
      .signers([payer])
      .rpc();
    const after = await provider.connection.getBalance(payee.publicKey);
    assert.equal(after - before, amount);
  });

  it("cancel_remaining refunds only pending milestones (SOL)", async () => {
    const dealId = 2;
    const [deal] = dealPda(dealId);
    const a = Math.floor(0.1 * LAMPORTS);
    await program.methods
      .createDealSol(
        new anchor.BN(dealId),
        payee.publicKey,
        arbiter.publicKey,
        ["M1", "M2", "M3"],
        [new anchor.BN(a), new anchor.BN(a), new anchor.BN(a)]
      )
      .accounts({ registry: registryPda()[0], deal, payer: payer.publicKey })
      .signers([payer])
      .rpc();

    // M1 -> done (in-flight, must NOT be refunded)
    await program.methods
      .markDone(new anchor.BN(dealId), 0)
      .accounts({ deal, signer: payee.publicKey })
      .signers([payee])
      .rpc();

    const before = await provider.connection.getBalance(payer.publicKey);
    const sig = await program.methods
      .cancelRemainingSol(new anchor.BN(dealId))
      .accounts({ deal, recipient: payer.publicKey, signer: payer.publicKey })
      .signers([payer])
      .rpc();
    // subtract tx fee for a clean comparison
    const fee = (
      await provider.connection.getFeeForMessage(
        (await provider.connection.getTransaction(sig, { maxSupportedTransactionVersion: 0 }))
          .transaction.message
      )
    ).value;
    const after = await provider.connection.getBalance(payer.publicKey);

    const d: any = await fetchDeal(dealId);
    assert.equal(d.milestones[0].state, 1); // Done untouched
    assert.equal(d.milestones[1].state, 4); // Refunded
    assert.equal(d.milestones[2].state, 4); // Refunded
    assert.equal(d.refunded.toNumber(), 2 * a);
    assert.equal(after - before + fee, 2 * a);
  });

  // ── failure cases ────────────────────────────────────────────────

  it("rejects create when payer == payee", async () => {
    const [deal] = dealPda(3);
    try {
      await program.methods
        .createDealSol(
          new anchor.BN(3),
          payer.publicKey, // payee == payer
          arbiter.publicKey,
          ["X"],
          [new anchor.BN(1000)]
        )
        .accounts({ registry: registryPda()[0], deal, payer: payer.publicKey })
        .signers([payer])
        .rpc();
      assert.fail("expected PayerIsPayee");
    } catch (e: any) {
      assert.include(e.toString(), "PayerIsPayee");
    }
  });

  it("rejects mark_done from a non-payee", async () => {
    const [deal] = dealPda(2);
    try {
      await program.methods
        .markDone(new anchor.BN(2), 1)
        .accounts({ deal, signer: stranger.publicKey })
        .signers([stranger])
        .rpc();
      assert.fail("expected NotPayee");
    } catch (e: any) {
      assert.include(e.toString(), "NotPayee");
    }
  });

  it("rejects approve from a non-payer", async () => {
    const [deal] = dealPda(2);
    try {
      await program.methods
        .approveMilestoneSol(new anchor.BN(2), 0)
        .accounts({ deal, recipient: payee.publicKey, signer: stranger.publicKey })
        .signers([stranger])
        .rpc();
      assert.fail("expected NotPayer");
    } catch (e: any) {
      assert.include(e.toString(), "NotPayer");
    }
  });

  it("rejects double-approve of the same milestone", async () => {
    const [deal] = dealPda(1); // already released in an earlier test
    try {
      await program.methods
        .approveMilestoneSol(new anchor.BN(1), 0)
        .accounts({ deal, recipient: payee.publicKey, signer: payer.publicKey })
        .signers([payer])
        .rpc();
      assert.fail("expected NotDone");
    } catch (e: any) {
      assert.include(e.toString(), "NotDone");
    }
  });

  it("rejects resolve by a non-arbiter", async () => {
    // fresh disputed milestone on a new SPL deal
    const dealId = 4;
    await createSplDeal(dealId, payer, [t(5)]);
    const [deal] = dealPda(dealId);
    await program.methods
      .markDone(new anchor.BN(dealId), 0)
      .accounts({ deal, signer: payee.publicKey })
      .signers([payee])
      .rpc();
    await program.methods
      .raiseDispute(new anchor.BN(dealId), 0)
      .accounts({ deal, signer: payer.publicKey })
      .signers([payer])
      .rpc();
    try {
      await program.methods
        .resolveDisputeSpl(new anchor.BN(dealId), 0, true)
        .accounts({
          deal,
          vault: vaultPda(deal)[0],
          recipientAta: payeeAta,
          signer: stranger.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      assert.fail("expected NotArbiter");
    } catch (e: any) {
      assert.include(e.toString(), "NotArbiter");
    }
  });

  it("rejects cancel when nothing is pending", async () => {
    const [deal] = dealPda(1); // single milestone already released
    try {
      await program.methods
        .cancelRemainingSol(new anchor.BN(1))
        .accounts({ deal, recipient: payer.publicKey, signer: payer.publicKey })
        .signers([payer])
        .rpc();
      assert.fail("expected NothingPending");
    } catch (e: any) {
      assert.include(e.toString(), "NothingPending");
    }
  });

  it("rejects out-of-range milestone index", async () => {
    const [deal] = dealPda(2);
    try {
      await program.methods
        .markDone(new anchor.BN(2), 9)
        .accounts({ deal, signer: payee.publicKey })
        .signers([payee])
        .rpc();
      assert.fail("expected InvalidMilestoneIndex");
    } catch (e: any) {
      assert.include(e.toString(), "InvalidMilestoneIndex");
    }
  });
});
