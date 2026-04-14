'use client';

import styles from './PromptCards.module.css';
import { ArrowLeftRight, TrendingUp, ShoppingBag, Coins, Plane, BarChart2, Send, Layers } from 'lucide-react';

const PROMPTS_WALLET = [
    { icon: ShoppingBag, label: 'Shop Amazon', prompt: 'Find the best gaming headset under $80 on Amazon with good reviews', isNew: true },
    { icon: Plane, label: 'Book flights', prompt: 'Find me flights from Mexico City for tomorrow', isNew: true },
    { icon: Coins, label: 'Stake tokens', prompt: 'Stake 50 USDC to earn yield' },
    { icon: ArrowLeftRight, label: 'Swap tokens', prompt: 'Swap 100 USDC to SOL instantly' },
    { icon: Send, label: 'Send SOL', prompt: 'Send SOL to another wallet' },
    { icon: TrendingUp, label: 'Predict markets', prompt: 'Show me the top prediction markets right now', isNew: true },
    { icon: BarChart2, label: 'Token prices', prompt: "What's the price of Solana right now?" },
    { icon: Layers, label: 'Multi-step', prompt: 'Find a mechanical keyboard under $60 on Amazon, then buy the top rated one with USDC' },
];

const PROMPTS_NO_WALLET = [
    { icon: ShoppingBag, label: 'Shop Amazon', prompt: 'Find the best gaming headset under $80 on Amazon with good reviews', isNew: true },
    { icon: Plane, label: 'Book flights', prompt: 'Find me flights from Mexico City for tomorrow', isNew: true },
    { icon: TrendingUp, label: 'Predict markets', prompt: 'Show me the top prediction markets right now', isNew: true },
    { icon: ArrowLeftRight, label: 'Swap tokens', prompt: 'Swap 100 USDC to SOL instantly' },
    { icon: Send, label: 'Send SOL', prompt: 'Send SOL to another wallet' },
    { icon: BarChart2, label: 'Token prices', prompt: "What's the price of Solana right now?" },
    { icon: Layers, label: 'Multi-step', prompt: 'Find a mechanical keyboard under $60 on Amazon, then buy the top rated one with USDC' },
];

export default function PromptCards({ onSelect, isWalletConnected }) {
    const prompts = isWalletConnected ? PROMPTS_WALLET : PROMPTS_NO_WALLET;

    return (
        <div className={styles.grid}>
            {prompts.map((item) => (
                <button
                    key={item.label}
                    className={`${styles.card} ${item.comingSoon ? styles.cardDisabled : ''}`}
                    onClick={() => !item.comingSoon && onSelect(item.prompt)}
                    disabled={item.comingSoon}
                >
                    <item.icon size={15} strokeWidth={2} className={styles.cardIcon} />
                    <span className={styles.label}>{item.label}</span>
                    {item.isNew && <span className={styles.newBadge}>NEW</span>}
                    {item.comingSoon && <span className={styles.soonBadge}>Soon</span>}
                </button>
            ))}
        </div>
    );
}
