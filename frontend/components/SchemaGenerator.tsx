import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Code, CheckCircle, AlertTriangle, XCircle, Search, Brain, Target, Eye, Zap, FileText, Database, Lightbulb, Camera } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import type { ValidateSchemaResponse } from "~backend/schema/validate";

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "completed" | "error";
  icon: React.ComponentType<{ className?: string }>;
}

interface VisualValidation {
  field: string;
  issue: string;
  severity: "error" | "warning" | "suggestion";
  recommendation: string;
}

interface SearchResult {
  url: string;
  title: string;
  description?: string;
  content: string;
  schemaMarkup?: Record<string, any>[];
}

interface SchemaPattern {
  field: string;
  frequency: number;
  examples: any[];
  required: boolean;
}

interface ScreenshotAnalysis {
  visualDescription: string;
  pageElements: {
    header: string;
    navigation: string[];
    mainContent: string;
    sidebar?: string;
    footer?: string;
    images: string[];
    forms: string[];
    buttons: string[];
    links: string[];
  };
  designAnalysis: {
    layout: string;
    colorScheme: string;
    typography: string;
    branding: string;
  };
  contentAnalysis: {
    primaryPurpose: string;
    targetAudience: string;
    keyMessages: string[];
    callsToAction: string[];
  };
  technicalObservations: {
    deviceType: string;
    responsive: boolean;
    accessibility: string[];
    performance: string[];
  };
  businessContext: {
    industry: string;
    businessType: string;
    services: string[];
    products: string[];
  };
  confidence: number;
}

export function SchemaGenerator() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [validation, setValidation] = useState<ValidateSchemaResponse | null>(null);
  const [visualValidation, setVisualValidation] = useState<{
    isAccurate: boolean;
    confidence: number;
    validations: VisualValidation[];
    improvements: string[];
    overallAssessment: string;
  } | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [appliedPatterns, setAppliedPatterns] = useState<string[]>([]);
  const [optimizationChanges, setOptimizationChanges] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  
  // Process insights data
  const [scrapedData, setScrapedData] = useState<{
    content: string;
    title: string;
    description?: string;
    url: string;
  } | null>(null);
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<ScreenshotAnalysis | null>(null);
  const [analysisData, setAnalysisData] = useState<{
    pageType: string;
    category: string;
    searchQueries: string[];
    confidence: number;
  } | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [patternData, setPatternData] = useState<{
    recommendedStructure: Record<string, any>;
    patterns: SchemaPattern[];
    insights: string[];
  } | null>(null);
  
  const { toast } = useToast();

  const steps: GenerationStep[] = [
    {
      id: "scrape",
      title: "Scraping Website",
      description: "Extracting content and capturing screenshot",
      status: "pending",
      icon: Globe
    },
    {
      id: "screenshot",
      title: "Analyzing Screenshot",
      description: "AI-powered visual analysis of the website",
      status: "pending",
      icon: Camera
    },
    {
      id: "analyze",
      title: "Analyzing Content",
      description: "Determining page type and generating search queries",
      status: "pending",
      icon: Brain
    },
    {
      id: "search",
      title: "Finding Similar Pages",
      description: "Searching for pages with existing schema markup",
      status: "pending",
      icon: Search
    },
    {
      id: "patterns",
      title: "Analyzing Patterns",
      description: "Extracting best practices from similar schemas",
      status: "pending",
      icon: Target
    },
    {
      id: "generate",
      title: "Generating Schema",
      description: "Creating optimized JSON-LD markup",
      status: "pending",
      icon: Code
    },
    {
      id: "visual",
      title: "Visual Validation",
      description: "Analyzing screenshot for schema accuracy",
      status: "pending",
      icon: Eye
    },
    {
      id: "optimize",
      title: "Optimizing Schema",
      description: "Refining markup based on visual analysis",
      status: "pending",
      icon: Zap
    }
  ];

  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>(steps);

  const updateStepStatus = (stepId: string, status: GenerationStep["status"]) => {
    setGenerationSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleGenerate = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSchema(null);
    setValidation(null);
    setVisualValidation(null);
    setConfidence(null);
    setAppliedPatterns([]);
    setOptimizationChanges([]);
    setScreenshot(null);
    setScrapedData(null);
    setScreenshotAnalysis(null);
    setAnalysisData(null);
    setSearchResults([]);
    setPatternData(null);
    setCurrentStep(0);
    setGenerationSteps(steps.map(step => ({ ...step, status: "pending" })));

    try {
      // Step 1: Scrape the website
      updateStepStatus("scrape", "running");
      setCurrentStep(0);
      const scrapeResult = await backend.scraper.scrape({ url: url.trim() });
      setScreenshot(scrapeResult.screenshot || null);
      setScrapedData({
        content: scrapeResult.content,
        title: scrapeResult.title,
        description: scrapeResult.description,
        url: scrapeResult.url
      });
      updateStepStatus("scrape", "completed");

      // Step 2: Analyze screenshot (if available)
      let screenshotAnalysisResult = null;
      if (scrapeResult.screenshot) {
        updateStepStatus("screenshot", "running");
        setCurrentStep(1);
        try {
          screenshotAnalysisResult = await backend.scraper.analyzeScreenshot({
            screenshot: scrapeResult.screenshot,
            url: scrapeResult.url,
            title: scrapeResult.title,
            content: scrapeResult.content,
          });
          setScreenshotAnalysis(screenshotAnalysisResult);
          updateStepStatus("screenshot", "completed");
        } catch (screenshotError) {
          console.error("Screenshot analysis failed:", screenshotError);
          updateStepStatus("screenshot", "error");
          // Continue without screenshot analysis
        }
      } else {
        updateStepStatus("screenshot", "completed");
      }

      // Step 3: Analyze the content (now with screenshot analysis)
      updateStepStatus("analyze", "running");
      setCurrentStep(2);
      const analysisResult = await backend.scraper.analyzePage({
        content: scrapeResult.content,
        title: scrapeResult.title,
        description: scrapeResult.description,
        url: scrapeResult.url,
        screenshotAnalysis: screenshotAnalysisResult,
      });
      setAnalysisData(analysisResult);
      updateStepStatus("analyze", "completed");

      // Step 4: Search for similar pages
      updateStepStatus("search", "running");
      setCurrentStep(3);
      const searchResult = await backend.scraper.searchSimilarPages({
        queries: analysisResult.searchQueries,
        pageType: analysisResult.pageType,
        maxResults: 8,
      });
      setSearchResults(searchResult.results);
      updateStepStatus("search", "completed");

      let recommendedStructure;
      let patterns;
      let insights;

      // Step 5: Analyze patterns (only if we found examples with schema markup)
      const exampleSchemas = searchResult.results
        .filter(result => result.schemaMarkup && result.schemaMarkup.length > 0)
        .flatMap(result => result.schemaMarkup || []);

      if (exampleSchemas.length > 0) {
        updateStepStatus("patterns", "running");
        setCurrentStep(4);
        try {
          const patternAnalysis = await backend.schema.analyzeExamples({
            pageType: analysisResult.pageType,
            category: analysisResult.category,
            originalContent: scrapeResult.content,
            originalTitle: scrapeResult.title,
            originalUrl: scrapeResult.url,
            exampleSchemas,
          });
          recommendedStructure = patternAnalysis.recommendedStructure;
          patterns = patternAnalysis.patterns;
          insights = patternAnalysis.insights;
          setPatternData(patternAnalysis);
          updateStepStatus("patterns", "completed");
        } catch (patternError) {
          console.error("Pattern analysis failed:", patternError);
          updateStepStatus("patterns", "error");
          // Continue without pattern analysis
        }
      } else {
        updateStepStatus("patterns", "completed");
      }

      // Step 6: Generate schema markup (now with screenshot analysis)
      updateStepStatus("generate", "running");
      setCurrentStep(5);
      const schemaResult = await backend.schema.generate({
        content: scrapeResult.content,
        title: scrapeResult.title,
        description: scrapeResult.description,
        url: scrapeResult.url,
        pageType: analysisResult.pageType,
        category: analysisResult.category,
        recommendedStructure,
        patterns,
        insights,
        screenshotAnalysis: screenshotAnalysisResult,
      });

      let finalSchema = schemaResult.schema;
      let finalConfidence = schemaResult.confidence;
      setAppliedPatterns(schemaResult.appliedPatterns);
      updateStepStatus("generate", "completed");

      // Step 7: Visual validation (if screenshot is available)
      if (scrapeResult.screenshot) {
        updateStepStatus("visual", "running");
        setCurrentStep(6);
        try {
          const visualValidationResult = await backend.schema.visualValidate({
            schema: finalSchema,
            screenshot: scrapeResult.screenshot,
            url: scrapeResult.url,
            title: scrapeResult.title,
            content: scrapeResult.content,
          });
          setVisualValidation(visualValidationResult);
          updateStepStatus("visual", "completed");

          // Step 8: Optimize schema based on visual validation
          if (visualValidationResult.validations.length > 0 || visualValidationResult.improvements.length > 0) {
            updateStepStatus("optimize", "running");
            setCurrentStep(7);
            try {
              const optimizationResult = await backend.schema.optimize({
                originalSchema: finalSchema,
                visualValidation: visualValidationResult,
                content: scrapeResult.content,
                title: scrapeResult.title,
                url: scrapeResult.url,
              });
              
              finalSchema = optimizationResult.optimizedSchema;
              finalConfidence = Math.max(finalConfidence, optimizationResult.confidence);
              setOptimizationChanges(optimizationResult.changes);
              updateStepStatus("optimize", "completed");
            } catch (optimizeError) {
              console.error("Schema optimization failed:", optimizeError);
              updateStepStatus("optimize", "error");
              // Continue with the original schema
            }
          } else {
            updateStepStatus("optimize", "completed");
          }
        } catch (visualError) {
          console.error("Visual validation failed:", visualError);
          updateStepStatus("visual", "error");
          updateStepStatus("optimize", "completed");
          // Continue without visual validation
        }
      } else {
        updateStepStatus("visual", "completed");
        updateStepStatus("optimize", "completed");
      }

      setSchema(finalSchema);
      setConfidence(finalConfidence);

      // Validate the final schema
      try {
        const validationResult = await backend.schema.validate({
          schema: finalSchema,
        });
        setValidation(validationResult);
      } catch (validationError) {
        console.error("Schema validation failed:", validationError);
        // Continue without validation results
      }

      setCurrentStep(-1);

      toast({
        title: "Success",
        description: `Schema markup generated successfully! (${Math.round(finalConfidence * 100)}% confidence)`,
      });
    } catch (error) {
      console.error("Error generating schema:", error);
      
      // Mark current step as error
      if (currentStep >= 0 && currentStep < generationSteps.length) {
        updateStepStatus(generationSteps[currentStep].id, "error");
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate schema markup",
        variant: "destructive",
      });
      setCurrentStep(-1);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!schema) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
      toast({
        title: "Copied",
        description: "Schema markup copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getStepIcon = (step: GenerationStep) => {
    const IconComponent = step.icon;
    if (step.status === "running") {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (step.status === "completed") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (step.status === "error") {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    return <IconComponent className="h-4 w-4 text-gray-400" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "text-red-600";
      case "warning": return "text-yellow-600";
      case "suggestion": return "text-blue-600";
      default: return "text-gray-600";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error": return "destructive";
      case "warning": return "secondary";
      case "suggestion": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website URL
          </CardTitle>
          <CardDescription>
            Enter the URL of the website you want to generate schema markup for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              disabled={isLoading}
            />
            <Button onClick={handleGenerate} disabled={isLoading || !url.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate Schema"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generation Progress */}
      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Progress</CardTitle>
            <CardDescription>
              Analyzing your website and finding the best schema structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={(currentStep + 1) / generationSteps.length * 100} className="w-full" />
              
              <div className="space-y-3">
                {generationSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      index === currentStep
                        ? "bg-blue-50 border border-blue-200"
                        : step.status === "completed"
                        ? "bg-green-50 border border-green-200"
                        : step.status === "error"
                        ? "bg-red-50 border border-red-200"
                        : "bg-gray-50"
                    }`}
                  >
                    {getStepIcon(step)}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs text-gray-600">{step.description}</div>
                    </div>
                    {step.status === "completed" && (
                      <Badge variant="secondary" className="text-xs">
                        Done
                      </Badge>
                    )}
                    {step.status === "running" && (
                      <Badge className="text-xs">
                        Running
                      </Badge>
                    )}
                    {step.status === "error" && (
                      <Badge variant="destructive" className="text-xs">
                        Error
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scraped Content Data */}
      {scrapedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Scraped Content Analysis
            </CardTitle>
            <CardDescription>
              Content extracted from the target website
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Page Title</h4>
                <p className="text-sm bg-gray-50 p-2 rounded">{scrapedData.title}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">URL</h4>
                <p className="text-sm bg-gray-50 p-2 rounded break-all">{scrapedData.url}</p>
              </div>
            </div>
            
            {scrapedData.description && (
              <div>
                <h4 className="font-medium text-sm mb-2">Meta Description</h4>
                <p className="text-sm bg-gray-50 p-2 rounded">{scrapedData.description}</p>
              </div>
            )}
            
            <div>
              <h4 className="font-medium text-sm mb-2">Content Preview</h4>
              <div className="text-sm bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                {scrapedData.content.substring(0, 500)}
                {scrapedData.content.length > 500 && "..."}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total content length: {scrapedData.content.length} characters
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screenshot Analysis Results */}
      {screenshotAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Screenshot Analysis Results
            </CardTitle>
            <CardDescription>
              AI-powered visual analysis of the website screenshot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Visual Description</h4>
              <p className="text-sm text-gray-700">{screenshotAnalysis.visualDescription}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Business Context</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">
                      {screenshotAnalysis.businessContext.industry}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {screenshotAnalysis.businessContext.businessType}
                    </Badge>
                  </div>
                  {screenshotAnalysis.businessContext.services.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">Services: </span>
                      <span className="text-xs text-gray-600">
                        {screenshotAnalysis.businessContext.services.join(', ')}
                      </span>
                    </div>
                  )}
                  {screenshotAnalysis.businessContext.products.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">Products: </span>
                      <span className="text-xs text-gray-600">
                        {screenshotAnalysis.businessContext.products.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-2">Content Strategy</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium">Purpose: </span>
                    <span className="text-xs text-gray-600">{screenshotAnalysis.contentAnalysis.primaryPurpose}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium">Audience: </span>
                    <span className="text-xs text-gray-600">{screenshotAnalysis.contentAnalysis.targetAudience}</span>
                  </div>
                  {screenshotAnalysis.contentAnalysis.callsToAction.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">CTAs: </span>
                      <span className="text-xs text-gray-600">
                        {screenshotAnalysis.contentAnalysis.callsToAction.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Page Elements Identified</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="mb-2">
                    <span className="font-medium">Header: </span>
                    <span className="text-gray-600">{screenshotAnalysis.pageElements.header}</span>
                  </div>
                  <div className="mb-2">
                    <span className="font-medium">Main Content: </span>
                    <span className="text-gray-600">{screenshotAnalysis.pageElements.mainContent}</span>
                  </div>
                  {screenshotAnalysis.pageElements.navigation.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium">Navigation: </span>
                      <span className="text-gray-600">{screenshotAnalysis.pageElements.navigation.join(', ')}</span>
                    </div>
                  )}
                </div>
                <div>
                  {screenshotAnalysis.pageElements.images.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium">Images: </span>
                      <span className="text-gray-600">{screenshotAnalysis.pageElements.images.join(', ')}</span>
                    </div>
                  )}
                  {screenshotAnalysis.pageElements.buttons.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium">Buttons: </span>
                      <span className="text-gray-600">{screenshotAnalysis.pageElements.buttons.join(', ')}</span>
                    </div>
                  )}
                  {screenshotAnalysis.pageElements.forms.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium">Forms: </span>
                      <span className="text-gray-600">{screenshotAnalysis.pageElements.forms.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Design Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="mb-1">
                    <span className="font-medium">Layout: </span>
                    <span className="text-gray-600">{screenshotAnalysis.designAnalysis.layout}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium">Color Scheme: </span>
                    <span className="text-gray-600">{screenshotAnalysis.designAnalysis.colorScheme}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1">
                    <span className="font-medium">Typography: </span>
                    <span className="text-gray-600">{screenshotAnalysis.designAnalysis.typography}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium">Branding: </span>
                    <span className="text-gray-600">{screenshotAnalysis.designAnalysis.branding}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Analysis Confidence: </span>
                <span className="text-lg font-bold text-blue-600">
                  {Math.round(screenshotAnalysis.confidence * 100)}%
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {screenshotAnalysis.technicalObservations.deviceType}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Analysis Results */}
      {analysisData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Content Analysis Results
            </CardTitle>
            <CardDescription>
              AI-powered analysis of page type and category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Detected Page Type</h4>
                <Badge variant="default" className="text-sm">
                  {analysisData.pageType}
                </Badge>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Business Category</h4>
                <Badge variant="outline" className="text-sm">
                  {analysisData.category}
                </Badge>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Analysis Confidence</h4>
                <div className="text-lg font-bold text-blue-600">
                  {Math.round(analysisData.confidence * 100)}%
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2">Generated Search Queries</h4>
              <div className="flex flex-wrap gap-2">
                {analysisData.searchQueries.map((query, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {query}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                These queries will be used to find similar pages with existing schema markup
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Similar Pages Found
            </CardTitle>
            <CardDescription>
              Pages with existing schema markup used for pattern analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Found {searchResults.length} similar pages, {searchResults.filter(r => r.schemaMarkup).length} with schema markup
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h5 className="font-medium text-sm">{result.title || "Untitled"}</h5>
                        <p className="text-xs text-gray-500 break-all">{result.url}</p>
                      </div>
                      <div className="flex gap-1">
                        {result.schemaMarkup && result.schemaMarkup.length > 0 && (
                          <Badge variant="default" className="text-xs">
                            {result.schemaMarkup.length} schema{result.schemaMarkup.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {result.description && (
                      <p className="text-xs text-gray-600 mb-2">{result.description}</p>
                    )}
                    
                    {result.schemaMarkup && result.schemaMarkup.length > 0 && (
                      <div className="mt-2">
                        <h6 className="text-xs font-medium mb-1">Schema Types Found:</h6>
                        <div className="flex flex-wrap gap-1">
                          {result.schemaMarkup.map((schema, schemaIndex) => (
                            <Badge key={schemaIndex} variant="outline" className="text-xs">
                              {schema['@type'] || 'Unknown'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pattern Analysis Results */}
      {patternData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Pattern Analysis Results
            </CardTitle>
            <CardDescription>
              Common patterns identified from similar schema markup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Recommended Schema Structure</h4>
              <div className="bg-gray-50 p-3 rounded text-xs">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(patternData.recommendedStructure, null, 2)}
                </pre>
              </div>
            </div>
            
            {patternData.patterns.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Field Frequency Analysis</h4>
                <div className="space-y-2">
                  {patternData.patterns.map((pattern, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{pattern.field}</span>
                        {pattern.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600">
                          {Math.round(pattern.frequency * 100)}% frequency
                        </div>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${pattern.frequency * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {patternData.insights.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Key Insights</h4>
                <ul className="space-y-1">
                  {patternData.insights.map((insight, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Screenshot Preview */}
      {screenshot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Website Screenshot
            </CardTitle>
            <CardDescription>
              Visual representation used for schema validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl mx-auto">
              <img 
                src={`data:image/png;base64,${screenshot}`} 
                alt="Website screenshot" 
                className="w-full border rounded-lg shadow-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual Validation Results */}
      {visualValidation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Visual Validation Results
            </CardTitle>
            <CardDescription>
              Analysis based on website screenshot and visual elements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm font-medium">Visual Accuracy</div>
                <div className={`text-2xl font-bold ${visualValidation.isAccurate ? 'text-green-600' : 'text-yellow-600'}`}>
                  {visualValidation.isAccurate ? 'Accurate' : 'Needs Review'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Confidence</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(visualValidation.confidence * 100)}%
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Overall Assessment</h4>
              <p className="text-sm text-gray-700">{visualValidation.overallAssessment}</p>
            </div>

            {visualValidation.validations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Specific Validations</h4>
                {visualValidation.validations.map((validation, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant={getSeverityBadge(validation.severity)} className="text-xs">
                        {validation.severity}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{validation.field}</div>
                        <div className="text-sm text-gray-600">{validation.issue}</div>
                      </div>
                    </div>
                    <div className="text-sm bg-blue-50 p-2 rounded">
                      <strong>Recommendation:</strong> {validation.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {visualValidation.improvements.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Suggested Improvements</h4>
                <ul className="space-y-1">
                  {visualValidation.improvements.map((improvement, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Optimization Changes */}
      {optimizationChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Schema Optimizations
            </CardTitle>
            <CardDescription>
              Changes made based on visual validation feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {optimizationChanges.map((change, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  {change}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Generation Results Summary */}
      {confidence !== null && appliedPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Generation Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm font-medium">Confidence Score</div>
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(confidence * 100)}%
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium mb-2">Applied Patterns</div>
                  <div className="flex flex-wrap gap-2">
                    {appliedPatterns.map((pattern, index) => (
                      <Badge key={index} variant="outline">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validation.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Schema Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={validation.isValid ? "default" : "destructive"}>
                {validation.isValid ? "Valid" : "Invalid"}
              </Badge>
              <span className="text-sm text-gray-600">
                {validation.errors.length} errors, {validation.warnings.length} warnings
              </span>
            </div>

            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Errors
                </h4>
                {validation.errors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertDescription>
                      <strong>{error.field}:</strong> {error.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-yellow-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h4>
                {validation.warnings.map((warning, index) => (
                  <Alert key={index}>
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated Schema */}
      {schema && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Generated JSON-LD Schema
            </CardTitle>
            <CardDescription>
              Copy this schema markup and add it to your website's HTML head section
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" onClick={copyToClipboard}>
                  Copy to Clipboard
                </Button>
              </div>
              
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{JSON.stringify(schema, null, 2)}</code>
                </pre>
              </div>

              <Alert>
                <AlertDescription>
                  To use this schema markup, wrap it in a script tag and add it to your HTML head:
                  <br />
                  <code className="text-sm bg-gray-100 px-1 rounded">
                    &lt;script type="application/ld+json"&gt;{"{...}"}&lt;/script&gt;
                  </code>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
