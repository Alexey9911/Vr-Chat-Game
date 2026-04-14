'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './PrivacyPanel.module.css';
import { X, Shield, Lock, EyeOff } from 'lucide-react';

const PRIVACY_MODES = [
    { id: 'standard', name: 'Standard Mode', desc: 'Basic encryption, cloud processing', icon: Shield },
    { id: 'enhanced', name: 'Enhanced Mode', desc: 'E2E encryption, minimal logging', icon: Lock },
    { id: 'paranoid', name: 'Paranoid Mode', desc: 'Local only, zero telemetry', icon: EyeOff },
];

const SECURITY_FEATURES = [
    { name: 'AES-256 Encryption', status: 'Active' },
    { name: 'TLS 1.3 Transport', status: 'Active' },
    { name: 'Zero-Knowledge Proof', status: 'Enabled' },
    { name: 'Biometric Auth', status: 'Available' },
];

const DATA_SETTINGS = [
    { name: 'Chat History', enabled: true },
    { name: 'Voice Retention', enabled: false },
    { name: 'Analytics', enabled: false },
];

export default function PrivacyPanel({ isOpen, onClose }) {
    const dropdownRef = useRef(null);
    const [activeMode, setActiveMode] = useState('enhanced');
    const [settings, setSettings] = useState(DATA_SETTINGS);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                const privacyBtn = e.target.closest('[data-label="Privacy"]');
                if (privacyBtn) return;
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const toggleSetting = (index) => {
        const newSettings = [...settings];
        newSettings[index].enabled = !newSettings[index].enabled;
        setSettings(newSettings);
    };

    return (
        <div
            className={`${styles.dropdown} ${isOpen ? styles.open : ''}`}
            ref={dropdownRef}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className={styles.header}>
                <span className={styles.title}>Privacy & Security</span>
                <button onClick={onClose} className={styles.closeButton}>
                    <X size={16} />
                </button>
            </div>

            {/* Privacy Modes - Clickable */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Privacy Mode</span>
                <div className={styles.modeList}>
                    {PRIVACY_MODES.map(mode => (
                        <button
                            key={mode.id}
                            className={`${styles.modeItem} ${activeMode === mode.id ? styles.modeActive : ''}`}
                            onClick={() => setActiveMode(mode.id)}
                        >
                            <mode.icon size={16} />
                            <div className={styles.modeInfo}>
                                <span className={styles.modeName}>{mode.name}</span>
                                <span className={styles.modeDesc}>{mode.desc}</span>
                            </div>
                            {activeMode === mode.id && <span className={styles.activeBadge}>Active</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Security Status */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Security Status</span>
                <div className={styles.featureList}>
                    {SECURITY_FEATURES.map((feature, i) => (
                        <div key={i} className={styles.featureItem}>
                            <span className={styles.featureName}>{feature.name}</span>
                            <span className={styles.featureStatus}>{feature.status}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Data Toggles */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Data Collection</span>
                <div className={styles.toggleList}>
                    {settings.map((setting, i) => (
                        <div key={i} className={styles.toggleItem}>
                            <span className={styles.toggleName}>{setting.name}</span>
                            <button
                                className={`${styles.toggle} ${setting.enabled ? styles.toggleOn : ''}`}
                                onClick={() => toggleSetting(i)}
                            >
                                <div className={styles.toggleKnob} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
