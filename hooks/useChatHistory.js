/**
 * useChatHistory Hook
 * Manages chat sessions in localStorage
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'neyrs_chat_history';

export default function useChatHistory() {
    const [history, setHistory] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);

    // Load history on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setHistory(parsed);
                // Optional: Restore last active chat or start new
            } catch (e) {
                console.error('Failed to parse history', e);
            }
        }
    }, []);

    // Save history whenever it changes
    useEffect(() => {
        if (history.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        }
    }, [history]);

    const createNewChat = () => {
        const newChat = {
            id: Date.now(),
            title: 'New Conversation',
            messages: [],
            createdAt: new Date().toISOString(),
        };
        setHistory(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        return newChat;
    };

    const saveMessageToChat = (chatId, message) => {
        setHistory(prev => prev.map(chat => {
            if (chat.id === chatId) {
                // Generate title from first user message if it's "New Conversation"
                let title = chat.title;
                if (chat.messages.length === 0 && message.type === 'user') {
                    title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
                }

                return {
                    ...chat,
                    title,
                    messages: [...chat.messages, message],
                    updatedAt: new Date().toISOString()
                };
            }
            return chat;
        }));
    };

    const updateMessageInChat = (chatId, messageId, updatedFields) => {
        setHistory(prev => prev.map(chat => {
            if (chat.id === chatId) {
                return {
                    ...chat,
                    messages: chat.messages.map(msg =>
                        msg.id === messageId ? { ...msg, ...updatedFields } : msg
                    ),
                    updatedAt: new Date().toISOString()
                };
            }
            return chat;
        }));
    };

    const deleteChat = (chatId) => {
        setHistory(prev => prev.filter(c => c.id !== chatId));
        if (activeChatId === chatId) {
            setActiveChatId(null);
        }
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
        setActiveChatId(null);
    };

    return {
        history,
        activeChatId,
        setActiveChatId,
        createNewChat,
        saveMessageToChat,
        updateMessageInChat,
        deleteChat,
        clearHistory
    };
}
