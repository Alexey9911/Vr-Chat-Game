// Mock prediction markets for testing (Jupiter Prediction API is in beta)
const MOCK_MARKETS = [
  {
    id: 'mock-btc-100k',
    eventId: 'btc-price-2026',
    title: 'Will Bitcoin reach $100k by end of 2026?',
    description: 'Market resolves YES if BTC price reaches $100,000 USD on any major exchange before Dec 31, 2026',
    category: 'crypto',
    yesPrice: 0.68,
    noPrice: 0.32,
    volume: 125000,
    liquidity: 45000,
    closeTime: '2026-12-31T23:59:59Z',
    status: 'open'
  },
  {
    id: 'mock-sol-eth',
    eventId: 'sol-flip-eth',
    title: 'Will Solana flip Ethereum in market cap?',
    description: 'Resolves YES if SOL market cap exceeds ETH market cap for 7 consecutive days',
    category: 'crypto',
    yesPrice: 0.15,
    noPrice: 0.85,
    volume: 89000,
    liquidity: 32000,
    closeTime: '2027-01-01T00:00:00Z',
    status: 'open'
  },
  {
    id: 'mock-nfl-chiefs',
    eventId: 'nfl-superbowl-2026',
    title: 'Will Kansas City Chiefs win Super Bowl 2026?',
    description: 'Resolves YES if Chiefs win Super Bowl LXI in February 2027',
    category: 'sports',
    yesPrice: 0.42,
    noPrice: 0.58,
    volume: 234000,
    liquidity: 78000,
    closeTime: '2027-02-01T00:00:00Z',
    status: 'open'
  },
  {
    id: 'mock-ai-agi',
    eventId: 'agi-2026',
    title: 'Will AGI be achieved by end of 2026?',
    description: 'Resolves YES if a major AI lab announces AGI with independent verification',
    category: 'tech',
    yesPrice: 0.08,
    noPrice: 0.92,
    volume: 156000,
    liquidity: 54000,
    closeTime: '2026-12-31T23:59:59Z',
    status: 'open'
  },
  {
    id: 'mock-trump-2024',
    eventId: 'us-election-2024',
    title: 'Will Trump win the 2024 US Presidential Election?',
    description: 'Resolves YES if Donald Trump wins the electoral college in November 2024',
    category: 'politics',
    yesPrice: 0.53,
    noPrice: 0.47,
    volume: 892000,
    liquidity: 234000,
    closeTime: '2024-11-06T00:00:00Z',
    status: 'open'
  }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category } = req.query;
    
    // Try real Jupiter API first
    const url = category 
      ? `https://api.jup.ag/prediction/v1/events?category=${category}&status=open`
      : 'https://api.jup.ag/prediction/v1/events?status=open';

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Transform events to flat market list
        const markets = [];
        const events = data.events || data || [];
        
        for (const event of events) {
          if (event.markets && Array.isArray(event.markets)) {
            for (const market of event.markets) {
              if (market.status === 'open') {
                markets.push({
                  id: market.id || market.marketId,
                  eventId: event.id || event.eventId,
                  title: market.title || event.title,
                  description: market.description || event.description,
                  category: event.category,
                  yesPrice: market.yesPrice || market.pricing?.yes?.buy || 0.5,
                  noPrice: market.noPrice || market.pricing?.no?.buy || 0.5,
                  volume: market.volume || 0,
                  liquidity: market.liquidity || 0,
                  closeTime: market.closeTime || event.closeTime,
                  status: market.status
                });
              }
            }
          }
        }

        if (markets.length > 0) {
          return res.status(200).json({
            success: true,
            markets: markets.slice(0, 5),
            total: markets.length,
            source: 'jupiter-api'
          });
        }
      }
    } catch (apiError) {
      console.warn('Jupiter API unavailable, using mock data:', apiError.message);
    }

    // Fallback to mock data (Jupiter Prediction API is in beta)
    let markets = MOCK_MARKETS;
    
    // Filter by category if specified
    if (category) {
      markets = markets.filter(m => m.category === category.toLowerCase());
    }

    res.status(200).json({
      success: true,
      markets: markets.slice(0, 5),
      total: markets.length,
      source: 'mock-data',
      note: 'Jupiter Prediction API is in beta. Using demo markets for testing.'
    });

  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch prediction markets'
    });
  }
}
