import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { ScoreBettingGame } from "../target/types/score_betting_game";

describe('escrow-game', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ScoreBettingGame as Program<ScoreBettingGame>;

  let player: Keypair;
  let escrowAccount: Keypair;

  const targetScore = 100;

  before(async () => {
    // Generate keypairs for the player and the escrow account
    player = anchor.web3.Keypair.generate();
    escrowAccount = anchor.web3.Keypair.generate();

    // Airdrop SOL to the player to fund their account
    const airdropTx = await provider.connection.requestAirdrop(
      player.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);

    // Fund the escrow account with a small initial amount (or set up as needed)
    const createEscrowTx = await provider.connection.requestAirdrop(
      escrowAccount.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(createEscrowTx);

    // Initialize the escrow account
    await program.methods
      .initializeEscrow()
      .accounts({
        player: player.publicKey,
        escrowAccount: escrowAccount.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player, escrowAccount]) // Escrow is also signed for initialization
      .rpc();
  });

  it('Deposits funds into the escrow account', async () => {
    await program.methods
      .depositFunds(new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL)) // Deposit 0.5 SOL
      .accounts({
        player: player.publicKey,
        escrowAccount: escrowAccount.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player]) // Only the player signs this transaction
      .rpc();

    const escrowAccountInfo = await provider.connection.getAccountInfo(escrowAccount.publicKey);
    console.log(`Escrow balance: ${escrowAccountInfo.lamports} lamports`);
  });

  it('Player submits a score and wins the game (score > target)', async () => {
    const playerScore = 150; // Score higher than target

    await program.methods
      .submitScore(new anchor.BN(playerScore), new anchor.BN(targetScore))
      .accounts({
        player: player.publicKey,
        escrowAccount: escrowAccount.publicKey,
      })
      .signers([player]) // Only the player signs this transaction
      .rpc();

    const playerBalanceAfterWin = await provider.connection.getBalance(player.publicKey);
    console.log(`Player balance after win: ${playerBalanceAfterWin} lamports`);
  });

  it('Player submits a score and loses the game (score < target)', async () => {
    const losingPlayer = anchor.web3.Keypair.generate();

    const airdropTx = await provider.connection.requestAirdrop(
      losingPlayer.publicKey,
      0.5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);

    const losingEscrowAccount = anchor.web3.Keypair.generate();
    const createEscrowTx = await provider.connection.requestAirdrop(
      losingEscrowAccount.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(createEscrowTx);

    const losingPlayerScore = 80;

    await program.methods
      .initializeEscrow()
      .accounts({
        player: losingPlayer.publicKey,
        escrowAccount: losingEscrowAccount.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([losingPlayer, losingEscrowAccount]) // Losing player and escrow account
      .rpc();

    await program.methods
      .depositFunds(new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL))
      .accounts({
        player: losingPlayer.publicKey,
        escrowAccount: losingEscrowAccount.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([losingPlayer])
      .rpc();

    await program.methods
      .submitScore(new anchor.BN(losingPlayerScore), new anchor.BN(targetScore))
      .accounts({
        player: losingPlayer.publicKey,
        escrowAccount: losingEscrowAccount.publicKey,
      })
      .signers([losingPlayer])
      .rpc();

    const losingPlayerBalanceAfterLoss = await provider.connection.getBalance(losingPlayer.publicKey);
    console.log(`Losing player balance after loss: ${losingPlayerBalanceAfterLoss} lamports`);
  });
});