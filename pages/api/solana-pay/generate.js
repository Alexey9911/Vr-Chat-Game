import { PublicKey } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import BigNumber from 'bignumber.js';
import QRCode from 'qrcode';

// Merchant wallet to receive payments
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'CsQckUWvnEBURG7h2KzScdCzQp4N879SyDhJ9dbymLFs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, product, shippingInfo, currency = 'USDC' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!product || !product.title) {
      return res.status(400).json({ error: 'Product information is required' });
    }

    // Create Solana Pay URL
    const recipient = new PublicKey(MERCHANT_WALLET);
    const amountBN = new BigNumber(amount);

    const label = `Neyrs - ${product.title.slice(0, 40)}...`;
    const message = shippingInfo?.name
      ? `Payment for ${product.title} - Ship to: ${shippingInfo.name}`
      : `Payment for ${product.title}`;

    const reference = new PublicKey(
      '11111111111111111111111111111111'
    );

    // Build URL params — omit splToken for native SOL payments
    const urlParams = {
      recipient,
      amount: amountBN,
      reference,
      label,
      message,
      memo: `Order: ${product.asin || product.flightUrl || 'N/A'}`,
    };

    // Only add splToken for USDC (not native SOL)
    if (currency !== 'SOL') {
      urlParams.splToken = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    }

    const url = encodeURL(urlParams);

    // Generate QR code as SVG string using qrcode library (works server-side)
    const qrSvg = await QRCode.toString(url.toString(), {
      type: 'svg',
      width: 400,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return res.status(200).json({
      success: true,
      paymentUrl: url.toString(),
      qrCode: qrSvg,
      amount: amount,
      currency: currency,
      recipient: MERCHANT_WALLET,
      reference: reference.toString(),
      label,
      message,
    });

  } catch (error) {
    console.error('Solana Pay generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate payment',
      details: error.message,
    });
  }
}
