"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const pathname = usePathname();
  
  return (
    <nav className="p-6">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/">
          <h1 className="text-2xl font-bold cursor-pointer">Christopher Tapia</h1>
        </Link>
        <div className="space-x-4">
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
        </div>
      </div>
    </nav>
  );
}