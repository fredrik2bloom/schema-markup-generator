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

CRITICAL: Return your response in this EXACT JSON format with no additional text or markdown:
{
  "recommendedStructure": {
    "@context": "https://schema.org",
    "@type": "${req.pageType}",
    "name": "Example Name"
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

Do not include any explanations, markdown formatting, or additional text. Return only the JSON object.
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
              content: "You are an expert in schema.org markup analysis. Always respond with valid JSON only, no markdown or additional text."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
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

      // Clean the response - remove any markdown formatting
      let cleanedContent = generatedContent.trim();
      
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\s*/g, '');
      cleanedContent = cleanedContent.replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      cleanedContent = cleanedContent.trim();

      // Parse the JSON response
      let analysis: AnalyzeExamplesResponse;
      try {
        analysis = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Failed to parse analysis response:", cleanedContent);
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.error("Failed to parse extracted JSON:", jsonMatch[0]);
            
            // Create a fallback response
            analysis = {
              recommendedStructure: {
                "@context": "https://schema.org",
                "@type": req.pageType,
                "name": req.originalTitle,
                "url": req.originalUrl
              },
              patterns: [],
              insights: ["Unable to analyze patterns due to parsing issues"]
            };
          }
        } else {
          // Create a fallback response
          analysis = {
            recommendedStructure: {
              "@context": "https://schema.org",
              "@type": req.pageType,
              "name": req.originalTitle,
              "url": req.originalUrl
            },
            patterns: [],
            insights: ["Unable to analyze patterns due to parsing issues"]
          };
        }
      }

      // Validate the response structure and provide defaults
      if (!analysis.recommendedStructure || typeof analysis.recommendedStructure !== 'object') {
        analysis.recommendedStructure = {
          "@context": "https://schema.org",
          "@type": req.pageType,
          "name": req.originalTitle,
          "url": req.originalUrl
        };
      }
      
      if (!Array.isArray(analysis.patterns)) {
        analysis.patterns = [];
      }
      
      if (!Array.isArray(analysis.insights)) {
        analysis.insights = [];
      }

      // Ensure the recommended structure has required fields
      if (!analysis.recommendedStructure["@context"]) {
        analysis.recommendedStructure["@context"] = "https://schema.org";
      }
      
      if (!analysis.recommendedStructure["@type"]) {
        analysis.recommendedStructure["@type"] = req.pageType;
      }

      return analysis;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Schema analysis error:", error);
      throw APIError.internal(`Failed to analyze schema examples: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
