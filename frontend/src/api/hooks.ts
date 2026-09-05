/**
 * Barrel for the data layer, so a screen imports from one place.
 * The hooks themselves live in `api/hooks/`, grouped by the part of the business they serve.
 */
export * from './hooks/people'
export * from './hooks/time'
export * from './hooks/payroll'
export * from './hooks/admin'
