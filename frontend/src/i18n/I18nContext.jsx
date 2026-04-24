import { createContext, useContext, useState, useCallback } from 'react';
import translations from './index';

const I18nContext = createContext();

export function I18nProvider({ children }) {
    const [locale, setLocale] = useState(() => {
        return localStorage.getItem('locale') || 'zh';
    });

    const changeLocale = useCallback((newLocale) => {
        setLocale(newLocale);
        localStorage.setItem('locale', newLocale);
    }, []);

    const t = useCallback((key) => {
        const keys = key.split('.');
        let value = translations[locale];
        for (const k of keys) {
            value = value?.[k];
        }
        return value || key;
    }, [locale]);

    return (
        <I18nContext.Provider value={{ locale, changeLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return context;
}

export { translations };