import { useId, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { errorMessage, markAllNoticesRead, publishNotice, setNoticeRead } from '../data/actions'
import type { NoticeScope } from '../data/types'
import { formatDate } from '../lib/format'
import { useApp } from '../state/AppContext'
import { useMine } from '../state/useMine'

type Filter = 'all' | NoticeScope

const SCOPE_LABEL: Record<NoticeScope, string> = { institution: 'Institution', course: 'Course' }
const field = 'min-h-11 w-full rounded-md border-2 border-wine bg-fog px-3 text-wine'

export function NoticesPage() {
  const { role } = useApp()
  const { notices, unread } = useMine()
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')
  const visible = notices.filter((n) => filter === 'all' || n.scope === filter)
  const guard = (p: Promise<void>) => p.then(() => setError('')).catch((e) => setError(errorMessage(e)))

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements from your institution and courses."
        action={
          <Button variant="secondary" className="bg-blush" disabled={unread === 0} onClick={() => void guard(markAllNoticesRead())}>
            <CheckCheck aria-hidden="true" className="mr-2 size-4" />
            Mark all as read
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <FilterTabs
          label="Filter notices"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'institution', label: 'Institution' },
            { value: 'course', label: 'Course' },
          ]}
        />
        <p className="text-rose" role="status">{unread} unread</p>
      </div>
      <p role="alert" className="mb-4 font-semibold empty:hidden">{error}</p>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className={role === 'student' ? 'lg:col-span-5' : 'lg:col-span-3'}>
          <Panel title="Inbox">
            {visible.length === 0 ? (
              <EmptyState title="No notices here">Try another filter.</EmptyState>
            ) : (
              <ul className="divide-y divide-rose">
                {visible.map((n) => (
                  <li key={n.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {!n.read && <Badge tone="solid">Unread</Badge>}
                      <Badge tone="outline">{SCOPE_LABEL[n.scope]}</Badge>
                      {n.courseId && (
                        <span className="text-sm font-semibold">
                          <CourseLink courseId={n.courseId} />
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold">{n.title}</h3>
                    <p className="mt-1 whitespace-pre-line">{n.body}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-ink-soft">{n.author}, {formatDate(n.date)}</p>
                      <Button
                        variant="secondary"
                        onClick={() => void guard(setNoticeRead(n.id, !n.read))}
                        aria-label={`${n.read ? 'Mark as unread' : 'Mark as read'}: ${n.title}`}
                      >
                        {n.read ? 'Mark as unread' : 'Mark as read'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        {role !== 'student' && (
          <div className="lg:col-span-2">
            <ComposePanel />
          </div>
        )}
      </div>
    </>
  )
}

function ComposePanel() {
  const { role } = useApp()
  const { courses } = useMine()
  const ids = { title: useId(), body: useId(), scope: useId(), course: useId() }
  const institutionWide = role === 'admin' || role === 'superadmin'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<NoticeScope>(institutionWide ? 'institution' : 'course')
  const [courseId, setCourseId] = useState('')
  const [message, setMessage] = useState('')
  const chosenCourse = courses.some((c) => c.id === courseId) ? courseId : (courses[0]?.id ?? '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await publishNotice({ title: title.trim(), body: body.trim(), courseId: scope === 'course' ? chosenCourse : undefined })
      setMessage('Notice published.')
      setTitle('')
      setBody('')
    } catch (err) {
      setMessage(errorMessage(err))
    }
  }

  return (
    <Panel title="New notice">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor={ids.title} className="mb-1 block font-medium">Title</label>
          <input id={ids.title} className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label htmlFor={ids.body} className="mb-1 block font-medium">Message</label>
          <textarea id={ids.body} className={`${field} min-h-28 py-2`} value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        {institutionWide && (
          <div>
            <label htmlFor={ids.scope} className="mb-1 block font-medium">Audience</label>
            <select id={ids.scope} className={field} value={scope} onChange={(e) => setScope(e.target.value as NoticeScope)}>
              <option value="institution">Whole institution</option>
              <option value="course">One course</option>
            </select>
          </div>
        )}
        {scope === 'course' && (
          <div>
            <label htmlFor={ids.course} className="mb-1 block font-medium">Course</label>
            <select id={ids.course} className={field} value={chosenCourse} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} {c.name}</option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" disabled={!title.trim() || !body.trim() || (scope === 'course' && !chosenCourse)}>Publish notice</Button>
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">{message}</p>
      </form>
    </Panel>
  )
}
