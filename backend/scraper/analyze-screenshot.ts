import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface AnalyzeScreenshotRequest {
  screenshot: string;
  url: string;
  title: string;
  content: string;
}

interface AnalyzeScreenshotResponse {
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
}

// Analyzes website screenshot to provide detailed visual and content insights.
export const analyzeScreenshot = api<AnalyzeScreenshotRequest, AnalyzeScreenshotResponse>(
  { expose: true, method: "POST", path: "/analyze-screenshot" },
  async (req) => {
    if (!req.screenshot || !req.url) {
      throw APIError.invalidArgument("Screenshot and URL are required");
    }

    const prompt = `
You are an expert web analyst and UX researcher. Analyze the provided website screenshot in detail and provide comprehensive insights about the site's visual design, content, structure, and business context.

Website Details:
- URL: ${req.url}
- Title: ${req.title}
- Content Preview: ${req.content.substring(0, 1000)}${req.content.length > 1000 ? "..." : ""}

Please analyze the screenshot and provide detailed insights covering:

1. VISUAL DESCRIPTION: Describe what you see in the screenshot - layout, colors, typography, overall design aesthetic

2. PAGE ELEMENTS: Identify and describe specific elements visible:
   - Header content and structure
   - Navigation menu items and structure
   - Main content areas and their purpose
   - Sidebar content (if present)
   - Footer elements (if visible)
   - Images and their context
   - Forms and input fields
   - Buttons and their purposes
   - Important links

3. DESIGN ANALYSIS:
   - Layout structure and grid system
   - Color scheme and branding
   - Typography choices and hierarchy
   - Overall branding and visual identity

4. CONTENT ANALYSIS:
   - Primary purpose of the page
   - Target audience indicators
   - Key messages being communicated
   - Calls to action present

5. TECHNICAL OBSERVATIONS:
   - Device type (desktop/mobile/tablet)
   - Responsive design indicators
   - Accessibility features visible
   - Performance indicators

6. BUSINESS CONTEXT:
   - Industry/sector identification
   - Business type (e-commerce, blog, corporate, etc.)
   - Services or products offered
   - Business model indicators

CRITICAL: Return your response in this EXACT JSON format with no additional text or markdown:
{
  "visualDescription": "Detailed description of what is visible in the screenshot",
  "pageElements": {
    "header": "Description of header content",
    "navigation": ["nav item 1", "nav item 2"],
    "mainContent": "Description of main content area",
    "sidebar": "Description of sidebar if present",
    "footer": "Description of footer if visible",
    "images": ["description of image 1", "description of image 2"],
    "forms": ["description of form 1"],
    "buttons": ["button 1 purpose", "button 2 purpose"],
    "links": ["important link 1", "important link 2"]
  },
  "designAnalysis": {
    "layout": "Layout structure description",
    "colorScheme": "Color palette and scheme",
    "typography": "Font choices and hierarchy",
    "branding": "Brand identity elements"
  },
  "contentAnalysis": {
    "primaryPurpose": "Main purpose of the page",
    "targetAudience": "Intended audience",
    "keyMessages": ["message 1", "message 2"],
    "callsToAction": ["CTA 1", "CTA 2"]
  },
  "technicalObservations": {
    "deviceType": "desktop/mobile/tablet",
    "responsive": true,
    "accessibility": ["accessibility feature 1"],
    "performance": ["performance indicator 1"]
  },
  "businessContext": {
    "industry": "Industry/sector",
    "businessType": "Type of business",
    "services": ["service 1", "service 2"],
    "products": ["product 1", "product 2"]
  },
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
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert web analyst and UX researcher. Analyze website screenshots to provide comprehensive insights about design, content, and business context. Always respond with valid JSON only, no markdown or additional text."
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
          max_tokens: 3000,
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
      let analysis: AnalyzeScreenshotResponse;
      try {
        analysis = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Failed to parse screenshot analysis response:", cleanedContent);
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.error("Failed to parse extracted JSON:", jsonMatch[0]);
            
            // Create a fallback response
            analysis = {
              visualDescription: "Unable to analyze screenshot due to parsing issues",
              pageElements: {
                header: "Unknown",
                navigation: [],
                mainContent: "Unable to analyze",
                images: [],
                forms: [],
                buttons: [],
                links: []
              },
              designAnalysis: {
                layout: "Unknown",
                colorScheme: "Unknown",
                typography: "Unknown",
                branding: "Unknown"
              },
              contentAnalysis: {
                primaryPurpose: "Unknown",
                targetAudience: "Unknown",
                keyMessages: [],
                callsToAction: []
              },
              technicalObservations: {
                deviceType: "desktop",
                responsive: true,
                accessibility: [],
                performance: []
              },
              businessContext: {
                industry: "Unknown",
                businessType: "Unknown",
                services: [],
                products: []
              },
              confidence: 0.1
            };
          }
        } else {
          // Create a fallback response
          analysis = {
            visualDescription: "Unable to analyze screenshot due to parsing issues",
            pageElements: {
              header: "Unknown",
              navigation: [],
              mainContent: "Unable to analyze",
              images: [],
              forms: [],
              buttons: [],
              links: []
            },
            designAnalysis: {
              layout: "Unknown",
              colorScheme: "Unknown",
              typography: "Unknown",
              branding: "Unknown"
            },
            contentAnalysis: {
              primaryPurpose: "Unknown",
              targetAudience: "Unknown",
              keyMessages: [],
              callsToAction: []
            },
            technicalObservations: {
              deviceType: "desktop",
              responsive: true,
              accessibility: [],
              performance: []
            },
            businessContext: {
              industry: "Unknown",
              businessType: "Unknown",
              services: [],
              products: []
            },
            confidence: 0.1
          };
        }
      }

      // Validate the response structure and provide defaults
      if (typeof analysis.visualDescription !== "string") {
        analysis.visualDescription = "Screenshot analysis completed";
      }
      
      if (!analysis.pageElements || typeof analysis.pageElements !== "object") {
        analysis.pageElements = {
          header: "Unknown",
          navigation: [],
          mainContent: "Unable to analyze",
          images: [],
          forms: [],
          buttons: [],
          links: []
        };
      }
      
      if (!analysis.designAnalysis || typeof analysis.designAnalysis !== "object") {
        analysis.designAnalysis = {
          layout: "Unknown",
          colorScheme: "Unknown",
          typography: "Unknown",
          branding: "Unknown"
        };
      }
      
      if (!analysis.contentAnalysis || typeof analysis.contentAnalysis !== "object") {
        analysis.contentAnalysis = {
          primaryPurpose: "Unknown",
          targetAudience: "Unknown",
          keyMessages: [],
          callsToAction: []
        };
      }
      
      if (!analysis.technicalObservations || typeof analysis.technicalObservations !== "object") {
        analysis.technicalObservations = {
          deviceType: "desktop",
          responsive: true,
          accessibility: [],
          performance: []
        };
      }
      
      if (!analysis.businessContext || typeof analysis.businessContext !== "object") {
        analysis.businessContext = {
          industry: "Unknown",
          businessType: "Unknown",
          services: [],
          products: []
        };
      }
      
      if (typeof analysis.confidence !== "number") {
        analysis.confidence = 0.7;
      }

      // Ensure arrays are properly initialized
      if (!Array.isArray(analysis.pageElements.navigation)) {
        analysis.pageElements.navigation = [];
      }
      if (!Array.isArray(analysis.pageElements.images)) {
        analysis.pageElements.images = [];
      }
      if (!Array.isArray(analysis.pageElements.forms)) {
        analysis.pageElements.forms = [];
      }
      if (!Array.isArray(analysis.pageElements.buttons)) {
        analysis.pageElements.buttons = [];
      }
      if (!Array.isArray(analysis.pageElements.links)) {
        analysis.pageElements.links = [];
      }
      if (!Array.isArray(analysis.contentAnalysis.keyMessages)) {
        analysis.contentAnalysis.keyMessages = [];
      }
      if (!Array.isArray(analysis.contentAnalysis.callsToAction)) {
        analysis.contentAnalysis.callsToAction = [];
      }
      if (!Array.isArray(analysis.technicalObservations.accessibility)) {
        analysis.technicalObservations.accessibility = [];
      }
      if (!Array.isArray(analysis.technicalObservations.performance)) {
        analysis.technicalObservations.performance = [];
      }
      if (!Array.isArray(analysis.businessContext.services)) {
        analysis.businessContext.services = [];
      }
      if (!Array.isArray(analysis.businessContext.products)) {
        analysis.businessContext.products = [];
      }

      return analysis;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Screenshot analysis error:", error);
      throw APIError.internal(`Failed to analyze screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
