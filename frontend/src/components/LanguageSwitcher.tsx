import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
 const { i18n } = useTranslation();

 const toggleLanguage = () => {
 const nextLang = i18n.language.startsWith('ar') ? 'en' : 'ar';
 i18n.changeLanguage(nextLang);
 };

 return (
 <button
 onClick={toggleLanguage}
 className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full text-base transition-colors mx-2 border border-gray-200 hover:border-gray-300"
 >
 {i18n.language.startsWith('ar') ? 'English' : 'العربية'}
 </button>
 );
};

export default LanguageSwitcher;
