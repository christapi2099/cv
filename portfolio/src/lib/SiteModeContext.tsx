"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type SiteMode = 'webdev' | 'photography';

interface SiteModeContextType {
  mode: SiteMode;
  toggleMode: () => void;
}

const SiteModeContext = createContext<SiteModeContextType | undefined>(undefined);

export function SiteModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SiteMode>('webdev');

  const toggleMode = () => {
    setMode(mode === 'webdev' ? 'photography' : 'webdev');
  };

  return (
    <SiteModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </SiteModeContext.Provider>
  );
}

export function useSiteMode() {
  const context = useContext(SiteModeContext);
  if (context === undefined) {
    throw new Error('useSiteMode must be used within a SiteModeProvider');
  }
  return context;
}