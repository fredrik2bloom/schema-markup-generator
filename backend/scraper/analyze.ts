import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface AnalyzePageRequest {
  content: string;
  title: string;
  description?: string;
  url: string;
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
  };
}

interface AnalyzePageResponse {
  pageType: string;
  category: string;
  searchQueries: string[];
  confidence: number;
}

// Analyzes scraped content and screenshot analysis to determine page type and generate search queries for similar pages.
export const analyzePage = api<AnalyzePageRequest, AnalyzePageResponse>(
  { expose: true, method: "POST", path: "/analyze-page" },
  async (req) => {
    if (!req.content || !req.title || !req.url) {
      throw APIError.invalidArgument("Content, title, and URL are required");
    }

    let prompt = `
Analyze the following website content and determine:
1. The primary page type (e.g., Article, Product, Organization, Person, Event, Recipe, etc.)
2. The business category/industry
3. Generate 3-5 search queries to find similar pages that would have good schema markup examples

Website URL: ${req.url}
Title: ${req.title}
Description: ${req.description || "Not provided"}

Content:
${req.content.substring(0, 3000)} ${req.content.length > 3000 ? "..." : ""}
`;

    // Add screenshot analysis if available
    if (req.screenshotAnalysis) {
      prompt += `

VISUAL ANALYSIS FROM SCREENSHOT:
Visual Description: ${req.screenshotAnalysis.visualDescription}

Page Elements:
- Header: ${req.screenshotAnalysis.pageElements.header}
- Navigation: ${req.screenshotAnalysis.pageElements.navigation.join(', ')}
- Main Content: ${req.screenshotAnalysis.pageElements.mainContent}
- Images: ${req.screenshotAnalysis.pageElements.images.join(', ')}
- Forms: ${req.screenshotAnalysis.pageElements.forms.join(', ')}
- Buttons: ${req.screenshotAnalysis.pageElements.buttons.join(', ')}

Design Analysis:
- Layout: ${req.screenshotAnalysis.designAnalysis.layout}
- Color Scheme: ${req.screenshotAnalysis.designAnalysis.colorScheme}
- Typography: ${req.screenshotAnalysis.designAnalysis.typography}
- Branding: ${req.screenshotAnalysis.designAnalysis.branding}

Content Analysis:
- Primary Purpose: ${req.screenshotAnalysis.contentAnalysis.primaryPurpose}
- Target Audience: ${req.screenshotAnalysis.contentAnalysis.targetAudience}
- Key Messages: ${req.screenshotAnalysis.contentAnalysis.keyMessages.join(', ')}
- Calls to Action: ${req.screenshotAnalysis.contentAnalysis.callsToAction.join(', ')}

Business Context:
- Industry: ${req.screenshotAnalysis.businessContext.industry}
- Business Type: ${req.screenshotAnalysis.businessContext.businessType}
- Services: ${req.screenshotAnalysis.businessContext.services.join(', ')}
- Products: ${req.screenshotAnalysis.businessContext.products.join(', ')}

Use this visual analysis to enhance your understanding of the page type and generate more accurate search queries.`;
    }

    prompt += `

CRITICAL: Return your response in this EXACT JSON format with no additional text or markdown:
{
  "pageType": "primary schema.org type (e.g., Article, Product, Organization)",
  "category": "business category or industry",
  "searchQueries": ["query1", "query2", "query3"],
  "confidence": 0.85
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
              content: "You are an expert in web content analysis and schema.org markup. Use both textual content and visual analysis to determine the most appropriate schema type. Always respond with valid JSON only, no markdown or additional text."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
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
      let analysis: AnalyzePageResponse;
      try {
        analysis = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Failed to parse page analysis response:", cleanedContent);
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.error("Failed to parse extracted JSON:", jsonMatch[0]);
            
            // Create a fallback response
            analysis = {
              pageType: "WebPage",
              category: "General",
              searchQueries: ["website schema markup", "webpage structured data"],
              confidence: 0.5
            };
          }
        } else {
          // Create a fallback response
          analysis = {
            pageType: "WebPage",
            category: "General",
            searchQueries: ["website schema markup", "webpage structured data"],
            confidence: 0.5
          };
        }
      }

      // Validate the response structure and provide defaults
      if (typeof analysis.pageType !== 'string' || !analysis.pageType) {
        analysis.pageType = "WebPage";
      }
      
      if (typeof analysis.category !== 'string' || !analysis.category) {
        analysis.category = "General";
      }
      
      if (!Array.isArray(analysis.searchQueries) || analysis.searchQueries.length === 0) {
        analysis.searchQueries = ["website schema markup", "webpage structured data"];
      }
      
      if (typeof analysis.confidence !== 'number') {
        analysis.confidence = 0.7;
      }

      return {
        pageType: analysis.pageType,
        category: analysis.category,
        searchQueries: analysis.searchQueries,
        confidence: Math.min(Math.max(analysis.confidence, 0), 1) // Clamp between 0 and 1
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Page analysis error:", error);
      throw APIError.internal(`Failed to analyze page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
