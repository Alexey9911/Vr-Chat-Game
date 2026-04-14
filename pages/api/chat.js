// Multi-provider LLM: Cerebras (primary) → Groq (fallback)
// Each provider has its own URL, model, and API keys
const LLM_PROVIDERS = [
    {
        name: 'Cerebras',
        url: 'https://api.cerebras.ai/v1/chat/completions',
        model: 'qwen-3-235b-a22b-instruct-2507',
        keys: [
            'csk-k26yfr89ttnnxer2dvdxnm955p89thy9hmy54wnh5y52tyx5',
            'csk-9y8364c38ne4dh9439pmkr34t33xyhfkwyvc5xwc45fhn8t9',
        ],
    },
    {
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        keys: [
            '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',
            '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',
            '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',
            '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',
            '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',
            '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',
            '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',
        ],
    },
];
// Legacy aliases for compatibility with the rest of the code
const GROQ_API_KEYS = LLM_PROVIDERS.flatMap(p => p.keys);
let groqKeyIndex = 0;
const GROQ_API_URL = LLM_PROVIDERS[0].url;
const GROQ_MODEL = LLM_PROVIDERS[0].model;
const MAX_HISTORY_MESSAGES = 5;
const MAX_RESPONSE_WORDS = 60;
const MAX_RESPONSE_PARAGRAPHS = 2;
const MAX_OUTPUT_TOKENS = 400;
const DEFAULT_TIMEZONE = "UTC";

const SYSTEM_PROMPT_NORMAL = `You are Neyrs, a clear and concise AI assistant.
STRICT RULES:
1. ALWAYS respond in ENGLISH.
2. Keep answers short and useful: max 2 short paragraphs and max 60 words.
3. Be direct first, then briefly clarify if needed.
4. NO emojis.
5. Avoid repeating the same opening phrase across turns.
6. If asked what you can do, use a bulleted list to mention current capabilities (e.g., checking SOL & Token balances, sending SOL, swapping tokens on Jupiter) and state clearly that these are just *some* of the things you can do, hinting at more features.

SOCIAL LINKS RULES:
- Do NOT include social links in every response.
- ONLY include social links when the user EXPLICITLY asks for them (e.g., "what are your socials?", "give me your links", "where can I find you?").
- If the user asks something indirect like "who are you?" or "what is this?", you may include AT MOST 2 links: Twitter/X and Documentation.
- If the user does NOT ask about socials, do NOT include any links.

Available social links (use full URLs):
- Twitter/X: https://x.com/NeyrsAgent
- Telegram: https://t.me/NeyrsDeFI
- Documentation: https://www.neyrs.cloud
- GitHub: https://github.com/Neyrspmnd/neyrs-repo`;

const buildFlirtyPrompt = ({ isFirstAssistantTurn, currentUserName }) => {
    const firstTurnRule = isFirstAssistantTurn
        ? "This is your FIRST reply in this chat: respond naturally to the greeting without mentioning date or time unless specifically asked."
        : "Do NOT greet again. Continue directly with the answer in a lightly flirty tone.";

    const userNameRule = currentUserName
        ? `User name: ${currentUserName}. Use it only when natural.`
        : "User name is unknown.";

    return `You are Neyrs, a witty and efficient assistant with a subtle flirt vibe.
STRICT RULES:
1. ALWAYS respond in ENGLISH.
2. Answer the user's request first, then add light charm.
3. You MAY occasionally use "darling" but NOT in every reply. Use it at most once every 3-4 messages, and only when it feels natural (greetings, warm moments). For factual or action responses (prices, swaps, searches), do NOT use it.
4. Do NOT use "babe" or "honey".
5. No explicit sexual content and NO emojis.
6. Keep answers short: max 2 short paragraphs and max 60 words.
7. Avoid repeating wording from your previous reply.
8. Do NOT mention date, time, or timezone unless the user specifically asks for it.
9. If asked what you can do, use a bulleted list to mention current capabilities (e.g., checking balances, sending SOL, swapping tokens) and state clearly that these are just *some* of the things you can do, hinting at more features.
10. ${firstTurnRule}
11. ${userNameRule}

SOCIAL LINKS RULES:
- Do NOT include social links in every response.
- ONLY include social links when the user EXPLICITLY asks for them (e.g., "what are your socials?", "give me your links", "where can I find you?").
- If the user asks something indirect like "who are you?" or "what is this?", you may include AT MOST 2 links: Twitter/X and Documentation.
- If the user does NOT ask about socials, do NOT include any links.

Available social links (use full URLs):
- Twitter/X: https://x.com/NeyrsAgent
- Telegram: https://t.me/NeyrsDeFI
- Documentation: https://www.neyrs.cloud
- GitHub: https://github.com/Neyrspmnd/neyrs-repo

Example responses (darling used sparingly):
- "Hello, darling. How can I help you today?" (greeting = natural)
- "Checking the live price of SOL for you..." (factual = NO darling)
- "Swap initiated. 100 USDC → SOL on Jupiter." (action = NO darling)
- "That's a great question. Let me explain." (no darling needed)
- "Darling, I'd be happy to help with that." (warm moment = ok)`;
};

const clampParagraphs = (text, maxParagraphs) => {
    const paragraphs = text
        .replace(/\r/g, "")
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .slice(0, maxParagraphs);

    return paragraphs.join("\n\n");
};

const clampWords = (text, maxWords) => {
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text.trim();
    return `${words.slice(0, maxWords).join(" ")}...`;
};

const enforceSingleDarling = (text) => {
    // Replace babe/honey with darling
    let normalized = text.replace(/\b(babe|honey)\b/gi, "darling");

    // Count how many times "darling" appears
    const darlingMatches = normalized.match(/\bdarling\b/gi);
    const darlingCount = darlingMatches ? darlingMatches.length : 0;

    // If already has exactly one darling, keep it as is
    if (darlingCount === 1) {
        return normalized
            .replace(/\s{2,}/g, " ")
            .replace(/\s+([,.!?;:])/g, "$1")
            .trim();
    }

    // If has multiple darlings, keep only the first one
    if (darlingCount > 1) {
        let seenDarling = false;
        normalized = normalized.replace(/\bdarling\b/gi, () => {
            if (seenDarling) return "";
            seenDarling = true;
            return "darling";
        });
    }

    // If no darling at all, don't force it - let the AI decide
    // The prompt already instructs to use it once, so trust the model

    normalized = normalized
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .trim();

    return normalized;
};

const postProcessResponse = (rawText, mode) => {
    const fallback = mode === "flirt"
        ? "Darling, ask me that one more time and I'll keep it crisp."
        : "Please ask that again and I will answer briefly.";

    if (!rawText || typeof rawText !== "string") return fallback;

    let text = rawText.trim();
    if (!text) return fallback;

    text = clampParagraphs(text, MAX_RESPONSE_PARAGRAPHS);
    text = clampWords(text, MAX_RESPONSE_WORDS);
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    if (mode === "flirt") {
        text = enforceSingleDarling(text);
    }

    return text || fallback;
};

const isModelUnavailableError = (error) => {
    const message = String(error?.message || "").toLowerCase();
    return error?.status === 404 || message.includes("not found");
};

const isValidTimeZone = (timeZone) => {
    if (!timeZone || typeof timeZone !== "string") return false;
    try {
        Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
};

const normalizeWalletAction = (action, userMessage, walletInfo) => {
    if (!action || typeof action !== 'object') return action;

    const msg = (userMessage || '').toLowerCase();

    // Check for "all" or "todo" keywords in the user message or if AI set amount=0 (means "all")
    const isAll = /\b(all|todo|todos?|max|máximo|everything|completo)\b/.test(msg) || (action.amount === 0 || action.amount === '0');

    if (action.type === 'send_sol' || action.type === 'swap' || action.type === 'stake' || action.type === 'unstake') {
        const normalizedAction = { ...action };

        // Handle "all" balance logic — resolve amount from wallet context
        if (isAll && walletInfo) {
            const token = action.type === 'send_sol' ? 'SOL' : (action.type === 'swap' ? (action.from || 'SOL') : (action.token || 'SOL'));
            const upperToken = token.toUpperCase();

            // Try to find balance from assets array first (most complete source)
            const assetMatch = (walletInfo.assets || []).find(a => a.symbol && a.symbol.toUpperCase() === upperToken);

            if (assetMatch && assetMatch.amount > 0) {
                const amt = upperToken === 'SOL' ? Math.max(0, assetMatch.amount - 0.002) : assetMatch.amount;
                normalizedAction.amount = Number(amt.toFixed(6));
            } else if (upperToken === 'SOL' && walletInfo.balance !== null && walletInfo.balance > 0) {
                const maxSol = Math.max(0, walletInfo.balance - 0.002);
                normalizedAction.amount = Number(maxSol.toFixed(5));
            } else if (upperToken === 'USDC' && walletInfo.usdcBalance !== null && walletInfo.usdcBalance > 0) {
                normalizedAction.amount = walletInfo.usdcBalance;
            }
        } else {
            // Normal number parsing fallback if LLM missed it
            const explicitAmountMatch = msg.match(/(\d+(?:[\.,]\d+)?)\s*(?:sol|usdc|usdt)?\b/i);

            if (explicitAmountMatch?.[1] && !normalizedAction.amount) {
                const parsedAmount = parseFloat(explicitAmountMatch[1].replace(',', '.'));
                if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
                    normalizedAction.amount = parsedAmount;
                }
            } else if (normalizedAction.amount !== undefined) {
                const parsedAmount = Number(normalizedAction.amount);
                if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
                    normalizedAction.amount = parsedAmount;
                }
            }
        }

        return normalizedAction;
    }

    return action;
};

const getTemporalContext = (timeZone) => {
    const now = new Date();
    const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

    const dateLong = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(now);

    const timeShort = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).format(now);

    return { timeZone: tz, dateLong, timeShort };
};

const isTemporalQuestion = (text) => {
    if (!text || typeof text !== "string") return false;

    const temporalPatterns = [
        /\b(today'?s date|what date|current date|what day is it|what day is today)\b/i,
        /\b(what time|current time|time now|time is it)\b/i,
        /\b(fecha|que fecha|qué fecha|que dia|qué día|hora)\b/i
    ];

    return temporalPatterns.some((pattern) => pattern.test(text));
};

const buildTemporalReply = ({ message, mode, temporalContext }) => {
    const text = message.toLowerCase();
    const asksDate = /\b(date|today|day|fecha|día|dia)\b/i.test(text);
    const asksTime = /\b(time|hora)\b/i.test(text);
    const suffix = mode === "flirt" ? ", darling." : ".";

    if (asksDate && asksTime) {
        return `It is ${temporalContext.timeShort} on ${temporalContext.dateLong} (${temporalContext.timeZone})${suffix}`;
    }

    if (asksTime) {
        return `The current time is ${temporalContext.timeShort} (${temporalContext.timeZone})${suffix}`;
    }

    return `Today is ${temporalContext.dateLong}${suffix}`;
};

// Groq client initialized above (uses fetch, no SDK needed)

// ═══ WALLET ACTION SYSTEM PROMPT ═══
const WALLET_ACTION_PROMPT = `
You have WALLET CAPABILITIES. Execute swaps, sends, and staking directly — be fast and direct.

THE "amount" FIELD IN ACTIONS IS ALWAYS THE INPUT TOKEN AMOUNT (the token being sold/sent).

CRITICAL RULES:

1. **SWAP** — [ACTION]{"type":"swap","from":"SOL","to":"USDC","amount":1}[/ACTION]
   - Supports: SOL, USDC, USDT, BTC, ETH, BONK, JUP, RAY, WIF, and any Solana mint address.

2. **SEND** — [ACTION]{"type":"send_sol","to":"ADDRESS","amount":0.5}[/ACTION]

3. **STAKE** (Jupiter Earn) — [ACTION]{"type":"stake","token":"USDC","amount":10}[/ACTION]
   - Only: SOL, USDC, USDT, EURC, USDG, USDS. User MUST hold the token. If not, suggest swapping first.

4. **UNSTAKE** — [ACTION]{"type":"unstake","token":"USDC","amount":10}[/ACTION]

5. **LIMIT ORDER** — [ACTION]{"type":"create_limit_order","inputToken":"SOL","outputToken":"BONK","amount":1,"targetPrice":0.00001}[/ACTION]

6. **INFO** — Balance: [ACTION]{"type":"get_tokens"}[/ACTION] | Price: [ACTION]{"type":"get_price","tokenId":"solana"}[/ACTION] | History: [ACTION]{"type":"get_history"}[/ACTION]

═══ "ALL" / "TODO" / "EVERYTHING" ═══
When user says "todo", "all", "everything", "max", "todo el usdt", etc.:
- LOOK AT WALLET CONTEXT BALANCES. Find the token they mention.
- Use that EXACT balance as the amount. NEVER ask "how much?" if user said all/todo.
- For SOL: subtract 0.002 for fees. For other tokens: use the full balance.
- Example: WALLET CONTEXT shows USDT Balance: 0.84 → user says "swap todo el usdt a sol"
  → [ACTION]{"type":"swap","from":"USDT","to":"SOL","amount":0.84}[/ACTION]

═══ AMOUNT INTERPRETATION ═══
- "swap 1 SOL to USDT" → amount: 1, from: SOL, to: USDT (clear input amount)
- "swap 0.01 sol a usdt" → amount: 0.01, from: SOL, to: USDT
- "1 usdt" or "quiero 1 usdt" (user wants ~1 USDT output) → Use ~0.012 SOL (estimate from SOL price in context). If SOL price unknown, use amount: 0.012 as rough estimate for 1 USDT.
- If user gives a number after being asked "how much?", that number IS the input amount. Just use it.
- "una" / "uno" = 1

═══ CONVERSATIONAL FLOW ═══
- BE DIRECT. If you have enough info (from token, to token, amount), EXECUTE IMMEDIATELY.
- User's command IS the confirmation. No need to ask "are you sure?"
- Only ask if TRULY ambiguous: missing both amount AND token direction.
- If only amount is missing but tokens are clear, ask ONCE: "How much SOL?"
- If user replies with just a number like "0.5" or "todo", use it immediately with previous context.
- NEVER ask twice for the same info.

EXAMPLES:
User: "swap sol a usdt 0.01" → Swapping 0.01 SOL to USDT now...\n[ACTION]{"type":"swap","from":"SOL","to":"USDT","amount":0.01}[/ACTION]
User: "swap todo el usdt a sol" (USDT balance: 0.84) → Swapping all your USDT to SOL...\n[ACTION]{"type":"swap","from":"USDT","to":"SOL","amount":0.84}[/ACTION]
User: "swap sol a usdt" → How much SOL? (ask ONCE)
User: "0.5" → Swapping 0.5 SOL to USDT...\n[ACTION]{"type":"swap","from":"SOL","to":"USDT","amount":0.5}[/ACTION]
User: "todo" → (look at context, use full balance of token from previous conversation)

NEVER invent balances. Use WALLET CONTEXT data. Use action blocks for all operations.
`;

// Amazon shopping prompt — active when wallet is connected
const AMAZON_ACTION_PROMPT = `
You have AMAZON PRODUCT SEARCH CAPABILITIES. You can help users find products on Amazon.

AMAZON RULES:
1. SEARCH: When user wants to find/look for/compare products on Amazon → use amazon_search action
2. Be conversational before the action block (e.g. "Searching Amazon for that...").
3. For vague searches, ask 1 clarifying question about budget or rating preference.
4. After showing results, user can select a product to get payment details.

AMAZON ACTION FORMAT:
[ACTION]{"type":"amazon_search","query":"PRODUCT QUERY","maxPrice":OPTIONAL_NUM,"minRating":OPTIONAL_NUM}[/ACTION]

EXAMPLES:
User: "find me gaming mice under $40 with 4+ stars"
You: "Searching Amazon for gaming mice under $40 with great reviews...\n[ACTION]{"type":"amazon_search","query":"gaming mouse","maxPrice":40,"minRating":4}[/ACTION]"

User: "show me budget mechanical keyboards"
You: "Looking for budget mechanical keyboards on Amazon...\n[ACTION]{"type":"amazon_search","query":"budget mechanical keyboard"}[/ACTION]"

User: "compare Logitech G502 vs Razer DeathAdder"
You: "Searching for both to compare prices and features...\n[ACTION]{"type":"amazon_search","query":"Logitech G502 Razer DeathAdder"}[/ACTION]"
`;

// Flight booking prompt — real-time AeroDataBox API + USDC payments
const FLIGHT_BOOKING_PROMPT = `
You have FLIGHT BOOKING CAPABILITIES powered by real-time airline data. You can help users search and book flights, paid with USDC on Solana.

When user mentions flights, travel, flying, booking a trip, vacations, airports, airlines, or anything related to air travel:
- ALWAYS include the flight_search action.
- If the user mentions a DEPARTURE CITY/AIRPORT, include the "airport" field with its IATA code (e.g. MEX, JFK, LAX, MIA, CUN, GDL, MTY, ORD, DFW, SFO, LHR, CDG, etc.).
- If the user mentions a TIME REFERENCE (today, tomorrow, this week, next Monday, a specific date), include the "date" field in YYYY-MM-DD format. Calculate the actual date based on today's date.
- If the user is VAGUE (just "book a flight" with no city or date), send the action WITHOUT airport/date fields — the form will ask them.

IMPORTANT: When both airport AND date can be inferred, ALWAYS include both so results show instantly without asking the user again.

Common IATA codes: Mexico City=MEX, Cancún=CUN, Guadalajara=GDL, Monterrey=MTY, Tijuana=TIJ, New York=JFK, Los Angeles=LAX, Miami=MIA, Chicago=ORD, Dallas=DFW, Houston=IAH, San Francisco=SFO, Atlanta=ATL, London=LHR, Paris=CDG, Madrid=MAD, Dubai=DXB, Tokyo=NRT, Bogotá=BOG, São Paulo=GRU.

EXAMPLES:
User: "I want to fly from Mexico City to the US this week"
You: "Here are today's departures from Mexico City! Pick a flight to book with USDC.\n[ACTION]{"type":"flight_search","airport":"MEX","date":"2026-04-08"}[/ACTION]"

User: "flights from cancun tomorrow"
You: "Checking departures from Cancún for tomorrow!\n[ACTION]{"type":"flight_search","airport":"CUN","date":"2026-04-07"}[/ACTION]"

User: "I want to book a flight"
You: "Let's find you a flight! Pick your airport and date below.\n[ACTION]{"type":"flight_search"}[/ACTION]"

User: "fly from LAX next friday"
You: "Pulling up LAX departures for Friday!\n[ACTION]{"type":"flight_search","airport":"LAX","date":"2026-04-10"}[/ACTION]"
`;

// Prediction Markets prompt — always available (realistic fake flow, Solana Pay checkout)
const PREDICTION_MARKETS_PROMPT = `
You have PREDICTION MARKETS CAPABILITIES. You can help users browse and bet on real-world events, paid with SOL on Solana.

When user mentions predictions, betting, prediction markets, forecasting events, "will X happen", wagering, or anything related to predicting outcomes:
- Respond enthusiastically.
- Say something like: "Check out the hottest prediction markets right now! Pick a question, choose Yes or No, and place your bet with SOL."
- Include the prediction_markets action.

[ACTION]{"type":"prediction_markets"}[/ACTION]

IMPORTANT RULES:
- ALWAYS trigger the prediction_markets action when the user mentions anything related to predictions, betting on events, or forecasting.
- The inline form will show available markets, handle Yes/No selection, amount entry, and Solana Pay checkout.
- Be conversational and excited about helping them predict.
- If user is not logged in, still trigger the action — the payment step will require login.

EXAMPLES:
User: "show me prediction markets"
You: "Here are the hottest prediction markets! Pick a question and place your bet with SOL.\n[ACTION]{"type":"prediction_markets"}[/ACTION]"

User: "I want to bet on crypto"
You: "Let's see what crypto predictions are trending! Browse and bet below.\n[ACTION]{"type":"prediction_markets"}[/ACTION]"

User: "any political betting markets?"
You: "Great question! Check out these prediction markets and make your call.\n[ACTION]{"type":"prediction_markets"}[/ACTION]"

User: "will bitcoin hit 100k?"
You: "That's a popular one! Browse the prediction markets below to place your bet.\n[ACTION]{"type":"prediction_markets"}[/ACTION]"
`;

// This prompt is ALWAYS active regardless of wallet connection
const PRICE_ACTION_PROMPT = `
You have PRICE LOOKUP CAPABILITIES that work WITHOUT a wallet connection.
When the user asks for the price of ANY cryptocurrency token, you MUST:
1. Detect if it's a TICKER (e.g., SOL, BTC, BONK) or CONTRACT ADDRESS (long alphanumeric string like "8Qoor...")
2. Respond appropriately based on token type:
   - For MAJOR TOKENS (SOL, BTC, ETH, USDC, etc.): "Checking the live price of [TOKEN] for you..."
   - For MEMECOINS with CONTRACT ADDRESS: "Looking up the price for this token..."
   - For UNKNOWN TOKENS: "Searching for price data..."
3. Include the get_price action block at the END of your response.
4. NEVER invent or guess a price value yourself.

PRICE ACTION FORMAT:
[ACTION]{"type":"get_price","tokenId":"TICKER_OR_CONTRACT_ADDRESS"}[/ACTION]

EXAMPLES:
User: "what is the price of SOL"
You: "Checking the live price of SOL for you...
[ACTION]{"type":"get_price","tokenId":"SOL"}[/ACTION]"

User: "price of 8QoornHynNCGVSwsRif9mbB24WA12D4RFBASYSDepump"
You: "Looking up the price for this token...
[ACTION]{"type":"get_price","tokenId":"8QoornHynNCGVSwsRif9mbB24WA12D4RFBASYSDepump"}[/ACTION]"

User: "precio de meme coin 8Qoor..."
You: "Searching for price data...
[ACTION]{"type":"get_price","tokenId":"8QoornHynNCGVSwsRif9mbB24WA12D4RFBASYSDepump"}[/ACTION]"
`;

const WALLET_EXAMPLES = `
SWAP EXAMPLES (instant execution with Privy):

User: "swap 1 SOL to USDC"
You: "Swapping 1 SOL to USDC now...\n[ACTION]{"type":"swap","from":"SOL","to":"USDC","amount":1}[/ACTION]"

User: "swap 0.01 SOL to BTC"
You: "Swapping 0.01 SOL to BTC now...\n[ACTION]{"type":"swap","from":"SOL","to":"BTC","amount":0.01}[/ACTION]"

User: "compra 50 usdc de BONK" (Spanish)
You: "Comprando BONK con 50 USDC...\n[ACTION]{"type":"swap","from":"USDC","to":"BONK","amount":50}[/ACTION]"

User: "sell all my JUP for SOL" (if they have 100 JUP)
You: "Converting 100 JUP to SOL...\n[ACTION]{"type":"swap","from":"JUP","to":"SOL","amount":100}[/ACTION]"

SEND EXAMPLES:

User: "send 0.5 SOL to GVn8Qhz9YkRzEqHmMkVZ8xkRWcBqXvKB3j7TgP2dMxqJ"
You: "Sending 0.5 SOL now...\n[ACTION]{"type":"send_sol","to":"GVn8Qhz9YkRzEqHmMkVZ8xkRWcBqXvKB3j7TgP2dMxqJ","amount":0.5}[/ACTION]"

User: "buy BONK when it reaches $0.00001"
You: "I'll create a limit order to buy BONK when the price reaches $0.00001 per token.
[ACTION]{"type":"create_limit_order","inputToken":"SOL","outputToken":"BONK","amount":0.5,"targetPrice":0.00001,"slippageBps":0}[/ACTION]"

User: "sell my WIF if it hits $3"
You: "I'll set up a limit order to sell your WIF tokens when the price reaches $3.
[ACTION]{"type":"create_limit_order","inputToken":"WIF","outputToken":"SOL","amount":100,"targetPrice":3,"slippageBps":0}[/ACTION]"

User: "show my active orders"
You: "Let me fetch your active limit orders.
[ACTION]{"type":"get_limit_orders"}[/ACTION]"

User: "what is my balance"
You: "Your current balance is X.XX SOL. Would you like to check your other token assets?"

User: "show my tokens"
You: "Fetching your token portfolio now...
[ACTION]{"type":"get_tokens"}[/ACTION]"
`;

// Parse action from AI response
const parseAction = (text) => {
    const actionMatch = text.match(/\[ACTION\](.*?)\[\/ACTION\]/s);
    if (!actionMatch) return { cleanText: text, action: null };
    try {
        const action = JSON.parse(actionMatch[1].trim());
        const cleanText = text.replace(/\[ACTION\].*?\[\/ACTION\]/s, '').trim();
        return { cleanText, action };
    } catch {
        return { cleanText: text, action: null };
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, history = [], mode = 'flirt', userName = '', userTimezone = '', walletInfo = null } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // === NAME DETECTION ===
        // Detect if user is telling their name (common patterns)
        let detectedName = null;
        const namePatterns = [
            /my name is (\w+)/i,
            /i'm (\w+)/i,
            /i am (\w+)/i,
            /call me (\w+)/i,
            /name's (\w+)/i,
            /^(\w+) here$/i,
        ];
        for (const pattern of namePatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                detectedName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                break;
            }
        }

        const temporalContext = getTemporalContext(userTimezone);

        // Deterministic replies for date/time questions to avoid hallucinated dates.
        if (isTemporalQuestion(message)) {
            const temporalReply = buildTemporalReply({
                message,
                mode,
                temporalContext
            });

            return res.status(200).json({
                response: temporalReply,
                success: true,
                detectedName
            });
        }

        const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
        const assistantTurns = safeHistory.filter(msg => msg?.type === 'ai').length;
        const isFirstAssistantTurn = assistantTurns === 0;
        const currentUserName = (detectedName || userName || '').trim();

        let systemPrompt = mode === 'normal'
            ? SYSTEM_PROMPT_NORMAL
            : buildFlirtyPrompt({ isFirstAssistantTurn, currentUserName });

        // Add wallet context if connected
        if (walletInfo && walletInfo.isConnected) {
            let balanceLines = `- SOL Balance: ${walletInfo.balance !== null ? walletInfo.balance + ' SOL' : 'loading...'}`;
            if (walletInfo.assets && walletInfo.assets.length > 0) {
                walletInfo.assets.forEach(a => {
                    if (a.symbol !== 'SOL' && a.amount > 0) {
                        balanceLines += `\n- ${a.symbol} Balance: ${a.amount}`;
                    }
                });
            } else if (walletInfo.usdcBalance !== null && walletInfo.usdcBalance !== undefined) {
                balanceLines += `\n- USDC Balance: ${walletInfo.usdcBalance}`;
            }
            const walletContext = `\n\nWALLET CONTEXT (user's wallet is connected):\n- Address: ${walletInfo.publicKey}\n${balanceLines}\n`;
            systemPrompt += walletContext + WALLET_ACTION_PROMPT + WALLET_EXAMPLES;
        } else {
            systemPrompt += '\nThe user\'s wallet is NOT connected. If they ask about wallet operations (send, swap, balance, portfolio, history), tell them to connect their wallet first using the Connect Wallet button.';
        }

        // Amazon shopping — ALWAYS available (no wallet needed for search)
        systemPrompt += AMAZON_ACTION_PROMPT;

        // Flight booking — ALWAYS available
        systemPrompt += FLIGHT_BOOKING_PROMPT;

        // Prediction markets — ALWAYS available
        systemPrompt += PREDICTION_MARKETS_PROMPT;

        // Price lookups ALWAYS available regardless of wallet connection
        systemPrompt += PRICE_ACTION_PROMPT;

        // Only include temporal context if it's a temporal question
        const temporalRules = isTemporalQuestion(message) ? `Current factual context:
- Current date: ${temporalContext.dateLong}
- Current time: ${temporalContext.timeShort}
- Time zone: ${temporalContext.timeZone}
If user asks about date/time/day, use these exact values and do not invent data.` : '';

        // Build OpenAI-compatible messages array
        const systemInstructionText = temporalRules 
            ? `${systemPrompt}\n\n${temporalRules}`
            : systemPrompt;

        const messages = [
            { role: 'system', content: systemInstructionText },
            ...safeHistory
                .filter(msg => msg && typeof msg.content === 'string' && msg.content.trim())
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
            { role: 'user', content: message }
        ];

        // Call LLM API — tries all providers in order (Cerebras → Groq), each with key rotation
        let rawText = '';
        let lastError = null;

        for (const provider of LLM_PROVIDERS) {
            if (rawText) break; // Already got a response
            for (let k = 0; k < provider.keys.length; k++) {
                const key = provider.keys[k];
                try {
                    console.log(`🔄 Trying ${provider.name} (key ${k + 1}/${provider.keys.length}, model: ${provider.model})`);
                    const resp = await fetch(provider.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${key}`,
                        },
                        body: JSON.stringify({
                            model: provider.model,
                            messages,
                            max_tokens: MAX_OUTPUT_TOKENS,
                            temperature: 0.55,
                            top_p: 0.9,
                        }),
                    });

                    const data = await resp.json();

                    if (!resp.ok) {
                        lastError = { status: resp.status, message: data.error?.message || `${provider.name} API error` };
                        console.log(`⚠️ ${provider.name} key ${k + 1}/${provider.keys.length} failed (HTTP ${resp.status}), trying next...`);
                        continue;
                    }

                    rawText = data.choices?.[0]?.message?.content || '';
                    if (rawText) {
                        console.log(`✅ ${provider.name} responded (key ${k + 1}, model: ${provider.model})`);
                        break;
                    }
                } catch (err) {
                    lastError = err;
                    console.log(`⚠️ ${provider.name} key ${k + 1} error: ${err.message}, trying next...`);
                    continue;
                }
            }
        }

        if (!rawText && lastError) {
            throw lastError;
        }
        const { cleanText, action } = parseAction(rawText);
        const normalizedAction = normalizeWalletAction(action, message, walletInfo);
        const text = postProcessResponse(cleanText, mode);

        return res.status(200).json({
            response: text,
            success: true,
            detectedName: detectedName,
            action: normalizedAction // Wallet action if detected
        });

    } catch (error) {
        console.error('Chat API Error:', error);

        // Handle common errors
        if (error.status === 429) {
            return res.status(429).json({
                error: 'Too many requests. Please wait a moment before trying again.',
                details: error.message
            });
        }

        return res.status(500).json({
            error: 'Failed to generate response',
            details: error.message
        });
    }
}
