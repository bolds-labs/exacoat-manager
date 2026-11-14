import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Save, Trash2, X } from 'lucide-react';
import type { GlobalFinish } from '../../lib/wordpressBridge';
import {
  draftFromFinish,
  emptyDraft,
  isDraftDirty,
  slugify,
  DEFAULT_BADGE_COLOR,
  type FinishDraft,
  type FinishStatus,
} from '../../lib/finishesEditor';
import { Drawer } from '../ds/Drawer';
import { Modal } from '../ds/Modal';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { TextField, fieldLabelClass } from '../ds/TextField';
import { Select } from '../ds/Select';
import { Switch } from '../ds/Switch';
import { MediaSlot } from './MediaSlot';

export const STOCK_OPTIONS: { value: FinishStatus; label: string }[] = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'coming_soon', label: 'Coming soon' },
];

export type MediaRole = 'thumbnail' | 'texture_url' | 'texture_big_url';

export interface FinishEditPanelProps {
  open: boolean;
  /** Finish being edited; null opens the panel in Add mode. */
  finish: GlobalFinish | null;
  groups: string[];
  defaultGroup: string;
  existingSlugs: string[];
  saving: boolean;
  /** True while a picker opened from the panel is on top; Escape or scrim clicks then leave the panel open. */
  blockClose?: boolean;
  /** The finish was removed elsewhere after the panel opened: show a notice and allow nothing but closing. */
  deleted?: boolean;
  onClose(): void;
  onSave(draft: FinishDraft): void;
  onDelete(finish: GlobalFinish): void;
  /** Opens the WordPress Media Library; the callback receives the chosen URL. */
  onBrowseMedia(role: MediaRole, current: string, apply: (url: string) => void): void;
}

const hexForColorInput = (v: string) => (/^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : DEFAULT_BADGE_COLOR);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-[18px] last:border-b-0">
      <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-faint">{title}</h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[12px] text-faint">
        <span>{label}</span>
        <span className="font-mono text-fg">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
    </label>
  );
}

function SwitchRow({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13.5px] text-fg">{label}</div>
        <div className="text-[12px] text-faint">{help}</div>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

export function FinishEditPanel({
  open,
  finish,
  groups,
  defaultGroup,
  existingSlugs,
  saving,
  blockClose = false,
  deleted = false,
  onClose,
  onSave,
  onDelete,
  onBrowseMedia,
}: FinishEditPanelProps) {
  const isCreate = finish === null;
  const [draft, setDraft] = useState<FinishDraft>(() => (finish ? draftFromFinish(finish) : emptyDraft(defaultGroup)));
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset the draft whenever the panel opens for another finish (or for Add).
  useEffect(() => {
    if (!open) return;
    setDraft(finish ? draftFromFinish(finish) : emptyDraft(defaultGroup));
    setSlugTouched(false);
    setConfirmDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, finish?.id]);

  const dirty = isDraftDirty(finish, draft);
  const set = <K extends keyof FinishDraft>(key: K, value: FinishDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const createSlug = slugify(draft.slug) || slugify(draft.name);
  const slugTaken = isCreate && createSlug !== '' && existingSlugs.includes(createSlug);
  const nameMissing = draft.name.trim() === '';
  const canSave = dirty && !saving && !deleted && !nameMissing && (!isCreate || (createSlug !== '' && !slugTaken));

  const groupOptions = useMemo(() => {
    const list = groups.includes(draft.group) || !draft.group ? groups : [...groups, draft.group];
    return list.map((g) => ({ value: g, label: g }));
  }, [groups, draft.group]);

  const requestClose = () => {
    if (dirty && !saving && !deleted) setConfirmDiscard(true);
    else onClose();
  };

  const browse = (role: MediaRole) => onBrowseMedia(role, draft[role], (url) => set(role, url));
  const shading = draft.surface_gradient_enabled ? draft.surface_gradient_opacity : 0;

  const header = (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[16px] font-semibold text-fg">{isCreate ? 'Add finish' : finish?.name}</h2>
          {dirty && (
            <span className="rounded-[7px] bg-st-act-bg px-2 py-[2px] text-[12px] font-medium text-st-act-fg">Unsaved changes</span>
          )}
        </div>
        <p className="text-[12.5px] text-faint">
          {isCreate ? 'New global finish for every configurator.' : 'Changes apply to every configurator after Save.'}
        </p>
      </div>
      <IconButton icon={X} label="Close panel" variant="ghost" onClick={requestClose} />
    </div>
  );

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!o && !blockClose) requestClose();
        }}
        header={header}
        width={600}
        label={isCreate ? 'Add finish' : `Edit finish ${finish?.name ?? ''}`}
      >
        <div className="flex min-h-full flex-col">
          <div className="flex-1">
            {deleted && (
              <p role="alert" className="mx-5 mt-4 rounded-[10px] border border-st-stop-border bg-st-stop-bg px-3.5 py-2.5 text-[13px] text-st-stop-fg">
                This finish was deleted elsewhere. Close the panel; nothing here can be saved.
              </p>
            )}
            <Section title="Basics">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Name" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Swarm" />
                {isCreate ? (
                  <TextField
                    label="Slug"
                    mono
                    value={slugTouched ? draft.slug : slugify(draft.name)}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set('slug', e.target.value);
                    }}
                    placeholder="made from the name"
                  />
                ) : (
                  <div>
                    <span className={fieldLabelClass}>Slug and CSS class</span>
                    <div className="flex h-9 items-center truncate font-mono text-[13px] text-muted">
                      {finish?.slug} · {finish?.class_name || `cfg-${finish?.slug}`}
                    </div>
                  </div>
                )}
              </div>
              {slugTaken && <p className="text-[12.5px] text-st-stop-fg">A finish with the slug "{createSlug}" already exists.</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Group" value={draft.group} options={groupOptions} onChange={(v) => set('group', v)} />
                <Select
                  label="Stock"
                  value={draft.status}
                  options={STOCK_OPTIONS}
                  onChange={(v) => set('status', v as FinishStatus)}
                />
              </div>
              <SwitchRow
                label="Show on storefront"
                help="Off keeps it for marketplace image exports only."
                checked={draft.is_active}
                onChange={(v) => set('is_active', v)}
              />
            </Section>

            <Section title="Price">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Main skin extra (Rp)"
                  type="number"
                  min={0}
                  step={5000}
                  mono
                  value={String(draft.extra_price)}
                  onChange={(e) => set('extra_price', Number(e.target.value) || 0)}
                />
                <TextField
                  label="Accent override (Rp)"
                  type="number"
                  min={0}
                  step={5000}
                  mono
                  value={String(draft.accent_extra_price)}
                  onChange={(e) => set('accent_extra_price', Number(e.target.value) || 0)}
                />
              </div>
              <p className="text-[12px] text-faint">
                Main extra applies to back and body skins. Leave the accent override at 0 to use the price tiers for camera and accent parts.
              </p>
            </Section>

            <Section title="Images">
              <MediaSlot
                label="Swatch thumbnail"
                hint="Square, 500x500"
                value={draft.thumbnail}
                onChange={(v) => set('thumbnail', v)}
                onBrowse={() => browse('thumbnail')}
              />
              <MediaSlot
                label="Master texture"
                hint="Tileable, 2000x3000"
                value={draft.texture_url}
                onChange={(v) => set('texture_url', v)}
                onBrowse={() => browse('texture_url')}
                shadingOpacity={shading}
              />
              <MediaSlot
                label="Big texture"
                hint="Laptops and tablets, optional"
                value={draft.texture_big_url}
                onChange={(v) => set('texture_big_url', v)}
                onBrowse={() => browse('texture_big_url')}
                shadingOpacity={shading}
              />
            </Section>

            <Section title="Shading tone">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Slider label="Shadow (multiply)" value={draft.shadow_opacity} min={0} max={1} step={0.05} onChange={(v) => set('shadow_opacity', v)} />
                <Slider label="Highlight (screen)" value={draft.highlight_opacity} min={0} max={1} step={0.05} onChange={(v) => set('highlight_opacity', v)} />
              </div>
              <SwitchRow
                label="Surface shading"
                help="Diagonal falloff for light skins, previewed on the textures above."
                checked={draft.surface_gradient_enabled}
                onChange={(v) => set('surface_gradient_enabled', v)}
              />
              {draft.surface_gradient_enabled && (
                <Slider
                  label="Surface shading strength"
                  value={draft.surface_gradient_opacity}
                  min={0.05}
                  max={0.6}
                  step={0.01}
                  onChange={(v) => set('surface_gradient_opacity', v)}
                />
              )}
            </Section>

            <Section title="Storefront">
              <div className="flex items-end gap-3">
                <TextField
                  label="Badge"
                  className="min-w-0 flex-1"
                  maxLength={15}
                  value={draft.badge_text}
                  placeholder="NEW, HOT"
                  onChange={(e) => set('badge_text', e.target.value)}
                />
                <label className="block">
                  <span className={fieldLabelClass}>Colour</span>
                  <input
                    type="color"
                    aria-label="Badge colour"
                    value={hexForColorInput(draft.badge_color)}
                    onChange={(e) => set('badge_color', e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-[9px] border border-field-border bg-field p-1"
                  />
                </label>
                {draft.badge_text.trim() && (
                  <span
                    className="mb-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-black"
                    style={{ backgroundColor: draft.badge_color || DEFAULT_BADGE_COLOR }}
                  >
                    {draft.badge_text.trim()}
                  </span>
                )}
              </div>
              <SwitchRow
                label="Custom per device"
                help="Only shown on devices that have their own artwork for this finish."
                checked={draft.is_custom_per_device}
                onChange={(v) => set('is_custom_per_device', v)}
              />
              <SwitchRow
                label="Disable logo cutout"
                help="For pre-printed artwork: no logo cutout on any device."
                checked={draft.disable_logo_cutout}
                onChange={(v) => set('disable_logo_cutout', v)}
              />
            </Section>
          </div>

          <footer className="sticky bottom-0 flex items-center gap-2 border-t border-line bg-panel px-5 py-3.5">
            {!isCreate && finish && (
              <Button variant="danger" icon={Trash2} onClick={() => onDelete(finish)} disabled={saving || deleted}>
                Delete
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={requestClose} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" icon={Save} disabled={!canSave} onClick={() => onSave({ ...draft, slug: isCreate ? createSlug : draft.slug })}>
                {saving ? 'Saving...' : isCreate ? 'Add finish' : 'Save'}
              </Button>
            </div>
          </footer>
        </div>
      </Drawer>

      <Modal
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">Your edits to this finish have not been saved.</p>
      </Modal>
    </>
  );
}
