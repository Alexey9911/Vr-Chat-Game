'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ChatLayout.module.css';
import ChatHeader from '../ChatHeader/ChatHeader';
import ChatMessages from '../ChatMessages/ChatMessages';
import ChatInput from '../ChatInput/ChatInput';
import SideNav from '../SideNav/SideNav';
import HistoryPanel from '../HistoryPanel/HistoryPanel';
import SettingsDropdown from '../SettingsDropdown/SettingsDropdown';
import ExplorePanel from '../ExplorePanel/ExplorePanel';
import NotificationPanel from '../NotificationPanel/NotificationPanel';
import PrivacyPanel from '../PrivacyPanel/PrivacyPanel';
import ProfilePanel from '../ProfilePanel/ProfilePanel';
import MobileNav from '../MobileNav/MobileNav';
import SkillTags from '../SkillTags/SkillTags';
import PromptCards from '../PromptCards/PromptCards';
import useChatHistory from '../../hooks/useChatHistory';
import useUserStats from '../../hooks/useUserStats';
import useWalletAuth from '../../hooks/useWalletAuth';
import useSolanaActions from '../../hooks/useSolanaActions';
import { Home, MessageSquare, Clock, Compass, Bell, Shield, User, Settings as SettingsIcon, Wallet } from 'lucide-react';
import { usePageTransition } from '../PageTransition/PageTransition';

export default function ChatLayout() {
    const { navigateWithTransition } = usePageTransition();
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTTSEnabled, setIsTTSEnabled] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isExploreOpen, setIsExploreOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNewChatAnimating, setIsNewChatAnimating] = useState(false);
    const [activeSkills, setActiveSkills] = useState([]);
    const [chatMode, setChatMode] = useState('flirt'); // 'flirt' or 'normal'
    const [userName, setUserName] = useState(''); // User's name (persisted)

    // Load userName from localStorage on mount
    useEffect(() => {
        const savedName = localStorage.getItem('neyrs_userName');
        if (savedName) setUserName(savedName);
    }, []);

    // TTS Settings
    const [ttsSettings, setTtsSettings] = useState({
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        stability: 0.3,
        style: 0.55
    });

    // Wallet Auth & Solana Actions
    const wallet = useWalletAuth();
    const solanaActions = useSolanaActions({
        publicKey: wallet.publicKey,
        signAndSendTransaction: wallet.signAndSendTransaction,
        signTransaction: wallet.signTransaction,
        walletType: wallet.walletType,
    });

    // Chat History Hook
    const {
        history,
        activeChatId,
        setActiveChatId,
        createNewChat,
        saveMessageToChat,
        updateMessageInChat
    } = useChatHistory();

    // User Stats Hook
    const { incrementMessages, getDisplayStats } = useUserStats();
    const userStats = getDisplayStats();

    const audioRef = useRef(null);
    const messagesAreaRef = useRef(null);
    const isInitialMount = useRef(true);

    // Get current messages from active chat
    const currentChat = history.find(c => c.id === activeChatId);
    const messages = currentChat?.messages || [];

    // Initialize first chat on mount if none exists
    useEffect(() => {
        if (history.length === 0) {
            createNewChat();
        } else if (!activeChatId) {
            setActiveChatId(history[0].id);
        }
    }, []);

    // Auto-scroll - smooth scroll to bottom without over-scrolling
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        const container = messagesAreaRef.current;
        if (container) {
            // Scroll to bottom with a small offset to keep the last message visible
            const scrollTo = container.scrollHeight - container.clientHeight;
            container.scrollTo({
                top: scrollTo,
                behavior: 'smooth'
            });
        }
    }, [messages.length]);

    const sanitizeForSpeech = (raw) => {
        return raw
            .replace(/https?:\/\/[^\s)]+/g, '')
            .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '')
            .replace(/\b[a-zA-Z0-9]{20,}\b/g, '')
            .replace(/0x[a-fA-F0-9]{8,}/g, '')
            .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/#+\s?/g, '')
            .replace(/^[\s]*[-•*]\s/gm, '')
            .replace(/\.\s/g, ', ')
            .replace(/\.$/, '')
            .replace(/\.{2,}/g, ',')
            .replace(/,\s*,/g, ',')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[,\s]+/, '')
            .trim();
    };

    const browserTTS = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
            || voices.find(v => v.lang.startsWith('en-US'))
            || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
    };

    const playTTS = useCallback(async (text) => {
        if (!isTTSEnabled) return;
        const cleanText = sanitizeForSpeech(text);
        if (!cleanText || cleanText.length < 3) return;

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: cleanText,
                    voiceId: ttsSettings.voiceId,
                    stability: ttsSettings.stability,
                    style: ttsSettings.style
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.audioContent && audioRef.current) {
                    const audioBlob = new Blob(
                        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
                        { type: 'audio/mp3' }
                    );
                    audioRef.current.src = URL.createObjectURL(audioBlob);
                    audioRef.current.volume = 0.2;
                    audioRef.current.play();
                    return;
                }
            }
            // API failed — use browser fallback
            browserTTS(cleanText);
        } catch (error) {
            console.error('TTS API error, using browser fallback:', error);
            browserTTS(cleanText);
        }
    }, [isTTSEnabled, ttsSettings]);

    // Handle Solana actions returned by the AI
    const handleSolanaAction = useCallback(async (action, chatId, aiMessageId) => {
        if (!action) return;

        try {
            const type = action.type;

            if (type === 'swap') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'swap' });
                const sig = await solanaActions.executeSwap(action.from, action.to, action.amount);
                updateMessageInChat(chatId, aiMessageId, { pending: false, txSignature: sig, txType: 'swap', txDetails: action });
                wallet.refreshBalance();
            } else if (type === 'send_sol') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'send' });
                const sig = await solanaActions.executeSendSol(action.to, action.amount);
                updateMessageInChat(chatId, aiMessageId, { pending: false, txSignature: sig, txType: 'send', txDetails: action });
                wallet.refreshBalance();
            } else if (type === 'stake') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'stake' });
                const sig = await solanaActions.executeStake(action.token, action.amount);
                updateMessageInChat(chatId, aiMessageId, { pending: false, txSignature: sig, txType: 'stake', txDetails: action });
                wallet.refreshBalance();
            } else if (type === 'unstake') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'unstake' });
                const sig = await solanaActions.executeUnstake(action.token, action.amount);
                updateMessageInChat(chatId, aiMessageId, { pending: false, txSignature: sig, txType: 'unstake', txDetails: action });
                wallet.refreshBalance();
            } else if (type === 'get_tokens' || type === 'get_portfolio') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'portfolio' });
                const assets = await solanaActions.getPortfolio();
                updateMessageInChat(chatId, aiMessageId, { pending: false, portfolio: assets });
            } else if (type === 'get_history') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'history' });
                const txHistory = await solanaActions.getHistory();
                updateMessageInChat(chatId, aiMessageId, { pending: false, txHistory });
            } else if (type === 'get_price') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'price' });
                const priceData = await solanaActions.getPrice(action.tokenId);
                updateMessageInChat(chatId, aiMessageId, { pending: false, priceData });
            } else if (type === 'amazon_search') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'amazon' });
                const resp = await fetch('/api/amazon/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: action.query, maxPrice: action.maxPrice, minRating: action.minRating }),
                });
                const amazonData = await resp.json();
                updateMessageInChat(chatId, aiMessageId, { pending: false, amazonProducts: amazonData.success ? amazonData.products : [] });
            } else if (type === 'flight_search') {
                updateMessageInChat(chatId, aiMessageId, { flightSearchForm: true, pending: false });
                return; // No async work needed, form handles everything
            } else if (type === 'prediction_markets') {
                updateMessageInChat(chatId, aiMessageId, { predictionMarketsForm: true, pending: false });
                return; // No async work needed, form handles everything
            } else if (type === 'create_limit_order') {
                updateMessageInChat(chatId, aiMessageId, { pending: true, pendingType: 'limit_order' });
                const result = await solanaActions.createLimitOrder(action.inputToken, action.outputToken, action.amount, action.targetPrice);
                updateMessageInChat(chatId, aiMessageId, { pending: false, txSignature: result.signature, txType: 'limit_order', txDetails: action });
            }
        } catch (err) {
            console.error('Solana action error:', err);
            updateMessageInChat(chatId, aiMessageId, {
                pending: false,
                actionError: err.message || 'Transaction failed'
            });
        }
    }, [solanaActions, wallet, updateMessageInChat]);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        let chatId = activeChatId;
        if (!chatId) {
            const newChat = createNewChat();
            chatId = newChat.id;
        }

        const userMessage = { id: Date.now(), type: 'user', content: inputValue };
        saveMessageToChat(chatId, userMessage);
        incrementMessages(); // Track user message

        const currentInput = inputValue;
        setInputValue('');
        setIsLoading(true);

        try {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

            // Build wallet info for the API
            const walletInfo = wallet.isConnected ? {
                isConnected: true,
                publicKey: wallet.publicKey,
                balance: wallet.balance,
                usdcBalance: wallet.usdcBalance,
                assets: [], // Will be populated by portfolio calls
            } : null;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentInput,
                    history: messages.slice(-5), // Reduced for speed
                    mode: chatMode,
                    userName: userName, // Pass current known name
                    userTimezone,
                    walletInfo,
                }),
            });

            const data = await response.json();

            if (data.success && data.response) {
                const aiMessageId = Date.now() + 1;
                const aiMessage = {
                    id: aiMessageId,
                    type: 'ai',
                    content: data.response
                };
                // Show text IMMEDIATELY
                saveMessageToChat(chatId, aiMessage);
                setIsLoading(false);

                // If API detected a new user name, save it
                if (data.detectedName && data.detectedName !== userName) {
                    setUserName(data.detectedName);
                    localStorage.setItem('neyrs_userName', data.detectedName);
                }

                // Play TTS in background (non-blocking)
                playTTS(data.response);

                // Execute action if AI returned one
                if (data.action) {
                    handleSolanaAction(data.action, chatId, aiMessageId);
                }
            } else {
                saveMessageToChat(chatId, {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: 'Hmm, something went wrong. Try again?'
                });
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Chat Error:', error);
            setIsLoading(false);
        }
    };

    const handlePromptCardClick = (prompt) => {
        setInputValue(prompt);
    };

    const handleNewChat = () => {
        // Trigger new chat animation
        setIsNewChatAnimating(true);
        setTimeout(() => setIsNewChatAnimating(false), 600);

        createNewChat();
        setIsHistoryOpen(false);
    };

    const handleSelectChat = (chatId) => {
        setActiveChatId(chatId);
        setIsHistoryOpen(false);
    };

    const handleToggleSkill = (skill) => {
        setActiveSkills(prev => {
            const exists = prev.find(s => s.title === skill.title);
            if (exists) {
                return prev.filter(s => s.title !== skill.title);
            }
            return [...prev, skill];
        });
    };

    // Navigation Items
    const leftNavItems = [
        { icon: Home, label: 'Home', onClick: () => navigateWithTransition('/') },
        { icon: Clock, label: 'History', onClick: () => setIsHistoryOpen(!isHistoryOpen) },
        { icon: MessageSquare, label: 'New Chat', onClick: handleNewChat },
        { icon: SettingsIcon, label: 'Settings', onClick: () => setIsSettingsOpen(!isSettingsOpen) },
    ];

    const rightNavItems = [
        { icon: Compass, label: 'Explore', onClick: () => setIsExploreOpen(!isExploreOpen) },
        { icon: Bell, label: 'Notifications', onClick: () => setIsNotificationsOpen(!isNotificationsOpen) },
        { icon: Shield, label: 'Privacy', onClick: () => setIsPrivacyOpen(!isPrivacyOpen) },
        { icon: User, label: 'Profile', onClick: () => setIsProfileOpen(!isProfileOpen) },
    ];

    // Determine active tab for Mobile Nav
    const getActiveMobileTab = () => {
        if (isHistoryOpen) return 'history';
        if (isPrivacyOpen) return 'privacy';
        if (isProfileOpen) return 'profile';
        if (isSettingsOpen) return 'settings';
        return '';
    };

    return (
        <main className={styles.layout}>
            {/* Ambient Background */}
            <div className={styles.background} />

            {/* Hidden Audio */}
            <audio ref={audioRef} className={styles.hiddenAudio} />

            {/* History Panel - Fixed to left edge */}
            <HistoryPanel
                isOpen={isHistoryOpen}
                history={history}
                activeChatId={activeChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
                onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
            />

            {/* Notification Panel - Fixed to right edge */}
            <NotificationPanel
                isOpen={isNotificationsOpen}
                onToggle={() => setIsNotificationsOpen(!isNotificationsOpen)}
            />

            {/* Privacy Panel */}
            <PrivacyPanel
                isOpen={isPrivacyOpen}
                onClose={() => setIsPrivacyOpen(false)}
            />

            {/* Profile Panel */}
            <ProfilePanel
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                userName={userName}
                userStats={userStats}
            />


            <div className={styles.mainLayoutGrid}>
                {/* Left Sidebar */}
                <div className={styles.sidebarWrapper}>
                    <div className={styles.sideNavWrapper}>
                        <SideNav items={leftNavItems} position="left" activeIndex={isHistoryOpen ? 1 : (isSettingsOpen ? 3 : -1)} />
                    </div>
                </div>

                {/* Settings Dropdown Component - Now anchored to Main Grid */}
                <SettingsDropdown
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    ttsSettings={ttsSettings}
                    onSettingsChange={setTtsSettings}
                    chatMode={chatMode}
                    onModeChange={setChatMode}
                />

                {/* Floating Glass Container */}
                <div className={`${styles.container} animate-scale-in ${isNewChatAnimating ? styles.newChatFlash : ''}`}>

                    {/* Header */}
                    <ChatHeader
                        isTTSEnabled={isTTSEnabled}
                        onToggleTTS={() => {
                            const next = !isTTSEnabled;
                            setIsTTSEnabled(next);
                            if (!next && audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.currentTime = 0;
                            }
                            if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
                                window.speechSynthesis.cancel();
                            }
                        }}
                        wallet={wallet}
                    />

                    {/* Main Chat Area */}
                    <div className={styles.mainContent}>
                        <div className={styles.messagesArea} ref={messagesAreaRef}>
                            <SkillTags activeSkills={activeSkills} onRemoveSkill={handleToggleSkill} />
                            {messages.length === 0 && !isLoading && (
                                <PromptCards onSelect={handlePromptCardClick} isWalletConnected={wallet.isConnected} />
                            )}
                            <ChatMessages messages={messages} isLoading={isLoading} wallet={wallet} chatId={activeChatId} saveMessageToChat={saveMessageToChat} updateMessageInChat={updateMessageInChat} />
                        </div>

                        <div className={styles.inputArea}>
                            <ChatInput
                                value={inputValue}
                                onChange={setInputValue}
                                onSend={handleSend}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className={styles.sidebarWrapper}>
                    <div className={styles.sideNavWrapper}>
                        <SideNav items={rightNavItems} position="right" activeIndex={isPrivacyOpen ? 2 : (isProfileOpen ? 3 : -1)} />
                    </div>
                </div>

                {/* Explore Panel - Now anchored to Main Grid */}
                <ExplorePanel
                    isOpen={isExploreOpen}
                    onClose={() => setIsExploreOpen(false)}
                    activeSkills={activeSkills}
                    onToggleSkill={handleToggleSkill}
                />
            </div>

            

            {/* Mobile Navigation */}
            <MobileNav
                activeTab={getActiveMobileTab()}
                onTabChange={() => { }}
                onNewChat={handleNewChat}
                onHistoryClick={() => setIsHistoryOpen(!isHistoryOpen)}
                onPrivacyClick={() => setIsPrivacyOpen(!isPrivacyOpen)}
                onProfileClick={() => setIsProfileOpen(!isProfileOpen)}
                onSettingsClick={() => setIsSettingsOpen(!isSettingsOpen)}
            />
        </main>
    );
}
