import React from 'react';

type HazardCategory = 'Biological Hazards' | 'Chemical Hazards' | 'Physical Hazards' | 'Safety Hazards' | 'Ergonomic Hazards' | 'Psychosocial Hazards';

export const HazardIcon = ({ category, className = "w-9 h-9" }: { category: string, className?: string }) => {
    switch (category) {
        case 'Biological Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <circle cx="32" cy="32" r="8" fill="#1a1a1a"/>
                    <path d="M32 24 C32 16 20 10 14 18 C8 26 16 34 24 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/>
                    <path d="M32 24 C38 16 50 18 48 28 C46 38 36 36 32 30" stroke="#1a1a1a" strokeWidth="5" fill="none"/>
                    <path d="M26 34 C18 38 16 50 26 50 C36 50 36 40 32 38" stroke="#1a1a1a" strokeWidth="5" fill="none"/>
                </svg>
            );
        case 'Chemical Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <circle cx="32" cy="32" r="6" fill="#1a1a1a"/>
                    <circle cx="20" cy="20" r="4" fill="#1a1a1a"/>
                    <circle cx="44" cy="20" r="4" fill="#1a1a1a"/>
                    <line x1="15" y1="50" x2="27" y2="30" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                    <line x1="37" y1="30" x2="49" y2="50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                    <line x1="10" y1="54" x2="54" y2="54" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                </svg>
            );
        case 'Physical Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <circle cx="32" cy="32" r="6" fill="#1a1a1a"/>
                    <path d="M32 8 L32 18 M32 46 L32 56 M8 32 L18 32 M46 32 L56 32" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
                    <path d="M32 14 A18 18 0 0 1 50 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/>
                    <path d="M32 50 A18 18 0 0 1 14 32" stroke="#1a1a1a" strokeWidth="4" fill="none"/>
                </svg>
            );
        case 'Safety Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <circle cx="40" cy="14" r="5" fill="#1a1a1a"/>
                    <path d="M40 20 L38 30 L30 26 L20 40" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M30 26 L26 42 L36 48" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M14 44 L22 44" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                </svg>
            );
        case 'Ergonomic Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <circle cx="36" cy="13" r="5" fill="#1a1a1a"/>
                    <path d="M36 18 L34 28 L44 32 L42 22" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="#1a1a1a" fillOpacity="0.3"/>
                    <path d="M34 28 L32 42 L26 52" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                    <path d="M32 42 L40 50" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                    <path d="M20 36 L34 28" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                    <rect x="14" y="32" width="12" height="8" rx="2" fill="#1a1a1a"/>
                </svg>
            );
        case 'Psychosocial Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <ellipse cx="32" cy="30" rx="16" ry="18" fill="#1a1a1a"/>
                    <path d="M20 22 C20 14 44 14 44 22" fill="#1a1a1a"/>
                    <path d="M24 26 C24 22 28 20 32 22 C36 20 40 22 40 26" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                    <path d="M26 32 C26 30 28 28 30 30" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                    <path d="M34 30 C36 28 38 30 38 32" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                </svg>
            );
        default:
            return null;
    }
};

export const HAZARD_CATEGORIES = [
    { value: 'Biological Hazards', labelAr: 'مخاطر بيولوجية', labelEn: 'Biological Hazards' },
    { value: 'Chemical Hazards', labelAr: 'مخاطر كيميائية', labelEn: 'Chemical Hazards' },
    { value: 'Physical Hazards', labelAr: 'مخاطر فيزيائية', labelEn: 'Physical Hazards' },
    { value: 'Safety Hazards', labelAr: 'مخاطر السلامة', labelEn: 'Safety Hazards' },
    { value: 'Ergonomic Hazards', labelAr: 'مخاطر هندسة بشرية', labelEn: 'Ergonomic Hazards' },
    { value: 'Psychosocial Hazards', labelAr: 'مخاطر نفسية-اجتماعية', labelEn: 'Psychosocial Hazards' },
];
