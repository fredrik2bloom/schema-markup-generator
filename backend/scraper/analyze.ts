import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const openAIApiKey = secret("OpenAIApiKey");

interface AnalyzePageRequest {
  content: string;
  title: string;
  description?: string;
  url: string;
}

interface AnalyzePageResponse {
  pageType: string;
  category: string;
  searchQueries: string[];
  confidence: number;
}

// Analyzes scraped content to determine page type and generate search queries for similar pages.
export const analyzePage = api<AnalyzePageRequest, AnalyzePageResponse>(
  { expose: true, method: "POST", path: "/analyze-page" },
  async (req) => {
    if (!req.content || !req.title || !req.url) {
      throw APIError.invalidArgument("Content, title, and URL are required");
    }

    const prompt = `
Analyze the following website content and determine:
1. The primary page type (e.g., Article, Product, Organization, Person, Event, Recipe, etc.)
2. The business category/industry
3. Generate 3-5 search queries to find similar pages that would have good schema markup examples

Website URL: ${req.url}
Title: ${req.title}
Description: ${req.description || "Not provided"}

Content:
${req.content.substring(0, 3000)} ${req.content.length > 3000 ? "..." : ""}

Return your analysis in the following JSON format:
{
  "pageType": "primary schema.org type (e.g., Article, Product, Organization)",
  "category": "business category or industry",
  "searchQueries": ["query1", "query2", "query3"],
  "confidence": 0.85
}

Focus on identifying the most appropriate schema.org type and generating search queries that would find pages with similar content structure and purpose.
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
              content: "You are an expert in web content analysis and schema.org markup. Analyze content to determine the most appropriate schema type and generate effective search queries."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
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

      // Parse the JSON response
      let analysis: AnalyzePageResponse;
      try {
        analysis = JSON.parse(generatedContent);
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch {
            throw APIError.internal("Failed to parse page analysis");
          }
        } else {
          throw APIError.internal("Failed to parse page analysis");
        }
      }

      // Validate the response structure
      if (!analysis.pageType || !analysis.category || !Array.isArray(analysis.searchQueries)) {
        throw APIError.internal("Invalid analysis response structure");
      }

      return analysis;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to analyze page: ${error}`);
    }
  }
);
