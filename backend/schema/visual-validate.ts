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

CRITICAL: Return your response in this EXACT JSON format with no additional text or markdown:
{
  "isAccurate": true,
  "confidence": 0.85,
  "validations": [
    {
      "field": "fieldName",
      "issue": "description of the issue",
      "severity": "error",
      "recommendation": "how to fix or improve"
    }
  ],
  "improvements": [
    "suggestion 1",
    "suggestion 2"
  ],
  "overallAssessment": "Summary of the schema quality and accuracy"
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
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert in schema.org markup validation and SEO optimization. Always respond with valid JSON only, no markdown or additional text."
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
      let validation: VisualValidateResponse;
      try {
        validation = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Failed to parse visual validation response:", cleanedContent);
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            validation = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.error("Failed to parse extracted JSON:", jsonMatch[0]);
            
            // Create a fallback response
            validation = {
              isAccurate: true,
              confidence: 0.5,
              validations: [],
              improvements: ["Unable to perform detailed visual validation"],
              overallAssessment: "Visual validation could not be completed due to parsing issues"
            };
          }
        } else {
          // Create a fallback response
          validation = {
            isAccurate: true,
            confidence: 0.5,
            validations: [],
            improvements: ["Unable to perform detailed visual validation"],
            overallAssessment: "Visual validation could not be completed due to parsing issues"
          };
        }
      }

      // Validate the response structure and provide defaults
      if (typeof validation.isAccurate !== "boolean") {
        validation.isAccurate = true;
      }
      
      if (typeof validation.confidence !== "number") {
        validation.confidence = 0.7;
      }
      
      if (!Array.isArray(validation.validations)) {
        validation.validations = [];
      }
      
      if (!Array.isArray(validation.improvements)) {
        validation.improvements = [];
      }
      
      if (typeof validation.overallAssessment !== "string") {
        validation.overallAssessment = "Schema validation completed";
      }

      return validation;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Visual validation error:", error);
      throw APIError.internal(`Failed to perform visual validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
