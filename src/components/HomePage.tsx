import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Github, Linkedin, Mail } from 'lucide-react';
import Navigation from '@/components/Navigation';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Navigation />

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex-1 space-y-6">
            <h1 className="text-5xl font-bold">
              Software Engineer<span className="text-blue-400">.</span>
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
        </div>
      </section>

      <footer className="py-12 bg-gray-900">
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
          </div>
        </div>
      </footer>
    </div>
  );
}
