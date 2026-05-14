'use client';

import { useMemo } from 'react';
import Input from '@/components/ui/Input';
import { IconCalendar } from '@/components/icons';
import type { FeedItemStatus } from '@/types';

/**
 * Date + time picker for the composer drawer's scheduling toggle.
 *
 * Two `<input>`s (native `date` + `time`) because they give us free
 * platform-native pickers + correct mobile keyboards. The combined
 * value is mirrored to the parent as an ISO timestamp.
 *
 *   - Validates against past dates client-side; the server runs the
 *     same check on POST/PATCH and 400s with `schedule_in_past`,
 *     so the UI gate is just a quality-of-life thing.
 *   - Surfaces the platform timezone label so the admin sees the
 *     timezone the system will publish in.
 *
 * Layout-agnostic — caller owns the row/column wrapping and the
 * radio toggle that switches "publicar agora" vs "agendar". The
 * scheduler itself just renders the two inputs + the helper line.
 */

interface Props {
  /** ISO timestamp or null. Null = not scheduled. */
  value: string | null;
  onChange: (next: string | null) => void;
  /** Used to apply the danger style + show the helper text. */
  status?: FeedItemStatus | null;
  disabled?: boolean;
}

function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  // Format as LOCAL date/time strings so the inputs round-trip
  // without a UTC drift surprise.
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

function combineToIso(date: string, time: string): string | null {
  if (!date) return null;
  const safeTime = time || '09:00';
  // Local time → ISO. The browser interprets `2026-05-14T09:00` as
  // local; `.toISOString()` then normalizes to UTC for storage.
  const local = new Date(`${date}T${safeTime}`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export default function FeedScheduler({ value, onChange, disabled }: Props) {
  const { date, time } = useMemo(() => splitIso(value), [value]);

  // Today (local) as YYYY-MM-DD — used as the input's `min` so the
  // native picker blocks past dates from the calendar UI.
  const today = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const inPast = useMemo(() => {
    if (!value) return false;
    return new Date(value).getTime() <= Date.now();
  }, [value]);

  // Resolve the user's IANA timezone label for the helper text. SSR
  // safety: Intl is available on the server too, so this is fine.
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'local';
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <Input
          type="date"
          inputSize="md"
          min={today}
          value={date}
          disabled={disabled}
          onChange={(e) => onChange(combineToIso(e.target.value, time))}
          leadingIcon={<IconCalendar size={14} />}
          invalid={inPast}
          aria-label="Data"
        />
        <Input
          type="time"
          inputSize="md"
          value={time}
          disabled={disabled || !date}
          onChange={(e) => onChange(combineToIso(date, e.target.value))}
          aria-label="Horário"
        />
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: inPast ? 'var(--danger)' : 'var(--text-mute)',
          letterSpacing: '-0.005em',
        }}
      >
        {inPast
          ? 'A data selecionada já passou. Escolha uma data futura.'
          : `Fuso horário da plataforma: ${tz}.`}
      </div>
    </div>
  );
}
