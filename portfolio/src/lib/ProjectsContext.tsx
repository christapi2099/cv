"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Project {
  id: number;
  title: string;
  description: string;
  detailedDescription: string;
  technologies: string[];
  featured: boolean;
}

interface ProjectsContextType {
  projects: Project[];
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: number, project: Partial<Project>) => void;
  deleteProject: (id: number) => void;
  getFeaturedProjects: () => Project[];
}

const defaultProjects: Project[] = [
  {
    id: 1,
    title: "Personal Portfolio Website",
    description: "A responsive portfolio website built with Next.js and Tailwind CSS",
    detailedDescription: "Designed and developed a personal portfolio website to showcase my web development skills and projects. The site features a responsive design, dark mode, and dynamic content management.",
    technologies: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
    featured: true
  },
  {
    id: 2,
    title: "E-commerce Platform",
    description: "Full-stack e-commerce application with payment processing",
    detailedDescription: "Built a complete e-commerce solution with product catalog, shopping cart, user authentication, and Stripe payment processing. Implemented admin dashboard for inventory management.",
    technologies: ["React", "Node.js", "Express", "MongoDB", "Stripe API"],
    featured: true
  }
];

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  
  const addProject = (project: Omit<Project, 'id'>) => {
    const newId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
    setProjects([...projects, { ...project, id: newId }]);
  };
  
  const updateProject = (id: number, updatedFields: Partial<Project>) => {
    setProjects(projects.map(project => 
      project.id === id ? { ...project, ...updatedFields } : project
    ));
  };
  
  const deleteProject = (id: number) => {
    setProjects(projects.filter(project => project.id !== id));
  };
  
  const getFeaturedProjects = () => {
    return projects.filter(project => project.featured);
  };
  
  return (
    <ProjectsContext.Provider value={{ 
      projects, 
      addProject, 
      updateProject, 
      deleteProject,
      getFeaturedProjects
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}