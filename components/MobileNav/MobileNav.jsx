'use client';

import styles from './MobileNav.module.css';
import { Clock, Shield, Plus, User, Settings } from 'lucide-react';

export default function MobileNav({
    activeTab,
    onTabChange,
    onNewChat,
    onHistoryClick,
    onPrivacyClick,
    onProfileClick,
    onSettingsClick
}) {
    return (
        <nav className={styles.navBar}>
            <button
                className={`${styles.navItem} ${activeTab === 'history' ? styles.active : ''}`}
                onClick={onHistoryClick}
                data-label="History"
            >
                <div className={styles.iconWrapper}>
                    <Clock size={22} />
                </div>
                <span className={styles.label}>History</span>
            </button>

            <button
                className={`${styles.navItem} ${activeTab === 'privacy' ? styles.active : ''}`}
                onClick={onPrivacyClick}
                data-label="Privacy"
            >
                <div className={styles.iconWrapper}>
                    <Shield size={22} />
                </div>
                <span className={styles.label}>Privacy</span>
            </button>

            <button
                className={styles.fab}
                onClick={onNewChat}
                aria-label="New Chat"
            >
                <Plus size={28} />
            </button>

            <button
                className={`${styles.navItem} ${activeTab === 'profile' ? styles.active : ''}`}
                onClick={onProfileClick}
                data-label="Profile"
            >
                <div className={styles.iconWrapper}>
                    <User size={22} />
                </div>
                <span className={styles.label}>Profile</span>
            </button>

            <button
                className={`${styles.navItem} ${activeTab === 'settings' ? styles.active : ''}`}
                onClick={onSettingsClick}
                data-label="Settings"
            >
                <div className={styles.iconWrapper}>
                    <Settings size={22} />
                </div>
                <span className={styles.label}>Settings</span>
            </button>
        </nav>
    );
}
