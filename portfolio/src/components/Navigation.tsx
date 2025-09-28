"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { useSiteMode } from '@/lib/SiteModeContext';
import { Camera, Code } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const { mode, toggleMode } = useSiteMode();
  
  return (
    <nav className="p-6">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/">
          <h1 className="text-2xl font-bold cursor-pointer">Christopher Tapia</h1>
        </Link>
        <div className="flex items-center space-x-4">
          <Link href="/about">
            <Button 
              variant={pathname === '/about' ? "default" : "ghost"}
            >
              About
            </Button>
          </Link>
          <Link href="/projects">
            <Button 
              variant={pathname === '/projects' ? "default" : "ghost"}
            >
              Projects
            </Button>
          </Link>
          <Link href="/contact">
            <Button 
              variant={pathname === '/contact' ? "default" : "ghost"}
            >
              Contact
            </Button>
          </Link>
          <Button 
            variant="outline"
            onClick={toggleMode}
            className="ml-4 flex items-center gap-2"
          >
            {mode === 'webdev' ? (
              <>
                <Camera className="h-4 w-4" />
                <span>Switch to Photography Mode</span>
              </>
            ) : (
              <>
                <Code className="h-4 w-4" />
                <span>Switch to Web Dev Mode</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
}