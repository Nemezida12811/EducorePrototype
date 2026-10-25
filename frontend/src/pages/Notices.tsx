import { useId, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import type { NoticeScope } from '../data/types'
import { formatDate } from '../lib/format'
import { INSTRUCTOR_ID } from '../data/demo'
import { getCourse } from '../data/selectors'
import { useSessions } from '../data/stores'
import { groupName, isGroup } from '../lib/groups'
import { useDemo } from '../state/DemoContext'
import { useMine } from '../state/useMine'

type Filter = 'all' | NoticeScope

const SCOPE_LABEL: Record<NoticeScope, string> = { institution: 'Institution', department: 'Department', course: 'Course', group: 'Practical group' }

export function NoticesPage() {
  const { role, readNoticeIds, toggleNoticeRead, markNoticesRead } = useDemo()
  const { notices, unread } = useMine()
  const [filter, setFilter] = useState<Filter>('all')
  const sessionList = useSessions()
  const visible = notices.filter((n) => filter === 'all' || n.scope === filter)

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements from your institution, departments and courses."
        action={
          <Button
            variant="secondary"
            className="bg-blush"
            disabled={unread === 0}
            onClick={() => markNoticesRead(notices.map((n) => n.id))}
          >
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
            { value: 'department', label: 'Department' },
            { value: 'course', label: 'Course' },
            { value: 'group', label: 'My group' },
          ]}
        />
        <p className="text-rose" role="status">
          {unread} unread
        </p>
      </div>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className={role === 'student' ? 'lg:col-span-5' : 'lg:col-span-3'}>
          <Panel title="Inbox">
            {visible.length === 0 ? (
              <EmptyState title="No notices here">Try another filter.</EmptyState>
            ) : (
              <ul className="divide-y divide-rose">
                {visible.map((n) => {
                  const isRead = readNoticeIds.has(n.id)
                  return (
                    <li key={n.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {!isRead && <Badge tone="solid">Unread</Badge>}
                        <Badge tone="outline">{SCOPE_LABEL[n.scope]}</Badge>
                        {n.courseId && (
                          <span className="text-sm font-semibold">
                            <CourseLink courseId={n.courseId} />
                          </span>
                        )}
                        {n.scope === 'group' && (() => {
                          const g = sessionList.find((x) => x.id === n.sessionId)
                          return g ? <Badge tone="soft">{groupName(g)}</Badge> : null
                        })()}
                      </div>
                      <h3 className="text-lg font-semibold">{n.title}</h3>
                      <p className="mt-1">{n.body}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-ink-soft">
                          {n.author}, {formatDate(n.date)}
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => toggleNoticeRead(n.id)}
                          aria-label={`${isRead ? 'Mark as unread' : 'Mark as read'}: ${n.title}`}
                        >
                          {isRead ? 'Mark as unread' : 'Mark as read'}
                        </Button>
                      </div>
                    </li>
                  )
                })}
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

const field = 'min-h-11 w-full rounded-md border-2 border-wine bg-fog px-3 text-wine'

function ComposePanel() {
  const { role, addNotice, groupTaken } = useDemo()
  const { courses } = useMine()
  const sessions = useSessions()
  const ids = { title: useId(), body: useId(), scope: useId(), course: useId(), gcourse: useId(), group: useId() }
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<NoticeScope>('institution')
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [groupCourse, setGroupCourse] = useState('')
  const [groupId, setGroupId] = useState('')
  const [message, setMessage] = useState('')

  // Teachers can write to the groups they lead; admins to any group of an active course.
  const allowed = sessions.filter(
    (s) => isGroup(s) && !getCourse(s.courseId).archived && (role === 'admin' || s.teacherId === INSTRUCTOR_ID),
  )
  const groupCourseIds = Array.from(new Set(allowed.map((s) => s.courseId)))
  const activeGroupCourse = groupCourseIds.includes(groupCourse) ? groupCourse : (groupCourseIds[0] ?? '')
  const groupsOfCourse = allowed.filter((s) => s.courseId === activeGroupCourse)
  const activeGroup = groupsOfCourse.find((g) => g.id === groupId) ?? groupsOfCourse[0]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (scope === 'group') {
      if (!activeGroup) return
      addNotice({ title: title.trim(), body: body.trim(), scope, courseId: activeGroup.courseId, sessionId: activeGroup.id })
      setMessage(`Notice sent to ${groupTaken(activeGroup)} students in ${groupName(activeGroup)}.`)
    } else {
      addNotice({ title: title.trim(), body: body.trim(), scope, courseId: scope === 'course' ? courseId : undefined })
      setMessage('Notice published.')
    }
    setTitle('')
    setBody('')
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
        <div>
          <label htmlFor={ids.scope} className="mb-1 block font-medium">Audience</label>
          <select id={ids.scope} className={field} value={scope} onChange={(e) => setScope(e.target.value as NoticeScope)}>
            <option value="institution">Whole institution</option>
            <option value="department">Department</option>
            <option value="course">One course</option>
            <option value="group">One practical group</option>
          </select>
        </div>
        {scope === 'course' && (
          <div>
            <label htmlFor={ids.course} className="mb-1 block font-medium">Course</label>
            <select id={ids.course} className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.code} {c.name}</option>
              ))}
            </select>
          </div>
        )}
        {scope === 'group' &&
          (groupCourseIds.length === 0 ? (
            <p className="text-ink-soft">You do not lead any practical group.</p>
          ) : (
            <>
              <div>
                <label htmlFor={ids.gcourse} className="mb-1 block font-medium">Course</label>
                <select id={ids.gcourse} className={field} value={activeGroupCourse} onChange={(e) => setGroupCourse(e.target.value)}>
                  {groupCourseIds.map((id) => (
                    <option key={id} value={id}>{getCourse(id).code} {getCourse(id).name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={ids.group} className="mb-1 block font-medium">Practical group</label>
                <select id={ids.group} className={field} value={activeGroup?.id ?? ''} onChange={(e) => setGroupId(e.target.value)}>
                  {groupsOfCourse.map((g) => (
                    <option key={g.id} value={g.id}>{groupName(g)}, {g.day} {g.start}-{g.end}</option>
                  ))}
                </select>
                {activeGroup && <p className="mt-1 text-sm text-ink-soft">Only the {groupTaken(activeGroup)} students in this group will receive it.</p>}
              </div>
            </>
          ))}
        <Button type="submit" disabled={!title.trim() || !body.trim() || (scope === 'group' && !activeGroup)}>Publish notice</Button>
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">{message}</p>
      </form>
    </Panel>
  )
}
