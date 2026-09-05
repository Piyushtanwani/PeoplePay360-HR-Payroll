import * as React from 'react'
import { useFormulaHelp, useSaveRule } from '@/api/hooks'
import { COMPUTE_TYPE_OPTIONS, RULE_CATEGORY_OPTIONS } from '@/api/constants'
import { Button, Callout, Chip, Field, MoneyInput, NumberInput, SegmentedControl, Select, Sheet, TextArea, TextInput } from '@/components/ui'
import { errorText } from '@/api/mutation'
import type { ComputeType, RuleCategory, SalaryRule, SalaryStructure } from '@/api/types'

/**
 * One rule of a salary structure.
 *
 * A rule may read any rule that runs before it and none that runs after, which is why the sequence and
 * the base-rule choice are presented together and the picker offers only earlier rules.
 */
export function RuleSheet({ open, onOpenChange, structure, rule }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  structure: SalaryStructure
  rule: SalaryRule | null
}) {
  const save = useSaveRule(structure.id, () => onOpenChange(false))
  const help = useFormulaHelp(open)

  const nextSequence = Math.max(0, ...structure.rules.map((r) => r.sequence)) + 10
  const empty = {
    name: '',
    code: '',
    category: 'ALLOWANCE' as RuleCategory,
    sequence: nextSequence,
    computeType: 'FIXED' as ComputeType,
    fixedAmount: null as number | null,
    percentage: null as number | null,
    baseRuleCode: null as string | null,
    formula: '',
    description: '',
  }
  const [form, setForm] = React.useState(empty)

  React.useEffect(() => {
    if (!open) return
    setForm(
      rule
        ? {
            name: rule.name,
            code: rule.code,
            category: rule.category,
            sequence: rule.sequence,
            computeType: rule.computeType,
            fixedAmount: rule.fixedAmount,
            percentage: rule.percentage,
            baseRuleCode: rule.baseRuleCode,
            formula: rule.formula ?? '',
            description: rule.description ?? '',
          }
        : { ...empty, sequence: nextSequence },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const earlierRules = structure.rules.filter((r) => r.sequence < form.sequence && r.id !== rule?.id)
  const valid =
    form.name.trim() &&
    form.code.trim() &&
    (form.computeType === 'FIXED'
      ? form.fixedAmount !== null
      : form.computeType === 'PERCENTAGE'
        ? form.percentage !== null && form.baseRuleCode
        : form.formula.trim().length > 0)

  const insertToken = (token: string) => set('formula', `${form.formula}${form.formula.endsWith(' ') || !form.formula ? '' : ' '}${token}`)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={rule ? `Edit ${rule.name}` : 'New rule'}
      description={`Runs as part of ${structure.name}. Rules execute in sequence, and each can use the results above it.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              save.mutate({
                ruleId: rule?.id ?? null,
                body: {
                  name: form.name.trim(),
                  code: form.code.trim().toUpperCase(),
                  category: form.category,
                  sequence: form.sequence,
                  computeType: form.computeType,
                  fixedAmount: form.computeType === 'FIXED' ? form.fixedAmount : null,
                  percentage: form.computeType === 'PERCENTAGE' ? form.percentage : null,
                  baseRuleCode: form.computeType === 'PERCENTAGE' ? form.baseRuleCode : null,
                  formula: form.computeType === 'FORMULA' ? form.formula.trim() : null,
                  description: form.description || null,
                },
              })
            }
          >
            {rule ? 'Save rule' : 'Add rule'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.isError ? <Callout tone="bad" title="Not saved">{errorText(save.error)}</Callout> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rule name" required>
            <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="House Rent Allowance" />
          </Field>
          <Field label="Code" required hint="How other rules refer to this one, as R_CODE in a formula.">
            <TextInput value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="HRA" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required hint={RULE_CATEGORY_OPTIONS.find((c) => c.value === form.category)?.description}>
            <Select value={form.category} onChange={(v) => set('category', v as RuleCategory)} options={RULE_CATEGORY_OPTIONS} />
          </Field>
          <Field label="Sequence" required hint="Lower runs first. Leave gaps so a rule can be inserted between two later.">
            <NumberInput value={form.sequence} min={1} step={10} onChange={(v) => set('sequence', v)} />
          </Field>
        </div>

        <Field label="How it is calculated" required>
          <SegmentedControl
            value={form.computeType}
            onChange={(v) => set('computeType', v as ComputeType)}
            options={COMPUTE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>

        {form.computeType === 'FIXED' ? (
          <Field label="Amount" required hint="The same figure every period, whatever the attendance.">
            <MoneyInput value={form.fixedAmount} onChange={(v) => set('fixedAmount', v)} />
          </Field>
        ) : form.computeType === 'PERCENTAGE' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Percentage" required>
              <NumberInput value={form.percentage} min={0} step={0.5} suffix="%" onChange={(v) => set('percentage', v)} />
            </Field>
            <Field
              label="Of which rule"
              required
              hint={earlierRules.length ? 'Only rules that run before this one.' : 'No earlier rule exists yet. Raise the sequence, or add the base rule first.'}
            >
              <Select
                value={form.baseRuleCode}
                onChange={(v) => set('baseRuleCode', v as string)}
                options={earlierRules.map((r) => ({
                  value: r.code,
                  label: r.name,
                  description: `${r.code} · runs at ${r.sequence}`,
                }))}
                placeholder="Select the base rule"
                emptyMessage="No earlier rules to base this on."
              />
            </Field>
          </div>
        ) : (
          <Field
            label="Formula"
            required
            hint="Checked when you save. A name that is not available at this position is refused."
          >
            <TextArea
              value={form.formula}
              onChange={(e) => set('formula', e.target.value)}
              placeholder="max(0, (R_GROSS - 25000) * 0.10)"
              className="tnum"
            />
            {help.data ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs2 text-label2">Click to insert. {help.data.example} is a worked example.</p>
                <div className="flex flex-wrap gap-1.5">
                  {help.data.variables.map((variable) => (
                    <button key={variable.name} type="button" onClick={() => insertToken(variable.name)} title={variable.description}>
                      <Chip tone="accent">{variable.name}</Chip>
                    </button>
                  ))}
                  {help.data.functions.map((fn) => (
                    <button key={fn} type="button" onClick={() => insertToken(fn.replace(/\(.*\)/, '('))}>
                      <Chip tone="teal">{fn}</Chip>
                    </button>
                  ))}
                </div>
                {earlierRules.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {earlierRules.map((r) => (
                      <button key={r.id} type="button" onClick={() => insertToken(`R_${r.code}`)} title={r.name}>
                        <Chip>R_{r.code}</Chip>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Field>
        )}

        <Field label="What this rule is for" hint="Shown to anyone reading the structure later.">
          <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}
