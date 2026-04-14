/**
 * /api/jupiter-limit-order — Creates and executes limit orders via Jupiter Trigger API
 * Allows users to buy/sell tokens when price reaches a specific target
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
  PEPE: '3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump',
};

// Resolve ticker to mint address
function resolveTokenMint(tokenInput) {
  if (!tokenInput) return null;
  const upper = tokenInput.toUpperCase().trim();
  if (TOKEN_MINTS[upper]) return TOKEN_MINTS[upper];
  if (tokenInput.length >= 32) return tokenInput;
  return null;
}

// Token decimals
const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  BONK: 5,
  JUP: 6,
  RAY: 6,
  WIF: 6,
  PEPE: 6,
};

function getDecimals(mintOrTicker) {
  const upper = (mintOrTicker || '').toUpperCase().trim();
  if (TOKEN_DECIMALS[upper]) return TOKEN_DECIMALS[upper];
  if (mintOrTicker === TOKEN_MINTS.SOL) return 9;
  if (mintOrTicker === TOKEN_MINTS.USDC || mintOrTicker === TOKEN_MINTS.USDT) return 6;
  return 9;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, userPublicKey } = req.body;

    // API Key for Jupiter
    const JUPITER_API_KEY = 'b97cb370-0a76-4706-954e-fdff19fef2a3';
    const jupiterHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': JUPITER_API_KEY
    };

    // ═══════════════════════════════════════════════════════
    // ACTION: CREATE LIMIT ORDER
    // ═══════════════════════════════════════════════════════
    if (action === 'createLimitOrder') {
      const { 
        inputTicker, 
        outputTicker, 
        inputAmount,  // Amount of input token to spend
        targetPrice,  // Target price (outputToken per inputToken)
        slippageBps = 0 // Default 0 for "Exact" mode
      } = req.body;

      if (!userPublicKey) {
        return res.status(400).json({ success: false, error: 'Wallet not connected' });
      }

      const inputMint = resolveTokenMint(inputTicker);
      const outputMint = resolveTokenMint(outputTicker);

      if (!inputMint || !outputMint) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid token. Use tickers like SOL, BONK, USDC, etc.' 
        });
      }

      // Calculate amounts in base units
      const inputDecimals = getDecimals(inputTicker);
      const outputDecimals = getDecimals(outputTicker);
      
      const makingAmount = Math.floor(inputAmount * Math.pow(10, inputDecimals)).toString();
      const takingAmount = Math.floor(inputAmount * targetPrice * Math.pow(10, outputDecimals)).toString();

      // Create limit order
      const createResp = await fetch('https://api.jup.ag/trigger/v1/createOrder', {
        method: 'POST',
        headers: jupiterHeaders,
        body: JSON.stringify({
          maker: userPublicKey,
          payer: userPublicKey,
          inputMint,
          outputMint,
          makingAmount,
          takingAmount,
          expiredAt: null, // No expiration
          feeBps: 0,
          slippageBps, // 0 = Exact mode, >0 = Ultra mode
        }),
      });

      const createData = await createResp.json();

      if (createData.error) {
        return res.status(400).json({ 
          success: false, 
          error: createData.error 
        });
      }

      return res.status(200).json({
        success: true,
        transaction: createData.transaction,
        requestId: createData.requestId,
        order: createData.order,
        details: {
          inputToken: inputTicker,
          outputToken: outputTicker,
          inputAmount,
          targetPrice,
          expectedOutput: inputAmount * targetPrice,
        }
      });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: EXECUTE LIMIT ORDER (after signing)
    // ═══════════════════════════════════════════════════════
    if (action === 'executeLimitOrder') {
      const { signedTransaction, requestId } = req.body;

      if (!signedTransaction || !requestId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing signedTransaction or requestId' 
        });
      }

      const executeResp = await fetch('https://api.jup.ag/trigger/v1/execute', {
        method: 'POST',
        headers: jupiterHeaders,
        body: JSON.stringify({
          signedTransaction,
          requestId,
        }),
      });

      const executeData = await executeResp.json();

      if (executeData.status === 'Success') {
        return res.status(200).json({
          success: true,
          signature: executeData.signature,
          order: executeData.order,
          status: 'created',
          message: 'Limit order created successfully. It will execute when price target is reached.'
        });
      }

      return res.status(400).json({
        success: false,
        error: executeData.error || executeData.code || 'Failed to execute limit order'
      });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: GET USER'S LIMIT ORDERS
    // ═══════════════════════════════════════════════════════
    if (action === 'getLimitOrders') {
      if (!userPublicKey) {
        return res.status(400).json({ success: false, error: 'Wallet not connected' });
      }

      const ordersResp = await fetch(
        `https://api.jup.ag/trigger/v1/getTriggerOrders?wallet=${userPublicKey}`,
        { headers: jupiterHeaders }
      );

      const ordersData = await ordersResp.json();

      if (ordersData.error) {
        return res.status(400).json({ success: false, error: ordersData.error });
      }

      // Format orders for display
      const formattedOrders = (ordersData.orders || []).map(order => ({
        orderKey: order.orderKey,
        inputMint: order.inputMint,
        outputMint: order.outputMint,
        makingAmount: order.makingAmount,
        takingAmount: order.takingAmount,
        status: order.status,
        createdAt: order.createdAt,
        // Calculate price
        price: parseFloat(order.takingAmount) / parseFloat(order.makingAmount),
      }));

      return res.status(200).json({
        success: true,
        orders: formattedOrders,
        total: formattedOrders.length
      });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: CANCEL LIMIT ORDER
    // ═══════════════════════════════════════════════════════
    if (action === 'cancelLimitOrder') {
      const { orderKey } = req.body;

      if (!userPublicKey || !orderKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing wallet or orderKey' 
        });
      }

      const cancelResp = await fetch('https://api.jup.ag/trigger/v1/cancelOrder', {
        method: 'POST',
        headers: jupiterHeaders,
        body: JSON.stringify({
          maker: userPublicKey,
          orderKey,
        }),
      });

      const cancelData = await cancelResp.json();

      if (cancelData.error) {
        return res.status(400).json({ success: false, error: cancelData.error });
      }

      return res.status(200).json({
        success: true,
        transaction: cancelData.transaction,
        requestId: cancelData.requestId,
        message: 'Order cancellation transaction ready to sign'
      });
    }

    return res.status(400).json({ 
      success: false, 
      error: 'Unknown action. Use: createLimitOrder, executeLimitOrder, getLimitOrders, cancelLimitOrder' 
    });

  } catch (error) {
    console.error('Jupiter Limit Order API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process limit order request' 
    });
  }
}
