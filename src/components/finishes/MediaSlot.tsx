import { ExternalLink, FolderOpen, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { TextField } from '../ds/TextField';

export interface MediaSlotProps {
  label: string;
  hint: string;
  value: string;
  onChange(url: string): void;
  onBrowse(): void;
  /** Diagonal surface shading preview drawn over the image (0 hides it). */
  shadingOpacity?: number;
}

function shadingGradient(o: number) {
  return `linear-gradient(135deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,${(o * 0.35).toFixed(3)}) 55%, rgba(0,0,0,${(o * 0.75).toFixed(3)}) 80%, rgba(0,0,0,${o.toFixed(3)}) 100%)`;
}

/** One image role of a finish: preview, URL, Media Library picker, clear and open. */
export function MediaSlot({ label, hint, value, onChange, onBrowse, shadingOpacity = 0 }: MediaSlotProps) {
  const url = value.trim();
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onBrowse}
        aria-label={`Choose ${label.toLowerCase()} from the Media Library`}
        className="relative grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-[10px] border border-field-border bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {url ? (
          <>
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.visibility = 'hidden';
              }}
              onLoad={(e) => {
                (e.target as HTMLElement).style.visibility = 'visible';
              }}
            />
            {shadingOpacity > 0 && (
              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: shadingGradient(shadingOpacity) }} />
            )}
          </>
        ) : (
          <ImageIcon className="h-4 w-4 text-faint" strokeWidth={1.8} aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-medium text-fg">{label}</span>
          <span className="truncate text-[12px] text-faint">{hint}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TextField
            mono
            className="min-w-0 flex-1"
            value={value}
            placeholder="https://"
            aria-label={`${label} URL`}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button icon={FolderOpen} onClick={onBrowse}>
            Browse
          </Button>
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${label.toLowerCase()} in a new tab`}
                title="Open in a new tab"
                className="grid h-9 w-9 flex-none place-items-center rounded-[9px] border border-transparent text-muted hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ExternalLink className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
              </a>
              <IconButton icon={X} label={`Clear ${label.toLowerCase()}`} variant="ghost" onClick={() => onChange('')} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
