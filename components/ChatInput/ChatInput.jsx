'use client';

import styles from './ChatInput.module.css';
import { Send, ArrowUp } from 'lucide-react';

export default function ChatInput({ value, onChange, onSend, isLoading }) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className={styles.inputContainer}>
            <div className={styles.inputWrapper}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Message Neyrs..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    autoFocus
                />
                <button
                    className={styles.sendButton}
                    onClick={onSend}
                    disabled={!value.trim() || isLoading}
                    aria-label="Send message"
                >
                    {isLoading ? (
                        <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                        <ArrowUp className={styles.sendIcon} strokeWidth={2.5} />
                    )}
                </button>
            </div>
        </div>
    );
}
