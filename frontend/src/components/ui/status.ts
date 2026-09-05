/**
 * One vocabulary for every status the app shows.
 *
 * Colour and wording used to be decided at each call site, so the same delivery status appeared as a
 * grey chip on one screen and a coloured badge on the next, and a boolean `active` was rendered using
 * the payrun word "Cancelled".
 */
export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'purple' | 'teal'

export const STATUS_TONES: Record<string, Tone> = {
  // Settled and healthy
  PRESENT: 'ok', APPROVED: 'ok', PAID: 'ok', RUNNING: 'ok', ACTIVE: 'ok', UP: 'ok', ALLOW: 'ok', RESOLVED: 'ok',
  // Needs someone to act
  LATE: 'warn', PENDING: 'warn', WARNING: 'warn', DRAFT: 'warn', NEEDS_ATTENTION: 'warn', DEGRADED: 'warn',
  OPEN: 'warn', MISSING_CHECKOUT: 'warn', NOT_SENT: 'warn',
  // Wrong, refused or stopped
  ABSENT: 'bad', REFUSED: 'bad', BLOCKER: 'bad', CANCELLED: 'bad', FAILED: 'bad', DENY: 'bad', DOWN: 'bad',
  EXPIRED: 'bad', INACTIVE: 'bad',
  // In progress
  OVERTIME: 'purple', COMPUTED: 'purple', OVERRIDDEN: 'purple',
  SENT: 'teal', VALIDATED: 'teal', QUEUED: 'teal', SKIPPED: 'neutral',
}

/** What each status means, shown as a tooltip on the badge and listed in a legend. */
export const STATUS_DESCRIPTIONS: Record<string, string> = {
  PRESENT: 'Checked in and out within the scheduled hours.',
  LATE: 'Checked in after the scheduled start plus the grace period. The day still counts as worked.',
  ABSENT: 'A scheduled working day with no check-in, found by the nightly sweep.',
  OVERTIME: 'Worked beyond the scheduled day by more than the threshold. The excess feeds payroll.',
  MISSING_CHECKOUT: 'Checked in but never checked out, so the day counts as no worked time until it is resolved.',
  OPEN: 'Nobody has dealt with this yet.',
  RESOLVED: 'Someone reviewed this and recorded why it was acceptable.',
  OVERRIDDEN: 'Accepted with a written reason, and the reason is on the audit trail.',

  DRAFT: 'Created but not yet in force.',
  PENDING: 'Waiting for a decision.',
  NEEDS_ATTENTION: 'Submitted, but something does not add up. Open it to see what.',
  APPROVED: 'Agreed and in effect.',
  REFUSED: 'Declined, with the reason recorded.',
  CANCELLED: 'Withdrawn. It no longer counts for anything.',

  RUNNING: 'Currently in force.',
  EXPIRED: 'Its end date has passed.',
  ACTIVE: 'In use.',
  INACTIVE: 'Kept for the record, but not used by anything new.',

  COMPUTED: 'Payslips have been calculated but not yet checked.',
  VALIDATED: 'Checked and cleared for payment.',
  PAID: 'Marked as paid.',
  SENT: 'Payslips have been emailed.',
  QUEUED: 'Waiting to be sent.',
  NOT_SENT: 'No payslip has been emailed yet.',
  FAILED: 'The email could not be delivered.',
  SKIPPED: 'Not attempted, usually because there is no address to send to.',

  BLOCKER: 'Must be fixed or explicitly overridden before payment.',
  WARNING: 'Worth a look, but it does not stop payment.',

  ALLOW: 'The action was permitted.',
  DENY: 'The action was refused.',
  UP: 'Responding normally.',
  DEGRADED: 'Responding, but not fully healthy.',
  DOWN: 'Not responding.',
}

export function toneFor(status: string): Tone {
  return STATUS_TONES[status] ?? 'neutral'
}

export function describeStatus(status: string): string | undefined {
  return STATUS_DESCRIPTIONS[status]
}

/** Legend entries for a given set of statuses, in the order given. */
export function legendFor(statuses: string[]) {
  return statuses.map((status) => ({ status, description: STATUS_DESCRIPTIONS[status] ?? '' }))
}
