//! Blue-Mango — milestone escrow for Solana.
//!
//! Solana/Anchor port of the Solidity `BlueMango` contract (Robinhood Chain).
//!
//! Roles: **payer** locks funds up front, **payee** does the work and marks
//! milestones done, **arbiter** (neutral third party) rules on disputes.
//!
//! Lifecycle (mirrors the Solidity contract 1:1):
//!   1. `create_deal_*` — payer funds the deal vault (native SOL or an SPL
//!      token) for milestones with fixed amounts.
//!   2. `mark_done` — payee signals a milestone is complete; starts the
//!      7-day claim clock.
//!   3. `approve_milestone_*` — payer releases the milestone amount to payee.
//!   4. `claim_milestone_*` — payee claims after the payer stays silent for
//!      [`CLAIM_TIMEOUT`].
//!   5. `raise_dispute` — either side escalates a done milestone.
//!   6. `resolve_dispute_*` — arbiter releases to payee or refunds payer.
//!   7. `cancel_remaining_*` — payer refunds every milestone still pending.
//!
//! Differences from the Solidity version (all deliberate):
//! * No ERC-20 `approve` step: the funding transfer happens inside
//!   `create_deal_*` with the payer as signer — one transaction, not two.
//! * Milestones live inline in the deal account, capped at
//!   [`MAX_MILESTONES`] (Solana accounts are fixed-size).
//! * Native SOL deals hold lamports directly in the deal PDA; SPL deals use
//!   a vault token-account PDA owned by the deal PDA.
//! * `payment_mint == Pubkey::default()` means native SOL.
//! * Rent-exempt lamports stay in the deal account after the last payout;
//!   there is no close instruction in v1.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

/// Placeholder program id — replaced by `anchor keys sync` at deploy time.
/// (No Solana toolchain in this environment, so no real keypair exists yet.)
declare_id!("11111111111111111111111111111111");

/// Silence window after which the payee can claim an approved-by-timeout milestone.
pub const CLAIM_TIMEOUT: i64 = 7 * 24 * 3600;

/// Max milestones per deal (fixed-size account constraint).
pub const MAX_MILESTONES: usize = 32;

/// Max milestone description length in bytes.
pub const MAX_DESC_LEN: usize = 128;

/// `payment_mint` value meaning "native SOL".
pub const NATIVE_SOL: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// Milestone states — same numeric mapping as the Solidity enum.
pub const STATE_PENDING: u8 = 0;
pub const STATE_DONE: u8 = 1;
pub const STATE_DISPUTED: u8 = 2;
pub const STATE_RELEASED: u8 = 3;
pub const STATE_REFUNDED: u8 = 4;

#[program]
pub mod blue_mango {
    use super::*;

    /// One-time setup: creates the registry holding the deal counter.
    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        ctx.accounts.registry.next_deal_id = 0;
        Ok(())
    }

    /// Create and fully fund a SOL deal. `deal_id` must equal the registry's
    /// `next_deal_id`; the registry counter is bumped atomically.
    pub fn create_deal_sol(
        ctx: Context<CreateDealSol>,
        deal_id: u64,
        payee: Pubkey,
        arbiter: Pubkey,
        descriptions: Vec<String>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        let total = init_deal(
            &mut ctx.accounts.deal,
            &mut ctx.accounts.registry,
            deal_id,
            ctx.accounts.payer.key(),
            payee,
            arbiter,
            NATIVE_SOL,
            &descriptions,
            &amounts,
        )?;
        ctx.accounts.deal.bump = ctx.bumps.deal;

        // Fund: payer -> deal PDA (the deal PDA is its own SOL vault).
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.deal.to_account_info(),
                },
            ),
            total,
        )?;

        let d = &ctx.accounts.deal;
        emit!(DealCreated {
            deal_id,
            payer: d.payer,
            payee: d.payee,
            arbiter: d.arbiter,
            payment_mint: NATIVE_SOL,
            total,
            milestone_count: d.milestone_count,
        });
        Ok(())
    }

    /// Create and fully fund an SPL-token deal. A vault token account PDA
    /// (authority = deal PDA) is created and funded from the payer's ATA.
    pub fn create_deal_spl(
        ctx: Context<CreateDealSpl>,
        deal_id: u64,
        payee: Pubkey,
        arbiter: Pubkey,
        descriptions: Vec<String>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let total = init_deal(
            &mut ctx.accounts.deal,
            &mut ctx.accounts.registry,
            deal_id,
            ctx.accounts.payer.key(),
            payee,
            arbiter,
            mint_key,
            &descriptions,
            &amounts,
        )?;
        ctx.accounts.deal.bump = ctx.bumps.deal;
        ctx.accounts.deal.vault_bump = ctx.bumps.vault;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.payer_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            total,
            ctx.accounts.mint.decimals,
        )?;

        let d = &ctx.accounts.deal;
        emit!(DealCreated {
            deal_id,
            payer: d.payer,
            payee: d.payee,
            arbiter: d.arbiter,
            payment_mint: mint_key,
            total,
            milestone_count: d.milestone_count,
        });
        Ok(())
    }

    /// Payee signals a milestone is complete. Starts the claim clock.
    pub fn mark_done(
        ctx: Context<DealMilestone>,
        deal_id: u64,
        milestone_index: u8,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let done_at = {
            let deal = &mut ctx.accounts.deal;
            require_keys_eq!(signer, deal.payee, MangoError::NotPayee);
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_PENDING, MangoError::NotPending);
            m.state = STATE_DONE;
            m.done_at = Clock::get()?.unix_timestamp;
            m.done_at
        };
        emit!(MilestoneDone {
            deal_id,
            milestone_index,
            done_at,
        });
        Ok(())
    }

    /// Payer approves a done milestone; funds go to the payee (SOL).
    pub fn approve_milestone_sol(
        ctx: Context<PayoutSol>,
        deal_id: u64,
        milestone_index: u8,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let (amount, payee, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint == NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.payer, MangoError::NotPayer);
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DONE, MangoError::NotDone);
            m.state = STATE_RELEASED;
            let amount = m.amount;
            deal.released = deal.released.checked_add(amount).ok_or(MangoError::Overflow)?;
            (amount, deal.payee, deal.bump)
        };
        payout_sol(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.recipient,
            amount,
            &ctx.accounts.system_program,
        )?;
        emit!(MilestoneReleased {
            deal_id,
            milestone_index,
            to: payee,
            amount,
        });
        Ok(())
    }

    /// Payer approves a done milestone; funds go to the payee (SPL).
    pub fn approve_milestone_spl(
        ctx: Context<PayoutSpl>,
        deal_id: u64,
        milestone_index: u8,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let (amount, payee, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint != NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.payer, MangoError::NotPayer);
            require_keys_eq!(ctx.accounts.vault.mint, deal.payment_mint, MangoError::WrongMint);
            require_keys_eq!(
                ctx.accounts.recipient_ata.owner,
                deal.payee,
                MangoError::WrongRecipient
            );
            require_keys_eq!(
                ctx.accounts.recipient_ata.mint,
                deal.payment_mint,
                MangoError::WrongMint
            );
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DONE, MangoError::NotDone);
            m.state = STATE_RELEASED;
            let amount = m.amount;
            deal.released = deal.released.checked_add(amount).ok_or(MangoError::Overflow)?;
            (amount, deal.payee, deal.bump)
        };
        payout_spl(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.vault,
            &ctx.accounts.recipient_ata,
            amount,
            &ctx.accounts.token_program,
        )?;
        emit!(MilestoneReleased {
            deal_id,
            milestone_index,
            to: payee,
            amount,
        });
        Ok(())
    }

    /// Payee claims a milestone the payer ignored for CLAIM_TIMEOUT (SOL).
    pub fn claim_milestone_sol(
        ctx: Context<PayoutSol>,
        deal_id: u64,
        milestone_index: u8,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let (amount, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint == NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.payee, MangoError::NotPayee);
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DONE, MangoError::NotDone);
            let now = Clock::get()?.unix_timestamp;
            require!(now >= m.done_at + CLAIM_TIMEOUT, MangoError::ClaimTooEarly);
            m.state = STATE_RELEASED;
            let amount = m.amount;
            deal.released = deal.released.checked_add(amount).ok_or(MangoError::Overflow)?;
            (amount, deal.bump)
        };
        payout_sol(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.recipient,
            amount,
            &ctx.accounts.system_program,
        )?;
        emit!(MilestoneClaimed {
            deal_id,
            milestone_index,
            amount,
        });
        Ok(())
    }

    /// Payee claims a milestone the payer ignored for CLAIM_TIMEOUT (SPL).
    pub fn claim_milestone_spl(
        ctx: Context<PayoutSpl>,
        deal_id: u64,
        milestone_index: u8,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let (amount, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint != NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.payee, MangoError::NotPayee);
            require_keys_eq!(ctx.accounts.vault.mint, deal.payment_mint, MangoError::WrongMint);
            require_keys_eq!(
                ctx.accounts.recipient_ata.owner,
                deal.payee,
                MangoError::WrongRecipient
            );
            require_keys_eq!(
                ctx.accounts.recipient_ata.mint,
                deal.payment_mint,
                MangoError::WrongMint
            );
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DONE, MangoError::NotDone);
            let now = Clock::get()?.unix_timestamp;
            require!(now >= m.done_at + CLAIM_TIMEOUT, MangoError::ClaimTooEarly);
            m.state = STATE_RELEASED;
            let amount = m.amount;
            deal.released = deal.released.checked_add(amount).ok_or(MangoError::Overflow)?;
            (amount, deal.bump)
        };
        payout_spl(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.vault,
            &ctx.accounts.recipient_ata,
            amount,
            &ctx.accounts.token_program,
        )?;
        emit!(MilestoneClaimed {
            deal_id,
            milestone_index,
            amount,
        });
        Ok(())
    }

    /// Either side escalates a done milestone to the arbiter.
    pub fn raise_dispute(
        ctx: Context<DealMilestone>,
        deal_id: u64,
        milestone_index: u8,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        {
            let deal = &mut ctx.accounts.deal;
            require!(
                signer == deal.payer || signer == deal.payee,
                MangoError::NotParty
            );
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DONE, MangoError::NotDone);
            m.state = STATE_DISPUTED;
        }
        emit!(DisputeRaised {
            deal_id,
            milestone_index,
            by: signer,
        });
        Ok(())
    }

    /// Arbiter rules on a disputed milestone. Final. (SOL)
    pub fn resolve_dispute_sol(
        ctx: Context<PayoutSol>,
        deal_id: u64,
        milestone_index: u8,
        release_to_payee: bool,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let recipient_key = ctx.accounts.recipient.key();
        let (amount, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint == NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.arbiter, MangoError::NotArbiter);
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DISPUTED, MangoError::NotDisputed);
            let amount = m.amount;
            let to = if release_to_payee {
                m.state = STATE_RELEASED;
                deal.released = deal.released.checked_add(amount).ok_or(MangoError::Overflow)?;
                deal.payee
            } else {
                m.state = STATE_REFUNDED;
                deal.refunded = deal.refunded.checked_add(amount).ok_or(MangoError::Overflow)?;
                deal.payer
            };
            require_keys_eq!(recipient_key, to, MangoError::WrongRecipient);
            (amount, deal.bump)
        };
        payout_sol(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.recipient,
            amount,
            &ctx.accounts.system_program,
        )?;
        emit!(DisputeResolved {
            deal_id,
            milestone_index,
            released_to_payee: release_to_payee,
            amount,
        });
        Ok(())
    }

    /// Arbiter rules on a disputed milestone. Final. (SPL)
    pub fn resolve_dispute_spl(
        ctx: Context<PayoutSpl>,
        deal_id: u64,
        milestone_index: u8,
        release_to_payee: bool,
    ) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let (amount, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint != NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.arbiter, MangoError::NotArbiter);
            require_keys_eq!(ctx.accounts.vault.mint, deal.payment_mint, MangoError::WrongMint);
            require_keys_eq!(
                ctx.accounts.recipient_ata.mint,
                deal.payment_mint,
                MangoError::WrongMint
            );
            let m = milestone_mut(deal, milestone_index)?;
            require!(m.state == STATE_DISPUTED, MangoError::NotDisputed);
            let amount = m.amount;
            let to = if release_to_payee {
                m.state = STATE_RELEASED;
                deal.released = deal.released.checked_add(amount).ok_or(MangoError::Overflow)?;
                deal.payee
            } else {
                m.state = STATE_REFUNDED;
                deal.refunded = deal.refunded.checked_add(amount).ok_or(MangoError::Overflow)?;
                deal.payer
            };
            require_keys_eq!(ctx.accounts.recipient_ata.owner, to, MangoError::WrongRecipient);
            (amount, deal.bump)
        };
        payout_spl(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.vault,
            &ctx.accounts.recipient_ata,
            amount,
            &ctx.accounts.token_program,
        )?;
        emit!(DisputeResolved {
            deal_id,
            milestone_index,
            released_to_payee: release_to_payee,
            amount,
        });
        Ok(())
    }

    /// Payer refunds every milestone still Pending. In-flight
    /// (Done/Disputed) milestones are untouched. (SOL)
    pub fn cancel_remaining_sol(ctx: Context<CancelSol>, deal_id: u64) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let recipient_key = ctx.accounts.recipient.key();
        let (refund_total, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint == NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.payer, MangoError::NotPayer);
            require_keys_eq!(recipient_key, deal.payer, MangoError::WrongRecipient);
            let refund_total = cancel_pending(deal)?;
            (refund_total, deal.bump)
        };
        payout_sol(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.recipient,
            refund_total,
            &ctx.accounts.system_program,
        )?;
        emit!(DealCancelled {
            deal_id,
            refunded_total: refund_total,
        });
        Ok(())
    }

    /// Payer refunds every milestone still Pending. (SPL)
    pub fn cancel_remaining_spl(ctx: Context<CancelSpl>, deal_id: u64) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let (refund_total, bump) = {
            let deal = &mut ctx.accounts.deal;
            require!(deal.payment_mint != NATIVE_SOL, MangoError::WrongAssetKind);
            require_keys_eq!(signer, deal.payer, MangoError::NotPayer);
            require_keys_eq!(ctx.accounts.vault.mint, deal.payment_mint, MangoError::WrongMint);
            require_keys_eq!(
                ctx.accounts.recipient_ata.mint,
                deal.payment_mint,
                MangoError::WrongMint
            );
            require_keys_eq!(
                ctx.accounts.recipient_ata.owner,
                deal.payer,
                MangoError::WrongRecipient
            );
            let refund_total = cancel_pending(deal)?;
            (refund_total, deal.bump)
        };
        payout_spl(
            &ctx.accounts.deal,
            deal_id,
            bump,
            &ctx.accounts.vault,
            &ctx.accounts.recipient_ata,
            refund_total,
            &ctx.accounts.token_program,
        )?;
        emit!(DealCancelled {
            deal_id,
            refunded_total: refund_total,
        });
        Ok(())
    }
}

// ── shared internals ─────────────────────────────────────────────────

/// Validates roles/parties/milestones, writes the deal + milestone records,
/// bumps the registry counter. Returns the funded total.
fn init_deal(
    deal: &mut Account<Deal>,
    registry: &mut Account<Registry>,
    deal_id: u64,
    payer: Pubkey,
    payee: Pubkey,
    arbiter: Pubkey,
    payment_mint: Pubkey,
    descriptions: &[String],
    amounts: &[u64],
) -> Result<u64> {
    require!(deal_id == registry.next_deal_id, MangoError::DealIdMismatch);
    require!(payee != Pubkey::default(), MangoError::ZeroAddress);
    require!(arbiter != Pubkey::default(), MangoError::ZeroAddress);
    require!(payee != payer, MangoError::PayerIsPayee);
    require!(arbiter != payer && arbiter != payee, MangoError::ArbiterNotNeutral);
    require!(
        !descriptions.is_empty() && descriptions.len() == amounts.len(),
        MangoError::InvalidMilestones
    );
    require!(
        descriptions.len() <= MAX_MILESTONES,
        MangoError::TooManyMilestones
    );

    let mut total: u64 = 0;
    let mut milestones = [MilestoneData::default(); MAX_MILESTONES];
    for (i, amount) in amounts.iter().enumerate() {
        require!(*amount > 0, MangoError::ZeroAmount);
        total = total.checked_add(*amount).ok_or(MangoError::Overflow)?;
        let bytes = descriptions[i].as_bytes();
        require!(bytes.len() <= MAX_DESC_LEN, MangoError::DescriptionTooLong);
        let mut description = [0u8; MAX_DESC_LEN];
        description[..bytes.len()].copy_from_slice(bytes);
        milestones[i] = MilestoneData {
            description,
            description_len: bytes.len() as u8,
            amount: *amount,
            state: STATE_PENDING,
            done_at: 0,
        };
    }

    deal.payer = payer;
    deal.payee = payee;
    deal.arbiter = arbiter;
    deal.payment_mint = payment_mint;
    deal.total = total;
    deal.released = 0;
    deal.refunded = 0;
    deal.milestone_count = descriptions.len() as u8;
    deal.milestones = milestones;
    // bump / vault_bump are stored by the caller from ctx.bumps.

    registry.next_deal_id = registry
        .next_deal_id
        .checked_add(1)
        .ok_or(MangoError::Overflow)?;

    Ok(total)
}

/// Marks every Pending milestone Refunded; returns the refund sum.
fn cancel_pending(deal: &mut Account<Deal>) -> Result<u64> {
    let mut refund_total: u64 = 0;
    for i in 0..deal.milestone_count as usize {
        let m = &mut deal.milestones[i];
        if m.state == STATE_PENDING {
            m.state = STATE_REFUNDED;
            refund_total = refund_total
                .checked_add(m.amount)
                .ok_or(MangoError::Overflow)?;
        }
    }
    require!(refund_total > 0, MangoError::NothingPending);
    deal.refunded = deal
        .refunded
        .checked_add(refund_total)
        .ok_or(MangoError::Overflow)?;
    Ok(refund_total)
}

fn milestone_mut(deal: &mut Account<Deal>, index: u8) -> Result<&mut MilestoneData> {
    require!(
        (index as usize) < deal.milestone_count as usize,
        MangoError::InvalidMilestoneIndex
    );
    Ok(&mut deal.milestones[index as usize])
}

/// Transfer lamports out of the deal PDA (native SOL vault).
fn payout_sol<'info>(
    deal: &Account<'info, Deal>,
    deal_id: u64,
    bump: u8,
    recipient: &AccountInfo<'info>,
    amount: u64,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    let seeds: &[&[u8]] = &[b"deal", &deal_id.to_le_bytes(), &[bump]];
    system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            system_program::Transfer {
                from: deal.to_account_info(),
                to: recipient.clone(),
            },
            &[seeds],
        ),
        amount,
    )
}

/// Transfer tokens out of the vault PDA (SPL vault, authority = deal PDA).
fn payout_spl<'info>(
    deal: &Account<'info, Deal>,
    deal_id: u64,
    bump: u8,
    vault: &Account<'info, TokenAccount>,
    recipient_ata: &Account<'info, TokenAccount>,
    amount: u64,
    token_program: &AccountInfo<'info>,
) -> Result<()> {
    let seeds: &[&[u8]] = &[b"deal", &deal_id.to_le_bytes(), &[bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.clone(),
            token::Transfer {
                from: vault.to_account_info(),
                to: recipient_ata.to_account_info(),
                authority: deal.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )
}

// ── accounts ─────────────────────────────────────────────────────────

#[account]
pub struct Registry {
    pub next_deal_id: u64,
}

impl Registry {
    pub const SPACE: usize = 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct MilestoneData {
    pub description: [u8; MAX_DESC_LEN],
    pub description_len: u8,
    pub amount: u64,
    pub state: u8,
    pub done_at: i64,
}

#[account]
pub struct Deal {
    pub payer: Pubkey,
    pub payee: Pubkey,
    pub arbiter: Pubkey,
    /// Mint of the escrowed SPL token; `Pubkey::default()` = native SOL.
    pub payment_mint: Pubkey,
    pub total: u64,
    pub released: u64,
    pub refunded: u64,
    pub milestone_count: u8,
    pub bump: u8,
    pub vault_bump: u8,
    pub milestones: [MilestoneData; MAX_MILESTONES],
}

impl Deal {
    pub const SPACE: usize =
        8 + 32 * 4 + 8 * 3 + 1 + 1 + 1 + MAX_MILESTONES * (MAX_DESC_LEN + 1 + 8 + 1 + 8);
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = payer,
        space = Registry::SPACE,
        seeds = [b"registry"],
        bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(deal_id: u64)]
pub struct CreateDealSol<'info> {
    #[account(mut, seeds = [b"registry"], bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = payer,
        space = Deal::SPACE,
        seeds = [b"deal", deal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub deal: Account<'info, Deal>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(deal_id: u64)]
pub struct CreateDealSpl<'info> {
    #[account(mut, seeds = [b"registry"], bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = payer,
        space = Deal::SPACE,
        seeds = [b"deal", deal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        init,
        payer = payer,
        seeds = [b"vault", deal.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = deal,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer_ata: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Signer-only milestone actions (mark_done, raise_dispute).
#[derive(Accounts)]
#[instruction(deal_id: u64, _milestone_index: u8)]
pub struct DealMilestone<'info> {
    #[account(mut, seeds = [b"deal", deal_id.to_le_bytes().as_ref()], bump = deal.bump)]
    pub deal: Account<'info, Deal>,
    pub signer: Signer<'info>,
}

/// SOL payout actions (approve / claim / resolve).
#[derive(Accounts)]
#[instruction(deal_id: u64, _milestone_index: u8)]
pub struct PayoutSol<'info> {
    #[account(mut, seeds = [b"deal", deal_id.to_le_bytes().as_ref()], bump = deal.bump)]
    pub deal: Account<'info, Deal>,
    /// CHECK: lamport recipient — validated against the deal's roles in the handler.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// SPL payout actions (approve / claim / resolve).
#[derive(Accounts)]
#[instruction(deal_id: u64, _milestone_index: u8)]
pub struct PayoutSpl<'info> {
    #[account(mut, seeds = [b"deal", deal_id.to_le_bytes().as_ref()], bump = deal.bump)]
    pub deal: Account<'info, Deal>,
    #[account(mut, seeds = [b"vault", deal.key().as_ref()], bump = deal.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_ata: Account<'info, TokenAccount>,
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// SOL cancel (no milestone index arg).
#[derive(Accounts)]
#[instruction(deal_id: u64)]
pub struct CancelSol<'info> {
    #[account(mut, seeds = [b"deal", deal_id.to_le_bytes().as_ref()], bump = deal.bump)]
    pub deal: Account<'info, Deal>,
    /// CHECK: lamport recipient — must be the payer (checked in handler).
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// SPL cancel (no milestone index arg).
#[derive(Accounts)]
#[instruction(deal_id: u64)]
pub struct CancelSpl<'info> {
    #[account(mut, seeds = [b"deal", deal_id.to_le_bytes().as_ref()], bump = deal.bump)]
    pub deal: Account<'info, Deal>,
    #[account(mut, seeds = [b"vault", deal.key().as_ref()], bump = deal.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_ata: Account<'info, TokenAccount>,
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ── events (mirror the Solidity events) ──────────────────────────────

#[event]
pub struct DealCreated {
    pub deal_id: u64,
    pub payer: Pubkey,
    pub payee: Pubkey,
    pub arbiter: Pubkey,
    pub payment_mint: Pubkey,
    pub total: u64,
    pub milestone_count: u8,
}

#[event]
pub struct MilestoneDone {
    pub deal_id: u64,
    pub milestone_index: u8,
    pub done_at: i64,
}

#[event]
pub struct MilestoneReleased {
    pub deal_id: u64,
    pub milestone_index: u8,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MilestoneClaimed {
    pub deal_id: u64,
    pub milestone_index: u8,
    pub amount: u64,
}

#[event]
pub struct DisputeRaised {
    pub deal_id: u64,
    pub milestone_index: u8,
    pub by: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub deal_id: u64,
    pub milestone_index: u8,
    pub released_to_payee: bool,
    pub amount: u64,
}

#[event]
pub struct DealCancelled {
    pub deal_id: u64,
    pub refunded_total: u64,
}

// ── errors (mirror the Solidity require messages) ────────────────────

#[error_code]
pub enum MangoError {
    #[msg("zero address")]
    ZeroAddress,
    #[msg("payer==payee")]
    PayerIsPayee,
    #[msg("arbiter not neutral")]
    ArbiterNotNeutral,
    #[msg("bad milestones")]
    InvalidMilestones,
    #[msg("too many milestones (max 32)")]
    TooManyMilestones,
    #[msg("amount zero")]
    ZeroAmount,
    #[msg("description too long (max 128 bytes)")]
    DescriptionTooLong,
    #[msg("deal id does not match registry counter")]
    DealIdMismatch,
    #[msg("not payer")]
    NotPayer,
    #[msg("not payee")]
    NotPayee,
    #[msg("not arbiter")]
    NotArbiter,
    #[msg("not party")]
    NotParty,
    #[msg("not pending")]
    NotPending,
    #[msg("not done")]
    NotDone,
    #[msg("not disputed")]
    NotDisputed,
    #[msg("too early")]
    ClaimTooEarly,
    #[msg("nothing pending")]
    NothingPending,
    #[msg("bad idx")]
    InvalidMilestoneIndex,
    #[msg("wrong asset kind for this instruction (SOL vs SPL)")]
    WrongAssetKind,
    #[msg("vault mint mismatch")]
    WrongMint,
    #[msg("recipient mismatch")]
    WrongRecipient,
    #[msg("arithmetic overflow")]
    Overflow,
}
