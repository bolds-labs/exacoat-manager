import { useState, type ReactNode } from 'react';
import { ChevronDown, Crop, Layers, Maximize2, PenLine, Scissors, Shield, Square } from 'lucide-react';
import { RadioCardGroup } from '../../ds/RadioCard';
import { Select } from '../../ds/Select';
import { Button } from '../../ds/Button';
import { formatCurrency } from '../../../lib/formatters';
import {
  choiceAvailabilityTag,
  findChoice,
  getWebstoreOptions,
  groupedLayerChoices,
  interactiveLayers,
  isChoiceSelectable,
  isLayerOptional,
  isLogoCutoutDisabledByFinish,
  selectedBackChoice,
  type OptionKey,
  type Selection,
  type WebstoreChoice,
  type WebstoreConfigurator,
  type WebstoreLayer,
} from '../../../lib/webstoreConfigurator';

export interface ConfigurationEditorProps {
  data: WebstoreConfigurator;
  selection: Selection;
  onChange(next: Selection): void;
  currency: string;
}

const tagClass = 'rounded-md bg-chip px-[7px] py-px text-[11.5px] font-medium text-muted';

export function priceLabel(amount: number, currency: string): string {
  if (!amount) return '';
  return `${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount), currency)}`;
}

/** Layers, finishes and options exactly as exacoat.com offers them for this product. */
export function ConfigurationEditor({ data, selection, onChange, currency }: ConfigurationEditorProps) {
  const layers = interactiveLayers(data);
  const options = getWebstoreOptions(data);
  const div = 10 ** (data.currencyMinorUnit || 0);
  const [openLayerId, setOpenLayerId] = useState<number | null>(() => {
    const firstEmpty = layers.find((l) => !isLayerOptional(data, l) && selection.layers[l.id] === null);
    return (firstEmpty || layers[0])?.id ?? null;
  });

  // Any pick (or removal) replaces a saved value that is not available any more.
  const setLayer = (layerId: number, choiceId: number | null) =>
    onChange({
      ...selection,
      layers: { ...selection.layers, [layerId]: choiceId },
      unavailable: selection.unavailable.filter((u) => u.layerId !== layerId),
    });

  const base = layers[0];
  const baseChosen = Boolean(
    base && (selection.layers[base.id] !== null || selection.unavailable.some((u) => u.layerId === base.id)),
  );
  const backChoice = selectedBackChoice(data, selection);
  const isUnset = (k: OptionKey) => selection.unset.includes(k);
  const setOption = (k: OptionKey, patch: Partial<Selection>) =>
    onChange({ ...selection, ...patch, unset: selection.unset.filter((u) => u !== k) });
  const notRecorded = <p className="mt-1.5 text-[12px] text-faint">Not recorded on this item. Pick one to save it.</p>;
  const logoForcedOff = isLogoCutoutDisabledByFinish(data, backChoice);

  return (
    <div className="flex flex-col gap-2.5">
      {options.variants.map((v) => {
        const old = selection.unavailable.find((u) => u.variantId === v.id);
        return (
          <div key={v.id}>
            <Select
              label={v.name}
              value={selection.variants[v.id] || ''}
              onChange={(optId) =>
                onChange({
                  ...selection,
                  variants: { ...selection.variants, [v.id]: optId },
                  unavailable: selection.unavailable.filter((u) => u.variantId !== v.id),
                })
              }
              options={v.options.map((o) => ({
                value: o.id,
                label: `${o.name}${o.price_diff ? ` (${priceLabel(o.price_diff / div, currency)})` : ''}`,
              }))}
            />
            {old && (
              <p className="mt-1 text-[12px] text-st-wait-fg">
                Saved as {old.spec.value}, not available any more. Pick an option to replace it.
              </p>
            )}
          </div>
        );
      })}

      {layers.map((layer, idx) => (
        <LayerSection
          key={layer.id}
          data={data}
          layer={layer}
          isBase={idx === 0}
          selection={selection}
          currency={currency}
          isOpen={openLayerId === layer.id}
          onToggle={() => setOpenLayerId(openLayerId === layer.id ? null : layer.id)}
          onPick={(choiceId) => setLayer(layer.id, choiceId)}
        />
      ))}

      {options.coverage.offered && baseChosen && (
        <OptionBlock title="Coverage" icon={Shield}>
          <RadioCardGroup
            aria-label="Coverage"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            value={isUnset('coverage') ? '' : selection.coverage}
            onChange={(v) => setOption('coverage', { coverage: v as Selection['coverage'] })}
            options={[
              { value: 'model_cut', icon: Crop, title: 'Model Cut', description: 'Back only' },
              {
                value: 'model_360',
                icon: Maximize2,
                title: 'Model 360°',
                description: options.coverage.model360Price
                  ? `Full wrap, ${priceLabel(options.coverage.model360Price, currency)}`
                  : 'Full wrap',
              },
            ]}
          />
          {isUnset('coverage') && notRecorded}
        </OptionBlock>
      )}

      {options.logo.offered && baseChosen && (
        <OptionBlock title="Logo cutout" icon={Scissors}>
          <RadioCardGroup
            aria-label="Logo cutout"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            value={isUnset('logo') ? '' : !logoForcedOff && selection.logoCutout ? 'with' : 'without'}
            onChange={(v) => setOption('logo', { logoCutout: v === 'with' })}
            options={[
              { value: 'with', icon: Scissors, title: 'With Logo Cutout', disabled: logoForcedOff },
              { value: 'without', icon: Square, title: 'No Logo Cutout' },
            ]}
          />
          {logoForcedOff && backChoice && (
            <p className="mt-1.5 text-[12px] text-faint">The webstore does not offer a logo cutout with {backChoice.name}.</p>
          )}
          {isUnset('logo') && notRecorded}
        </OptionBlock>
      )}

      {options.pencil.offered && (
        <OptionBlock title={options.pencil.label} icon={PenLine}>
          <RadioCardGroup
            aria-label={options.pencil.label}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            value={isUnset('pencil') ? '' : selection.pencilCutout ? 'with' : 'without'}
            onChange={(v) => setOption('pencil', { pencilCutout: v === 'with' })}
            options={[
              { value: 'with', icon: Scissors, title: `With ${options.pencil.label}` },
              { value: 'without', icon: Square, title: `Without ${options.pencil.label}` },
            ]}
          />
          {isUnset('pencil') && notRecorded}
        </OptionBlock>
      )}

      {!baseChosen && base && (options.coverage.offered || options.logo.offered) && (
        <p className="text-[12px] text-faint">
          Coverage and logo cutout apply to the {base.name} skin. Choose a {base.name} finish to set them.
        </p>
      )}
    </div>
  );
}

function OptionBlock({ title, icon: Icon, children }: { title: string; icon: typeof Layers; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Icon className="h-[15px] w-[15px] text-faint" strokeWidth={1.8} aria-hidden />
        {title}
      </div>
      {children}
    </div>
  );
}

interface LayerSectionProps {
  data: WebstoreConfigurator;
  layer: WebstoreLayer;
  isBase: boolean;
  selection: Selection;
  currency: string;
  isOpen: boolean;
  onToggle(): void;
  onPick(choiceId: number | null): void;
}

function LayerSection({ data, layer, isBase, selection, currency, isOpen, onToggle, onPick }: LayerSectionProps) {
  const optional = isLayerOptional(data, layer);
  const chosen = findChoice(data, layer.id, selection.layers[layer.id]);
  const old = selection.unavailable.find((u) => u.layerId === layer.id);
  const div = 10 ** (data.currencyMinorUnit || 0);
  const groups = groupedLayerChoices(data, layer.id);
  const panelId = `layer-panel-${layer.id}`;

  let summary: ReactNode;
  if (chosen) {
    summary = (
      <span className="text-fg">
        {chosen.name}
        {chosen.extraPrice ? <span className="ml-1.5 font-mono text-muted">{priceLabel(chosen.extraPrice / div, currency)}</span> : null}
      </span>
    );
  } else if (old) {
    summary = <span className="text-st-wait-fg">{old.spec.value}, not available any more</span>;
  } else {
    summary = <span className="text-faint">{optional ? 'Not included' : 'No finish chosen'}</span>;
  }

  return (
    <div className="rounded-xl border border-card-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Swatch choice={chosen} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <b className="text-[13.5px] font-semibold text-fg">{layer.name}</b>
              {isBase && <span className={tagClass}>Required</span>}
              {optional && <span className={tagClass}>Optional</span>}
              {layer.isNonVisual && <span className={tagClass}>Kit part</span>}
            </span>
            <span className="mt-0.5 block truncate text-[12.5px]">{summary}</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 flex-none text-faint transition-transform ${isOpen ? 'rotate-180' : ''}`}
            strokeWidth={1.8}
            aria-hidden
          />
        </button>
        {optional && (chosen || old) && (
          <Button size="sm" variant="ghost" onClick={() => onPick(null)}>
            Remove
          </Button>
        )}
      </div>

      {isOpen && (
        <div id={panelId} className="flex flex-col gap-3 border-t border-line p-3">
          {groups.length === 0 && <p className="text-[12.5px] text-faint">The webstore offers no finishes for this part.</p>}
          {groups.map((g) => (
            <div key={`${g.id}-${g.name}`}>
              <div className="mb-1.5 text-[12px] text-faint">{g.name}</div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${layer.name}: ${g.name}`}>
                {g.choices.map((c) => (
                  <FinishButton
                    key={c.id}
                    choice={c}
                    selected={chosen?.id === c.id}
                    price={priceLabel((c.extraPrice || 0) / div, currency)}
                    onPick={() => onPick(c.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Swatch({ choice }: { choice: WebstoreChoice | null }) {
  const url = choice?.thumbnail?.url;
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border border-card-border bg-chip">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Layers className="h-4 w-4 text-faint" strokeWidth={1.8} aria-hidden />}
    </span>
  );
}

function FinishButton({
  choice,
  selected,
  price,
  onPick,
}: {
  choice: WebstoreChoice;
  selected: boolean;
  price: string;
  onPick(): void;
}) {
  const unavailableTag = choiceAvailabilityTag(choice);
  const selectable = isChoiceSelectable(choice);
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!selectable && !selected}
      onClick={selectable ? onPick : undefined}
      title={unavailableTag ? `${choice.name}: ${unavailableTag}` : choice.name}
      className={`flex h-[38px] items-center gap-2 rounded-[9px] border pl-1.5 pr-2.5 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? 'border-accent-border bg-accent-soft text-fg' : 'border-field-border bg-field text-fg hover:bg-chip'
      }`}
    >
      <span className="h-6 w-6 flex-none overflow-hidden rounded-full border border-card-border bg-chip">
        {choice.thumbnail?.url && <img src={choice.thumbnail.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </span>
      <span className="font-medium">{choice.name}</span>
      {price && <span className="font-mono text-[11.5px] text-muted">{price}</span>}
      {unavailableTag && <span className={tagClass}>{unavailableTag}</span>}
      {!unavailableTag && choice.badgeText && <span className={tagClass}>{choice.badgeText}</span>}
    </button>
  );
}
