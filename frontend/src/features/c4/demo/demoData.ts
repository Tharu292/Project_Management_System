// DEVELOPMENT-ONLY DEMONSTRATION DATA.
//
// Nothing here is real: no real group, person, score or mark. It is loaded
// only through a dynamic import behind `import.meta.env.DEV`, so a production
// build does not contain this file. Never import it statically.

import type { AccountType, SystemRole } from '../../../auth/types'
import type { MyGroup } from '../api/types'

/** Appears in every demonstration record, so it is obvious on screen and easy to search a build for. */
export const DEMO_MARKER = 'C4-DEMO'

const DEMO_GROUP_A = '00000000-0000-4000-8000-00000000000a'
const DEMO_GROUP_B = '00000000-0000-4000-8000-00000000000b'

export function demoGroupsFor(accountType: AccountType, systemRole: SystemRole): MyGroup[] {
  if (systemRole === 'ADMIN') {
    return []
  }
  if (accountType === 'STUDENT') {
    return [
      {
        projectId: DEMO_GROUP_A,
        projectCode: `${DEMO_MARKER}-A`,
        title: 'Demonstration group A',
        status: 'ACTIVE',
        roles: ['STUDENT'],
      },
    ]
  }
  return [
    {
      projectId: DEMO_GROUP_A,
      projectCode: `${DEMO_MARKER}-A`,
      title: 'Demonstration group A',
      status: 'ACTIVE',
      roles: ['SUPERVISOR'],
    },
    {
      projectId: DEMO_GROUP_B,
      projectCode: `${DEMO_MARKER}-B`,
      title: 'Demonstration group B',
      status: 'ACTIVE',
      roles: ['EVALUATOR'],
    },
  ]
}
