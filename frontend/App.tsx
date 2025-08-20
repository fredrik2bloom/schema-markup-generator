import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { SchemaPilot } from "./components/SchemaPilot";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              SchemaPilot
            </h1>
            <p className="text-lg text-gray-600">
              Paste a URL (+ optional hint) → get validated, opinionated JSON-LD with auto-detected type and features
            </p>
          </header>
          
          <SchemaPilot />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
