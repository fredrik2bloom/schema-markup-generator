import { api, APIError } from "encore.dev/api";

interface ValidateSchemaRequest {
  schema: Record<string, any>;
}

interface ValidationError {
  field: string;
  message: string;
}

interface ValidateSchemaResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// Validates JSON-LD schema markup for correctness and completeness.
export const validate = api<ValidateSchemaRequest, ValidateSchemaResponse>(
  { expose: true, method: "POST", path: "/schema/validate" },
  async (req) => {
    if (!req.schema) {
      throw APIError.invalidArgument("Schema is required");
    }

    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!req.schema["@context"]) {
      errors.push({
        field: "@context",
        message: "@context is required for JSON-LD"
      });
    } else if (typeof req.schema["@context"] === "string" && !req.schema["@context"].includes("schema.org")) {
      warnings.push("@context should typically reference schema.org");
    }

    if (!req.schema["@type"]) {
      errors.push({
        field: "@type",
        message: "@type is required to specify the schema type"
      });
    }

    // Validate common schema types
    const schemaType = req.schema["@type"];
    if (schemaType) {
      switch (schemaType) {
        case "Article":
          validateArticleSchema(req.schema, errors, warnings);
          break;
        case "WebPage":
          validateWebPageSchema(req.schema, errors, warnings);
          break;
        case "Organization":
          validateOrganizationSchema(req.schema, errors, warnings);
          break;
        case "Product":
          validateProductSchema(req.schema, errors, warnings);
          break;
        case "Person":
          validatePersonSchema(req.schema, errors, warnings);
          break;
        default:
          // Generic validation for other types
          validateGenericSchema(req.schema, errors, warnings);
      }
    }

    // Check for common issues
    validateUrls(req.schema, errors);
    validateDates(req.schema, errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
);

function validateArticleSchema(schema: Record<string, any>, errors: ValidationError[], warnings: string[]) {
  if (!schema.headline) {
    errors.push({ field: "headline", message: "Article should have a headline" });
  }
  
  if (!schema.author) {
    warnings.push("Article should include author information");
  }
  
  if (!schema.datePublished) {
    warnings.push("Article should include datePublished");
  }
  
  if (!schema.image) {
    warnings.push("Article should include an image for better SEO");
  }
}

function validateWebPageSchema(schema: Record<string, any>, errors: ValidationError[], warnings: string[]) {
  if (!schema.name && !schema.headline) {
    errors.push({ field: "name", message: "WebPage should have a name or headline" });
  }
  
  if (!schema.url) {
    warnings.push("WebPage should include a URL");
  }
}

function validateOrganizationSchema(schema: Record<string, any>, errors: ValidationError[], warnings: string[]) {
  if (!schema.name) {
    errors.push({ field: "name", message: "Organization must have a name" });
  }
  
  if (!schema.url) {
    warnings.push("Organization should include a URL");
  }
}

function validateProductSchema(schema: Record<string, any>, errors: ValidationError[], warnings: string[]) {
  if (!schema.name) {
    errors.push({ field: "name", message: "Product must have a name" });
  }
  
  if (!schema.description) {
    warnings.push("Product should include a description");
  }
  
  if (!schema.offers) {
    warnings.push("Product should include offers information");
  }
}

function validatePersonSchema(schema: Record<string, any>, errors: ValidationError[], warnings: string[]) {
  if (!schema.name) {
    errors.push({ field: "name", message: "Person must have a name" });
  }
}

function validateGenericSchema(schema: Record<string, any>, errors: ValidationError[], warnings: string[]) {
  if (!schema.name && !schema.headline && !schema.title) {
    warnings.push("Schema should include a name, headline, or title");
  }
}

function validateUrls(schema: Record<string, any>, errors: ValidationError[]) {
  const urlFields = ["url", "sameAs", "image", "logo"];
  
  for (const field of urlFields) {
    const value = schema[field];
    if (value) {
      if (typeof value === "string") {
        if (!isValidUrl(value)) {
          errors.push({ field, message: `${field} must be a valid URL` });
        }
      } else if (Array.isArray(value)) {
        value.forEach((url, index) => {
          if (typeof url === "string" && !isValidUrl(url)) {
            errors.push({ field: `${field}[${index}]`, message: `${field} array item must be a valid URL` });
          }
        });
      }
    }
  }
}

function validateDates(schema: Record<string, any>, errors: ValidationError[]) {
  const dateFields = ["datePublished", "dateModified", "dateCreated"];
  
  for (const field of dateFields) {
    const value = schema[field];
    if (value && typeof value === "string") {
      if (!isValidDate(value)) {
        errors.push({ field, message: `${field} must be a valid ISO 8601 date` });
      }
    }
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.includes("T") || dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}
