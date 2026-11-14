import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { controlClass } from './TextField';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder: string;
  shortcut?: string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { placeholder, shortcut, className = '', ...rest },
  ref,
) {
  return (
    <div className={`${controlClass} ${className}`}>
      <Search className="h-[15px] w-[15px] text-faint" aria-hidden />
      <input
        ref={ref}
        type="search"
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
