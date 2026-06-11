import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRIO } from './utils/constants';

const SETTINGS_KEY = 'notemd_settings_v1';

const base = { prio: PRIO, radius: { sm: 5, md: 9, lg: 14, xl: 20 }, font: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 28 } };

export const lightTheme = {
  ...base,
  id: 'paper',
  bg:         '#F2EDE3',
  surface:    '#FAF8F2',
  surfaceAlt: '#EDE8DC',
  surfaceEm:  '#E4DDD1',
  ink:        '#1E1B16',
  inkLight:   '#EAE4D9',
  text:       '#1E1B16',
  textSec:    '#6B6050',
  textTer:    '#A8998A',
  border:     '#D9D0C0',
  borderEm:   '#B5AA98',
  success:    '#4A7459',
  danger:     '#CD2C54',
  accent:     '#1E1B16',
  accentLight:'#EAE4D9',
};

export const darkTheme = {
  ...base,
  id: 'dark',
  bg:         '#1a1a1a',
  surface:    '#242424',
  surfaceAlt: '#1e1e1e',
  surfaceEm:  '#2a2a2a',
  ink:        '#f0f0f0',
  inkLight:   '#2a2a2a',
  text:       '#f0f0f0',
  textSec:    '#909090',
  textTer:    '#606060',
  border:     '#383838',
  borderEm:   '#525252',
  success:    '#4A7459',
  danger:     '#CD2C54',
  accent:     '#f0f0f0',
  accentLight:'#2a2a2a',
};

const ThemeContext = createContext(lightTheme);
const ThemeControlContext = createContext({
  themeId: 'paper', switchTheme: () => {},
  showMeetings: true, setShowMeetings: () => {},
});

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState('paper');
  const [showMeetings, setShowMeetingsState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.themeId) setThemeId(s.themeId);
        if (s.showMeetings !== undefined) setShowMeetingsState(s.showMeetings);
      } catch {}
    });
  }, []);

  const persist = useCallback((patch) => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      const prev = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...prev, ...patch }));
    });
  }, []);

  const switchTheme = useCallback((id) => {
    setThemeId(id);
    persist({ themeId: id });
  }, [persist]);

  const setShowMeetings = useCallback((val) => {
    setShowMeetingsState(val);
    persist({ showMeetings: val });
  }, [persist]);

  const active = themeId === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeControlContext.Provider value={{ themeId, switchTheme, showMeetings, setShowMeetings }}>
      <ThemeContext.Provider value={active}>
        {children}
      </ThemeContext.Provider>
    </ThemeControlContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useThemeControl = () => useContext(ThemeControlContext);
