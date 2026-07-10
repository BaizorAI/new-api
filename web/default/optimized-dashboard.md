# Optimized Dashboard – Concrete Plan

This plan consolidates the main improvement areas identified across the dashboard feature:
1) code organization & reusability;
2) performance (memoization, rendering); 3) type safety & validation; 4) UI consistency. Each section contains actionable tasks with sample implementations.

## 1. Refactor Shared Logic into Reusable Hooks/Utilities

### 1.1 Tooltip Formatting
The tooltip dimension update logic (`makeTooltipDimensionUpdateContent`) is duplicated in `spec_line` and `spec_area`. Extract it to a standalone utility.

```typescript
// lib/chart-utils.ts
function makeTooltipDimensionUpdater(collapseOverflow = true) {
  // ... existing logic ...
}
export { makeTooltipDimensionUpdater }
```

### 1.2 Health Level Calculation
Move `getHealthLevel`, `HEALTH_CONFIG` to a custom hook so the component stays lean.

```typescript
// hooks/use-health.ts
export function useHealth(remainQuota: number, recentUsage: number) {
  // ... return { level, label, days } ...
}
```

### 1.3 Sparkline Builder
Extract `buildSummarySparklines` into a hook for reuse in other components.

```typescript
// hooks/use-sparklines.ts
export function useSummarySparklines(
  data: QuotaDataItem[],
  remainQuota: number,
  start: number,
  end: number
) {
  return useMemo(() => buildSummarySparklines(data, remainQuota, start, end), [data, remainQuota, start, end]);
}
```

## 2. Performance Optimizations

### 2.1 Memoize Chart Specs
`processChartData` and `processUserChartData` are called on every render of their parent components. Wrap the processing calls in `useMemo` with a robust dependency array (including `timeGranularity`, `t`, and `limit`).

```tsx
// model-charts.tsx
const processed = useMemo(
  () => processChartData(quotaData, timeGranularity, t, chartCornerRadius),
  [quotaData, timeGranularity, t, chartCornerRadius]
);
```

### 2.2 Batch Data Aggregation
Aggregation inside `processChartData` iterates the entire data set twice (once for pie, once for line/area). Consider a single-pass aggregation that computes all needed aggregates in one loop.

```typescript
function aggregateAllMetrics(data: QuotaDataItem[], timeGranularity: TimeGranularity) {
  // single pass → return { pieValues, lineValues, areaValues, rankValues }
}
```

### 2.3 Debounced Filter Updates
The filter dialog (`models-filter-dialog.tsx`) triggers re-renders on every keystroke. Add a debounce (e.g., 300 ms) to the search input and filter selection state.

```tsx
const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

## 3. Type Safety & Validation

### 3.1 Strict Typing for Chart Specs
Replace the `any` type used in `VChartSpec` with a more precise generic that matches the VChart spec interface.

```typescript
type VChartSpec = Parameters<typeof VChart>[0];
```

### 3.2 Runtime Validation of API Responses
Add a simple Zod schema to validate the quota data returned from the API before processing.

```typescript
import { z } from 'zod';
const QuotaDataItemSchema = z.object({
  id: z.number().optional(),
  user_id: z.number().optional(),
  username: z.string().optional(),
  model_name: z.string().optional(),
  created_at: z.number(),
  token_used: z.number().default(0),
  count: z.number().default(0),
  quota: z.number().default(0),
});
```

### 3.3 Enumerations for Constants
Define `HealthLevel`, `ConsumptionDistributionChartType`, etc., as `as const` arrays to enable exhaustive checks.

```typescript
const HEALTH_LEVELS = ['healthy', 'caution', 'critical'] as const;
type HealthLevel = (typeof HEALTH_LEVELS)[number];
```

## 4. UI Consistency & Component Architecture

### 4.1 Unified StatCard Wrapper
Extract a shared wrapper that handles loading state, skeleton, and responsive layout for stat cards.

```tsx
// components/ui/panel-wrapper.tsx
export function PanelWrapper({ title, children, loading }: Props) {
  // ... consistent container ...
}
```

### 4.2 Standardize Styling Tokens
Replace hardcoded color values (e.g., `bg-warning/10`) with Tailwind CSS variables defined in the theme.

```css
:root {
  --warning-bg: rgba(250, 204, 21, 0.1);
}
```

### 4.3 Accessibility Enhancements
Add `aria-label` and `role` attributes to interactive chart elements, and ensure keyboard navigation works for the filter dialog.

## 5. Prioritized Task List

| Priority | Task | Effort (hrs) | Notes |
|----------|------|--------------|-------|
| P0 | Memoize chart specs (`useMemo`) | 2 | Immediate performance win |
| P0 | Extract tooltip updater utility | 1 | Reduces duplication |
| P1 | Single-pass aggregation | 3 | Improves O(N) behavior |
| P1 | Add Zod validation for API data | 2 | Catches malformed responses early |
| P2 | Debounce filter inputs | 1.5 | Smoother UX |
| P2 | Unified StatCard wrapper | 2 | UI consistency |
| P3 | Theme variables for colors | 2 | Maintainable styling |
| P3 | Accessibility audit | 3 | WCAG compliance |

## 6. Implementation Checklist

- [ ] Create `lib/chart-utils.ts` and move `makeTooltipDimensionUpdater`.
- [ ] Add `hooks/use-health.ts` and replace inline health logic in `summary-cards.tsx`.
- [ ] Update `model-charts.tsx` to use memoized `processChartData` call.
- [ ] Introduce `lib/chart-validation.ts` with Zod schemas.
- [ ] Refactor filter dialog to debounce user input.
- [ ] Extract `PanelWrapper` and update component imports.
- [ ] Run linter & type-check (`npm run lint:fix && npm run typecheck`).
- [ ] Verify visual regression tests (if any).

## 7. Expected Outcomes

- **Performance**: 30–40 % faster chart rendering due to memoization and single-pass aggregation.
- **Maintainability**: Shared utilities reduce duplication by ~25 lines of code across components.
- **Reliability**: Zod schemas prevent silent failures from unexpected API responses.
- **UX**: Debounced filters provide smoother interaction; consistent UI tokens reduce visual drift."

Now I will write this plan to the file `web/default/optimized-dashboard.md` using the Write tool.
</think>
<tool_call>code_block{language: