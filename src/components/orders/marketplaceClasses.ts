/** Shared token class recipes for the Shopee and TikTok views and their detail drawers. */

export const channelTagClass = 'rounded-[7px] border border-line bg-chip px-2 py-0.5 text-[11.5px] font-medium text-muted';

export const copyBtnClass =
  'inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-faint transition-colors hover:bg-chip hover:text-fg cursor-pointer';

/** Item and buyer notes: act family tones so they read as something to check before packing. */
export const noteClass =
  'flex items-start gap-1.5 rounded-[8px] border border-st-act-border bg-st-act-bg px-2.5 py-1 text-[12px] text-st-act-fg';

export const sectionTitleClass = 'flex items-center gap-1.5 text-[13.5px] font-semibold text-fg';

export const fieldLabelClass = 'block text-[12px] text-faint';

/** Inset well inside an order card (items, logistics). */
export const wellClass = 'rounded-[11px] border border-line bg-panel';

/** Text input styled like the kit field; data-ds must be set on the element. */
export const fieldInputClass =
  'h-9 w-full rounded-[9px] border border-field-border bg-field text-[13px] text-fg placeholder:text-faint outline-none focus:border-accent';

/** Item in a custom popover menu (kept custom where items need a disabled state). */
export const menuItemClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-fg hover:bg-chip disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export const menuPanelClass =
  'absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-card-border bg-pop p-1.5 font-sans shadow-[0_16px_40px_rgba(0,0,0,0.35)]';
