// Amazon Product Search using RapidAPI
// Free API: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-amazon-data

// Multiple API keys for rotation (100 requests each = 200 total)
const RAPIDAPI_KEYS = [
  process.env.RAPIDAPI_KEY_1 || '442a458117msha0f1d8b998ba565p13fd2fjsn2af4933a67bb',
  process.env.RAPIDAPI_KEY_2 || '05280094a7msh84191c1ebc7f655p1617f9jsnb81e6580170d',
].filter(Boolean); // Remove empty keys

const RAPIDAPI_HOST = 'real-time-amazon-data.p.rapidapi.com';

// Round-robin counter for key rotation
let currentKeyIndex = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, maxPrice, minRating } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Search Amazon products via RapidAPI with key rotation
    // Documentation: https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-amazon-data
    const searchParams = new URLSearchParams({
      query: query,
      page: '1',
      country: 'US',
      sort_by: 'RELEVANCE', // Options: RELEVANCE, LOWEST_PRICE, HIGHEST_PRICE, REVIEWS, NEWEST
    });

    const apiUrl = `https://${RAPIDAPI_HOST}/search?${searchParams}`;
    
    // Try all available API keys with rotation
    let response = null;
    let lastError = null;
    
    for (let attempt = 0; attempt < RAPIDAPI_KEYS.length; attempt++) {
      // Get current key and rotate for next request
      const apiKey = RAPIDAPI_KEYS[currentKeyIndex];
      currentKeyIndex = (currentKeyIndex + 1) % RAPIDAPI_KEYS.length;
      
      console.log(`[Amazon Search] Attempt ${attempt + 1}/${RAPIDAPI_KEYS.length} - Using API key #${currentKeyIndex === 0 ? RAPIDAPI_KEYS.length : currentKeyIndex} (${apiKey.substring(0, 15)}...)`);

      try {
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
        });

        console.log(`[Amazon Search] Response status: ${response.status}`);

        // If successful, break the loop
        if (response.ok) {
          console.log(`[Amazon Search] ✅ Success with API key #${currentKeyIndex === 0 ? RAPIDAPI_KEYS.length : currentKeyIndex}`);
          break;
        }

        // If rate limited (429) or forbidden (403), try next key
        if (response.status === 429 || response.status === 403) {
          const errorText = await response.text();
          lastError = { status: response.status, message: errorText };
          console.log(`[Amazon Search] ⚠️ Key #${currentKeyIndex === 0 ? RAPIDAPI_KEYS.length : currentKeyIndex} failed (${response.status}), trying next key...`);
          response = null;
          continue;
        }

        // For other errors, break and return the error
        break;

      } catch (error) {
        lastError = { status: 500, message: error.message };
        console.error(`[Amazon Search] ❌ Request failed:`, error.message);
        response = null;
        continue;
      }
    }

    // If all keys failed
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : lastError?.message || 'All API keys exhausted';
      console.error('[Amazon Search] All API keys failed:', lastError);
      return res.status(500).json({ 
        error: 'Failed to search Amazon products',
        details: errorText,
        status: response?.status || lastError?.status || 500,
        message: 'All API keys exhausted or rate limited',
        fallback: true 
      });
    }

    const data = await response.json();
    
    // Transform API response to our format
    // API returns { data: { products: [...] } }
    const rawProducts = data?.data?.products || [];
    
    let products = rawProducts
      .map(p => ({
        asin: p.asin,
        title: p.product_title || 'Unknown Product',
        price: parseFloat((p.product_price || '').replace(/[^0-9.]/g, '') || '0'),
        rating: parseFloat(p.product_star_rating || '0'),
        reviewCount: parseInt(p.product_num_ratings || '0'),
        image: p.product_photo,
        url: p.product_url,
      }))
      .filter(p => p.price > 0); // Remove products without price

    // Apply filters
    if (maxPrice) {
      products = products.filter(p => p.price <= maxPrice);
    }
    if (minRating) {
      products = products.filter(p => p.rating >= minRating);
    }

    // Sort by price (low to high) and limit to top 5
    products = products
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    return res.status(200).json({ 
      success: true, 
      products,
      query,
    });

  } catch (error) {
    console.error('Amazon search error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
