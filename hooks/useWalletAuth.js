import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Primary: Helius RPC (faster, better rate limits)
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=58005a1c-f710-494f-913f-055a35c4404c';
const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com'; // Fallback

// Create connection with Helius as primary
let connection;
try {
  connection = new Connection(HELIUS_RPC, 'confirmed');
  console.log('🚀 Connected to Helius RPC');
} catch (err) {
  console.warn('⚠️ Helius RPC failed, using public RPC as fallback');
  connection = new Connection(PUBLIC_RPC, 'confirmed');
}
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mainnet

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error) => (error?.message || String(error || '')).trim();

const isPrivyCancellationError = (message) => {
  const normalized = message.toLowerCase();
  return normalized.includes('user exited the modal before submitting the transaction') ||
    normalized.includes('transaction cancelled') ||
    normalized.includes('user rejected') ||
    normalized.includes('user denied');
};

const isPrivyRetriableError = (message) => {
  const normalized = message.toLowerCase();
  return normalized.includes('failed to connect to wallet') ||
    normalized.includes('something went wrong') ||
    normalized.includes('try again later') ||
    normalized.includes('wallet is still initializing') ||
    normalized.includes('wallet not ready') ||
    normalized.includes('network request failed') ||
    normalized.includes('timeout') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('connection error');
};

const withPrivyRetries = async (operation, { attempts = 2, retryDelayMs = 350 } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = getErrorMessage(error);

      if (isPrivyCancellationError(message)) {
        throw new Error('Transaction cancelled');
      }

      lastError = error;

      if (!isPrivyRetriableError(message) || attempt === attempts) {
        break;
      }

      await wait(retryDelayMs * attempt);
    }
  }

  throw lastError;
};

/**
 * useWalletAuth — Privy-only wallet hook for Neyrs
 * Privy embedded wallet is the primary method.
 */
export default function useWalletAuth() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction: privySignAndSendTransaction } = useSignAndSendTransaction();

  const [balance, setBalance] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(null);

  // Get Solana wallet from Privy user object first (more reliable),
  // then fallback to wallets array from Solana hook.
  const userSolanaWallet =
    (user?.wallet?.chainType === 'solana' ? user.wallet : null) ||
    user?.linkedAccounts?.find(
      (account) =>
        account?.type === 'wallet' &&
        account?.chainType === 'solana' &&
        account?.walletClientType === 'privy'
    ) ||
    null;

  // Solana hook wallet object is still needed for signing transactions.
  const privyWallet =
    wallets?.find((w) => w.address && w.address === userSolanaWallet?.address) ||
    wallets?.find((w) => w.walletClientType === 'privy') ||
    wallets?.[0] ||
    null;
  const privyPublicKey = userSolanaWallet?.address || privyWallet?.address || null;
  const activePublicKey = privyPublicKey;
  const walletType = privyPublicKey ? 'privy' : null;
  const isAuthenticated = authenticated;
  const isConnected = !!activePublicKey;
  
  // Check if Privy wallet is fully ready for transactions
  const isPrivyWalletReady = useCallback(() => {
    if (!privyWallet || !privyPublicKey) return false;
    return !!(privyWallet.address && 
      (typeof privyWallet.sendTransaction === 'function' || 
       typeof privyWallet.signAndSendTransaction === 'function'));
  }, [privyWallet, privyPublicKey]);

  // Fetch SOL balance via API
  const fetchBalance = useCallback(async (pubKey) => {
    if (!pubKey) return null;
    try {
      const walletPubkey = new PublicKey(pubKey);
      const balanceLamports = await connection.getBalance(walletPubkey);
      const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
      setBalance(balanceSol);
      return balanceSol;
    } catch (err) {
      console.error('Balance fetch error:', err);
      setBalance(null);
      return null;
    }
  }, []);

  // Fetch USDC balance
  const fetchUsdcBalance = useCallback(async (pubKey) => {
    if (!pubKey) return null;
    try {
      const walletPubkey = new PublicKey(pubKey);
      const tokenAccount = await getAssociatedTokenAddress(USDC_MINT, walletPubkey);
      const balance = await connection.getTokenAccountBalance(tokenAccount);
      const usdcAmount = parseFloat(balance.value.uiAmount || 0);
      setUsdcBalance(usdcAmount);
      return usdcAmount;
    } catch (err) {
      if (err?.message?.includes('could not find account')) {
        setUsdcBalance(0);
        return 0;
      }
      console.error('USDC balance fetch error:', err);
      setUsdcBalance(0);
      return 0;
    }
  }, []);

  // Fetch balance when wallet connects/changes
  useEffect(() => {
    if (!activePublicKey) {
      setBalance(null);
      setUsdcBalance(null);
      return;
    }
    
    const loadBalances = async () => {
      try {
        await Promise.all([
          fetchBalance(activePublicKey),
          fetchUsdcBalance(activePublicKey)
        ]);
      } catch (err) {
        console.error('Error loading balances:', err);
      }
    };
    
    loadBalances();
  }, [activePublicKey]);

  // Re-fetch balances when Privy wallet becomes ready
  useEffect(() => {
    if (walletType === 'privy' && isPrivyWalletReady() && activePublicKey) {
      fetchBalance(activePublicKey);
      fetchUsdcBalance(activePublicKey);
    }
  }, [walletType, privyWallet, activePublicKey]);

  // Login with Privy (email)
  const loginWithPrivy = useCallback(() => {
    login();
  }, [login]);

  // Disconnect / logout
  const disconnect = useCallback(async () => {
    if (authenticated) {
      try { await logout(); } catch {}
    }
    setBalance(null);
    setUsdcBalance(null);
  }, [authenticated, logout]);

  // Sign and send transaction using Privy's official useSendTransaction hook
  const signAndSendTransaction = useCallback(async (transaction) => {
    if (!walletType) throw new Error('No wallet connected');
    
    if (!ready) {
      throw new Error('Privy is still initializing. Please wait a moment.');
    }
    
    if (!privyWallet) {
      throw new Error('Wallet not found. Please reconnect.');
    }

    // Serialize transaction to Uint8Array as Privy expects
    let serializedTx;
    if (transaction instanceof Uint8Array) {
      serializedTx = transaction;
    } else if (transaction instanceof Transaction) {
      serializedTx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
    } else if (typeof transaction?.serialize === 'function') {
      serializedTx = transaction.serialize();
    } else {
      throw new Error('Invalid transaction format');
    }

    try {
      const signature = await privySignAndSendTransaction({
        transaction: serializedTx,
        wallet: privyWallet,
      });
      
      return signature;
    } catch (error) {
      const msg = getErrorMessage(error);
      
      if (isPrivyCancellationError(msg)) {
        throw new Error('Transaction cancelled');
      }
      
      console.error('❌ Privy transaction error:', msg);
      throw error;
    }
  }, [walletType, privyWallet, ready, privySignAndSendTransaction, isPrivyWalletReady]);

  // Legacy signTransaction stub
  const signTransaction = useCallback(async (transaction) => {
    throw new Error('Use signAndSendTransaction for Privy wallets');
  }, []);

  // Send USDC using Privy wallet
  const sendUSDC = useCallback(async (recipientAddress, amount) => {
    if (!activePublicKey) throw new Error('Wallet not connected');
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    
    try {
      const fromPubkey = new PublicKey(activePublicKey);
      const toPubkey = new PublicKey(recipientAddress);
      
      const fromTokenAccount = await getAssociatedTokenAddress(USDC_MINT, fromPubkey);
      const toTokenAccount = await getAssociatedTokenAddress(USDC_MINT, toPubkey);
      
      // USDC has 6 decimals
      const amountInSmallestUnit = Math.floor(amount * 1_000_000);
      
      const transaction = new Transaction();
      
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          amountInSmallestUnit,
          [],
          TOKEN_PROGRAM_ID
        )
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      const signature = await signAndSendTransaction(transaction);
      
      return { success: true, signature };
    } catch (error) {
      console.error('USDC send error:', error);
      throw error;
    }
  }, [activePublicKey, signAndSendTransaction]);

  // Send native SOL using Privy wallet
  const sendSOL = useCallback(async (recipientAddress, amount) => {
    if (!activePublicKey) throw new Error('Wallet not connected');
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    
    try {
      const fromPubkey = new PublicKey(activePublicKey);
      const toPubkey = new PublicKey(recipientAddress);
      
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      const signature = await signAndSendTransaction(transaction);
      
      return { success: true, signature };
    } catch (error) {
      console.error('SOL send error:', error);
      throw error;
    }
  }, [activePublicKey, signAndSendTransaction]);

  return {
    // Auth state
    ready,
    isAuthenticated,
    isConnected,
    walletType,
    user,
    isWalletReady: walletType === 'privy' ? isPrivyWalletReady() : false,

    // Wallet info
    publicKey: activePublicKey,
    privyPublicKey,
    balance,
    usdcBalance,
    connection,

    // Actions
    loginWithPrivy,
    disconnect,
    signAndSendTransaction,
    signTransaction,
    sendUSDC,
    sendSOL,
    refreshBalance: async () => {
      if (activePublicKey) {
        await Promise.all([
          fetchBalance(activePublicKey),
          fetchUsdcBalance(activePublicKey)
        ]);
      }
    },
    isPrivyLoading: !ready,
  };
}
