# EduCore

A static prototype of a university academic portal (single institution). React 19, TypeScript,
Vite and Tailwind CSS v4. No backend, no API calls, no authentication: all data lives in
`src/data/demo.ts`, and anything you change in the UI resets when you reload.

## Run it locally

Requires Node.js 20.19 or newer (or 22.12+).

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck, then production build into dist/
npm run preview    # serve the production build
npm run typecheck  # types only
```

## Roles

Use the **Student / Instructor / Admin** toggle in the top bar. Pages a role cannot see redirect to
the dashboard.

| Page             | Student                                         | Instructor                                 | Admin                              |
| ---------------- | ----------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| Dashboard        | Credits, average, today's classes, results      | Courses, students, grading queue           | Occupancy report, CSV export       |
| Courses          | Enrolled, catalog, archived                     | Teaching, all active, archived             | Active, archived                   |
| Course detail    | Info, own grades, enroll / withdraw / waitlist  | Info, student grades and distribution      | Info (grades hidden)               |
| Study plan       | Plan by year and semester with live status      | -                                          | -                                  |
| Grades           | Final marks, semester results, mark scale       | -                                          | -                                  |
| Schedule         | Own timetable, .ics export                      | Teaching timetable, .ics export            | Institution timetable              |
| Exams            | Register and cancel                             | Terms with registration counts             | Terms with registration counts     |
| Calendar         | Semesters, key dates, holidays                  | same                                       | same                               |
| Notices          | Inbox, read / unread, filters                   | Inbox and publish a notice                 | Inbox and publish a notice         |
| Instructor panel | -                                               | Roster, course details, grading queue      | -                                  |
| Users            | -                                               | -                                          | Accounts, activate / deactivate    |
| Organization     | -                                               | -                                          | Faculty, departments, programs     |
| Profile          | Contact details, notification choices, data export (JSON)                                              |

Every course, active or archived, opens at `#/courses/<id>` (for example `#/courses/ads2` or
`#/courses/oop`). Grades follow the domain model: one grade per course made of components from the
course's grading scheme, with a final score from 0 to 100 and a mark derived from it (A to FX).

## Structure

```
src/
  data/        types.ts, demo.ts (all static data), selectors.ts
  lib/         format.ts, grades.ts (marks, totals), calendar.ts (key dates, .ics),
               download.ts (CSV and file saving), router.ts (tiny hash router)
  state/       DemoContext.tsx (role, enrollment, exams, notices), useMine.ts (per-role views)
  components/
    layout/    AppShell, Sidebar, TopBar, RoleToggle
    ui/        Panel, StatCard, DataTable, CourseCard, CourseLink, Badge, ProgressBar, Button, ...
  pages/       one file per page
  nav.ts       navigation items and which roles see them
  index.css    palette tokens and focus styles
```

The `Course` type mirrors the course model: name, description, teachers (with a guarantor), student
limit, academic year and archived state, plus department, completion type and grading scheme.

## Design notes

- **Palette** (`src/index.css`): blush `#F8DFD9`, fog `#EFEFEF`, rose `#D5A8AA`, mauve `#BE8191`,
  wine `#52202F`, plus three derived shades (deeper wine, lighter wine, muted ink).
- **Signature**: panels sit on a solid mauve offset block, like stacked sheets of paper.
- **Type**: Bricolage Grotesque for headings, Atkinson Hyperlegible Next for body text, both
  bundled through Fontsource.
- **Contrast**: wine text on blush, fog and rose is at least 6:1; blush on wine is above 11:1.
  Mauve is decorative only (wine text on it is 4.2:1).
- **Accessibility**: skip link, landmarks, `aria-current`, focus moves to the page on navigation,
  two-tone focus ring, captioned tables with row headers, live regions for status messages, and
  reduced motion is respected.

## Customizing

- Change the demo content in `src/data/demo.ts`; types are in `src/data/types.ts`.
- Change colors in the `@theme` block of `src/index.css`.
- Add a page: create `src/pages/Foo.tsx`, add its id to `RouteId` in `src/lib/router.ts`, then
  register it in `src/nav.ts` and `PAGES` in `src/App.tsx`.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds the app and publishes it on every push to `main`.

1. Create an empty repository on GitHub.
2. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Push the project:

   ```bash
   git init -b main
   git add .
   git commit -m "Add EduCore prototype"
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

4. Watch the run in the **Actions** tab. The site appears at `https://<user>.github.io/<repo>/`.

The build uses relative asset paths (`base: './'`) and a hash router, so it works under the
`/<repo>/` sub-path without extra configuration.
