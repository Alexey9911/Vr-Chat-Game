/**
 * useUserStats Hook
 * Tracks user statistics in localStorage:
 * - Total messages sent
 * - Total time chatting (in seconds)
 * - Streak (consecutive days)
 * - Level (based on messages)
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'neyrs_user_stats';

const DEFAULT_STATS = {
    messageCount: 0,
    totalTimeSeconds: 0,
    lastActiveDate: null,
    streakDays: 0,
    sessionStartTime: null,
};

const LEVELS = [
    { min: 0, name: 'Bronze' },
    { min: 50, name: 'Silver' },
    { min: 150, name: 'Gold' },
    { min: 500, name: 'Platinum' },
    { min: 1000, name: 'Diamond' },
];

export default function useUserStats() {
    const [stats, setStats] = useState(DEFAULT_STATS);

    // Load stats on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setStats(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error('Failed to parse user stats', e);
            }
        }

        // Start session timer
        const startTime = Date.now();
        setStats(prev => ({ ...prev, sessionStartTime: startTime }));

        // Update streak on load
        updateStreak();

        // Cleanup: save session time on unmount
        return () => {
            const sessionDuration = Math.floor((Date.now() - startTime) / 1000);
            if (sessionDuration > 0) {
                saveSessionTime(sessionDuration);
            }
        };
    }, []);

    // Save stats whenever they change (except sessionStartTime)
    useEffect(() => {
        const { sessionStartTime, ...toSave } = stats;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }, [stats]);

    // Save session time to localStorage directly
    const saveSessionTime = (seconds) => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                parsed.totalTimeSeconds = (parsed.totalTimeSeconds || 0) + seconds;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            } catch (e) { }
        }
    };

    // Update streak based on last active date
    const updateStreak = () => {
        const today = new Date().toDateString();
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const lastActive = parsed.lastActiveDate;

                if (lastActive === today) {
                    // Already active today, keep streak
                    return;
                }

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (lastActive === yesterday.toDateString()) {
                    // Active yesterday, increment streak
                    setStats(prev => ({
                        ...prev,
                        streakDays: (prev.streakDays || 0) + 1,
                        lastActiveDate: today
                    }));
                } else {
                    // Streak broken, reset to 1
                    setStats(prev => ({
                        ...prev,
                        streakDays: 1,
                        lastActiveDate: today
                    }));
                }
            } catch (e) { }
        } else {
            // First time, start streak at 1
            setStats(prev => ({
                ...prev,
                streakDays: 1,
                lastActiveDate: today
            }));
        }
    };

    // Increment message count
    const incrementMessages = useCallback(() => {
        setStats(prev => ({
            ...prev,
            messageCount: prev.messageCount + 1
        }));
    }, []);

    // Calculate level based on messages
    const getLevel = useCallback(() => {
        const count = stats.messageCount;
        let level = LEVELS[0].name;
        for (const l of LEVELS) {
            if (count >= l.min) {
                level = l.name;
            }
        }
        return level;
    }, [stats.messageCount]);

    // Format time for display
    const formatTime = useCallback(() => {
        const totalSeconds = stats.totalTimeSeconds;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }, [stats.totalTimeSeconds]);

    // Get formatted stats for display
    const getDisplayStats = useCallback(() => {
        return {
            messages: stats.messageCount.toLocaleString(),
            time: formatTime(),
            streak: `${stats.streakDays}d`,
            level: getLevel()
        };
    }, [stats, formatTime, getLevel]);

    return {
        stats,
        incrementMessages,
        getDisplayStats,
        getLevel,
        formatTime
    };
}
