"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Github, Linkedin, Mail } from 'lucide-react';
import { TypeAnimation } from 'react-type-animation';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Navigation */}
      <nav className="p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Christopher Tapia</h1>
          <div className="space-x-4">
            <Button variant="ghost">About</Button>
            <Button variant="ghost">Projects</Button>
            <Button variant="ghost">Contact</Button>
          </div>
        </div>
      </nav>

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
                Building elegant solutions to complex problems. Passionate about web development, 
                cloud architecture, and creating impactful user experiences.
              </p>
              <div className="flex gap-4">
                <Button>View Projects</Button>
                <Button variant="outline">Contact Me</Button>
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              <Avatar className="w-64 h-64">
                <img
                  src="/api/placeholder/256/256"
                  alt="Profile"
                  className="rounded-full"
                />
              </Avatar>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-12">Featured Projects</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((project) => (
              <Card key={project} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle>Project {project}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Description of your amazing project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300">
                    Detailed explanation of the project, technologies used, and your role in its development.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer with Social Links */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-center space-x-6">
            <Button variant="ghost" size="icon">
              <Github className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Linkedin className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Mail className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}