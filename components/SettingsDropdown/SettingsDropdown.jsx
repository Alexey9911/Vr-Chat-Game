'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './SettingsDropdown.module.css';
import { X } from 'lucide-react';

const VOICES = [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female — Default)' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Female)' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Female)' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Female)' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Male)' },
];

export default function SettingsDropdown({ isOpen, onClose, ttsSettings, onSettingsChange, chatMode, onModeChange }) {
    const dropdownRef = useRef(null);
    const isClosingRef = useRef(false);

    // Fake setting state (does nothing, just for UI)
    const [neuralOptimization, setNeuralOptimization] = useState(75);

    // Close on outside click - use a flag to prevent immediate reopen
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                // Check if clicking on the settings button itself (prevent toggle conflict)
                const settingsBtn = e.target.closest('[data-label="Settings"]');
                if (settingsBtn) {
                    // Don't close, let the button toggle handle it
                    return;
                }
                isClosingRef.current = true;
                onClose();
                // Reset the flag after a short delay
                setTimeout(() => {
                    isClosingRef.current = false;
                }, 100);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const handleChange = (key, value) => {
        onSettingsChange({ ...ttsSettings, [key]: value });
    };

    return (
        <div
            className={`${styles.dropdown} ${isOpen ? styles.open : ''}`}
            ref={dropdownRef}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className={styles.header}>
                <span className={styles.title}>Configuration</span>
                <button onClick={onClose} className={styles.closeButton}>
                    <X size={16} />
                </button>
            </div>

            {/* Personality Mode Selector */}
            <div className={styles.section}>
                <label className={styles.sectionLabel}>Personality Mode</label>
                <div className={styles.modeSelector}>
                    <button
                        className={`${styles.modeButton} ${chatMode === 'normal' ? styles.activeMode : ''}`}
                        onClick={() => onModeChange('normal')}
                    >
                        Normal
                    </button>
                    <button
                        className={`${styles.modeButton} ${chatMode === 'flirt' ? styles.activeMode : ''}`}
                        onClick={() => onModeChange('flirt')}
                    >
                        Flirty
                    </button>
                </div>
            </div>

            {/* Voice Selector */}
            <div className={styles.section}>
                <label className={styles.sectionLabel}>Voice Model</label>
                <select
                    className={styles.select}
                    value={ttsSettings.voiceId}
                    onChange={(e) => handleChange('voiceId', e.target.value)}
                >
                    {VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            </div>

            {/* Stability Slider — ElevenLabs: 0 to 1 */}
            <div className={styles.section}>
                <label className={styles.sectionLabel}>Stability</label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        className={styles.slider}
                        min="0"
                        max="1"
                        step="0.05"
                        value={ttsSettings.stability}
                        onChange={(e) => handleChange('stability', parseFloat(e.target.value))}
                    />
                    <span className={styles.sliderValue}>{ttsSettings.stability.toFixed(2)}</span>
                </div>
            </div>

            {/* Style Slider — ElevenLabs: 0 to 1 */}
            <div className={styles.section}>
                <label className={styles.sectionLabel}>Style</label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        className={styles.slider}
                        min="0"
                        max="1"
                        step="0.05"
                        value={ttsSettings.style}
                        onChange={(e) => handleChange('style', parseFloat(e.target.value))}
                    />
                    <span className={styles.sliderValue}>{ttsSettings.style.toFixed(2)}</span>
                </div>
            </div>

            {/* Neural Optimization - Fake setting (does nothing) */}
            <div className={styles.section}>
                <label className={styles.sectionLabel}>Neural Optimization</label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        className={styles.slider}
                        min="0"
                        max="100"
                        step="5"
                        value={neuralOptimization}
                        onChange={(e) => setNeuralOptimization(parseInt(e.target.value))}
                    />
                    <span className={styles.sliderValue}>{neuralOptimization}%</span>
                </div>
                <span className={styles.hint}>Enhances response clarity</span>
            </div>
        </div>
    );
}
