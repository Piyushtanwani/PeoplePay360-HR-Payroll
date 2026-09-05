import { useAttendanceRules } from '@/api/hooks'
import { HelpItems, HelpPopover, Spinner, StatusLegend } from '@/components/ui'

/**
 * "How attendance is classified", read from the server rather than written out here.
 *
 * The thresholds are the ones the classifier actually applies, so this panel cannot drift from the
 * behaviour it describes.
 */
export function AttendanceHelp() {
  const rules = useAttendanceRules()

  return (
    <HelpPopover title="How attendance is classified" size="lg">
      {rules.isLoading ? (
        <p className="flex items-center gap-2"><Spinner /> Loading the current rules…</p>
      ) : rules.data ? (
        <>
          <div>
            <p className="mb-2 font-medium text-label">The five statuses</p>
            <HelpItems items={rules.data.statuses.map((s) => ({ term: s.title, text: s.detail }))} />
          </div>
          <div className="border-t border-separator pt-3">
            <p className="mb-2 font-medium text-label">Edge cases</p>
            <HelpItems items={rules.data.edgeCases.map((e) => ({ term: e.title, text: e.detail }))} />
          </div>
          <div className="border-t border-separator pt-3">
            <p className="mb-2 font-medium text-label">Current thresholds</p>
            <dl className="space-y-1 tnum">
              <div className="flex justify-between gap-4">
                <dt>Late after</dt>
                <dd className="font-medium text-label">{rules.data.lateGraceMinutes} minutes</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Overtime beyond</dt>
                <dd className="font-medium text-label">{rules.data.overtimeThresholdMinutes} minutes</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Missing check-out after</dt>
                <dd className="font-medium text-label">{rules.data.missingCheckoutAfterMinutes} minutes</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Time zone</dt>
                <dd className="font-medium text-label">{rules.data.timezone}</dd>
              </div>
            </dl>
          </div>
        </>
      ) : (
        <p>The current rules could not be loaded.</p>
      )}
    </HelpPopover>
  )
}

/** The status legend, for placing beside a table rather than in the page header. */
export function AttendanceLegend() {
  return <StatusLegend statuses={['PRESENT', 'LATE', 'OVERTIME', 'ABSENT', 'MISSING_CHECKOUT']} />
}
