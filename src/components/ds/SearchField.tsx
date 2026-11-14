import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes, type MouseEvent } from 'react';
import { Search } from 'lucide-react';
import { controlClass } from './TextField';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder: string;
  shortcut?: string;
}

/**
 * Search input in a field wrapper. Clicks anywhere on the wrapper (icon, shortcut chip, padding)
 * focus the input and reach `onClick`, so a read-only trigger such as the header palette opener
 * works across the whole control.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { placeholder, shortcut, className = '', onClick, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const handleWrapperClick = (e: MouseEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (!input) return;
    if (e.target !== input) input.focus();
    onClick?.(e as unknown as MouseEvent<HTMLInputElement>);
  };

  return (
    <div className={`${controlClass} ${className}`} onClick={handleWrapperClick}>
      <Search className="h-[15px] w-[15px] text-faint" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        data-ds=""
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        {...rest}
      />
      {shortcut && (
        <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] font-medium text-faint">
          {shortcut}
        </kbd>
      )}
    </div>
  );
});
