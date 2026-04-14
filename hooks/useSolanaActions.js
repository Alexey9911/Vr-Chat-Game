import { useCallback } from 'react';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from '@solana/web3.js';

// Primary: Helius RPC (faster, better rate limits)
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=58005a1c-f710-494f-913f-055a35c4404c';
const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com'; // Fallback

let connection;
try {
  connection = new Connection(HELIUS_RPC, 'confirmed');
} catch (err) {
  console.warn('⚠️ Helius RPC failed, using public RPC');
  connection = new Connection(PUBLIC_RPC, 'confirmed');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error) => (error?.message || String(error || '')).trim();

const isRetriableSwapError = (message) => {
  const normalized = message.toLowerCase();
  return normalized.includes('failed to connect to wallet') ||
    normalized.includes('something went wrong') ||
    normalized.includes('try again later') ||
    normalized.includes('blockhash not found') ||
    normalized.includes('transaction expired') ||
    normalized.includes('network request failed') ||
    normalized.includes('timeout');
};

/**
 * useSolanaActions — hooks for executing Solana transactions
 * Works with Privy wallet via signAndSendTransaction
 */
export default function useSolanaActions({ publicKey, signAndSendTransaction, signTransaction, walletType }) {

  const readJsonSafely = useCallback(async (resp) => {
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Unexpected non-JSON response (status ${resp.status})`);
    }
  }, []);

  // Send native SOL
  const executeSendSol = useCallback(async (toAddress, amount) => {
    if (!publicKey) throw new Error('Wallet not connected');

    console.log('💸 Sending SOL:', { from: publicKey, to: toAddress, amount });
    
    const fromPubkey = new PublicKey(publicKey);
    const toPubkey = new PublicKey(toAddress);

    const requestedLamports = Math.floor(Number(amount) * LAMPORTS_PER_SOL);
    if (!Number.isFinite(requestedLamports) || requestedLamports <= 0) {
      throw new Error('Invalid amount for SOL transfer');
    }

    const balanceLamports = await connection.getBalance(fromPubkey, 'confirmed');
    // Reserve for: rent-exempt minimum (~890,000) + transaction fees (~10,000) = ~900,000 lamports (~0.0009 SOL)
    const feeReserveLamports = 1_000_000; // 0.001 SOL safety margin
    const maxTransferableLamports = Math.max(balanceLamports - feeReserveLamports, 0);
    const lamportsToSend = Math.min(requestedLamports, maxTransferableLamports);

    if (lamportsToSend <= 0) {
      throw new Error('Insufficient SOL balance. Need at least 0.001 SOL reserved for rent and fees.');
    }
    
    console.log('💰 Balance check:', {
      balance: balanceLamports / LAMPORTS_PER_SOL,
      requested: requestedLamports / LAMPORTS_PER_SOL,
      sending: lamportsToSend / LAMPORTS_PER_SOL,
      reserved: feeReserveLamports / LAMPORTS_PER_SOL
    });

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: lamportsToSend,
      })
    );

    console.log('🔗 Fetching latest blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;
    
    console.log('✍️ Transaction prepared, signing and sending...');
    const signature = await signAndSendTransaction(transaction);
    console.log('✅ SOL sent! Signature:', signature);
    return signature;
  }, [publicKey, signAndSendTransaction]);

  // Get SOL balance
  const getBalance = useCallback(async (address) => {
    const pubkey = address || publicKey;
    if (!pubkey) return 0;
    try {
      const resp = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getBalance', publicKey: pubkey })
      });
      const data = await readJsonSafely(resp);
      if (data.success) {
        return data.balance;
      }
      return 0;
    } catch (err) {
      console.error('getBalance error:', err);
      return 0;
    }
  }, [publicKey, readJsonSafely]);

  // Get Transaction History
  const getHistory = useCallback(async () => {
    if (!publicKey) return [];
    try {
      const resp = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getHistory', publicKey })
      });
      const data = await readJsonSafely(resp);
      return data.success ? data.history : [];
    } catch (err) {
      console.error('getHistory error:', err);
      return [];
    }
  }, [publicKey, readJsonSafely]);

  // Get Token Portfolio
  const getTokens = useCallback(async () => {
    if (!publicKey) return [];
    try {
      const resp = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTokens', publicKey })
      });
      const data = await readJsonSafely(resp);
      return data.success ? data.tokens : [];
    } catch (err) {
      console.error('getTokens error:', err);
      return [];
    }
  }, [publicKey, readJsonSafely]);

  // Get Token Price
  const getPrice = useCallback(async (tokenId) => {
    try {
      const resp = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getPrice', tokenId })
      });
      const data = await readJsonSafely(resp);
      // Return full data object including marketCap, tokenName, etc.
      return data.success ? data : { price: 0 };
    } catch (err) {
      console.error('getPrice error:', err);
      return { price: 0 };
    }
  }, [readJsonSafely]);

  // Create Limit Order
  const createLimitOrder = useCallback(async (inputTicker, outputTicker, inputAmount, targetPrice, slippageBps = 0) => {
    if (!publicKey) throw new Error('Wallet not connected');

    // 1. Create limit order
    const resp = await fetch('/api/jupiter-limit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createLimitOrder',
        userPublicKey: publicKey,
        inputTicker,
        outputTicker,
        inputAmount,
        targetPrice,
        slippageBps,
      }),
    });

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'Failed to create limit order');

    // 2. Deserialize and sign transaction
    const txBuf = Buffer.from(data.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuf);
    const signed = await signTransaction(transaction);

    // 3. Execute the limit order
    const signedTx = Buffer.from(signed.serialize()).toString('base64');
    const executeResp = await fetch('/api/jupiter-limit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'executeLimitOrder',
        signedTransaction: signedTx,
        requestId: data.requestId,
      }),
    });

    const executeData = await executeResp.json();
    if (!executeData.success) throw new Error(executeData.error || 'Failed to execute limit order');

    return {
      signature: executeData.signature,
      order: executeData.order,
      details: data.details,
    };
  }, [publicKey, signTransaction]);

  // Get User's Limit Orders
  const getLimitOrders = useCallback(async () => {
    if (!publicKey) return [];
    try {
      const resp = await fetch('/api/jupiter-limit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getLimitOrders', userPublicKey: publicKey })
      });
      const data = await resp.json();
      return data.success ? data.orders : [];
    } catch (err) {
      console.error('getLimitOrders error:', err);
      return [];
    }
  }, [publicKey]);

  // Cancel Limit Order
  const cancelLimitOrder = useCallback(async (orderKey) => {
    if (!publicKey) throw new Error('Wallet not connected');

    const resp = await fetch('/api/jupiter-limit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancelLimitOrder',
        userPublicKey: publicKey,
        orderKey,
      }),
    });

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'Failed to cancel limit order');

    // Sign and execute cancellation
    const txBuf = Buffer.from(data.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuf);
    const signed = await signTransaction(transaction);
    const rawTransaction = signed.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 2,
    });

    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }, [publicKey, signTransaction]);

  // Get full portfolio (SOL + all SPL tokens with metadata/icons)
  const getPortfolio = useCallback(async () => {
    if (!publicKey) return [];
    try {
      const resp = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getPortfolio', publicKey })
      });
      const data = await readJsonSafely(resp);
      return data.success ? data.assets : [];
    } catch (err) {
      console.error('getPortfolio error:', err);
      return [];
    }
  }, [publicKey, readJsonSafely]);

  // Get estimated transaction fee
  const getEstimatedFee = useCallback(async () => {
    return 0.000005; // 5000 lamports default for SOL transfers
  }, []);

  // Swap tokens via Jupiter
  const executeSwap = useCallback(async (fromToken, toToken, amount) => {
    if (!publicKey) throw new Error('Wallet not connected');

    console.log('🔄 Executing swap:', { from: fromToken, to: toToken, amount });

    // 1. Request swap transaction from Jupiter API
    const resp = await fetch('/api/jupiter-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputTicker: fromToken,
        outputTicker: toToken,
        amount,
        userPublicKey: publicKey,
      }),
    });

    const data = await readJsonSafely(resp);
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Swap failed');
    }

    console.log('📦 Received swap transaction from Jupiter');

    // 2. Deserialize — legacy (asLegacyTransaction: true + maxAccounts=30)
    const swapTxBuf = Buffer.from(data.swapTransaction, 'base64');
    let transaction;
    try {
      transaction = Transaction.from(swapTxBuf);
    } catch {
      transaction = VersionedTransaction.deserialize(swapTxBuf);
    }

    // 3. Sign and send via Privy
    console.log('✍️ Signing and sending swap transaction...');
    const signature = await signAndSendTransaction(transaction);
    
    console.log('✅ Swap completed! Signature:', signature);
    return signature;
  }, [publicKey, readJsonSafely, signAndSendTransaction]);

  // Stake (deposit) tokens via Jupiter Lend Earn
  const executeStake = useCallback(async (token, amount) => {
    if (!publicKey) throw new Error('Wallet not connected');

    console.log('📥 Staking:', { token, amount });

    const resp = await fetch('/api/jupiter-stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deposit',
        token,
        amount,
        userPublicKey: publicKey,
      }),
    });

    const data = await readJsonSafely(resp);
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Stake failed');
    }

    const stakeTxBuf = Buffer.from(data.transaction, 'base64');
    let transaction;
    try {
      transaction = VersionedTransaction.deserialize(stakeTxBuf);
    } catch {
      transaction = Transaction.from(stakeTxBuf);
    }

    console.log('✍️ Signing and sending stake transaction...');
    const signature = await signAndSendTransaction(transaction);

    console.log('✅ Stake completed! Signature:', signature);
    return signature;
  }, [publicKey, readJsonSafely, signAndSendTransaction]);

  // Unstake (withdraw) tokens from Jupiter Lend Earn
  const executeUnstake = useCallback(async (token, amount) => {
    if (!publicKey) throw new Error('Wallet not connected');

    console.log('📤 Unstaking:', { token, amount });

    const resp = await fetch('/api/jupiter-stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'withdraw',
        token,
        amount,
        userPublicKey: publicKey,
      }),
    });

    const data = await readJsonSafely(resp);
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Unstake failed');
    }

    const unstakeTxBuf = Buffer.from(data.transaction, 'base64');
    let transaction;
    try {
      transaction = VersionedTransaction.deserialize(unstakeTxBuf);
    } catch {
      transaction = Transaction.from(unstakeTxBuf);
    }

    console.log('✍️ Signing and sending unstake transaction...');
    const signature = await signAndSendTransaction(transaction);

    console.log('✅ Unstake completed! Signature:', signature);
    return signature;
  }, [publicKey, readJsonSafely, signAndSendTransaction]);

  return {
    executeSendSol,
    executeSwap,
    executeStake,
    executeUnstake,
    getBalance,
    getEstimatedFee,
    getHistory,
    getTokens,
    getPortfolio,
    getPrice,
    createLimitOrder,
    getLimitOrders,
    cancelLimitOrder,
  };
}
