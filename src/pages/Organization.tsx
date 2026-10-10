import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { courses, orgUnits, studyPrograms, teachers } from '../data/demo'
import type { OrgUnit, StudyProgram } from '../data/types'

const unitColumns: Column<OrgUnit>[] = [
  {
    header: 'Unit',
    rowHeader: true,
    cell: (u) => (
      <span className={u.parentId ? 'ml-5 block border-l-2 border-mauve pl-3' : 'block'}>
        {u.name}
        <span className="block text-sm font-normal text-ink-soft">{u.code}</span>
      </span>
    ),
  },
  { header: 'Courses', cell: (u) => courses.filter((c) => c.orgUnitId === u.id).length },
  { header: 'Teachers', cell: (u) => teachers.filter((t) => t.orgUnitId === u.id).length },
  { header: 'Programs', align: 'right', cell: (u) => studyPrograms.filter((p) => p.orgUnitId === u.id).length },
]

const programColumns: Column<StudyProgram>[] = [
  { header: 'Program', rowHeader: true, cell: (p) => p.name },
  { header: 'Level', cell: (p) => p.degreeLevel },
  { header: 'Duration', cell: (p) => `${p.durationYears} years` },
  { header: 'Department', cell: (p) => orgUnits.find((u) => u.id === p.orgUnitId)?.code },
  { header: 'Students', align: 'right', cell: (p) => p.students },
]

export function OrganizationPage() {
  return (
    <>
      <PageHeader title="Organization" description="Faculty structure and the study programs offered by its departments." />
      <div className="flex flex-col gap-10">
        <Panel title="Faculty and departments" flush>
          <DataTable caption="Organizational units" columns={unitColumns} rows={orgUnits} getKey={(u) => u.id} />
        </Panel>
        <Panel title="Study programs" flush>
          <DataTable caption="Study programs" columns={programColumns} rows={studyPrograms} getKey={(p) => p.id} />
        </Panel>
      </div>
    </>
  )
}
