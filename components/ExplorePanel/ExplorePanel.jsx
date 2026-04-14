'use client';

import { useEffect, useRef } from 'react';
import styles from './ExplorePanel.module.css';
import {
    PenTool, Code, BarChart, Image as ImageIcon,
    Mic, Globe, Map, Languages, X, Plus, Check
} from 'lucide-react';

const SKILLS = [
    { icon: PenTool, title: 'Creative Writing', desc: 'Storytelling & Scripts' },
    { icon: Code, title: 'Code Analysis', desc: 'Debug & Refactor' },
    { icon: BarChart, title: 'Data Science', desc: 'Analytics & Insights' },
    { icon: ImageIcon, title: 'Image Gen', desc: 'Visual Art Creation' },
    { icon: Mic, title: 'Audio Synthesis', desc: 'Voice & Sound Design' },
    { icon: Globe, title: 'Web Browsing', desc: 'Real-time Search' },
    { icon: Map, title: 'Strategic Planning', desc: 'Roadmaps & Logic' },
    { icon: Languages, title: 'Translation', desc: 'Multi-lingual Support' },
];

export default function ExplorePanel({ isOpen, onClose, activeSkills = [], onToggleSkill }) {
    const panelRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && panelRef.current && !panelRef.current.contains(e.target)) {
                // Check if clicking on the explore button itself (prevent toggle conflict)
                const exploreBtn = e.target.closest('[data-label="Explore"]');
                if (exploreBtn) return;

                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const isSkillActive = (skillTitle) => {
        return activeSkills.some(s => s.title === skillTitle);
    };

    return (
        <div
            className={`${styles.panel} ${isOpen ? styles.open : ''}`}
            ref={panelRef}
        >
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Explore Skills</h2>
                    <p className={styles.subtitle}>Discover what Neyrs can do</p>
                </div>
                <button onClick={onClose} className={styles.closeButton}>
                    <X size={20} />
                </button>
            </div>

            <div className={styles.grid}>
                {SKILLS.map((skill, index) => {
                    const isActive = isSkillActive(skill.title);
                    return (
                        <div
                            key={index}
                            className={`${styles.card} ${isActive ? styles.active : ''}`}
                            style={{ animationDelay: `${index * 50}ms` }}
                            onClick={() => onToggleSkill(skill)}
                        >
                            <div className={styles.iconWrapper}>
                                <skill.icon size={24} strokeWidth={1.5} />
                            </div>
                            <div className={styles.cardContent}>
                                <h3 className={styles.cardTitle}>{skill.title}</h3>
                                <p className={styles.cardDesc}>{skill.desc}</p>
                            </div>
                            <div className={styles.action}>
                                {isActive ? <Check size={20} /> : <Plus size={20} />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
