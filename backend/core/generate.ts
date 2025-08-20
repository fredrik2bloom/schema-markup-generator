import { api, APIError } from "encore.dev/api";
import { parseHint } from "./hint-parser";
import { fetchAndNormalize } from "./fetcher";
import { classifyPage } from "./classifier";
import { applyPolicy } from "./policy";
import { assembleSchema } from "./assembler";
import { validateSchema } from "./validator";

interface GenerateRequest {
  url: string;
  hint?: string;
  options?: {
    renderMode?: "auto" | "html" | "headless";
  };
}

interface GenerateResponse {
  detectedType: string;
  subtype?: string;
  features: string[];
  confidence: number;
  jsonld: Record<string, any>;
  explanations: string[];
  warnings: string[];
  hintDirective: Record<string, any>;
  lint: {
    schemaOrgValid: boolean;
    richResultsEligible: boolean;
    errors: string[];
    warnings: string[];
  };
}

// Generates JSON-LD schema markup from URL with optional hint guidance.
export const generate = api<GenerateRequest, GenerateResponse>(
  { expose: true, method: "POST", path: "/generate" },
  async (req) => {
    if (!req.url) {
      throw APIError.invalidArgument("URL is required");
    }

    try {
      // 1. Parse hint into directive
      const hintDirective = parseHint(req.hint || "");

      // 2. Fetch and normalize content
      const content = await fetchAndNormalize(req.url, {
        renderMode: req.options?.renderMode || hintDirective.renderMode || "auto"
      });

      // 3. Classify page type and features
      const classification = classifyPage(content, hintDirective);

      // 4. Apply policy rules
      const policyResult = applyPolicy(classification, content, hintDirective);

      // 5. Assemble JSON-LD schema
      const jsonld = assembleSchema(policyResult, content);

      // 6. Validate schema
      const validation = validateSchema(jsonld);

      return {
        detectedType: policyResult.primaryType,
        subtype: policyResult.subtype,
        features: policyResult.features,
        confidence: policyResult.confidence,
        jsonld,
        explanations: policyResult.explanations,
        warnings: policyResult.warnings,
        hintDirective,
        lint: validation
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
