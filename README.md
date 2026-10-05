# 🥭 Blue-Mango — milestone escrow for crypto deals

Lock USDG in a smart contract, release it branch by branch as work gets done.
No middlemen, no chargebacks, no “trust me bro”.

## Structure

```
blue-mango/
  contracts/          Foundry project
    src/BlueMango.sol     Escrow contract (USDG, milestones, arbiter disputes)
    test/BlueMango.t.sol  22 forge tests — all green
    script/Deploy.s.sol   Deploy script (reads USDG_TOKEN env)
  frontend/           Next.js 14 + wagmi/viem
    app/page.tsx            Landing page
    app/app/page.tsx        Deal dashboard (tree visualization)
    app/app/new/page.tsx    Create-a-deal flow (approve + create)
    app/app/deal/[id]/      Deal detail + milestone actions
    components/DealTree.tsx The signature tree-and-branches visual
    public/logo.webp        Brand logo (also the favicon)
```

## Contract

`BlueMango.sol` — payer creates a deal (payee, arbiter, milestones with USDG
amounts) and funds the exact total up front. Flow per milestone:

Pending → **Done** (payee) → **Released** (payer approves) ·
7-day payer silence → payee **claims** ·
**Disputed** (either side) → arbiter rules **Released** or **Refunded** ·
payer can **cancel** any still-Pending milestones for a refund.

Guards: reentrancy lock on every state-changing money path, milestone sums must
equal the funded total, neutral-arbiter + payer≠payee checks, strict state machine.

```bash
cd contracts
forge test
```

## Frontend

```bash
cd frontend
cp .env.example .env.local   # fill in addresses
npm install
npm run dev
```

Env: `NEXT_PUBLIC_BLUEMANGO_ADDRESS`, `NEXT_PUBLIC_USDG_ADDRESS`,
`NEXT_PUBLIC_MAINNET=1` for Robinhood mainnet (4663), else testnet (46630).

The UI is theme-aware (dark default, respects OS setting, toggle persisted).
Brand: midnight blue + mango amber. Every deal renders as a tree — trunk is the
locked total, branches are milestones colored by state.

## Deploy (testnet)

```bash
cd contracts
USDG_TOKEN=0x... forge script script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.chain.robinhood.com --broadcast
```

Then put the deployed address in `frontend/.env.local`. Mainnet deploys need
Javin's explicit approval — never broadcast to mainnet on your own call.
