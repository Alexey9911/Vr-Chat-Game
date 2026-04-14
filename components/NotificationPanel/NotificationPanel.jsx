'use client';

import styles from './NotificationPanel.module.css';
import { Bell, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';

const NOTIFICATIONS = [
    { id: 1, type: 'info', title: 'New Model Available', desc: 'GPT-4o is now ready to use.', time: '2m ago', read: false },
    { id: 2, type: 'success', title: 'System Update', desc: 'Neyrs v2.1 is live.', time: '1h ago', read: true },
    { id: 3, type: 'alert', title: 'Maintenance', desc: 'Scheduled for tonight.', time: '5h ago', read: true },
    { id: 4, type: 'info', title: 'Welcome!', desc: 'Thanks for joining Neyrs.', time: '1d ago', read: true },
];

export default function NotificationPanel({ isOpen, onToggle }) {

    // If not open, the whole panel acts as a toggle button
    const handlePanelClick = (e) => {
        if (!isOpen) {
            onToggle();
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle size={16} className="text-green-500" />;
            case 'alert': return <AlertCircle size={16} className="text-amber-500" />;
            default: return <Info size={16} className="text-blue-500" />;
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
                    <h2 className={styles.title}>Notifications</h2>
                    <div className="flex items-center gap-2">
                        <button
                            className={styles.closeButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <div className={styles.list}>
                    {NOTIFICATIONS.length === 0 && (
                        <div className={styles.emptyState}>
                            No notifications
                        </div>
                    )}

                    {NOTIFICATIONS.map(notif => (
                        <div
                            key={notif.id}
                            className={`${styles.item} ${!notif.read ? styles.unread : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={styles.itemHeader}>
                                <div className={styles.iconWrapper}>
                                    {getIcon(notif.type)}
                                </div>
                                <span className={styles.time}>{notif.time}</span>
                            </div>
                            <div className={styles.itemContent}>
                                <h3 className={styles.itemTitle}>{notif.title}</h3>
                                <p className={styles.itemDesc}>{notif.desc}</p>
                            </div>
                            {!notif.read && <div className={styles.unreadDot} />}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
