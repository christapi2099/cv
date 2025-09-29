"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Linkedin, Mail, Camera, Image as ImageIcon } from 'lucide-react';
import { TypeAnimation } from 'react-type-animation';
import Navigation from '@/components/Navigation';
import PhotographySidebar from '@/components/PhotographySidebar';
import { useSiteMode } from '@/lib/SiteModeContext';
import { useProjects } from '@/lib/ProjectsContext';

export default function HomePage() {
  const { mode } = useSiteMode();
  const { getFeaturedProjects } = useProjects();
  const featuredProjects = getFeaturedProjects();

  return (
    <div className={`min-h-screen ${
      mode === 'webdev' 
        ? 'bg-gradient-to-b from-gray-900 to-gray-800' 
        : 'bg-gradient-to-b from-black to-gray-900'
    } text-white transition-colors duration-700`}>
      {/* Navigation */}
      <Navigation />

      {/* Photography Sidebar - Only visible in photography mode */}
      {mode === 'photography' && <PhotographySidebar />}

      {/* Main Content Area */}
      <div className={`transition-all duration-700 ease-in-out ${
        mode === 'photography' ? 'md:pl-64' : ''
      }`}>
        {/* Web Development Mode Content */}
        <div className={`transition-all duration-700 ease-in-out ${
          mode === 'webdev' ? 'opacity-100 transform translate-y-0' : 'opacity-0 absolute -z-10 transform -translate-y-8'
        }`}>
          {mode === 'webdev' && (
            <>
              {/* Hero Section */}
              <section className="py-20">
                <div className="max-w-6xl mx-auto px-6">
                  <div className="flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 space-y-6">
                      <h1 className="text-5xl font-bold">
                        <TypeAnimation
                          sequence={[
                            'Software Engineer',
                            1000,
                            'Dev Ops',
                            1000,
                            'Full-Stack Web Development',
                            1000,
                            'React Native Developer',
                            1000,
                          ]}
                          wrapper="span"
                          speed={50}
                          repeat={Infinity}
                        />
                        <span className="text-blue-400">.</span>
                      </h1>
                      <p className="text-xl text-gray-300">
                        Recent graduate, from the University of California, Irvine, specializing
                        in organizations and information technology. Passionate about software development,
                        DevOps, and full-stack web development. Interested in building CI/CD pipelines,
                        and creating scalable, maintainable applications.
                      </p>
                      <div className="flex gap-4">
                        <Link href="/projects">
                          <Button>View Projects</Button>
                        </Link>
                        <Link href="/contact">
                          <Button variant="outline">Contact Me</Button>
                        </Link>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-center">
                      {/* Simplified headshot with border only */}
                      <div className="border-4 border-blue-300 rounded-full overflow-hidden w-64 h-64">
                        <Image
                          src="/images/headshot1.JPG"
                          alt="Christopher Tapia"
                          className="w-full h-full object-cover"
                          width={256}
                          height={256}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Featured Projects Section - Dynamic from ProjectsContext */}
              <section className="py-20 bg-gray-900/50">
                <div className="max-w-6xl mx-auto px-6">
                  <div className="flex justify-between items-center mb-12">
                    <h2 className="text-3xl font-bold">Featured Projects</h2>
                    <Link href="/projects">
                      <Button variant="outline" size="sm">View All Projects</Button>
                    </Link>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {featuredProjects.map((project) => (
                      <Card key={project.id} className="bg-gray-800 border-gray-700">
                        <CardHeader>
                          <CardTitle>{project.title}</CardTitle>
                          <CardDescription className="text-gray-400">
                            {project.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-300">
                            {project.detailedDescription}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-4">
                            {project.technologies.map((tech, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-900/40 rounded-md text-xs text-blue-200">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Photography Mode Content */}
        <div className={`transition-all duration-700 ease-in-out ${
          mode === 'photography' ? 'opacity-100 transform translate-y-0' : 'opacity-0 absolute -z-10 transform translate-y-8'
        }`}>
          {mode === 'photography' && (
            <>
              {/* Photography Hero Section */}
              <section className="py-20">
                <div className="max-w-6xl mx-auto px-6">
                  <div className="flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 space-y-6">
                      <h1 className="text-5xl font-bold">
                        <TypeAnimation
                          sequence={[
                            'Wedding Photographer',
                            1000,
                            'Portrait Specialist',
                            1000,
                            'Visual Storyteller',
                            1000,
                            'Business Photographer',
                            1000,
                            'Lighting Expert',
                            1000,
                            'Couples Photographer',
                            1000,
                          ]}
                          wrapper="span"
                          speed={50}
                          repeat={Infinity}
                        />
                        <span className="text-purple-400">.</span>
                      </h1>
                      <p className="text-xl text-gray-300">
                        Professional photographer specializing in wedding photography, business portraits, 
                        and full body portraiture. With extensive experience in photography, photo editing, 
                        posing techniques, and lighting setups, I create captivating images that tell your 
                        unique story and capture authentic moments.
                      </p>
                      <div className="flex gap-4">
                        <Button className="bg-purple-600 hover:bg-purple-700">View Gallery</Button>
                        <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-900/20">Book a Session</Button>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="border-4 border-purple-400 rounded-full overflow-hidden w-64 h-64">
                        <Image
                          src="/images/headshot1.JPG"
                          alt="Christopher Tapia"
                          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                          width={256}
                          height={256}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Photography Gallery Section */}
              <section className="py-20 bg-black/50">
                <div className="max-w-6xl mx-auto px-6">
                  <h2 className="text-3xl font-bold mb-12">Portfolio Highlights</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Wedding Photos */}
                    <div className="overflow-hidden rounded-lg group relative">
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-600" />
                        <span className="sr-only">Wedding Sample</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4">
                          <p className="text-white font-medium">Wedding Collection</p>
                          <p className="text-gray-300 text-sm">Elegant Moments</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Business Photos */}
                    <div className="overflow-hidden rounded-lg group relative">
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-600" />
                        <span className="sr-only">Business Sample</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4">
                          <p className="text-white font-medium">Business Portraits</p>
                          <p className="text-gray-300 text-sm">Professional Presence</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Portrait Photos */}
                    <div className="overflow-hidden rounded-lg group relative">
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-600" />
                        <span className="sr-only">Portrait Sample</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4">
                          <p className="text-white font-medium">Full Body Portraiture</p>
                          <p className="text-gray-300 text-sm">Expressive Compositions</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Couples Photos */}
                    <div className="overflow-hidden rounded-lg group relative">
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-600" />
                        <span className="sr-only">Couples Sample</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4">
                          <p className="text-white font-medium">Couples Sessions</p>
                          <p className="text-gray-300 text-sm">Love Stories</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Additional samples */}
                    <div className="overflow-hidden rounded-lg group relative">
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-600" />
                        <span className="sr-only">Additional Sample</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4">
                          <p className="text-white font-medium">Editorial</p>
                          <p className="text-gray-300 text-sm">Creative Direction</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-hidden rounded-lg group relative">
                      <div className="aspect-square bg-gray-800 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-600" />
                        <span className="sr-only">Additional Sample</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4">
                          <p className="text-white font-medium">Fashion</p>
                          <p className="text-gray-300 text-sm">Style & Expression</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center mt-10">
                    <Button className="bg-purple-600 hover:bg-purple-700">View Full Gallery</Button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer with Social Links - Common to both modes but with mode-specific styling/links */}
        <footer className={`py-12 transition-colors duration-700 ease-in-out ${
          mode === 'webdev' ? 'bg-gray-900' : 'bg-black'
        }`}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex justify-center space-x-6">
              <a href="https://github.com/christapi2099" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon">
                  <Github className="w-5 h-5" />
                </Button>
              </a>
              <a href="https://www.linkedin.com/in/christopher-tapia-439897198/" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon">
                  <Linkedin className="w-5 h-5" />
                </Button>
              </a>
              <a href="mailto: christapia898@gmail.com">
                <Button variant="ghost" size="icon">
                  <Mail className="w-5 h-5" />
                </Button>
              </a>
              {mode === 'photography' && (
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon">
                    <Camera className="w-5 h-5" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}