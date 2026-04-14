'use client';

import styles from './ExplanationPanel.module.css';
import { X } from 'lucide-react';

export default function ExplanationPanel({ isOpen, onClose }) {
    return (
        <aside className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
            <div className={styles.header}>
                <h2 className={styles.title}>About Neyrs</h2>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={24} />
                </button>
            </div>

            <div className={styles.content}>
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Overview</h3>
                    <p>Neyrs is your intelligent creative companion, powered by Gemini. Designed for fluid conversations and instant assistance.</p>
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Capabilities</h3>
                    <ul className="list-disc pl-4 space-y-2">
                        <li>Natural Voice Synthesis</li>
                        <li>Context-Aware Responses</li>
                        <li>Creative Writing & Analysis</li>
                    </ul>
                </div>
            </div>
        </aside>
    );
}
