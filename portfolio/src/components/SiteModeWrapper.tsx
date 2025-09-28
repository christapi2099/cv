"use client";

import React from 'react';
import { SiteModeProvider } from '@/lib/SiteModeContext';
import { ProjectsProvider } from '@/lib/ProjectsContext';

export default function SiteModeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteModeProvider>
      <ProjectsProvider>
        {children}
      </ProjectsProvider>
    </SiteModeProvider>
  );
}