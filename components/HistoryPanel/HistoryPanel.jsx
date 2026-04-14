'use client';

import styles from './HistoryPanel.module.css';
import { Plus, ChevronLeft } from 'lucide-react';

export default function HistoryPanel({ isOpen, history, activeChatId, onSelectChat, onNewChat, onToggle }) {

    // If not open, the whole panel acts as a toggle button
    const handlePanelClick = (e) => {
        if (!isOpen) {
            onToggle();
        }
    };

    return (
        <aside
            className={`${styles.panel} ${isOpen ? styles.open : styles.peek}`}
            onClick={handlePanelClick}
        >
            {/* Visual indicator for peek state */}
            <div className={styles.peekVisual} />

            {/* Content Container - fades in/out */}
            <div className={styles.content}>
                <div className={styles.header}>
                    <h2 className={styles.title}>History</h2>
                    <div className="flex items-center gap-2">
                        <button
                            className={styles.newChatButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                onNewChat();
                            }}
                            title="New Chat"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            className={styles.closeButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                    </div>
                </div>

                <div className={styles.list}>
                    {history.length === 0 && (
                        <div className={styles.emptyState}>
                            No chats yet
                        </div>
                    )}

                    {history.map(chat => (
                        <button
                            key={chat.id}
                            className={`${styles.chatItem} ${chat.id === activeChatId ? styles.active : ''}`}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent toggling if we click an item
                                onSelectChat(chat.id);
                            }}
                        >
                            <div className={styles.chatTitle}>{chat.title || 'Untitled'}</div>
                            <div className={styles.chatDate}>
                                {new Date(chat.createdAt).toLocaleDateString()}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );
}
