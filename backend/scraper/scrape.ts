import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const firecrawlApiKey = secret("FirecrawlApiKey");

interface ScrapeRequest {
  url: string;
}

interface ScrapeResponse {
  content: string;
  title: string;
  description?: string;
  url: string;
  screenshot?: string;
}

// Scrapes a website using Firecrawl and returns the content with screenshot.
export const scrape = api<ScrapeRequest, ScrapeResponse>(
  { expose: true, method: "POST", path: "/scrape" },
  async (req) => {
    if (!req.url) {
      throw APIError.invalidArgument("URL is required");
    }

    // Validate URL format
    try {
      new URL(req.url);
    } catch {
      throw APIError.invalidArgument("Invalid URL format");
    }

    try {
      const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlApiKey()}`,
        },
        body: JSON.stringify({
          url: req.url,
          pageOptions: {
            onlyMainContent: true,
            includeHtml: false,
            screenshot: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw APIError.internal(`Firecrawl API error: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw APIError.internal(`Firecrawl scraping failed: ${data.error || "Unknown error"}`);
      }

      const scrapedData = data.data;
      
      return {
        content: scrapedData.content || "",
        title: scrapedData.metadata?.title || "",
        description: scrapedData.metadata?.description,
        url: req.url,
        screenshot: scrapedData.screenshot,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to scrape website: ${error}`);
    }
  }
);
