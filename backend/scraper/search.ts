import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const firecrawlApiKey = secret("FirecrawlApiKey");

interface SearchSimilarPagesRequest {
  queries: string[];
  pageType: string;
  maxResults: number;
}

interface SearchResult {
  url: string;
  title: string;
  description?: string;
  content: string;
  schemaMarkup?: Record<string, any>[];
}

interface SearchSimilarPagesResponse {
  results: SearchResult[];
  totalFound: number;
}

// Searches for similar pages and extracts their schema markup for analysis.
export const searchSimilarPages = api<SearchSimilarPagesRequest, SearchSimilarPagesResponse>(
  { expose: true, method: "POST", path: "/search-similar" },
  async (req) => {
    if (!req.queries || req.queries.length === 0) {
      throw APIError.invalidArgument("Search queries are required");
    }

    const maxResults = Math.min(req.maxResults || 5, 10); // Limit to prevent excessive API calls
    const results: SearchResult[] = [];

    try {
      // Use Firecrawl's search functionality to find similar pages
      for (const query of req.queries.slice(0, 3)) { // Limit to 3 queries
        try {
          const searchResponse = await fetch("https://api.firecrawl.dev/v0/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${firecrawlApiKey()}`,
            },
            body: JSON.stringify({
              query: `${query} schema markup ${req.pageType}`,
              pageOptions: {
                onlyMainContent: true,
                includeHtml: true, // We need HTML to extract schema markup
              },
              searchOptions: {
                limit: Math.ceil(maxResults / req.queries.length),
              },
            }),
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.success && searchData.data) {
              for (const item of searchData.data) {
                if (results.length >= maxResults) break;
                
                // Extract schema markup from HTML if present
                const schemaMarkup = extractSchemaMarkup(item.html || "");
                
                results.push({
                  url: item.metadata?.sourceURL || item.url || "",
                  title: item.metadata?.title || "",
                  description: item.metadata?.description,
                  content: item.content || "",
                  schemaMarkup: schemaMarkup.length > 0 ? schemaMarkup : undefined,
                });
              }
            }
          }
        } catch (queryError) {
          // Continue with other queries if one fails
          console.error(`Search query failed: ${query}`, queryError);
        }
      }

      return {
        results,
        totalFound: results.length,
      };
    } catch (error) {
      throw APIError.internal(`Failed to search similar pages: ${error}`);
    }
  }
);

function extractSchemaMarkup(html: string): Record<string, any>[] {
  const schemas: Record<string, any>[] = [];
  
  // Look for JSON-LD script tags
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);
      
      // Handle both single objects and arrays
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch (parseError) {
      // Skip invalid JSON
      continue;
    }
  }
  
  return schemas;
}
