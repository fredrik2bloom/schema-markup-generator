import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface AnalyzeExamplesRequest {
  pageType: string;
  category: string;
  originalContent: string;
  originalTitle: string;
  originalUrl: string;
  exampleSchemas: Record<string, any>[];
}

interface SchemaPattern {
  field: string;
  frequency: number;
  examples: any[];
  required: boolean;
}

interface AnalyzeExamplesResponse {
  recommendedStructure: Record<string, any>;
  patterns: SchemaPattern[];
  insights: string[];
}

// Analyzes example schema markup to identify patterns and recommend structure.
export const analyzeExamples = api<AnalyzeExamplesRequest, AnalyzeExamplesResponse>(
  { expose: true, method: "POST", path: "/schema/analyze-examples" },
  async (req) => {
    if (!req.pageType || !req.originalContent || !req.exampleSchemas || req.exampleSchemas.length === 0) {
      throw APIError.invalidArgument("Page type, content, and example schemas are required");
    }

    const prompt = `
Analyze the following example schema markup patterns and create a recommended structure for a new ${req.pageType} schema.

Original Page Details:
- Type: ${req.pageType}
- Category: ${req.category}
- Title: ${req.originalTitle}
- URL: ${req.originalUrl}
- Content: ${req.originalContent.substring(0, 2000)}${req.originalContent.length > 2000 ? "..." : ""}

Example Schema Markup from Similar Pages:
${JSON.stringify(req.exampleSchemas, null, 2)}

Please analyze these examples and provide:
1. A recommended schema structure that follows common patterns
2. Identify which fields appear most frequently
3. Provide insights about best practices observed

Return your analysis in this JSON format:
{
  "recommendedStructure": {
    "@context": "https://schema.org",
    "@type": "${req.pageType}",
    // ... recommended fields based on patterns
  },
  "patterns": [
    {
      "field": "fieldName",
      "frequency": 0.8,
      "examples": ["example1", "example2"],
      "required": true
    }
  ],
  "insights": [
    "Most examples include author information",
    "Images are commonly structured as ImageObject"
  ]
}

Focus on creating a comprehensive but practical schema structure that incorporates the most common and valuable patterns from the examples.
`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIApiKey()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert in schema.org markup analysis. Analyze patterns in example schemas to recommend optimal structures for new content."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw APIError.internal(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedContent = data.choices[0]?.message?.content;

      if (!generatedContent) {
        throw APIError.internal("No content generated from OpenAI");
      }

      // Parse the JSON response
      let analysis: AnalyzeExamplesResponse;
      try {
        analysis = JSON.parse(generatedContent);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch {
            throw APIError.internal("Failed to parse schema analysis");
          }
        } else {
          throw APIError.internal("Failed to parse schema analysis");
        }
      }

      // Validate the response structure
      if (!analysis.recommendedStructure || !Array.isArray(analysis.patterns) || !Array.isArray(analysis.insights)) {
        throw APIError.internal("Invalid analysis response structure");
      }

      return analysis;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to analyze schema examples: ${error}`);
    }
  }
);
