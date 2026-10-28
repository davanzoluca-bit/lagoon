# Lagoon design system

The UI uses a compact set of semantic color, spacing, radius, type, motion, and elevation tokens in `tokens.css`. Dark mode overrides the same semantic colors, so components do not need theme-specific color declarations.

Reusable React components are split into `components/` and re-exported from `index.ts`. App panels now compose through `Card`, and reusable visual elements are owned by their components:

- `Button` and `IconButton` provide consistent action controls.
- `Field` provides a consistent label wrapper for native controls.
- `Dialog` provides the shared modal surface, overlay, close button, Escape handling, focus management, and backdrop dismissal.
- `Card` and `CardHeader` provide the shared surface and heading for app panels.
- `MetricCard` and `CommunityPostCard` provide reusable dashboard and feed card patterns.
- `Avatar` and `PageHeading` provide shared identity and page-heading patterns.

Each component's styles live beside it. `components.css` contains shared form, button, dialog, and upload primitives; `styles.css` is the design-system stylesheet entry point. Add new controls by composing these components and semantic tokens instead of adding one-off visual values.
