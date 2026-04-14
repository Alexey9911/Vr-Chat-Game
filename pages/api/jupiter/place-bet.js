import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=d7b6c0e1-5b5a-4f5a-9f5a-5f5a5f5a5f5a';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { marketId, side, contracts, walletAddress } = req.body;

    if (!marketId || !side || !contracts || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: marketId, side, contracts, walletAddress'
      });
    }

    // Check if this is a mock market (for demo/testing)
    const isMockMarket = marketId.startsWith('mock-');

    if (isMockMarket) {
      // Create a simple demo transaction for mock markets
      // This simulates the Jupiter prediction market transaction structure
      const connection = new Connection(SOLANA_RPC, 'confirmed');
      const userPubkey = new PublicKey(walletAddress);
      const { blockhash } = await connection.getLatestBlockhash();

      // Create a minimal transaction (send 0.001 SOL to self as placeholder)
      const transaction = new Transaction({
        feePayer: userPubkey,
        blockhash: blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
      });

      // Add a minimal instruction (this would be the prediction market instruction in production)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 1000 // 0.000001 SOL placeholder
        })
      );

      // Serialize transaction to base64
      const serialized = transaction.serialize({ requireAllSignatures: false }).toString('base64');

      return res.status(200).json({
        success: true,
        orderPubkey: `demo-order-${Date.now()}`,
        transaction: serialized,
        estimatedCost: contracts * (side === 'YES' ? 0.68 : 0.32), // Mock cost
        contracts: parseInt(contracts),
        side: side.toUpperCase(),
        note: 'Demo transaction for testing. In production, this would create a real Jupiter prediction order.'
      });
    }

    // Try real Jupiter API for non-mock markets
    try {
      const response = await fetch('https://api.jup.ag/prediction/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          marketId: marketId,
          side: side.toUpperCase(),
          contracts: parseInt(contracts),
          owner: walletAddress
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json({
          success: true,
          orderPubkey: data.orderPubkey || data.order?.pubkey,
          transaction: data.transaction,
          estimatedCost: data.estimatedCost || data.cost,
          contracts: parseInt(contracts),
          side: side.toUpperCase()
        });
      }
    } catch (apiError) {
      console.warn('Jupiter API unavailable:', apiError.message);
    }

    // Fallback error if no mock and API failed
    throw new Error('Jupiter Prediction API is currently unavailable. Please use demo markets for testing.');

  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to place bet'
    });
  }
}
