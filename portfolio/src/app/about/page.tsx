"use client";

import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Star, GitFork, Eye } from 'lucide-react';

// Define interface for GitHub repository data
interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
}

export default function AboutPage() {
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch repositories from GitHub API
    const fetchRepositories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('https://api.github.com/users/christapi2099/repos?sort=updated&per_page=10');
        
        if (!response.ok) {
          throw new Error('Failed to fetch repositories');
        }
        
        const data = await response.json();
        setRepositories(data);
        setIsLoading(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchRepositories();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Navigation />
      
      <main className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-8">About Me</h1>
          
          {/* Personal Bio Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Who I Am</h2>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-lg text-gray-300 mb-4">
                  I&apos;m Christopher Tapia, a 4th Year Informatics Major at the University of California, Irvine,
                  specializing in organizations and information technology.
                </p>
                <p className="text-lg text-gray-300 mb-4">
                  I&apos;m passionate about software development, DevOps, and full-stack web development.
                  My interests include building CI/CD pipelines and creating scalable, maintainable applications.
                </p>
                <p className="text-lg text-gray-300">
                  When I&apos;m not coding, I enjoy exploring new technologies, contributing to open-source projects,
                  and staying up-to-date with the latest industry trends.
                </p>
              </div>
              <div className="flex justify-center">
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
          </section>
          
          {/* Skills Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Skills & Technologies</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "JavaScript", "TypeScript", "React", "Next.js",
                "Node.js", "Express", "Python", "Java",
                "HTML/CSS", "Tailwind CSS", "Git", "GitHub",
                "CI/CD", "Docker", "AWS", "MongoDB"
              ].map((skill, index) => (
                <div 
                  key={index} 
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-blue-400 transition-colors"
                >
                  {skill}
                </div>
              ))}
            </div>
          </section>
          
          {/* GitHub Stats Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">GitHub Stats</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {/* GitHub Stats Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="w-5 h-5" />
                    GitHub Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    {/* Using regular img tag for better SVG rendering */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="https://github-readme-stats.vercel.app/api?username=christapi2099&show_icons=true&theme=dark&hide_border=true&count_private=true" 
                      alt="GitHub Stats"
                      style={{ width: '100%', maxWidth: '500px', height: 'auto' }}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Languages Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="w-5 h-5" />
                    Most Used Languages
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    {/* Using regular img tag for better SVG rendering */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="https://github-readme-stats.vercel.app/api/top-langs/?username=christapi2099&layout=compact&theme=dark&hide_border=true" 
                      alt="Top Languages"
                      style={{ width: '100%', maxWidth: '500px', height: 'auto' }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
          
          {/* Repositories Section */}
          <section>
            <h2 className="text-2xl font-semibold mb-6">Public Repositories</h2>
            
            {isLoading ? (
              <div className="text-center py-12">
                <p>Loading repositories...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400">Error: {error}</p>
                <p className="text-gray-400 mt-2">
                  GitHub API rate limits may apply. Please try again later or visit my 
                  <a 
                    href="https://github.com/christapi2099" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline ml-1"
                  >
                    GitHub profile
                  </a>.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {repositories.map((repo) => (
                  <Card key={repo.id} className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle>
                          <a 
                            href={repo.html_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors flex items-center gap-2"
                          >
                          <Github className="w-5 h-5" />
                          {repo.name}
                        </a>
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        {repo.description || "No description provided"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6 text-sm text-gray-400">
                        {repo.language && (
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                            {repo.language}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4" />
                          {repo.stargazers_count}
                        </div>
                        <div className="flex items-center gap-1">
                          <GitFork className="w-4 h-4" />
                          {repo.forks_count}
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {repo.watchers_count}
                        </div>
                      </div>
                      
                      <div className="mt-4">
                          <a 
                            href={repo.html_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                          <Button variant="outline" size="sm">
                            View Repository
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-400">
            Want to connect? Check out my <a href="/contact" className="text-blue-400 hover:underline">contact page</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}