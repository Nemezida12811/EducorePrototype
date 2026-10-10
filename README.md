# EduCore

A static prototype of a university student portal. React 19, TypeScript, Vite and Tailwind CSS v4.
No backend, no API calls, no authentication: all data lives in `src/data/demo.ts`.

## Run it locally

Requires Node.js 20.19 or newer (or 22.12+).

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm run build      # typecheck, then production build into dist/
npm run preview    # serve the production build
npm run typecheck  # types only
```

## What is inside

| Page             | Student role                                   | Instructor role                              |
| ---------------- | ---------------------------------------------- | -------------------------------------------- |
| Dashboard        | Credits, average, today's classes, results     | Courses, students, grading queue             |
| Courses          | Enrolled, catalog, archived                    | Teaching, all active, archived               |
| Grades           | Final marks, semester results, mark scale      | Hidden                                       |
| Schedule         | Weekly timetable for enrolled courses          | Weekly teaching timetable                    |
| Exams            | Register and cancel (kept in memory only)      | Terms with registration counts               |
| Instructor panel | Hidden                                         | Roster, course details, grading queue        |

Use the **Student / Instructor** toggle in the top bar to switch roles. Pages a role cannot see
redirect to the dashboard. Exam registrations reset when you reload the page.

## Structure

```
src/
  data/        types.ts, demo.ts (all static data), selectors.ts (role filters)
  lib/         format.ts (dates, marks), router.ts (tiny hash router)
  state/       DemoContext.tsx (role + exam registrations)
  components/
    layout/    AppShell, Sidebar, TopBar, RoleToggle
    ui/        Panel, StatCard, DataTable, CourseCard, Badge, ProgressBar, Button, FilterTabs, ...
  pages/       one file per page
  nav.ts       navigation items and which roles see them
  index.css    palette tokens and focus styles
```

The `Course` type mirrors the course model: name, description, teachers, student limit,
academic year and archived state.

## Design notes

- **Palette** (`src/index.css`): blush `#F8DFD9`, fog `#EFEFEF`, rose `#D5A8AA`, mauve `#BE8191`,
  wine `#52202F`, plus three derived shades (a deeper wine for the sidebar, a lighter wine for
  hover, and a muted ink for secondary text).
- **Signature**: panels sit on a solid mauve offset block, like stacked sheets of paper.
- **Type**: Bricolage Grotesque for headings, Atkinson Hyperlegible Next for body text.
  Both are bundled through Fontsource, so nothing loads from a CDN.
- **Contrast**: wine text on blush, fog and rose is at least 6:1; blush on wine is above 11:1.
  Mauve is decorative only (wine text on it is 4.2:1), so no text sits on mauve.
- **Accessibility**: skip link, landmarks, `aria-current` on navigation, focus moves to the page on
  navigation, two-tone focus ring, tables with captions and row headers, scrollable table regions
  are keyboard focusable, and reduced motion is respected.

## Customizing

- Change the demo content in `src/data/demo.ts`; types are in `src/data/types.ts`.
- Change colors in the `@theme` block of `src/index.css`.
- Add a page: create `src/pages/Foo.tsx`, add its id to `RouteId` in `src/lib/router.ts`,
  then register it in `src/nav.ts` and `PAGES` in `src/App.tsx`.
