import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface VisualValidateRequest {
  schema: Record<string, any>;
  screenshot: string;
  url: string;
  title: string;
  content: string;
}

interface VisualValidation {
  field: string;
  issue: string;
  severity: "error" | "warning" | "suggestion";
  recommendation: string;
}

interface VisualValidateResponse {
  isAccurate: boolean;
  confidence: number;
  validations: VisualValidation[];
  improvements: string[];
  overallAssessment: string;
}

// Validates schema markup accuracy using visual analysis of the website screenshot.
export const visualValidate = api<VisualValidateRequest, VisualValidateResponse>(
  { expose: true, method: "POST", path: "/schema/visual-validate" },
  async (req) => {
    if (!req.schema || !req.screenshot || !req.url) {
      throw APIError.invalidArgument("Schema, screenshot, and URL are required");
    }

    const prompt = `
You are an expert in schema.org markup validation. Analyze the provided website screenshot and compare it with the generated JSON-LD schema markup to ensure accuracy and completeness.

Website Details:
- URL: ${req.url}
- Title: ${req.title}
- Content Preview: ${req.content.substring(0, 1000)}${req.content.length > 1000 ? "..." : ""}

Generated Schema Markup:
${JSON.stringify(req.schema, null, 2)}

Please analyze the screenshot and schema markup to:

1. Verify that the schema accurately represents what's visible on the page
2. Check if important visual elements are missing from the schema
3. Identify any discrepancies between the visual content and schema data
4. Suggest improvements for better SEO and rich snippet performance
5. Validate that the schema type matches the actual page content

Focus on:
- Product information (if it's a product page)
- Article/blog post structure (if it's content)
- Organization details (if it's a business page)
- Contact information visibility
- Images and media representation
- Pricing and availability (for e-commerce)
- Author and publication details (for articles)
- Navigation and page structure

Return your analysis in this JSON format:
{
  "isAccurate": true/false,
  "confidence": 0.85,
  "validations": [
    {
      "field": "fieldName",
      "issue": "description of the issue",
      "severity": "error|warning|suggestion",
      "recommendation": "how to fix or improve"
    }
  ],
  "improvements": [
    "suggestion 1",
    "suggestion 2"
  ],
  "overallAssessment": "Summary of the schema quality and accuracy"
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
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert in schema.org markup validation and SEO optimization. Analyze website screenshots to validate schema markup accuracy and suggest improvements."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${req.screenshot}`
                  }
                }
              ]
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
      let validation: VisualValidateResponse;
      try {
        validation = JSON.parse(generatedContent);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            validation = JSON.parse(jsonMatch[0]);
          } catch {
            throw APIError.internal("Failed to parse visual validation response");
          }
        } else {
          throw APIError.internal("Failed to parse visual validation response");
        }
      }

      // Validate the response structure
      if (typeof validation.isAccurate !== "boolean" || !Array.isArray(validation.validations) || !Array.isArray(validation.improvements)) {
        throw APIError.internal("Invalid visual validation response structure");
      }

      return validation;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to perform visual validation: ${error}`);
    }
  }
);
