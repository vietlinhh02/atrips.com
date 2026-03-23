'use client';

import { useCallback, useState } from 'react';
import { Check, X } from '@phosphor-icons/react';
import tripService from '@/src/services/tripService';
import { toast } from '@/src/components/ui/use-toast';

interface ActivityEditorProps {
  tripId: string;
  activityId: string;
  initial: {
    name: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    estimatedCost?: number;
    currency?: string;
    notes?: string;
  };
  onSave: (updated: ActivityEditorProps['initial']) => void;
  onCancel: () => void;
}

export default function ActivityEditor({
  tripId,
  activityId,
  initial,
  onSave,
  onCancel,
}: ActivityEditorProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await tripService.updateActivity(tripId, activityId, {
        name: form.name,
        description: form.description || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        notes: form.notes || undefined,
      });
      onSave(form);
      toast.success('Activity updated');
    } catch {
      toast.error('Failed to update activity');
    } finally {
      setSaving(false);
    }
  }, [form, tripId, activityId, onSave]);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--primary-main)] bg-[var(--primary-surface)] p-3">
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        placeholder="Activity name"
      />

      <div className="flex gap-2">
        <input
          type="time"
          value={form.startTime || ''}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        />
        <input
          type="time"
          value={form.endTime || ''}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        />
      </div>

      <textarea
        value={form.description || ''}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        rows={2}
        placeholder="Description"
      />

      <input
        type="number"
        value={form.estimatedCost ?? ''}
        onChange={(e) =>
          setForm({
            ...form,
            estimatedCost: e.target.value ? Number(e.target.value) : undefined,
          })
        }
        className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        placeholder="Estimated cost"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-md bg-[var(--primary-main)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Check size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
