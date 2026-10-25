import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { SelectField, TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { orgUnitsStore, programsStore, useCourses, useOrgUnits, usePrograms, useTeachers } from '../data/stores'
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
        <span className={u.parentId ? 'ml-5 block border-l-2 border-mauve pl-3' : 'block'}>
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
    { header: 'Level', cell: (p) => p.degreeLevel },
    { header: 'Duration', cell: (p) => `${p.durationYears} years` },
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
      <PageHeader title="Organization" description="Manage the faculty's departments and the study programs they offer. Changes reset on reload." />
      <div className="flex flex-col gap-10">
        {unitForm && (
          <UnitForm key={unitForm} unit={units.find((u) => u.id === unitForm)} onDone={() => setUnitForm(null)} />
        )}
        <Panel
          title="Faculty and departments"
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!name.trim() || !c) return setError('Name and code are required.')
    if (units.some((u) => u.code === c && u.id !== unit?.id)) return setError('Another unit already uses this code.')
    if (unit) orgUnitsStore.set((prev) => prev.map((u) => (u.id === unit.id ? { ...u, name: name.trim(), code: c } : u)))
    else orgUnitsStore.set((prev) => [...prev, { id: `ou-${Date.now()}`, name: name.trim(), code: c, parentId: 'fei' }])
    onDone()
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

function ProgramForm({ program, onDone }: { program?: StudyProgram; onDone: () => void }) {
  const departments = useOrgUnits().filter((u) => u.parentId !== null)
  const [name, setName] = useState(program?.name ?? '')
  const [level, setLevel] = useState<string>(program?.degreeLevel ?? 'Bachelor')
  const [years, setYears] = useState(String(program?.durationYears ?? 3))
  const [unit, setUnit] = useState(program?.orgUnitId ?? departments[0].id)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const y = Number(years)
    if (!name.trim()) return setError('Name is required.')
    if (!Number.isInteger(y) || y < 1 || y > 6) return setError('Duration must be 1 to 6 years.')
    const values = { name: name.trim(), degreeLevel: level as StudyProgram['degreeLevel'], durationYears: y, orgUnitId: unit }
    if (program) programsStore.set((prev) => prev.map((p) => (p.id === program.id ? { ...p, ...values } : p)))
    else programsStore.set((prev) => [...prev, { ...values, id: `sp-${Date.now()}`, students: 0 }])
    onDone()
  }

  return (
    <Panel title={program ? `Edit ${program.name}` : 'New study program'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <SelectField label="Degree level" value={level} onChange={setLevel} options={[{ value: 'Bachelor', label: 'Bachelor' }, { value: 'Master', label: 'Master' }]} />
        <TextField label="Duration (years)" type="number" min={1} max={6} value={years} onChange={setYears} />
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
