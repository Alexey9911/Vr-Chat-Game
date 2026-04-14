'use client';

import styles from './SideNav.module.css';

export default function SideNav({ items, position = 'left', activeIndex = 0 }) {
    return (
        <nav
            className={`${styles.navContainer} ${position === 'right' ? styles.rightSidebar : ''} animate-fade-in`}
            style={{ animationDelay: '0.2s' }}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    className={`${styles.navItem} ${index === activeIndex ? styles.active : ''}`}
                    aria-label={item.label}
                    data-label={item.label}
                    onClick={item.onClick}
                >
                    <item.icon size={22} strokeWidth={2} />
                </button>
            ))}
        </nav>
    );
}
