'use client';

import { useRef, useEffect } from 'react';
import styles from './ProfilePanel.module.css';
import { X, User, MessageSquare, Clock, Zap, Trophy } from 'lucide-react';

const ACHIEVEMENTS = [
    { name: 'First Chat', desc: 'Started your journey', unlocked: true },
    { name: 'Night Owl', desc: 'Chat after midnight', unlocked: true },
    { name: 'Power User', desc: '100+ messages daily', unlocked: true },
    { name: 'Marathon', desc: '24h total time', unlocked: false },
];

export default function ProfilePanel({ isOpen, onClose, userName, userStats }) {
    const dropdownRef = useRef(null);

    // Build stats array from real data
    const statsData = [
        { label: 'Messages', value: userStats?.messages || '0', icon: MessageSquare },
        { label: 'Time', value: userStats?.time || '0m', icon: Clock },
        { label: 'Streak', value: userStats?.streak || '0d', icon: Zap },
        { label: 'Level', value: userStats?.level || 'Bronze', icon: Trophy },
    ];

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                const profileBtn = e.target.closest('[data-label="Profile"]');
                if (profileBtn) return;
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    return (
        <div
            className={`${styles.dropdown} ${isOpen ? styles.open : ''}`}
            ref={dropdownRef}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className={styles.header}>
                <span className={styles.title}>Profile</span>
                <button onClick={onClose} className={styles.closeButton}>
                    <X size={16} />
                </button>
            </div>

            {/* User Card */}
            <div className={styles.userCard}>
                <div className={styles.avatar}>
                    <User size={24} />
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{userName || 'Anonymous'}</span>
                    <span className={styles.userTier}>Premium Member</span>
                </div>
            </div>

            {/* Stats Grid - Real Data */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Statistics</span>
                <div className={styles.statsGrid}>
                    {statsData.map((stat, i) => (
                        <div key={i} className={styles.statCard}>
                            <stat.icon size={14} />
                            <span className={styles.statValue}>{stat.value}</span>
                            <span className={styles.statLabel}>{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Achievements */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Achievements</span>
                <div className={styles.achievementList}>
                    {ACHIEVEMENTS.map((ach, i) => (
                        <div
                            key={i}
                            className={`${styles.achievementItem} ${!ach.unlocked ? styles.locked : ''}`}
                        >
                            <Trophy size={12} />
                            <div className={styles.achievementInfo}>
                                <span className={styles.achievementName}>{ach.name}</span>
                                <span className={styles.achievementDesc}>{ach.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
