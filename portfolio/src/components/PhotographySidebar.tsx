"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Camera, Building2, Heart, User } from 'lucide-react';

export default function PhotographySidebar() {
  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-black/90 pt-24 px-4 hidden md:block border-r border-purple-900/30">
      <div className="space-y-2">
        <h3 className="text-purple-400 text-sm font-medium mb-4 uppercase tracking-wider">Portfolio</h3>
        
        <Link href="/photography/wedding" className="block">
          <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-purple-900/20">
            <Camera className="mr-2 h-4 w-4 text-purple-400" />
            Wedding
          </Button>
        </Link>
        
        <Link href="/photography/business" className="block">
          <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-purple-900/20">
            <Building2 className="mr-2 h-4 w-4 text-purple-400" />
            Business
          </Button>
        </Link>
        
        <Link href="/photography/portraiture" className="block">
          <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-purple-900/20">
            <User className="mr-2 h-4 w-4 text-purple-400" />
            Portraiture
          </Button>
        </Link>
        
        <Link href="/photography/couples" className="block">
          <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-purple-900/20">
            <Heart className="mr-2 h-4 w-4 text-purple-400" />
            Couples
          </Button>
        </Link>
        
        <div className="pt-6 pb-2">
          <div className="border-t border-purple-900/30"></div>
        </div>
        
        <Link href="/photography/contact" className="block">
          <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-purple-900/20">
            Book a Session
          </Button>
        </Link>
      </div>
      
      <div className="absolute bottom-6 left-4 right-4 text-xs text-gray-500">
        <p>© {new Date().getFullYear()} Christopher Tapia</p>
        <p className="mt-1">Photography & Visual Arts</p>
      </div>
    </div>
  );
}