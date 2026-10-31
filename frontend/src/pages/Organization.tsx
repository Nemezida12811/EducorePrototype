import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { SelectField, TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { errorMessage, saveDepartment, saveProgram } from '../data/actions'
import { useCourses, useOrgUnits, usePrograms, useTeachers } from '../data/stores'
import type { OrgUnit, StudyProgram } from '../data/types'

export function OrganizationPage() {
  const units = useOrgUnits()
  const programs = usePrograms()
  const courses = useCourses()
  const teachers = useTeachers()
  const [unitForm, setUnitForm] = useState<null | 'new' | string>(null)
  const [programForm, setProgramForm] = useState<null | 'new' | string>(null)

  const unitColumns: Column<OrgUnit>[] = [
    {
      header: 'Unit',
      rowHeader: true,
      cell: (u) => (
        <span className="block">
          {u.name}
          <span className="block text-sm font-normal text-ink-soft">{u.code}</span>
        </span>
      ),
    },
    { header: 'Courses', cell: (u) => courses.filter((c) => c.orgUnitId === u.id).length },
    { header: 'Teachers', cell: (u) => teachers.filter((t) => t.orgUnitId === u.id).length },
    { header: 'Programs', cell: (u) => programs.filter((p) => p.orgUnitId === u.id).length },
    {
      header: 'Actions',
      align: 'right',
      cell: (u) => <Button variant="secondary" onClick={() => setUnitForm(u.id)} aria-label={`Edit ${u.name}`}>Edit</Button>,
    },
  ]

  const programColumns: Column<StudyProgram>[] = [
    { header: 'Program', rowHeader: true, cell: (p) => p.name },
    { header: 'Degree', cell: (p) => p.degree },
    { header: 'Credits required', cell: (p) => p.creditsRequired },
    { header: 'Department', cell: (p) => units.find((u) => u.id === p.orgUnitId)?.code },
    { header: 'Students', cell: (p) => p.students },
    {
      header: 'Actions',
      align: 'right',
      cell: (p) => <Button variant="secondary" onClick={() => setProgramForm(p.id)} aria-label={`Edit ${p.name}`}>Edit</Button>,
    },
  ]

  return (
    <>
      <PageHeader title="Organization" description="Manage the departments and the study programs they offer." />
      <div className="flex flex-col gap-10">
        {unitForm && (
          <UnitForm key={unitForm} unit={units.find((u) => u.id === unitForm)} onDone={() => setUnitForm(null)} />
        )}
        <Panel
          title="Departments"
          flush
          action={
            <Button variant="secondary" onClick={() => setUnitForm('new')}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              New department
            </Button>
          }
        >
          <DataTable caption="Organizational units" columns={unitColumns} rows={units} getKey={(u) => u.id} />
        </Panel>

        {programForm && (
          <ProgramForm key={programForm} program={programs.find((p) => p.id === programForm)} onDone={() => setProgramForm(null)} />
        )}
        <Panel
          title="Study programs"
          flush
          action={
            <Button variant="secondary" onClick={() => setProgramForm('new')}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              New program
            </Button>
          }
        >
          <DataTable caption="Study programs" columns={programColumns} rows={programs} getKey={(p) => p.id} />
        </Panel>
      </div>
    </>
  )
}

function UnitForm({ unit, onDone }: { unit?: OrgUnit; onDone: () => void }) {
  const units = useOrgUnits()
  const [name, setName] = useState(unit?.name ?? '')
  const [code, setCode] = useState(unit?.code ?? '')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!name.trim() || !c) return setError('Name and code are required.')
    if (units.some((u) => u.code === c && u.id !== unit?.id)) return setError('Another unit already uses this code.')
    try {
      await saveDepartment(unit?.id ?? null, { name: name.trim(), code: c })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Panel title={unit ? `Edit ${unit.code}` : 'New department'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Code" value={code} onChange={setCode} hint="Short code, for example KPI" required />
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit">{unit ? 'Save changes' : 'Create department'}</Button>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}

const DEGREES = ['Bc.', 'Ing.', 'Mgr.', 'PhD.']

function ProgramForm({ program, onDone }: { program?: StudyProgram; onDone: () => void }) {
  const departments = useOrgUnits()
  const [name, setName] = useState(program?.name ?? '')
  const [degree, setDegree] = useState<string>(program?.degree ?? 'Bc.')
  const [credits, setCredits] = useState(String(program?.creditsRequired ?? 180))
  const [unit, setUnit] = useState(program?.orgUnitId ?? departments[0]?.id ?? '')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = Number(credits)
    if (!name.trim()) return setError('Name is required.')
    if (!unit) return setError('Create a department first.')
    if (!Number.isInteger(c) || c < 1 || c > 600) return setError('Required credits must be a whole number from 1 to 600.')
    try {
      await saveProgram(program?.id ?? null, { name: name.trim(), degree, creditsRequired: c, departmentId: unit })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Panel title={program ? `Edit ${program.name}` : 'New study program'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <SelectField label="Degree" value={degree} onChange={setDegree} options={DEGREES.map((d) => ({ value: d, label: d }))} />
        <TextField label="Credits required" type="number" min={1} max={600} value={credits} onChange={setCredits} />
        <SelectField label="Department" value={unit} onChange={setUnit} options={departments.map((d) => ({ value: d.id, label: `${d.code}, ${d.name}` }))} />
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit">{program ? 'Save changes' : 'Create program'}</Button>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
