import React from 'react';

export const HazardIcon = ({ category, className = "w-9 h-9" }: { category: string, className?: string }) => {
    switch (category) {
        // Safety Classification
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
        case 'Environmental Hazards':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#4CAF50"/>
                    <path d="M32 14 C22 22 18 34 22 44 C26 50 38 50 42 44 C46 34 42 22 32 14 Z" fill="#ffffff"/>
                    <path d="M32 20 L32 46 M32 30 L26 26 M32 36 L38 32 M32 40 L27 38" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
            );

        // Security Classification
        case 'Theft':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#EF4444"/>
                    <rect x="22" y="28" width="20" height="22" rx="4" fill="#ffffff"/>
                    <path d="M26 28 V20 C26 16.7 28.7 14 32 14 C35.3 14 38 16.7 38 20 V28" stroke="#ffffff" strokeWidth="4" strokeLinecap="round"/>
                    <circle cx="32" cy="38" r="3" fill="#EF4444"/>
                    <line x1="32" y1="41" x2="32" y2="45" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
            );
        case 'Unauthorized Access':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#F97316"/>
                    <circle cx="32" cy="24" r="9" fill="#ffffff"/>
                    <path d="M18 48 C18 40 24 38 32 38 C40 38 46 40 46 48" fill="#ffffff"/>
                    <line x1="16" y1="16" x2="48" y2="48" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round"/>
                </svg>
            );
        case 'Damage':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#8B5CF6"/>
                    <path d="M22 18 L42 18 L38 46 L26 46 Z" fill="#ffffff"/>
                    <path d="M28 24 L36 32 L30 36 L38 42" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            );
        case 'Misbehavior':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#EC4899"/>
                    <circle cx="32" cy="32" r="20" fill="#ffffff"/>
                    <circle cx="26" cy="28" r="2.5" fill="#EC4899"/>
                    <circle cx="38" cy="28" r="2.5" fill="#EC4899"/>
                    <path d="M25 40 C28 36 36 36 39 40" stroke="#EC4899" strokeWidth="3" strokeLinecap="round" fill="none"/>
                    <path d="M22 22 L29 25 M42 22 L35 25" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
            );
        case 'Force Access':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#DC2626"/>
                    <path d="M18 16 H36 V48 H18 Z" fill="#ffffff"/>
                    <path d="M36 16 L48 24 V42 L36 48 Z" fill="#ffffff" fillOpacity="0.7"/>
                    <path d="M14 32 H28 M24 26 L30 32 L24 38" stroke="#DC2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            );

        // Fallback
        case 'Health Hazards':
        case 'Health and Non':
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#FFC107"/>
                    <path d="M28 16 L36 16 L36 28 L48 28 L48 36 L36 36 L36 48 L28 48 L28 36 L16 36 L16 28 L28 28 Z" fill="#1a1a1a"/>
                </svg>
            );
        case 'Other Hazards':
        default:
            return (
                <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" fill="#64748B"/>
                    <path d="M24 24 C24 16 40 16 40 24 C40 32 32 34 32 40" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none"/>
                    <circle cx="32" cy="48" r="3.5" fill="#ffffff"/>
                </svg>
            );
    }
};

export const SAFETY_HAZARDS = [
    { value: 'Physical Hazards', labelAr: 'مخاطر فيزيائية', labelEn: 'Physical Hazards' },
    { value: 'Ergonomic Hazards', labelAr: 'مخاطر هندسة بشرية', labelEn: 'Ergonomic Hazards' },
    { value: 'Chemical Hazards', labelAr: 'مخاطر كيميائية', labelEn: 'Chemical Hazards' },
    { value: 'Biological Hazards', labelAr: 'مخاطر بيولوجية', labelEn: 'Biological Hazards' },
    { value: 'Psychosocial Hazards', labelAr: 'مخاطر نفسية-اجتماعية', labelEn: 'Psychosocial Hazards' },
    { value: 'Safety Hazards', labelAr: 'مخاطر السلامة', labelEn: 'Safety Hazards' },
    { value: 'Environmental Hazards', labelAr: 'مخاطر بيئية', labelEn: 'Environmental Hazards' },
];

export const SECURITY_HAZARDS = [
    { value: 'Theft', labelAr: 'سرقة', labelEn: 'Theft' },
    { value: 'Unauthorized Access', labelAr: 'دخول غير مصرح', labelEn: 'Unauthorized Access' },
    { value: 'Damage', labelAr: 'تلف / تخريب', labelEn: 'Damage' },
    { value: 'Misbehavior', labelAr: 'سوء سلوك', labelEn: 'Misbehavior' },
    { value: 'Force Access', labelAr: 'دخول بالقوة', labelEn: 'Force Access' },
];

// Combined list for general compatibility
export const HAZARD_CATEGORIES = [
    ...SAFETY_HAZARDS,
    ...SECURITY_HAZARDS,
    { value: 'Health Hazards', labelAr: 'مخاطر صحية', labelEn: 'Health Hazards' },
    { value: 'Other Hazards', labelAr: 'أخرى (غير مصنف)', labelEn: 'Other Hazards' },
];
