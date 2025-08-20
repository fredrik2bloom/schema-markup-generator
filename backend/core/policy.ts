import type { Classification } from "./classifier";
import type { NormalizedContent } from "./fetcher";

interface PolicyResult {
  primaryType: string;
  subtype?: string;
  features: string[];
  confidence: number;
  explanations: string[];
  warnings: string[];
  mentions: string[];
}

export function applyPolicy(
  classification: Classification, 
  content: NormalizedContent, 
  hintDirective: any
): PolicyResult {
  const explanations: string[] = [];
  const warnings: string[] = [];
  const mentions: string[] = [];
  let { primaryType, subtype, features, confidence } = classification;

  // Apply quality gates
  const qualityResult = applyQualityGates(classification, content);
  if (qualityResult.downgraded) {
    primaryType = qualityResult.newType;
    subtype = qualityResult.newSubtype;
    confidence = Math.min(confidence, 0.6);
    warnings.push(...qualityResult.warnings);
    explanations.push(`Downgraded from ${classification.primaryType} to ${primaryType}: ${qualityResult.reason}`);
  }

  // Apply hint directives
  if (hintDirective.suppress) {
    features = features.filter(f => !hintDirective.suppress.includes(f));
    explanations.push(`Suppressed features: ${hintDirective.suppress.join(", ")}`);
  }

  if (hintDirective.enrich) {
    for (const feature of hintDirective.enrich) {
      if (!features.includes(feature)) {
        features.push(feature);
        explanations.push(`Added feature: ${feature}`);
      }
    }
  }

  // Apply strictness rules
  if (hintDirective.strictness === "strict") {
    features = applyStrictValidation(features, content, warnings);
  }

  // One primary type rule - conflicting types go to mentions
  if (classification.signals.length > 1) {
    const conflictingTypes = detectConflictingTypes(classification.signals);
    if (conflictingTypes.length > 0) {
      mentions.push(...conflictingTypes);
      explanations.push(`Conflicting types moved to mentions: ${conflictingTypes.join(", ")}`);
    }
  }

  // Add classification explanations
  explanations.push(...classification.signals);

  return {
    primaryType,
    subtype,
    features,
    confidence,
    explanations,
    warnings,
    mentions
  };
}

interface QualityGateResult {
  downgraded: boolean;
  newType?: string;
  newSubtype?: string;
  reason?: string;
  warnings: string[];
}

function applyQualityGates(classification: Classification, content: NormalizedContent): QualityGateResult {
  const warnings: string[] = [];

  // Product quality gates
  if (classification.primaryType === "Product") {
    if (!content.domSignals.hasPrice) {
      return {
        downgraded: true,
        newType: "WebPage",
        reason: "No price found",
        warnings: ["Product requires visible price"]
      };
    }
    if (!content.domSignals.hasCurrency) {
      warnings.push("Price found but currency not clearly specified");
    }
  }

  // LocalBusiness quality gates
  if (classification.primaryType === "LocalBusiness") {
    if (!content.domSignals.hasNAP) {
      return {
        downgraded: true,
        newType: "WebPage",
        reason: "Incomplete NAP (Name, Address, Phone)",
        warnings: ["LocalBusiness requires complete contact information"]
      };
    }
  }

  // Article quality gates
  if (classification.primaryType === "Article" || classification.primaryType === "BlogPosting") {
    if (!content.domSignals.hasByline) {
      warnings.push("Article missing author byline");
    }
    if (!content.domSignals.hasPublishDate) {
      warnings.push("Article missing publication date");
    }
  }

  // Image quality gates
  if (content.meta.ogImage) {
    // In a real implementation, we would check image dimensions
    // For now, just warn if no image is present
  } else {
    warnings.push("No featured image found - may affect rich results");
  }

  return {
    downgraded: false,
    warnings
  };
}

function applyStrictValidation(features: string[], content: NormalizedContent, warnings: string[]): string[] {
  const validatedFeatures: string[] = [];

  for (const feature of features) {
    switch (feature) {
      case "offers":
        if (content.domSignals.hasPrice && content.domSignals.hasCurrency) {
          validatedFeatures.push(feature);
        } else {
          warnings.push("Offers feature requires visible price and currency");
        }
        break;
      case "aggregateRating":
        if (content.domSignals.hasRating) {
          validatedFeatures.push(feature);
        } else {
          warnings.push("AggregateRating feature requires visible rating");
        }
        break;
      case "reviews":
        if (content.domSignals.hasReviews) {
          validatedFeatures.push(feature);
        } else {
          warnings.push("Reviews feature requires visible review content");
        }
        break;
      default:
        validatedFeatures.push(feature);
    }
  }

  return validatedFeatures;
}

function detectConflictingTypes(signals: string[]): string[] {
  const conflicting: string[] = [];
  
  // Simple conflict detection - in practice this would be more sophisticated
  if (signals.some(s => s.includes("Product")) && signals.some(s => s.includes("Article"))) {
    conflicting.push("Product");
  }
  
  return conflicting;
}
