import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Code, CheckCircle, AlertTriangle, XCircle, Search, Brain, Target, Eye, Zap } from "lucide-react";
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
    setCurrentStep(0);
    setGenerationSteps(steps.map(step => ({ ...step, status: "pending" })));

    try {
      // Step 1: Scrape the website
      updateStepStatus("scrape", "running");
      setCurrentStep(0);
      const scrapeResult = await backend.scraper.scrape({ url: url.trim() });
      setScreenshot(scrapeResult.screenshot || null);
      updateStepStatus("scrape", "completed");

      // Step 2: Analyze the content
      updateStepStatus("analyze", "running");
      setCurrentStep(1);
      const analysisResult = await backend.scraper.analyzePage({
        content: scrapeResult.content,
        title: scrapeResult.title,
        description: scrapeResult.description,
        url: scrapeResult.url,
      });
      updateStepStatus("analyze", "completed");

      // Step 3: Search for similar pages
      updateStepStatus("search", "running");
      setCurrentStep(2);
      const searchResult = await backend.scraper.searchSimilarPages({
        queries: analysisResult.searchQueries,
        pageType: analysisResult.pageType,
        maxResults: 8,
      });
      updateStepStatus("search", "completed");

      let recommendedStructure;
      let patterns;
      let insights;

      // Step 4: Analyze patterns (only if we found examples with schema markup)
      const exampleSchemas = searchResult.results
        .filter(result => result.schemaMarkup && result.schemaMarkup.length > 0)
        .flatMap(result => result.schemaMarkup || []);

      if (exampleSchemas.length > 0) {
        updateStepStatus("patterns", "running");
        setCurrentStep(3);
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
        updateStepStatus("patterns", "completed");
      } else {
        updateStepStatus("patterns", "completed");
      }

      // Step 5: Generate schema markup
      updateStepStatus("generate", "running");
      setCurrentStep(4);
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
      });

      let finalSchema = schemaResult.schema;
      let finalConfidence = schemaResult.confidence;
      setAppliedPatterns(schemaResult.appliedPatterns);
      updateStepStatus("generate", "completed");

      // Step 6: Visual validation (if screenshot is available)
      if (scrapeResult.screenshot) {
        updateStepStatus("visual", "running");
        setCurrentStep(5);
        const visualValidationResult = await backend.schema.visualValidate({
          schema: finalSchema,
          screenshot: scrapeResult.screenshot,
          url: scrapeResult.url,
          title: scrapeResult.title,
          content: scrapeResult.content,
        });
        setVisualValidation(visualValidationResult);
        updateStepStatus("visual", "completed");

        // Step 7: Optimize schema based on visual validation
        if (visualValidationResult.validations.length > 0 || visualValidationResult.improvements.length > 0) {
          updateStepStatus("optimize", "running");
          setCurrentStep(6);
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
        } else {
          updateStepStatus("optimize", "completed");
        }
      } else {
        updateStepStatus("visual", "completed");
        updateStepStatus("optimize", "completed");
      }

      setSchema(finalSchema);
      setConfidence(finalConfidence);

      // Validate the final schema
      const validationResult = await backend.schema.validate({
        schema: finalSchema,
      });

      setValidation(validationResult);
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
