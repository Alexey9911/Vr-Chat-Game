import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Primary: Helius RPC (faster, better rate limits)
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=58005a1c-f710-494f-913f-055a35c4404c';
const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com'; // Fallback

// Try Helius first, fallback to public if needed
let connection;
try {
  connection = new Connection(HELIUS_RPC, 'confirmed');
} catch (err) {
  console.warn('Helius RPC failed, using public RPC');
  connection = new Connection(PUBLIC_RPC, 'confirmed');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, publicKey } = req.body;

    if (action === 'getBalance') {
      if (!publicKey) {
        return res.status(400).json({ success: false, error: 'Missing publicKey' });
      }

      const pubkeyObj = new PublicKey(publicKey);
      const balanceLamports = await connection.getBalance(pubkeyObj);
      const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
      
      return res.status(200).json({
        success: true,
        balance: balanceSol,
        lamports: balanceLamports
      });
    }

    if (action === 'getLatestBlockhash') {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      return res.status(200).json({ success: true, blockhash, lastValidBlockHeight });
    }

    if (action === 'getHistory') {
      if (!publicKey) return res.status(400).json({ success: false, error: 'Missing publicKey' });
      const pubkeyObj = new PublicKey(publicKey);
      const sigs = await connection.getSignaturesForAddress(pubkeyObj, { limit: 3 });
      return res.status(200).json({ success: true, history: sigs });
    }

    if (action === 'getTokens') {
      if (!publicKey) return res.status(400).json({ success: false, error: 'Missing publicKey' });
      const pubkeyObj = new PublicKey(publicKey);
      const parsedAccounts = await connection.getParsedTokenAccountsByOwner(pubkeyObj, {
        programId: TOKEN_PROGRAM_ID
      });
      const tokens = parsedAccounts.value
        .map(acc => {
          const info = acc.account.data.parsed.info;
          return { mint: info.mint, amount: info.tokenAmount.uiAmountString, decimals: info.tokenAmount.decimals };
        })
        .filter(t => parseFloat(t.amount) > 0);
      return res.status(200).json({ success: true, tokens });
    }

    if (action === 'getPortfolio') {
      if (!publicKey) return res.status(400).json({ success: false, error: 'Missing publicKey' });
      const pubkeyObj = new PublicKey(publicKey);

      // Fetch SOL balance + all SPL tokens in parallel
      const [balanceLamports, parsedAccounts] = await Promise.all([
        connection.getBalance(pubkeyObj, 'confirmed'),
        connection.getParsedTokenAccountsByOwner(pubkeyObj, { programId: TOKEN_PROGRAM_ID })
      ]);

      const solBalance = balanceLamports / LAMPORTS_PER_SOL;

      // Filter tokens with balance > 0
      const splTokens = parsedAccounts.value
        .map(acc => {
          const info = acc.account.data.parsed.info;
          return {
            mint: info.mint,
            amount: parseFloat(info.tokenAmount.uiAmountString || '0'),
            decimals: info.tokenAmount.decimals,
          };
        })
        .filter(t => t.amount > 0);

      // Resolve metadata from Jupiter token list (batch call)
      let tokenMeta = {};
      if (splTokens.length > 0) {
        try {
          const allResp = await fetch('https://api.jup.ag/tokens/v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mints: splTokens.map(t => t.mint) })
          });
          if (allResp.ok) {
            const allData = await allResp.json();
            if (Array.isArray(allData)) {
              allData.forEach(t => { tokenMeta[t.address] = t; });
            }
          }
        } catch (e) {
          console.warn('Jupiter token metadata batch failed:', e.message);
        }
      }

      // Well-known token fallbacks
      const KNOWN_TOKENS = {
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', logoURI: 'https://static.jup.ag/jup/icon.png' },
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png' },
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', name: 'dogwifhat', logoURI: 'https://bafkreibk3covs5ltyqxa272uodhber4nt6krwz2fc3s3whsg43ycmlfqwi.ipfs.nftstorage.link' },
      };

      const assets = [
        {
          symbol: 'SOL',
          name: 'Solana',
          mint: 'So11111111111111111111111111111111111111112',
          amount: solBalance,
          decimals: 9,
          logoURI: '/images/solana.svg',
          isNative: true,
        },
        ...splTokens.map(t => {
          const meta = tokenMeta[t.mint] || KNOWN_TOKENS[t.mint] || {};
          return {
            symbol: meta.symbol || t.mint.slice(0, 4) + '...',
            name: meta.name || 'Unknown Token',
            mint: t.mint,
            amount: t.amount,
            decimals: t.decimals,
            logoURI: meta.logoURI || meta.logo_uri || null,
            isNative: false,
          };
        })
      ];

      return res.status(200).json({ success: true, assets });
    }

    if (action === 'getPrice') {
      const id = req.body.tokenId || 'SOL';
      // Don't uppercase if it looks like a mint address (long alphanumeric string)
      const ticker = id.length > 20 ? id : id.toUpperCase();
      
      // Token mint addresses mapping
      const TOKEN_MINTS = {
        SOL: 'So11111111111111111111111111111111111111112',
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
        ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      };
      
      const JUPITER_API_KEY = 'b97cb370-0a76-4706-954e-fdff19fef2a3';
      
      try {
        // Primary: Jupiter Price API v3 (works for major tokens)
        const mintAddress = TOKEN_MINTS[ticker] || ticker;
        console.log(`[DEBUG] Getting price for ticker: ${ticker}, mint: ${mintAddress}`);
        
        const pRes = await fetch(`https://api.jup.ag/price/v3?ids=${mintAddress}`, {
          headers: {
            'Accept': 'application/json',
            'x-api-key': JUPITER_API_KEY,
          }
        });
        
        if (!pRes.ok) {
          console.log(`[DEBUG] Price API returned status ${pRes.status}`);
          throw new Error(`Jupiter Price API returned ${pRes.status}`);
        }
        
        const pData = await pRes.json();
        console.log(`[DEBUG] Price API response for ${mintAddress}:`, pData.data?.[mintAddress] ? 'has data' : 'null');
        
        // Jupiter v3 returns data in format: { data: { [mint]: { price: number } } }
        if (pData.data && pData.data[mintAddress] && pData.data[mintAddress].price) {
          console.log(`[DEBUG] Found price in Price API: ${pData.data[mintAddress].price}`);
          return res.status(200).json({ 
            success: true, 
            price: parseFloat(pData.data[mintAddress].price), 
            id: ticker,
            source: 'jupiter-price-v3'
          });
        }
        
        // If Price API returns null, try Tokens API (works for memecoins/small tokens)
        console.log(`[DEBUG] Price API returned null, trying Tokens API...`);
        
        const tokensRes = await fetch(`https://api.jup.ag/tokens/v2/search?query=${mintAddress}`, {
          headers: {
            'Accept': 'application/json',
            'x-api-key': JUPITER_API_KEY,
          }
        });
        
        console.log(`[DEBUG] Tokens API status: ${tokensRes.status}`);
        
        if (tokensRes.ok) {
          const tokensData = await tokensRes.json();
          console.log(`[DEBUG] Tokens API returned ${tokensData?.length || 0} results`);
          
          if (tokensData && tokensData.length > 0) {
            const token = tokensData[0];
            console.log(`[DEBUG] First token: ${token.name} (${token.symbol}), price: ${token.usdPrice}, mcap: ${token.mcap}`);
            
            if (token.usdPrice && token.usdPrice > 0) {
              console.log(`[DEBUG] SUCCESS - Returning price from Tokens API: ${token.usdPrice}`);
              return res.status(200).json({ 
                success: true, 
                price: parseFloat(token.usdPrice), 
                id: ticker,
                tokenName: token.name,
                tokenSymbol: token.symbol,
                marketCap: token.mcap || null,
                fdv: token.fdv || null,
                liquidity: token.liquidity || null,
                source: 'jupiter-tokens-v2'
              });
            } else {
              console.log(`[DEBUG] Token found but usdPrice is ${token.usdPrice}`);
            }
          } else {
            console.log(`[DEBUG] Tokens API returned empty array`);
          }
        } else {
          console.log(`[DEBUG] Tokens API request failed`);
        }
        
        // If both Jupiter APIs fail, throw error to try external fallbacks
        console.log(`[DEBUG] Both Jupiter APIs failed, trying external fallbacks...`);
        throw new Error("Jupiter APIs returned no price data");
      } catch (err) {
        console.error(`[ERROR] Jupiter APIs failed for ${ticker}:`, err.message);
        
        try {
          // Fallback 1: Binance API for major coins
          if (['BTC', 'ETH', 'SOL', 'USDT'].includes(ticker)) {
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}USDT`);
            const bData = await bRes.json();
            if (bData.price) {
              return res.status(200).json({ 
                success: true, 
                price: parseFloat(bData.price), 
                id: ticker 
              });
            }
          }
          
          // Stablecoin fallback
          if (ticker === 'USDC') {
            return res.status(200).json({ success: true, price: 1.0, id: 'USDC' });
          }
          
          // Fallback 2: CoinGecko API (more reliable than DexScreener)
          const coinGeckoIds = {
            SOL: 'solana',
            BTC: 'bitcoin',
            ETH: 'ethereum',
            BONK: 'bonk',
            JUP: 'jupiter-exchange-solana',
            RAY: 'raydium',
            WIF: 'dogwifcoin',
          };
          
          if (coinGeckoIds[ticker]) {
            const cgRes = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds[ticker]}&vs_currencies=usd`
            );
            const cgData = await cgRes.json();
            if (cgData[coinGeckoIds[ticker]]?.usd) {
              return res.status(200).json({ 
                success: true, 
                price: cgData[coinGeckoIds[ticker]].usd, 
                id: ticker 
              });
            }
          }
          
          // Last resort: DexScreener
          const dRes = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${ticker}`);
          const dData = await dRes.json();
          const match = dData.pairs?.find(p => 
            p.chainId === 'solana' && 
            p.baseToken.symbol.toUpperCase() === ticker
          );
          
          if (match?.priceUsd) {
            return res.status(200).json({ 
              success: true, 
              price: parseFloat(match.priceUsd), 
              id: ticker 
            });
          }
          
          throw new Error('No price data available from any source');
        } catch (fallbackErr) {
          console.error('All Price APIs failed:', fallbackErr);
          return res.status(200).json({ 
            success: false, 
            price: 0, 
            id: ticker,
            error: 'Unable to fetch price from any source'
          });
        }
      }
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });

  } catch (error) {
    console.error('Solana RPC Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to execute Solana RPC call' 
    });
  }
}
