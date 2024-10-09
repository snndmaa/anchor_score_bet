use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("Hh7LpaGrzLMMk9NgpFkw99wHE94rQKtfCymxvBm89mgr");

#[program]
mod score_betting_game {
    use super::*;

    pub fn initialize_escrow(ctx: Context<InitializeEscrow>) -> Result<()> {
        let escrow_account = &mut ctx.accounts.escrow_account;
        escrow_account.amount = 0;
        Ok(())
    }

    pub fn deposit_funds(ctx: Context<DepositFunds>, amount: u64) -> Result<()> {
        let player = &ctx.accounts.player;
        let escrow_account = &mut ctx.accounts.escrow_account;

        // Transfer the amount from player to the escrow account
        let transfer_ix = system_instruction::transfer(
            &player.key(),
            &escrow_account.key(),
            amount,
        );
        invoke(
            &transfer_ix,
            &[player.to_account_info(), escrow_account.to_account_info(), ctx.accounts.system_program.to_account_info()],
        )?;

        // Update the escrow account amount
        escrow_account.amount += amount;

        Ok(())
    }

    pub fn submit_score(ctx: Context<SubmitScore>, score: u64, target_score: u64) -> Result<()> {
        let escrow_account = &mut ctx.accounts.escrow_account;
        let player = &ctx.accounts.player;

        if score >= target_score {
            // The player has won, transfer the deposited amount back to the player
            let amount_to_transfer = escrow_account.amount * 2;

            // Check if the escrow account has enough lamports to cover the transfer
            let escrow_lamports = **escrow_account.to_account_info().lamports.borrow();
            require!(
                escrow_lamports >= amount_to_transfer,
                CustomError::InsufficientFundsInEscrow
            );

            // Perform the transfer
            **escrow_account.to_account_info().try_borrow_mut_lamports()? -= amount_to_transfer;
            **player.to_account_info().try_borrow_mut_lamports()? += amount_to_transfer;

            // Reset the escrow amount after payout
            escrow_account.amount = 0;
        } else {
            // The player has lost, funds are kept in the escrow (no transfer)
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(init, payer = player, space = 8 + 8)]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitScore<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    pub amount: u64, // Stores the amount of SOL deposited by the player
}

#[error_code]
pub enum CustomError {
    #[msg("Not enough funds in escrow account.")]
    InsufficientFundsInEscrow,
}
