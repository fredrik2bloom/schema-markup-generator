import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Code, CheckCircle, AlertTriangle, XCircle, Info, Lightbulb, Copy, RotateCcw, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";

interface GenerateResponse {
  detectedType: string;
  subtype?: string;
  features: string[];
  confidence: number;
  jsonld: Record<string, any>;
  explanations: string[];
  warnings: string[];
  hintDirective: Record<string, any>;
  lint: {
    schemaOrgValid: boolean;
    richResultsEligible: boolean;
    errors: string[];
    warnings: string[];
  };
}

export function SchemaPilot() {
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [showExplanations, setShowExplanations] = useState(false);
  const { toast } = useToast();

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
    setResult(null);

    try {
      const response = await backend.core.generate({
        url: url.trim(),
        hint: hint.trim() || undefined,
        options: {
          renderMode: "auto"
        }
      });

      setResult(response);

      toast({
        title: "Success",
        description: `Schema generated! (${Math.round(response.confidence * 100)}% confidence)`,
      });
    } catch (error) {
      console.error("Error generating schema:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate schema",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(result.jsonld, null, 2));
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

  const reset = () => {
    setUrl("");
    setHint("");
    setResult(null);
    setShowExplanations(false);
  };

  const testInRichResultsTest = () => {
    if (!result) return;
    const encodedUrl = encodeURIComponent(url);
    window.open(`https://search.google.com/test/rich-results?url=${encodedUrl}`, '_blank');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getFeatureBadgeVariant = (feature: string) => {
    const highValue = ["offers", "aggregateRating", "breadcrumbs"];
    return highValue.includes(feature) ? "default" : "secondary";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Input and Controls */}
      <div className="space-y-6">
        {/* URL Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Website URL
            </CardTitle>
            <CardDescription>
              Enter the URL you want to generate schema markup for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="url"
              placeholder="https://example.com/your-page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleGenerate()}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        {/* Hint Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Hint (Optional)
            </CardTitle>
            <CardDescription>
              Steer the detection with free text hints
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="e.g., 'Buying guide → ItemList, cap 8, ignore reviews' or 'Treat as Product, include offers, no reviews'"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
            <div className="text-xs text-gray-500">
              <p className="font-medium mb-1">Example hints:</p>
              <ul className="space-y-1">
                <li>• "Buying guide with prices. Make it an ItemList and cap at 5 items."</li>
                <li>• "Treat this as a product, include offers, no reviews."</li>
                <li>• "Local dental clinic, Swedish, strict."</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading || !url.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              "Generate Schema"
            )}
          </Button>
          <Button variant="outline" onClick={reset} disabled={isLoading}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Results Summary */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Detection Results</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExplanations(!showExplanations)}
                >
                  <Info className="h-4 w-4 mr-1" />
                  Why?
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary Type and Confidence */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Primary Type</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-sm">
                      {result.detectedType}
                    </Badge>
                    {result.subtype && (
                      <Badge variant="outline" className="text-xs">
                        {result.subtype}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">Confidence</div>
                  <div className={`text-2xl font-bold ${getConfidenceColor(result.confidence)}`}>
                    {Math.round(result.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Features */}
              {result.features.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Detected Features</div>
                  <div className="flex flex-wrap gap-2">
                    {result.features.map((feature, index) => (
                      <Badge 
                        key={index} 
                        variant={getFeatureBadgeVariant(feature)}
                        className="text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Eligibility Badges */}
              <div className="flex gap-2">
                <Badge 
                  variant={result.lint.schemaOrgValid ? "default" : "destructive"}
                  className="text-xs"
                >
                  {result.lint.schemaOrgValid ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  Schema.org Valid
                </Badge>
                <Badge 
                  variant={result.lint.richResultsEligible ? "default" : "secondary"}
                  className="text-xs"
                >
                  {result.lint.richResultsEligible ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  Rich Results Eligible
                </Badge>
              </div>

              {/* Explanations */}
              {showExplanations && (
                <div className="space-y-3 pt-3 border-t">
                  {result.explanations.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Detection Signals</div>
                      <ul className="space-y-1">
                        {result.explanations.map((explanation, index) => (
                          <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {explanation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.warnings.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2 text-yellow-600">Warnings</div>
                      <ul className="space-y-1">
                        {result.warnings.map((warning, index) => (
                          <li key={index} className="text-xs text-yellow-600 flex items-start gap-2">
                            <AlertTriangle className="h-3 w-3 mt-1 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Object.keys(result.hintDirective).length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Applied Hints</div>
                      <div className="text-xs bg-blue-50 p-2 rounded">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(result.hintDirective, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation Results */}
        {result && (result.lint.errors.length > 0 || result.lint.warnings.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Validation Issues
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.lint.errors.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-red-600 mb-2">Errors</div>
                  {result.lint.errors.map((error, index) => (
                    <Alert key={index} variant="destructive" className="text-sm">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {result.lint.warnings.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-yellow-600 mb-2">Warnings</div>
                  {result.lint.warnings.map((warning, index) => (
                    <Alert key={index} className="text-sm">
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel - JSON-LD Preview */}
      <div className="space-y-6">
        {result && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Generated JSON-LD Schema
              </CardTitle>
              <CardDescription>
                Copy this schema markup and add it to your website's HTML head
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyToClipboard} className="flex-1">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                  <Button variant="outline" onClick={testInRichResultsTest}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                
                {/* JSON Preview */}
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                    <code>{JSON.stringify(result.jsonld, null, 2)}</code>
                  </pre>
                </div>

                {/* Usage Instructions */}
                <Alert>
                  <AlertDescription>
                    To use this schema markup, wrap it in a script tag and add it to your HTML head:
                    <br />
                    <code className="text-sm bg-gray-100 px-1 rounded mt-1 inline-block">
                      &lt;script type="application/ld+json"&gt;{"{...}"}&lt;/script&gt;
                    </code>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Placeholder when no result */}
        {!result && (
          <Card className="h-96 flex items-center justify-center">
            <CardContent className="text-center">
              <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Enter a URL and generate schema to see the JSON-LD preview here
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
