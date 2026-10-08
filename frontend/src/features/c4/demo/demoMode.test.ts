import { describe, expect, it } from 'vitest'
import { GROUP_SECTIONS, accessFor, sectionsFor } from '../groups/groupAccess'
import type { MyGroup, ProjectRole } from '../api/types'
import { demoGroupsFor } from './demoData'
import { isDemoMode } from './demoMode'

describe('isDemoMode', () => {
  it('is on only in the development server with the flag set to exactly "true"', () => {
    expect(isDemoMode({ DEV: true, VITE_C4_DEMO_DATA: 'true' })).toBe(true)
  })

  it('is always off in a production build, whatever the flag says', () => {
    expect(isDemoMode({ DEV: false, VITE_C4_DEMO_DATA: 'true' })).toBe(false)
    expect(isDemoMode({ VITE_C4_DEMO_DATA: 'true' })).toBe(false)
  })

  it('is off unless the flag is exactly "true"', () => {
    for (const value of [undefined, '', 'TRUE', 'True', '1', 'yes', 'on', ' true']) {
      expect(isDemoMode({ DEV: true, VITE_C4_DEMO_DATA: value })).toBe(false)
    }
  })
})

describe('demonstration data', () => {
  it('is labelled as demonstration data in every record and gives administrators nothing', () => {
    for (const group of [...demoGroupsFor('STUDENT', 'USER'), ...demoGroupsFor('STAFF', 'USER')]) {
      expect(group.projectCode).toContain('C4-DEMO')
      expect(group.title).toContain('Demonstration')
    }
    expect(demoGroupsFor('STAFF', 'ADMIN')).toEqual([])
    expect(demoGroupsFor('STUDENT', 'USER').every((group) => group.roles.join() === 'STUDENT')).toBe(true)
    expect(demoGroupsFor('STAFF', 'USER').some((group) => group.roles.includes('STUDENT'))).toBe(false)
  })

  it('is only ever loaded through a dynamic import guarded by the development flag', () => {
    // Every source file of the app, as text.
    const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
    expect(Object.keys(sources).length).toBeGreaterThan(40)

    const importers = Object.entries(sources).filter(
      ([path, source]) => !/\.test\.tsx?$/.test(path) && !path.endsWith('/demoData.ts') && source.includes('demoData'),
    )

    expect(importers.map(([path]) => path)).toEqual(['/src/features/c4/groups/MyGroupsProvider.tsx'])
    const [, source] = importers[0]
    // Never a static import, and always behind the build-time development check.
    expect(source).not.toMatch(/import\s[^;]*from\s+['"][^'"]*demoData['"]/)
    expect(source).toMatch(
      /if \(import\.meta\.env\.DEV && isDemoMode\(\)\) \{\s*const \{[^}]+\} = await import\('\.\.\/demo\/demoData'\)/,
    )
  })
})

describe('section access by role', () => {
  const groupWith = (...roles: ProjectRole[]): MyGroup => ({
    projectId: 'p',
    projectCode: 'P',
    title: 'P',
    status: 'ACTIVE',
    roles,
  })
  const labels = (...roles: ProjectRole[]) => sectionsFor(groupWith(...roles)).map((section) => section.label)

  it('offers wellbeing sections to students only', () => {
    const wellbeing = GROUP_SECTIONS.filter((section) => section.privacy !== 'none')
    expect(wellbeing.map((section) => section.label)).toEqual(['Team wellbeing', 'My wellbeing'])

    for (const section of wellbeing) {
      expect(section.allowed(accessFor(groupWith('STUDENT')))).toBe(true)
      for (const staffRole of ['SUPERVISOR', 'CO_SUPERVISOR', 'EVALUATOR'] as const) {
        expect(section.allowed(accessFor(groupWith(staffRole)))).toBe(false)
      }
      expect(section.allowed(accessFor(groupWith('SUPERVISOR', 'EVALUATOR')))).toBe(false)
      expect(section.allowed(accessFor(groupWith()))).toBe(false)
    }
  })

  it('never offers both assessment sides, and neither side to a student', () => {
    expect(labels('SUPERVISOR')).toContain('Supervisor assessment')
    expect(labels('SUPERVISOR')).not.toContain('Evaluator assessment')
    expect(labels('CO_SUPERVISOR')).toContain('Supervisor assessment')
    expect(labels('EVALUATOR')).toContain('Evaluator assessment')
    expect(labels('EVALUATOR')).not.toContain('Supervisor assessment')
    for (const combination of [['SUPERVISOR', 'EVALUATOR'], ['CO_SUPERVISOR', 'EVALUATOR'], ['STUDENT'], []] as ProjectRole[][]) {
      expect(labels(...combination).filter((label) => label.endsWith('assessment'))).toEqual([])
    }
  })

  it('offers nothing to someone with no role in the group', () => {
    expect(labels()).toEqual([])
  })

  it('defines no assessment stage, percentage or grade', () => {
    const text = JSON.stringify(GROUP_SECTIONS.map(({ label, description, path }) => ({ label, description, path })))
    expect(text).not.toMatch(/\d/)
    expect(text).not.toMatch(/grade|viva|proposal|%/i)
  })
})
