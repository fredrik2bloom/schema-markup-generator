import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { SchemaGenerator } from "./components/SchemaGenerator";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Schema Markup Generator
            </h1>
            <p className="text-lg text-gray-600">
              Generate JSON-LD schema markup for any website using AI-powered content analysis
            </p>
          </header>
          
          <SchemaGenerator />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
