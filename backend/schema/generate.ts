import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface GenerateSchemaRequest {
  content: string;
  title: string;
  description?: string;
  url: string;
  pageType?: string;
  category?: string;
  recommendedStructure?: Record<string, any>;
  patterns?: Array<{
    field: string;
    frequency: number;
    examples: any[];
    required: boolean;
  }>;
  insights?: string[];
}

interface GenerateSchemaResponse {
  schema: Record<string, any>;
  confidence: number;
  appliedPatterns: string[];
}

// Generates JSON-LD schema markup from scraped content using AI and pattern analysis.
export const generate = api<GenerateSchemaRequest, GenerateSchemaResponse>(
  { expose: true, method: "POST", path: "/schema/generate" },
  async (req) => {
    if (!req.content || !req.title || !req.url) {
      throw APIError.invalidArgument("Content, title, and URL are required");
    }

    let prompt = `
Analyze the following website content and generate appropriate JSON-LD schema markup.

Website URL: ${req.url}
Title: ${req.title}
Description: ${req.description || "Not provided"}

Content:
${req.content.substring(0, 4000)} ${req.content.length > 4000 ? "..." : ""}
`;

    // Add pattern-based guidance if available
    if (req.pageType && req.recommendedStructure) {
      prompt += `

IMPORTANT: Based on analysis of similar ${req.pageType} pages, use this recommended structure as a foundation:
${JSON.stringify(req.recommendedStructure, null, 2)}

Common patterns observed in similar pages:
${req.patterns?.map(p => `- ${p.field}: appears in ${Math.round(p.frequency * 100)}% of examples${p.required ? ' (required)' : ''}`).join('\n') || 'None provided'}

Best practices insights:
${req.insights?.map(insight => `- ${insight}`).join('\n') || 'None provided'}

Please adapt this structure to fit the specific content while maintaining the proven patterns.`;
    }

    prompt += `

Requirements:
1. Return ONLY valid JSON-LD markup
2. Use appropriate schema.org types${req.pageType ? ` (preferably ${req.pageType})` : ''}
3. Include all relevant properties based on the content
4. Ensure the JSON is properly formatted
5. Include @context and @type
6. Use the provided URL, title, and description where appropriate
${req.recommendedStructure ? '7. Follow the recommended structure patterns where applicable' : ''}

Return your response in this JSON format:
{
  "schema": { /* the JSON-LD schema object */ },
  "confidence": 0.85,
  "appliedPatterns": ["pattern1", "pattern2"]
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
              content: "You are an expert in schema.org markup and SEO. Generate accurate and comprehensive JSON-LD schema markup based on website content and proven patterns from similar pages."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
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
      let result: GenerateSchemaResponse;
      try {
        result = JSON.parse(generatedContent);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch {
            // Fallback: treat the entire content as just the schema
            try {
              const schema = JSON.parse(generatedContent);
              result = {
                schema,
                confidence: 0.7,
                appliedPatterns: []
              };
            } catch {
              throw APIError.internal("Failed to parse generated JSON-LD schema");
            }
          }
        } else {
          throw APIError.internal("Failed to parse generated JSON-LD schema");
        }
      }

      // Basic validation
      if (!result.schema || !result.schema["@context"] || !result.schema["@type"]) {
        throw APIError.internal("Generated schema is missing required @context or @type");
      }

      return {
        schema: result.schema,
        confidence: result.confidence || 0.7,
        appliedPatterns: result.appliedPatterns || []
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to generate schema: ${error}`);
    }
  }
);
