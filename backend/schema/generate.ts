import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface GenerateSchemaRequest {
  content: string;
  title: string;
  description?: string;
  url: string;
}

interface GenerateSchemaResponse {
  schema: Record<string, any>;
}

// Generates JSON-LD schema markup from scraped content using AI.
export const generate = api<GenerateSchemaRequest, GenerateSchemaResponse>(
  { expose: true, method: "POST", path: "/schema/generate" },
  async (req) => {
    if (!req.content || !req.title || !req.url) {
      throw APIError.invalidArgument("Content, title, and URL are required");
    }

    const prompt = `
Analyze the following website content and generate appropriate JSON-LD schema markup. 
Choose the most suitable schema.org type based on the content (e.g., Article, WebPage, Organization, Product, etc.).

Website URL: ${req.url}
Title: ${req.title}
Description: ${req.description || "Not provided"}

Content:
${req.content.substring(0, 4000)} ${req.content.length > 4000 ? "..." : ""}

Requirements:
1. Return ONLY valid JSON-LD markup
2. Use appropriate schema.org types
3. Include all relevant properties based on the content
4. Ensure the JSON is properly formatted
5. Include @context and @type
6. Use the provided URL, title, and description where appropriate

Return only the JSON-LD object, no explanations or additional text.
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
              content: "You are an expert in schema.org markup and SEO. Generate accurate and comprehensive JSON-LD schema markup based on website content."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
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

      // Parse the JSON-LD
      let schema: Record<string, any>;
      try {
        schema = JSON.parse(generatedContent);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            schema = JSON.parse(jsonMatch[0]);
          } catch {
            throw APIError.internal("Failed to parse generated JSON-LD schema");
          }
        } else {
          throw APIError.internal("Failed to parse generated JSON-LD schema");
        }
      }

      // Basic validation
      if (!schema["@context"] || !schema["@type"]) {
        throw APIError.internal("Generated schema is missing required @context or @type");
      }

      return { schema };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to generate schema: ${error}`);
    }
  }
);
