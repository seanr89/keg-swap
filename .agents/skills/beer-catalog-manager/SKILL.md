---
name: beer-catalog-manager
description: >-
  Procedures for managing, validating, and migrating beer datasets, styles taxonomy, ABV calculations, and batch JSON imports for Keg Swap. Use this skill when modifying beers.json, writing batch import utilities, or altering drink and review data models.
---

# Beer Catalog Manager Guide for Keg Swap

This skill defines standards and procedures for beer data integrity in Keg Swap.

---

## 1. Beer Dataset Schema (`beers.json`)

The batch beer uploader expects JSON items adhering strictly to this format:

```json
[
  {
    "name": "Northern Monk Faith",
    "brewery": "Northern Monk Brew Co",
    "location": "Leeds",
    "abv": "5.4%",
    "style": "Hazy Pale Ale",
    "description": "Juicy, tropical pale ale packed with Citra and Mosaic hops.",
    "imageUrl": "https://example.com/images/faith.jpg"
  }
]
```

### Data Normalization Rules:
1. **ABV Validation**:
   - Must be represented as a percentage string (e.g. `"5.4%"`).
   - If incoming data provides a bare number (e.g. `5.4`), the uploader must append `"%"`.
   - Range must fall between `0.0%` and `30.0%`.
2. **Style Taxonomy**:
   - Normalize styles to consistent casing (e.g. `"IPA"`, `"Stout"`, `"Porter"`, `"Sour"`, `"Saison"`, `"Lager"`, `"Bitter"`, `"Pale Ale"`).
3. **Drink IDs**:
   - When importing batch items, assign deterministic or UUID identifiers (`crypto.randomUUID()`). Do not use bare sequential integers to prevent key collisions across events.

---

## 2. Review & Rating Mathematics

Keg Swap utilizes a 10-point scale with 0.5 step increments (displayed via beer glass icons in `StarRating.tsx`):
- Minimum valid rating: `0.5`
- Maximum valid rating: `10.0`
- Half-step support: `(index + 0.5)` or `(index + 1.0)`

### Average Rating Calculation:
```typescript
export function computeAverageRating(reviews: BeerReview[]): { average: number; count: number } {
  if (!reviews || reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = Math.round((sum / reviews.length) * 10) / 10;
  return { average: avg, count: reviews.length };
}
```

---

## 3. Batch Ingestion Verification Procedure

When modifying `beers.json` or importing new festival lists:
1. Validate JSON syntax:
   `node -e "JSON.parse(require('fs').readFileSync('beers.json'))"`
2. Verify all mandatory keys (`name`, `brewery`, `location`, `abv`, `style`) exist on every item.
3. Check for duplicates (same name and brewery).
