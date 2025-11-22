# UI Migration Tracker

| Component | File | Notes | Status |
| --- | --- | --- | --- |
| Alert | `src/components/ui/alert.tsx` | Pure DOM + `cva` styles | ✅ Converted |
| Card | `src/components/ui/card.tsx` | DOM wrappers only | ✅ Converted |
| Skeleton | `src/components/ui/skeleton.tsx` | Simple div wrapper | ✅ Converted |
| Input | `src/components/ui/input.tsx` | Native `<input>` styles | ✅ Converted |
| Textarea | `src/components/ui/textarea.tsx` | Native `<textarea>` styles | ✅ Converted |
| Table | `src/components/ui/table.tsx` | Structural table shell | ✅ Converted |
| Separator | `src/components/ui/separator.tsx` | Pure div separator with a11y props | ✅ Converted |
| Badge | `src/components/ui/badge.tsx` | Span variant styling only | ✅ Converted |
| Label | `src/components/ui/label.tsx` | Native `<label>` implementation | ✅ Converted |
| Breadcrumb | `src/components/ui/breadcrumb.tsx` | Simplified nav/list shell | ✅ Converted |
| Avatar | `src/components/ui/avatar.tsx` | Context-driven fallback with signals | ✅ Converted |
| ScrollArea | `src/components/ui/scroll-area.tsx` | Native overflow container | ✅ Converted |
| Checkbox | `src/components/ui/checkbox.tsx` | Signal-driven button + input | ✅ Converted |
| Collapsible | `src/components/ui/collapsible.tsx` | Custom context + trigger/content | ✅ Converted |
| Toggle | `src/components/ui/toggle.tsx` | Stateless button toggle | ✅ Converted |
| ToggleGroup | `src/components/ui/toggle-group.tsx` | Group manager with context | ✅ Converted |
| Tabs | `src/components/ui/tabs.tsx` | Context-managed tab system | ✅ Converted |
| Slider | `src/components/ui/slider.tsx` | Basic single-value slider | ✅ Converted |
| Tooltip | `src/components/ui/tooltip.tsx` | Lightweight hover/focus tooltip | ✅ Converted |
| Dialog | `src/components/ui/dialog.tsx` | Portal-based modal shell | ✅ Converted |

_Legend_: ✅ — already migrated to the converged renderer/runtime, ⏳ — selected for the first wave and still pending refactor.
