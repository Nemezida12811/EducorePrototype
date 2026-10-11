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

Use the role switcher in the top bar (Student, Instructor, Admin, Super admin). Pages a role cannot see
redirect to the dashboard.

| Page             | Student                          | Instructor                           | Admin                                  | Super admin            |
| ---------------- | -------------------------------- | ------------------------------------ | -------------------------------------- | ---------------------- |
| Dashboard        | Credits, average, today          | Courses, students, grading queue     | Occupancy report, CSV export           | Users, storage, courses |
| Courses          | Enrolled, catalog, archived      | Teaching, all, archived, new course  | Active, archived, new course           | -                      |
| Course detail    | Info, own grades, enroll         | Info, grades, exams, edit course     | Info, manage any course                | -                      |
| Study plan       | Plan with live status            | -                                    | -                                      | -                      |
| Grades           | Final marks, semester results    | -                                    | -                                      | -                      |
| Schedule, Exams  | Own                              | Sessions they run, add exams         | Institution-wide, add exams            | -                      |
| Calendar         | yes                              | yes                                  | yes                                    | -                      |
| Notices          | Inbox                            | Inbox, publish                       | Inbox, publish                         | -                      |
| Instructor panel | -                                | Roster, grading queue                | -                                      | -                      |
| Users            | -                                | -                                    | Create, edit, change role, deactivate  | -                      |
| Organization     | -                                | -                                    | Departments and study programs         | -                      |
| Platform         | -                                | -                                    | -                                      | Usage and limits       |
| Profile          | Contact details, notification choices, data export (all roles)                                                             |

Every course, active or archived, opens at `#/courses/<id>` (for example `#/courses/ads2` or `#/courses/oop`).

## Management features (all in memory, reset on reload)

- **Users and roles (FR-2.1, 2.2):** admins create and edit accounts, change a user's role and deactivate
  accounts. A new teacher also becomes selectable as a course teacher. Admins cannot deactivate or demote themselves.
- **Departments and programs (FR-2.3):** admins add and edit departments and study programs.
- **Platform limits (FR-2.5):** the super admin sees users and storage in use and sets the platform-wide limits.
  There are no plans and no per-institution split; limits cannot be set below current usage.
- **Courses (FR-3.1, 3.2):** teachers and admins create a course with capacity, syllabus topics, department,
  guarantor, teachers and a grading scheme, and edit it later (teachers only for courses they teach).
- **Timetable (FR-3.3):** in *Edit course*, teachers and admins add lectures, practicals, labs and seminars, set the
  day and time, room, and assign one of the course's teachers to each session. Teachers see the sessions they run in their schedule.
- **Exam terms:** teachers and admins add and remove exam terms from the Exams page or from a course page
  (date, time, room, format, term, capacity, registration open or closed). Students see them right away.
- **Prerequisites (FR-3.4):** shown on the course page; students cannot enroll until they have passed them.
- **Documents (FR-3.5):** teachers and admins add PDFs (up to 10 MB) as syllabus or material. Files stay in the browser.
- **Archive (FR-3.6):** archiving keeps grades and history; courses can be restored.
- **Grading (FR-5.1):** teachers enter component points per student. When every component has points the total
  becomes the final score and the mark (A to FX) is set. Archived courses are read-only.

Grades follow the domain model: one grade per course, made of components from the course's grading scheme,
with a final score from 0 to 100 and a mark derived from it.

## Structure

```
src/
  data/        types.ts, demo.ts (seed data), stores.ts (editable in-memory state), selectors.ts
  lib/         format.ts, grades.ts (marks, totals), calendar.ts (key dates, .ics),
               download.ts (CSV and file saving), router.ts (tiny hash router)
  state/       DemoContext.tsx (role, enrollment, exams, notices), useMine.ts (per-role views)
  components/
    layout/    AppShell, Sidebar, TopBar, RoleToggle
    forms/     CourseForm
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
