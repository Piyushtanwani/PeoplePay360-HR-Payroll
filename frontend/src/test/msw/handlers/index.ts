import { authHandlers } from './auth'
import { peopleHandlers } from './people'
import { timeHandlers } from './time'
import { payrollHandlers } from './payroll'
import { adminHandlers } from './admin'

export const handlers = [...authHandlers, ...peopleHandlers, ...timeHandlers, ...payrollHandlers, ...adminHandlers]
