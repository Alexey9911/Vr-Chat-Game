/**
 * /api/jupiter-quote — Gets a swap quote + serialized transaction from Jupiter
 * Uses Jupiter Swap API v1 (api.jup.ag/swap/v1)
 * API key from portal.jup.ag for better rate limits
 */

// Common token mint addresses
const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
};

const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  BONK: 5,
  JUP: 6,
  RAY: 6,
  WIF: 6,
  BTC: 8,
  ETH: 8,
};

const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=58005a1c-f710-494f-913f-055a35c4404c';
const JUPITER_API_KEY = 'b97cb370-0a76-4706-954e-fdff19fef2a3';

function isMintAddress(str) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((str || '').trim());
}

async function getMintDecimals(mint) {
  if (mint === TOKEN_MINTS.SOL) return 9;
  if (mint === TOKEN_MINTS.USDC || mint === TOKEN_MINTS.USDT) return 6;

  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          mint,
          { encoding: 'jsonParsed' }
        ]
      })
    });
    
    const data = await response.json();
    const decimals = data?.result?.value?.data?.parsed?.info?.decimals;

    if (!Number.isInteger(decimals)) {
      console.warn(`Unable to resolve token decimals for mint ${mint}`);
      return 6; // Default safe fallback
    }

    return decimals;
  } catch (err) {
    console.error('Error fetching mint decimals:', err);
    return 6; // Default safe fallback
  }
}

// Resolve a ticker symbol (like "SOL") to a mint address
async function resolveToken(tokenInput) {
  if (!tokenInput) return null;

  const normalizedInput = tokenInput.trim();
  const upper = normalizedInput.toUpperCase();

  // 1. Direct match with our known mints
  if (TOKEN_MINTS[upper]) {
    return {
      mint: TOKEN_MINTS[upper],
      decimals: TOKEN_DECIMALS[upper],
      symbol: upper,
    };
  }

  // 2. Is it already a mint address?
  if (isMintAddress(normalizedInput)) {
    try {
      const decimals = await getMintDecimals(normalizedInput);
      return {
        mint: normalizedInput,
        decimals,
        symbol: 'Token', // Unknown symbol
      };
    } catch (e) {
      console.warn('Failed to get decimals for mint:', normalizedInput, e);
      return null;
    }
  }

  // 3. Search Jupiter API
  try {
    const query = encodeURIComponent(normalizedInput);
    const response = await fetch(`https://api.jup.ag/tokens/v1/search?query=${query}`, {
      headers: { 'Accept': 'application/json', 'x-api-key': JUPITER_API_KEY },
    });

    if (!response.ok) return null;
    const tokens = await response.json();
    
    if (Array.isArray(tokens) && tokens.length > 0) {
      // Find exact match first, then fallback to first result
      const match = tokens.find(t => t.symbol?.toUpperCase() === upper) || tokens[0];
      return {
        mint: match.address,
        decimals: match.decimals,
        symbol: match.symbol,
      };
    }
  } catch (e) {
    console.error('Jupiter token search error:', e);
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { inputTicker, outputTicker, amount, userPublicKey } = req.body;

    console.log('🔄 Swap request:', { inputTicker, outputTicker, amount, userPublicKey });

    const resolvedInput = await resolveToken(inputTicker || 'SOL');
    const resolvedOutput = await resolveToken(outputTicker);

    if (!resolvedInput) {
      return res.status(400).json({ success: false, error: `Unknown input token: ${inputTicker}` });
    }
    if (!resolvedOutput) {
      return res.status(400).json({ success: false, error: `Unknown output token: ${outputTicker}` });
    }
    if (!userPublicKey) {
      return res.status(400).json({ success: false, error: 'Wallet not connected' });
    }

    let numericAmount = Number(amount);
    
    // If amount is 0 or missing, try to fetch user's full balance for that token ("all" fallback)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      if (userPublicKey && resolvedInput) {
        try {
          console.log('⚠️ Amount is 0 — fetching full token balance as fallback...');
          if (resolvedInput.mint === TOKEN_MINTS.SOL) {
            const balResp = await fetch(HELIUS_RPC, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [userPublicKey] }),
            });
            const balData = await balResp.json();
            const lamports = balData?.result?.value || 0;
            numericAmount = Math.max(0, (lamports / 1e9) - 0.002); // Reserve 0.002 SOL for fees
            console.log(`📊 SOL balance: ${lamports / 1e9}, using: ${numericAmount}`);
          } else {
            const tokResp = await fetch(HELIUS_RPC, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
                params: [userPublicKey, { mint: resolvedInput.mint }, { encoding: 'jsonParsed' }],
              }),
            });
            const tokData = await tokResp.json();
            const accounts = tokData?.result?.value || [];
            if (accounts.length > 0) {
              numericAmount = parseFloat(accounts[0].account.data.parsed.info.tokenAmount.uiAmountString || '0');
              console.log(`📊 ${resolvedInput.symbol} balance: ${numericAmount}`);
            }
          }
        } catch (e) {
          console.error('Failed to fetch token balance fallback:', e.message);
        }
      }
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid swap amount' });
      }
    }

    const scaledAmount = Math.floor(numericAmount * Math.pow(10, resolvedInput.decimals));
    
    console.log('💱 Resolved tokens:', {
      input: `${resolvedInput.symbol} (${resolvedInput.mint})`,
      output: `${resolvedOutput.symbol} (${resolvedOutput.mint})`,
      scaledAmount
    });

    // 1. Get Quote from Jupiter Swap API v1
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${resolvedInput.mint}&outputMint=${resolvedOutput.mint}&amount=${scaledAmount}&slippageBps=50&restrictIntermediateTokens=true&maxAccounts=30`;
    console.log('🔍 Fetching quote:', quoteUrl);
    
    const quoteResp = await fetch(quoteUrl, {
      headers: { 'x-api-key': JUPITER_API_KEY }
    });
    const quoteData = await quoteResp.json();

    if (!quoteResp.ok || quoteData.error) {
      console.error('Jupiter Quote Error:', quoteData);
      return res.status(400).json({ 
        success: false, 
        error: quoteData.error || 'Failed to get quote from Jupiter' 
      });
    }

    // 2. Get Swap Transaction from Jupiter Swap API v1
    console.log('📝 Requesting swap transaction for user:', userPublicKey);
    const swapResp = await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': JUPITER_API_KEY },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        asLegacyTransaction: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 100000,
            priorityLevel: 'medium'
          }
        }
      })
    });

    const swapData = await swapResp.json();

    if (!swapResp.ok || swapData.error) {
      console.error('Jupiter Swap Error:', swapData);
      return res.status(400).json({ 
        success: false, 
        error: swapData.error || 'Failed to generate swap transaction' 
      });
    }

    if (!swapData.swapTransaction) {
      return res.status(400).json({ 
        success: false, 
        error: 'Jupiter API did not return a transaction' 
      });
    }

    // Calculate estimated output
    const estimatedOutput = quoteData.outAmount ? 
      (quoteData.outAmount / Math.pow(10, resolvedOutput.decimals)).toFixed(6) : '0';

    console.log('✅ Swap transaction generated successfully');

    return res.status(200).json({
      success: true,
      swapTransaction: swapData.swapTransaction,
      inputAmount: numericAmount,
      outputAmount: estimatedOutput,
      priceImpact: quoteData.priceImpactPct || 0,
      inputToken: resolvedInput.symbol,
      outputToken: resolvedOutput.symbol
    });

  } catch (error) {
    console.error('Swap API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
