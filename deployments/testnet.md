# Blue-Mango deployments

## Robinhood Chain testnet (chain id 46630)
- RPC: https://rpc.testnet.chain.robinhood.com
- MockUSDG: 0xB6413D809877E0eca807AabB415ffc8A4e17510d
- BlueMango: 0x394308335Ed7861bB0790652545Fa8EB9dACaBec
- Deployed: 2026-10-05
- Deployer: 0xb6b788c2a4704c3288e7e5Bd95229b639C5818b1 (testnet-only key, burned after use — do not reuse)
- E2E verified: deal #0 created (50 mock USDG locked, 2 milestones), contract holds funds correctly.

## Frontend env (Vercel)
- NEXT_PUBLIC_BLUEMANGO_ADDRESS=0x394308335Ed7861bB0790652545Fa8EB9dACaBec
- NEXT_PUBLIC_USDG_ADDRESS=0xB6413D809877E0eca807AabB415ffc8A4e17510d
- NEXT_PUBLIC_CHAIN_ID=46630
- NEXT_PUBLIC_RPC_URL=https://rpc.testnet.chain.robinhood.com
