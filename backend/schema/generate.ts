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
  screenshotAnalysis?: {
    visualDescription: string;
    pageElements: {
      header: string;
      navigation: string[];
      mainContent: string;
      sidebar?: string;
      footer?: string;
      images: string[];
      forms: string[];
      buttons: string[];
      links: string[];
    };
    designAnalysis: {
      layout: string;
      colorScheme: string;
      typography: string;
      branding: string;
    };
    contentAnalysis: {
      primaryPurpose: string;
      targetAudience: string;
      keyMessages: string[];
      callsToAction: string[];
    };
    technicalObservations: {
      deviceType: string;
      responsive: boolean;
      accessibility: string[];
      performance: string[];
    };
    businessContext: {
      industry: string;
      businessType: string;
      services: string[];
      products: string[];
    };
    confidence: number;
  } | null;
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

    // Add screenshot analysis if available
    if (req.screenshotAnalysis) {
      prompt += `

VISUAL ANALYSIS FROM SCREENSHOT:
Visual Description: ${req.screenshotAnalysis.visualDescription}

Page Elements Identified:
- Header: ${req.screenshotAnalysis.pageElements.header}
- Navigation: ${req.screenshotAnalysis.pageElements.navigation.join(', ')}
- Main Content: ${req.screenshotAnalysis.pageElements.mainContent}
- Images: ${req.screenshotAnalysis.pageElements.images.join(', ')}
- Forms: ${req.screenshotAnalysis.pageElements.forms.join(', ')}
- Buttons: ${req.screenshotAnalysis.pageElements.buttons.join(', ')}
- Important Links: ${req.screenshotAnalysis.pageElements.links.join(', ')}

Design & Branding:
- Layout: ${req.screenshotAnalysis.designAnalysis.layout}
- Color Scheme: ${req.screenshotAnalysis.designAnalysis.colorScheme}
- Typography: ${req.screenshotAnalysis.designAnalysis.typography}
- Branding: ${req.screenshotAnalysis.designAnalysis.branding}

Content Strategy:
- Primary Purpose: ${req.screenshotAnalysis.contentAnalysis.primaryPurpose}
- Target Audience: ${req.screenshotAnalysis.contentAnalysis.targetAudience}
- Key Messages: ${req.screenshotAnalysis.contentAnalysis.keyMessages.join(', ')}
- Calls to Action: ${req.screenshotAnalysis.contentAnalysis.callsToAction.join(', ')}

Business Context:
- Industry: ${req.screenshotAnalysis.businessContext.industry}
- Business Type: ${req.screenshotAnalysis.businessContext.businessType}
- Services: ${req.screenshotAnalysis.businessContext.services.join(', ')}
- Products: ${req.screenshotAnalysis.businessContext.products.join(', ')}

Use this visual analysis to create more accurate and comprehensive schema markup that reflects what users actually see on the page.`;
    }

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
1. Generate valid JSON-LD markup that follows schema.org standards
2. Use appropriate schema.org types${req.pageType ? ` (preferably ${req.pageType})` : ''}
3. Include all relevant properties based on the content AND visual elements
4. Ensure the JSON is properly formatted
5. Include @context and @type
6. Use the provided URL, title, and description where appropriate
${req.recommendedStructure ? '7. Follow the recommended structure patterns where applicable' : ''}
${req.screenshotAnalysis ? '8. Incorporate visual elements and business context from the screenshot analysis' : ''}

CRITICAL: Return your response in this EXACT JSON format with no additional text or markdown:
{
  "schema": {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Example Title",
    "url": "https://example.com"
  },
  "confidence": 0.85,
  "appliedPatterns": ["pattern1", "pattern2"]
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
              content: "You are an expert in schema.org markup and SEO. Generate accurate and comprehensive JSON-LD schema markup based on both textual content and visual analysis. Always respond with valid JSON only, no markdown or additional text."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
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

      // Clean the response - remove any markdown formatting
      let cleanedContent = generatedContent.trim();
      
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\s*/g, '');
      cleanedContent = cleanedContent.replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      cleanedContent = cleanedContent.trim();

      // Parse the JSON response
      let result: GenerateSchemaResponse;
      try {
        result = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", cleanedContent);
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.error("Failed to parse extracted JSON:", jsonMatch[0]);
            
            // Last resort: try to create a basic schema from the content
            const fallbackSchema = {
              "@context": "https://schema.org",
              "@type": req.pageType || "WebPage",
              "name": req.title,
              "url": req.url,
              "description": req.description
            };
            
            result = {
              schema: fallbackSchema,
              confidence: 0.5,
              appliedPatterns: ["fallback"]
            };
          }
        } else {
          // Create a basic fallback schema
          const fallbackSchema = {
            "@context": "https://schema.org",
            "@type": req.pageType || "WebPage",
            "name": req.title,
            "url": req.url,
            "description": req.description
          };
          
          result = {
            schema: fallbackSchema,
            confidence: 0.5,
            appliedPatterns: ["fallback"]
          };
        }
      }

      // Validate the result structure
      if (!result || typeof result !== 'object') {
        throw APIError.internal("Invalid response structure from OpenAI");
      }

      // Ensure we have a schema object
      if (!result.schema || typeof result.schema !== 'object') {
        const fallbackSchema = {
          "@context": "https://schema.org",
          "@type": req.pageType || "WebPage",
          "name": req.title,
          "url": req.url,
          "description": req.description
        };
        
        result.schema = fallbackSchema;
      }

      // Basic validation of the schema
      if (!result.schema["@context"]) {
        result.schema["@context"] = "https://schema.org";
      }
      
      if (!result.schema["@type"]) {
        result.schema["@type"] = req.pageType || "WebPage";
      }

      // Ensure confidence and appliedPatterns are present
      if (typeof result.confidence !== 'number') {
        result.confidence = 0.7;
      }
      
      if (!Array.isArray(result.appliedPatterns)) {
        result.appliedPatterns = [];
      }

      return {
        schema: result.schema,
        confidence: Math.min(Math.max(result.confidence, 0), 1), // Clamp between 0 and 1
        appliedPatterns: result.appliedPatterns
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Schema generation error:", error);
      throw APIError.internal(`Failed to generate schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
