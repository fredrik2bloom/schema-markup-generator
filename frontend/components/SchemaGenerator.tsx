import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Code, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import backend from "~backend/client";
import type { ValidateSchemaResponse } from "~backend/schema/validate";

export function SchemaGenerator() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [validation, setValidation] = useState<ValidateSchemaResponse | null>(null);
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
    setSchema(null);
    setValidation(null);

    try {
      // First, scrape the website
      const scrapeResult = await backend.scraper.scrape({ url: url.trim() });
      
      // Then generate schema markup
      const schemaResult = await backend.schema.generate({
        content: scrapeResult.content,
        title: scrapeResult.title,
        description: scrapeResult.description,
        url: scrapeResult.url,
      });

      setSchema(schemaResult.schema);

      // Validate the generated schema
      const validationResult = await backend.schema.validate({
        schema: schemaResult.schema,
      });

      setValidation(validationResult);

      toast({
        title: "Success",
        description: "Schema markup generated successfully!",
      });
    } catch (error) {
      console.error("Error generating schema:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate schema markup",
        variant: "destructive",
      });
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
              Validation Results
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
