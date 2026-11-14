import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Circle, LayoutGrid, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { FinishGroupSetting } from '../../lib/wordpressBridge';
import { validateGroupName } from '../../lib/finishesEditor';
import { Modal } from '../ds/Modal';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { TextField, fieldLabelClass } from '../ds/TextField';
import { Switch } from '../ds/Switch';
import { RadioCardGroup } from '../ds/RadioCard';

export function describeGroupSetting(s?: FinishGroupSetting): string {
  const parts = [s?.display_style === 'compact_dots' ? 'Dots' : 'Cards'];
  if (s?.collapsed_by_default) parts.push('collapsed');
  if ((s?.show_more_limit || 0) > 0) parts.push(`show ${s?.show_more_limit}`);
  return parts.join(', ');
}

const DEFAULT_SETTING: FinishGroupSetting = { display_style: 'cards', collapsed_by_default: false, show_more_limit: 0 };
const LIMIT_PRESETS = [0, 3, 4, 6, 8];

export interface FinishGroupsModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  groups: string[];
  counts: Record<string, number>;
  settings: Record<string, FinishGroupSetting>;
  /** Group whose display settings open expanded. */
  focusGroup: string | null;
  busy: boolean;
  onMove(group: string, direction: 'up' | 'down'): void;
  onAdd(name: string): Promise<boolean>;
  onDelete(group: string): void;
  onRename(oldName: string, newName: string): Promise<boolean>;
  onSaveSetting(group: string, setting: FinishGroupSetting): Promise<boolean>;
}

export function FinishGroupsModal({
  open,
  onOpenChange,
  groups,
  counts,
  settings,
  focusGroup,
  busy,
  onMove,
  onAdd,
  onDelete,
  onRename,
  onSaveSetting,
}: FinishGroupsModalProps) {
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ group: string; value: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [setting, setSetting] = useState<FinishGroupSetting>(DEFAULT_SETTING);
  const [error, setError] = useState<string | null>(null);

  const openSettings = (g: string | null) => {
    setExpanded(g);
    setSetting(g ? { ...DEFAULT_SETTING, ...settings[g] } : DEFAULT_SETTING);
  };

  useEffect(() => {
    if (!open) return;
    setNewName('');
    setRenaming(null);
    setError(null);
    openSettings(focusGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusGroup]);

  const submitAdd = async () => {
    const msg = validateGroupName(newName, groups);
    if (msg) return setError(msg);
    setError(null);
    if (await onAdd(newName.trim())) setNewName('');
  };

  const submitRename = async () => {
    if (!renaming) return;
    if (renaming.value.trim() === renaming.group) return setRenaming(null);
    const msg = validateGroupName(renaming.value, groups, renaming.group);
    if (msg) return setError(msg);
    setError(null);
    if (await onRename(renaming.group, renaming.value.trim())) setRenaming(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Finish groups"
      description="Order here is the tab order on every configurator."
      width={640}
      onEscapeKeyDown={(e) => {
        // Escape first cancels an open rename and keeps the pop-up.
        if (renaming) {
          e.preventDefault();
          setRenaming(null);
          setError(null);
        }
      }}
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-line rounded-[12px] border border-card-border">
        {groups.map((g, i) => {
          const count = counts[g] || 0;
          const isRenaming = renaming?.group === g;
          return (
            <li key={g} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                {isRenaming ? (
                  <TextField
                    autoFocus
                    aria-label={`New name for ${g}`}
                    className="min-w-0 flex-1"
                    value={renaming.value}
                    onChange={(e) => setRenaming({ group: g, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitRename();
                    }}
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-fg">{g}</div>
                    <div className="text-[12px] text-faint">
                      {count} {count === 1 ? 'finish' : 'finishes'} · {describeGroupSetting(settings[g])}
                    </div>
                  </div>
                )}
                {isRenaming ? (
                  <>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void submitRename()}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <IconButton size="sm" variant="ghost" icon={ChevronUp} label={`Move ${g} up`} disabled={busy || i === 0} onClick={() => onMove(g, 'up')} />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={ChevronDown}
                      label={`Move ${g} down`}
                      disabled={busy || i === groups.length - 1}
                      onClick={() => onMove(g, 'down')}
                    />
                    <IconButton size="sm" variant="ghost" icon={Pencil} label={`Rename ${g}`} disabled={busy} onClick={() => setRenaming({ group: g, value: g })} />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={SlidersHorizontal}
                      label={`Display settings for ${g}`}
                      aria-expanded={expanded === g}
                      onClick={() => openSettings(expanded === g ? null : g)}
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      label={count > 0 ? `${g} has ${count} ${count === 1 ? 'finish' : 'finishes'}; move them first` : `Delete ${g}`}
                      disabled={busy || count > 0}
                      onClick={() => onDelete(g)}
                    />
                  </>
                )}
              </div>

              {expanded === g && (
                <div className="mt-3 flex flex-col gap-3.5 rounded-[10px] bg-chip p-3.5">
                  <RadioCardGroup
                    aria-label={`Display style for ${g}`}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    value={setting.display_style === 'compact_dots' ? 'compact_dots' : 'cards'}
                    onChange={(v) => setSetting((s) => ({ ...s, display_style: v as FinishGroupSetting['display_style'] }))}
                    options={[
                      { value: 'cards', icon: LayoutGrid, title: 'Cards', description: 'Texture card with the name' },
                      { value: 'compact_dots', icon: Circle, title: 'Dots', description: 'Round swatches, name in the header' },
                    ]}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[13.5px] text-fg">Collapsed by default</div>
                      <div className="text-[12px] text-faint">Shoppers open the group to see it.</div>
                    </div>
                    <Switch
                      aria-label="Collapsed by default"
                      checked={Boolean(setting.collapsed_by_default)}
                      onCheckedChange={(v) => setSetting((s) => ({ ...s, collapsed_by_default: v }))}
                    />
                  </div>
                  <div>
                    <span className={fieldLabelClass}>Show more after</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {LIMIT_PRESETS.map((n) => (
                        <Button
                          key={n}
                          size="sm"
                          variant={(setting.show_more_limit || 0) === n ? 'primary' : 'secondary'}
                          aria-pressed={(setting.show_more_limit || 0) === n}
                          onClick={() => setSetting((s) => ({ ...s, show_more_limit: n }))}
                        >
                          {n === 0 ? 'Show all' : n}
                        </Button>
                      ))}
                      <TextField
                        aria-label="Custom number of swatches before show more"
                        type="number"
                        min={0}
                        max={100}
                        mono
                        className="w-24"
                        value={setting.show_more_limit ? String(setting.show_more_limit) : ''}
                        placeholder="Custom"
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setSetting((s) => ({ ...s, show_more_limit: Number.isNaN(n) || n <= 0 ? 0 : n }));
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-faint">Extra swatches hide behind a "+N more" button on the storefront.</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openSettings(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={async () => {
                        if (await onSaveSetting(g, setting)) openSettings(null);
                      }}
                    >
                      Save display
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-end gap-2">
        <TextField
          label="New group"
          className="min-w-0 flex-1"
          value={newName}
          placeholder="e.g. Wood series"
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitAdd();
          }}
        />
        <Button icon={Plus} disabled={busy || !newName.trim()} onClick={() => void submitAdd()}>
          Add group
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-st-stop-fg">
          {error}
        </p>
      )}
    </Modal>
  );
}
