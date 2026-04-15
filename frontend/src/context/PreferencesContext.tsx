import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Language, translations, TranslationKey } from '../i18n/translations';

export type ThemeMode = 'system' | 'light' | 'dark';
export type FontFamilyMode = 'claude' | 'inter' | 'system';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme-mode';
const LANGUAGE_STORAGE_KEY = 'language';

type PreferencesContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  language: Language;
  setLanguage: (language: Language) => void;
  fontFamily: FontFamilyMode;
  setFontFamily: (fontFamily: FontFamilyMode) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  localizeApiMessage: (message: string) => string;
};

const apiMessageMap: Record<string, TranslationKey> = {
  'Registration successful': 'apiRegistrationSuccessful',
  'Login successful': 'apiLoginSuccessful',
  'Correct! Flag accepted.': 'apiCorrectFlag',
  'Incorrect flag. Try again!': 'apiIncorrectFlag',
  'Team name or email already exists': 'apiTeamExists',
  'Username already exists': 'apiUsernameExists',
  'Invalid credentials': 'apiInvalidCredentials',
  'Email and password are required': 'apiEmailPasswordRequired',
  'Name, email, and password are required': 'apiNameEmailPasswordRequired',
  'Username and password are required': 'apiUsernamePasswordRequired',
  'Password must be at least 6 characters': 'apiPasswordMin',
  'Database error': 'apiDatabaseError',
  'Authentication required': 'apiAuthenticationRequired',
  'Invalid or expired token': 'apiInvalidToken',
  'Challenge created': 'apiChallengeCreated',
  'Challenge updated': 'apiChallengeUpdated',
  'Challenge deleted': 'apiChallengeDeleted',
  'Challenge not found': 'apiChallengeNotFound',
  'Failed to create challenge': 'apiFailedCreateChallenge',
  'Failed to update challenge': 'apiFailedUpdateChallenge',
  'Failed to delete challenge': 'apiFailedDeleteChallenge',
  'Title, points, and flag are required': 'apiChallengeFlagRequired',
  'Title, category, points, and flag are required': 'apiChallengeCategoryFlagRequired',
  'Invalid challenge category': 'apiInvalidChallengeCategory',
  'Category name is required': 'apiCategoryNameRequired',
  'Category already exists': 'apiCategoryExists',
  'Failed to create category': 'apiFailedCreateCategory',
  'Category created': 'apiCategoryCreated',
  'Team updated': 'apiTeamUpdated',
  'Member added': 'apiMemberAdded',
  'Member updated': 'apiMemberUpdated',
  'Member deleted': 'apiMemberDeleted',
  'Team not found': 'apiTeamNotFound',
  'Team has reached the maximum of 6 members': 'apiTeamMaxMembers',
  'Team name member cannot be edited here': 'apiTeamNameMemberEditBlocked',
  'Team name member cannot be deleted': 'apiTeamNameMemberDeleteBlocked',
  'CTF is finished. Access is locked for team accounts.': 'apiCtfFinishedLocked',
  'Challenge ID and flag are required': 'apiChallengeIdFlagRequired',
  'You have already solved this challenge': 'apiAlreadySolved',
  'Failed to submit flag': 'apiFailedSubmitFlag',
  'Too many flag submissions. Please slow down.': 'apiTooManySubmissions',
  'Flag submissions are currently closed.': 'apiFlagSubmissionsClosed'
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getInitialThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'en' || stored === 'fr') {
    return stored;
  }
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('fr') ? 'fr' : 'en';
}

function getInitialFontFamily(): FontFamilyMode {
  return 'claude';
}

function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return mode;
}

function getSystemDarkPreference(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function PreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [fontFamily] = useState<FontFamilyMode>(getInitialFontFamily);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDarkPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = useMemo(() => resolveTheme(themeMode, systemDark), [themeMode, systemDark]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode, resolvedTheme]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', 'claude');
  }, [fontFamily]);

  const setThemeMode = (mode: ThemeMode): void => {
    setThemeModeState(mode);
  };

  const toggleTheme = (): void => {
    const current = resolveTheme(themeMode, systemDark);
    setThemeModeState(current === 'dark' ? 'light' : 'dark');
  };

  const setLanguage = (nextLanguage: Language): void => {
    setLanguageState(nextLanguage);
  };

  const setFontFamily = (nextFontFamily: FontFamilyMode): void => {
    void nextFontFamily;
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let value: string = translations[language][key] ?? translations.en[key];
    if (!params) {
      return value;
    }
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      value = value.split(`{${paramKey}}`).join(String(paramValue));
    });
    return value;
  };

  const localizeApiMessage = (message: string): string => {
    const key = apiMessageMap[message];
    return key ? t(key) : message;
  };

  return (
    <PreferencesContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        setThemeMode,
        toggleTheme,
        language,
        setLanguage,
        fontFamily,
        setFontFamily,
        t,
        localizeApiMessage
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
