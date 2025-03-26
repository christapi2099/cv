"use client";

import React from 'react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink } from 'lucide-react';

export default function ProjectsPage() {
  // Sample projects data - this could be fetched from an API or CMS in a real application
  const projects = [
    {
      id: 1,
      title: "Portfolio Website",
      description: "Personal portfolio website built with Next.js and Tailwind CSS",
      details: "A responsive portfolio website showcasing my projects, skills, and experience. Built with Next.js, TypeScript, and Tailwind CSS.",
      technologies: ["Next.js", "TypeScript", "Tailwind CSS", "React"],
      githubUrl: "https://github.com/christapi2099/cv",
      liveUrl: "#"
    },
    {
      id: 2,
      title: "BJJ Roletrack",
      description: "Analytics driven Martial Arts Attendance tracking platform",
      details: "A full-stack web application for tracking martial arts attendance. Includes user authentication, membership tracking, registration, class QR code check in generation, attendance tracking, and analytics dashboard.",
      technologies: ["React", "Node.js", "MUI", "MYSQL"],
      githubUrl: "https://github.com/christapi2099/task-manager",
      liveUrl: "#"
    },
    {
      id: 3,
      title: "Second Brain",
      description: "React Native Task and Routine Management Platform",
      details: "This is a react native expo app that helps people with ADHD get organized by helping them break down tasks, manage their time, plan ahead and help with symptoms of time blindness and procrastination.",
      technologies: ["React Native", "Expo", "TypeScript", "MYSQLite", "AWS Amplify"],
      githubUrl: "https://github.com/christapi2099/adhd_secondbrain",
      liveUrl: "#"
    },
    {
      id: 4,
      title: "Weather Dashboard",
      description: "A weather dashboard using OpenWeather API",
      details: "A weather dashboard that displays current weather and 5-day forecast for any city. Uses the OpenWeather API for weather data.",
      technologies: ["JavaScript", "HTML", "CSS", "API Integration"],
      githubUrl: "https://github.com/christapi2099/weather-dashboard",
      liveUrl: "#"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Navigation />
      
      <main className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-8">My Projects</h1>
          <p className="text-xl text-gray-300 mb-12">
            Here are some of the projects I've worked on. Each project represents different skills and technologies I've used.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project) => (
              <Card key={project.id} className="bg-gray-800 border-gray-700 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-2xl">{project.title}</CardTitle>
                  <CardDescription className="text-gray-400">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300">{project.details}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {project.technologies.map((tech, index) => (
                      <span 
                        key={index} 
                        className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-sm"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Github className="w-4 h-4" />
                        Code
                      </Button>
                    </a>
                    <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Live Demo
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-400">
            Want to see more? Check out my <a href="https://github.com/christapi2099" className="text-blue-400 hover:underline">GitHub profile</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}