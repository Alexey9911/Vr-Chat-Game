'use client';

import styles from './SkillTags.module.css';
import { X, Sparkles } from 'lucide-react';
import { PenTool, Code, BarChart, Image as ImageIcon, Mic, Globe, Map, Languages } from 'lucide-react';

// Mapping string titles to icons for rendering
const ICON_MAP = {
    'Creative Writing': PenTool,
    'Code Analysis': Code,
    'Data Science': BarChart,
    'Image Gen': ImageIcon,
    'Audio Synthesis': Mic,
    'Web Browsing': Globe,
    'Strategic Planning': Map,
    'Translation': Languages
};

export default function SkillTags({ activeSkills, onRemoveSkill }) {
    if (!activeSkills || activeSkills.length === 0) return null;

    return (
        <div className={styles.tagsContainer}>
            {activeSkills.map((skill) => {
                const Icon = ICON_MAP[skill.title] || Sparkles;

                return (
                    <div
                        key={skill.title}
                        className={`${styles.tag} animate-scale-in`}
                        onClick={() => onRemoveSkill(skill)}
                    >
                        <div className={styles.iconWrapper}>
                            <Icon size={12} />
                        </div>
                        <span className={styles.label}>{skill.title}</span>
                        <button className={styles.removeBtn}>
                            <X size={12} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
