import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface OptimizeSchemaRequest {
  originalSchema: Record<string, any>;
  visualValidation: {
    isAccurate: boolean;
    confidence: number;
    validations: Array<{
      field: string;
      issue: string;
      severity: "error" | "warning" | "suggestion";
      recommendation: string;
    }>;
    improvements: string[];
    overallAssessment: string;
  };
  content: string;
  title: string;
  url: string;
}

interface OptimizeSchemaResponse {
  optimizedSchema: Record<string, any>;
  changes: string[];
  confidence: number;
  reasoning: string;
}

// Optimizes schema markup based on visual validation feedback.
export const optimize = api<OptimizeSchemaRequest, OptimizeSchemaResponse>(
  { expose: true, method: "POST", path: "/schema/optimize" },
  async (req) => {
    if (!req.originalSchema || !req.visualValidation) {
      throw APIError.invalidArgument("Original schema and visual validation are required");
    }

    const prompt = `
You are an expert in schema.org markup optimization. Based on the visual validation feedback, optimize the existing JSON-LD schema markup to address identified issues and improve accuracy.

Original Schema:
${JSON.stringify(req.originalSchema, null, 2)}

Visual Validation Feedback:
- Accuracy: ${req.visualValidation.isAccurate}
- Confidence: ${req.visualValidation.confidence}
- Overall Assessment: ${req.visualValidation.overallAssessment}

Specific Issues to Address:
${req.visualValidation.validations.map(v => `- ${v.field}: ${v.issue} (${v.severity}) - ${v.recommendation}`).join('\n')}

Suggested Improvements:
${req.visualValidation.improvements.map(imp => `- ${imp}`).join('\n')}

Website Details:
- URL: ${req.url}
- Title: ${req.title}
- Content: ${req.content.substring(0, 2000)}${req.content.length > 2000 ? "..." : ""}

Please optimize the schema markup by:
1. Fixing all identified errors
2. Addressing warnings where possible
3. Implementing suggested improvements
4. Ensuring the schema accurately represents the visual content
5. Adding any missing but important schema properties
6. Maintaining valid JSON-LD structure

Return your response in this JSON format:
{
  "optimizedSchema": { /* the improved JSON-LD schema */ },
  "changes": [
    "Added missing image property",
    "Fixed incorrect price format",
    "Updated author information"
  ],
  "confidence": 0.92,
  "reasoning": "Explanation of the key optimizations made"
}
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
              content: "You are an expert in schema.org markup optimization. Improve schema markup based on visual validation feedback to ensure maximum accuracy and SEO benefit."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2500,
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
      let optimization: OptimizeSchemaResponse;
      try {
        optimization = JSON.parse(generatedContent);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            optimization = JSON.parse(jsonMatch[0]);
          } catch {
            throw APIError.internal("Failed to parse schema optimization response");
          }
        } else {
          throw APIError.internal("Failed to parse schema optimization response");
        }
      }

      // Validate the response structure
      if (!optimization.optimizedSchema || !Array.isArray(optimization.changes)) {
        throw APIError.internal("Invalid schema optimization response structure");
      }

      // Basic validation of the optimized schema
      if (!optimization.optimizedSchema["@context"] || !optimization.optimizedSchema["@type"]) {
        throw APIError.internal("Optimized schema is missing required @context or @type");
      }

      return {
        optimizedSchema: optimization.optimizedSchema,
        changes: optimization.changes,
        confidence: optimization.confidence || 0.8,
        reasoning: optimization.reasoning || "Schema optimized based on visual validation feedback"
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to optimize schema: ${error}`);
    }
  }
);
