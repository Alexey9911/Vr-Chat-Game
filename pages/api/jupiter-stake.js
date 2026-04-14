/**
 * /api/jupiter-stake — Deposit/withdraw via Jupiter Lend Earn API
 * Returns unsigned base64 transaction for client-side signing with Privy
 */

const JUPITER_API_KEY = 'b97cb370-0a76-4706-954e-fdff19fef2a3';

// Only tokens supported by Jupiter Earn vaults
const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  EURC: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
  USDG: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH',
  USDS: 'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA',
};

const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  EURC: 6,
  USDG: 6,
  USDS: 6,
};

const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=58005a1c-f710-494f-913f-055a35c4404c';
const SUPPORTED_EARN_TOKENS = Object.keys(TOKEN_MINTS);

function resolveAsset(tokenInput) {
  if (!tokenInput) return null;
  const upper = tokenInput.trim().toUpperCase();
  if (TOKEN_MINTS[upper]) {
    return { mint: TOKEN_MINTS[upper], decimals: TOKEN_DECIMALS[upper], symbol: upper };
  }
  return null;
}

async function checkTokenBalance(userPublicKey, mint, decimals) {
  try {
    if (mint === TOKEN_MINTS.SOL) {
      const resp = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [userPublicKey] }),
      });
      const data = await resp.json();
      return (data?.result?.value || 0) / 1e9;
    } else {
      const resp = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
          params: [userPublicKey, { mint }, { encoding: 'jsonParsed' }],
        }),
      });
      const data = await resp.json();
      const accounts = data?.result?.value || [];
      if (accounts.length > 0) {
        return parseFloat(accounts[0].account.data.parsed.info.tokenAmount.uiAmountString || '0');
      }
      return 0;
    }
  } catch {
    return -1; // Unknown, skip check
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, token, amount, userPublicKey } = req.body;

    if (!userPublicKey) {
      return res.status(400).json({ success: false, error: 'Wallet not connected' });
    }

    const resolved = resolveAsset(token);
    if (!resolved) {
      return res.status(400).json({ success: false, error: `Token "${token}" is not supported for Jupiter Earn. Supported: ${SUPPORTED_EARN_TOKENS.join(', ')}` });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const scaledAmount = Math.floor(numericAmount * Math.pow(10, resolved.decimals)).toString();

    console.log(`📥 Jupiter Lend ${action}:`, { token: resolved.symbol, amount: numericAmount, scaledAmount, user: userPublicKey });

    // Check user has enough balance before calling Jupiter API
    if (action === 'deposit') {
      const userBalance = await checkTokenBalance(userPublicKey, resolved.mint, resolved.decimals);
      console.log(`📊 User ${resolved.symbol} balance: ${userBalance}`);
      if (userBalance >= 0 && userBalance < numericAmount) {
        const has = userBalance === 0 ? `You don't have any ${resolved.symbol}` : `You only have ${userBalance.toFixed(4)} ${resolved.symbol}`;
        return res.status(400).json({
          success: false,
          error: `${has}, but tried to stake ${numericAmount} ${resolved.symbol}. You need to hold the token first — try swapping to ${resolved.symbol} before staking.`,
        });
      }
    }

    if (action === 'deposit') {
      const resp = await fetch('https://api.jup.ag/lend/v1/earn/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': JUPITER_API_KEY,
        },
        body: JSON.stringify({
          asset: resolved.mint,
          signer: userPublicKey,
          amount: scaledAmount,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.transaction) {
        console.error('Jupiter Lend Deposit Error:', data);
        return res.status(400).json({
          success: false,
          error: data.error || data.message || 'Failed to create deposit transaction',
        });
      }

      console.log('✅ Deposit transaction generated');
      return res.status(200).json({
        success: true,
        transaction: data.transaction,
        token: resolved.symbol,
        amount: numericAmount,
        action: 'deposit',
      });

    } else if (action === 'withdraw') {
      const resp = await fetch('https://api.jup.ag/lend/v1/earn/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': JUPITER_API_KEY,
        },
        body: JSON.stringify({
          asset: resolved.mint,
          signer: userPublicKey,
          amount: scaledAmount,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.transaction) {
        console.error('Jupiter Lend Withdraw Error:', data);
        return res.status(400).json({
          success: false,
          error: data.error || data.message || 'Failed to create withdraw transaction',
        });
      }

      console.log('✅ Withdraw transaction generated');
      return res.status(200).json({
        success: true,
        transaction: data.transaction,
        token: resolved.symbol,
        amount: numericAmount,
        action: 'withdraw',
      });

    } else {
      return res.status(400).json({ success: false, error: `Unknown action: ${action}. Use "deposit" or "withdraw"` });
    }

  } catch (error) {
    console.error('Jupiter Stake API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
