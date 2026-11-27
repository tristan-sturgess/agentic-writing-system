// An ordered list of records: add one from a select, move it, or remove it.
// The order is the record's own order, so this is not a multiselect.

import { Button, Group, Input, Select, Stack, Text } from '@mantine/core'
import { useUncontrolled } from '@mantine/hooks'
import { useState, type FocusEventHandler, type ReactNode } from 'react'

import type { Choice } from './choices'

export function OrderedIdList({
  label,
  error,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  disabled,
  options,
  addLabel,
  removable = true,
}: {
  label: string
  error?: ReactNode
  value?: string[]
  defaultValue?: string[]
  onChange?: (value: string[]) => void
  onFocus?: FocusEventHandler<HTMLDivElement>
  onBlur?: FocusEventHandler<HTMLDivElement>
  disabled?: boolean
  options: Choice[]
  /** The add control's placeholder. Omit it to hide adding. */
  addLabel?: string
  removable?: boolean
}) {
  const [ids, setIds] = useUncontrolled({
    value,
    defaultValue,
    finalValue: [],
    onChange,
  })
  const [adding, setAdding] = useState<string | null>(null)
  const labels = new Map(options.map((option) => [option.value, option.label]))
  const available = options.filter((option) => !ids.includes(option.value))

  function update(next: string[]) {
    setIds(next)
  }

  return (
    <Input.Wrapper label={label} error={error} labelElement="div" onFocus={onFocus} onBlur={onBlur}>
      <Stack gap="xs" mt={4}>
        {ids.length === 0 && (
          <Text size="sm" c="dimmed">
            None
          </Text>
        )}
        {ids.map((id, index) => (
          <Group key={id} gap="xs" wrap="nowrap" justify="space-between">
            <Text size="sm" style={{ flex: '1 1 auto', minWidth: 0 }}>
              {index + 1}. {labels.get(id) ?? id}
            </Text>
            <Group gap={4} wrap="nowrap">
              <Button
                type="button"
                variant="default"
                size="compact-xs"
                disabled={disabled || index === 0}
                onClick={() => update(move(ids, index, index - 1))}
              >
                Up
              </Button>
              <Button
                type="button"
                variant="default"
                size="compact-xs"
                disabled={disabled || index === ids.length - 1}
                onClick={() => update(move(ids, index, index + 1))}
              >
                Down
              </Button>
              {removable && (
                <Button
                  type="button"
                  variant="subtle"
                  color="red"
                  size="compact-xs"
                  disabled={disabled}
                  onClick={() => update(ids.filter((item) => item !== id))}
                >
                  Remove
                </Button>
              )}
            </Group>
          </Group>
        ))}
        {addLabel && (
          <Select
            aria-label={addLabel}
            placeholder={addLabel}
            data={available}
            value={adding}
            disabled={disabled || available.length === 0}
            searchable
            clearable
            nothingFoundMessage="None left"
            onChange={(next) => {
              setAdding(null)
              if (next) update([...ids, next])
            }}
          />
        )}
      </Stack>
    </Input.Wrapper>
  )
}

function move(ids: string[], from: number, to: number): string[] {
  const next = [...ids]
  const [item] = next.splice(from, 1)
  if (item == null) return ids
  next.splice(to, 0, item)
  return next
}
