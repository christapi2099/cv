"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Linkedin, Mail } from 'lucide-react';
import { TypeAnimation } from 'react-type-animation';
import Navigation from '@/components/Navigation';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Navigation */}
      <Navigation />

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
                    'React Native',
                    1000,
                  ]}
                  wrapper="span"
                  speed={50}
                  repeat={Infinity}
                />
                <span className="text-blue-400">.</span>
              </h1>
              <p className="text-xl text-gray-300">
                4th Year Informatics Major @ University of California, Irvine, specializing
                organizations and information technology. Passionate about software development,
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
                <img
                  src="/images/headshot1.JPG"
                  alt="Christopher Tapia"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold">Featured Projects</h2>
            <Link href="/projects">
              <Button variant="outline" size="sm">View All Projects</Button>
            </Link>
          </div>
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
          <a href="https://github.com/christapi2099" target='_blank' rel="noopener noreferrer" >
            <Button variant="ghost" size="icon">
              <Github className="w-5 h-5" />
            </Button>
          </a>
          <a href='https://www.linkedin.com/in/christopher-tapia-439897198/' target='_blank' rel="noopener noreferrer" >
            <Button variant="ghost" size="icon">
              <Linkedin className="w-5 h-5" />
            </Button>
          </a>
          <a href='mailto: christapia898@gmail.com'>
            <Button variant="ghost" size="icon">
              <Mail className="w-5 h-5" />
            </Button>
          </a>
          </div>
        </div>
      </footer>
    </div>
  );
}