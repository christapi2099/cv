"use client";

import React from 'react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Linkedin, Mail, MapPin } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Navigation />
      
      <main className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-8">Contact Me</h1>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-semibold mb-6">Get In Touch</h2>
              <p className="text-lg text-gray-300 mb-8">
                I&apos;m always open to new opportunities, collaborations, or just a friendly chat about technology.
                Feel free to reach out through any of the following channels:
              </p>
              
              <div className="space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-900/30 p-3 rounded-full">
                        <Mail className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="font-medium">Email</h3>
                        <a 
                          href="mailto:christapia898@gmail.com"
                          className="text-blue-400 hover:underline"
                        >
                          christapia898@gmail.com
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-900/30 p-3 rounded-full">
                        <Linkedin className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="font-medium">LinkedIn</h3>
                        <a 
                          href="https://www.linkedin.com/in/christopher-tapia-439897198/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          christopher-tapia
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-900/30 p-3 rounded-full">
                        <Github className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="font-medium">GitHub</h3>
                        <a 
                          href="https://github.com/christapi2099" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          christapi2099
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-900/30 p-3 rounded-full">
                        <MapPin className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="font-medium">Location</h3>
                        <p className="text-gray-300">Irvine, California</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
            
            {/* Contact Form */}
            <section>
              <h2 className="text-2xl font-semibold mb-6">Send a Message</h2>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-6">
                  <form className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:border-blue-400 focus:outline-none"
                        placeholder="Your name"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:border-blue-400 focus:outline-none"
                        placeholder="Your email"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        id="subject"
                        className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:border-blue-400 focus:outline-none"
                        placeholder="Subject"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium mb-1">
                        Message
                      </label>
                      <textarea
                        id="message"
                        rows={5}
                        className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:border-blue-400 focus:outline-none"
                        placeholder="Your message"
                      ></textarea>
                    </div>
                    
                    <Button className="w-full">Send Message</Button>
                    
                    <p className="text-sm text-gray-400 text-center">
                      Note: This is a demo form and does not actually send messages.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex justify-center space-x-6 mb-6">
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
            <a href="mailto:christapia898@gmail.com">
              <Button variant="ghost" size="icon">
                <Mail className="w-5 h-5" />
              </Button>
            </a>
          </div>
          <p className="text-gray-400">
            &copy; {new Date().getFullYear()} Christopher Tapia. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}