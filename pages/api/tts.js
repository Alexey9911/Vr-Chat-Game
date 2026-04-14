// ElevenLabs Text-to-Speech API
// Voice: Bella (feminine, warm, natural)

const ELEVENLABS_API_KEY = 'a91f52e82553ff8e78b25e9f765760271a2514bb4de38bd421329326a0f9aed9';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, voiceId, stability, style } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // ═══ SANITIZE TEXT FOR NATURAL SPEECH ═══
        // Strip everything that shouldn't be read aloud (links, addresses, code, etc.)
        let smoothedText = text
            // Remove URLs (http/https links)
            .replace(/https?:\/\/[^\s)]+/g, '')
            // Remove wallet addresses (Base58: 32-44 chars of alphanumeric)
            .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '')
            // Remove hex strings (0x...)
            .replace(/0x[a-fA-F0-9]{8,}/g, '')
            // Remove transaction signatures / hashes (long alphanumeric 64+ chars)
            .replace(/\b[a-zA-Z0-9]{64,}\b/g, '')
            // Remove markdown bold/italic markers
            .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
            // Remove markdown links [text](url)
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove inline code backticks
            .replace(/`([^`]+)`/g, '$1')
            // Remove any remaining long alphanumeric strings (token mints, IDs, etc.)
            .replace(/\b[a-zA-Z0-9]{20,}\b/g, '')
            // Remove bullet points and list markers
            .replace(/^[\s]*[-•*]\s/gm, '')
            // Replace ellipsis with brief pause
            .replace(/\.{2,}/g, ',')
            // Clean up multiple spaces, commas, and punctuation artifacts
            .replace(/,\s*,/g, ',')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[,\s]+/, '')
            .trim();

        // If after sanitization there's nothing meaningful, skip TTS
        if (!smoothedText || smoothedText.length < 3) {
            return res.status(200).json({ audioContent: null, success: true, voice: 'skipped' });
        }

        const activeVoice = voiceId || DEFAULT_VOICE_ID;
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${activeVoice}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: smoothedText,
                model_id: 'eleven_turbo_v2_5',
                voice_settings: {
                    stability: typeof stability === 'number' ? stability : 0.3,
                    similarity_boost: 0.65,
                    style: typeof style === 'number' ? style : 0.55,
                    use_speaker_boost: true,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ElevenLabs TTS Error:', response.status, errorText);
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        // ElevenLabs returns raw audio bytes — convert to base64 for frontend
        const audioBuffer = await response.arrayBuffer();
        const audioContent = Buffer.from(audioBuffer).toString('base64');

        return res.status(200).json({
            audioContent,
            success: true,
            voice: 'elevenlabs'
        });

    } catch (error) {
        console.error('TTS API Error:', error);
        return res.status(500).json({
            error: 'Failed to generate speech',
            details: error.message
        });
    }
}
