import React, { useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  className?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  hasError = false,
  className,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep array of characters
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto focus first empty input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      const firstEmptyIdx = digits.findIndex(d => !d);
      const targetIdx = firstEmptyIdx === -1 ? length - 1 : firstEmptyIdx;
      inputRefs.current[targetIdx]?.focus();
    }
  }, []);

  const handleInputChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, ''); // Numeric only
    if (!rawVal) {
      // Clear current digit
      const nextDigits = [...digits];
      nextDigits[idx] = '';
      const newVal = nextDigits.join('').slice(0, length);
      onChange(newVal);
      return;
    }

    // Handle single digit or multiple pasted digits into single field
    const nextDigits = [...digits];
    if (rawVal.length === 1) {
      nextDigits[idx] = rawVal;
      const newVal = nextDigits.join('').slice(0, length);
      onChange(newVal);

      // Advance focus to next input
      if (idx < length - 1) {
        inputRefs.current[idx + 1]?.focus();
      }

      if (newVal.length === length && onComplete) {
        onComplete(newVal);
      }
    } else {
      // Multiple digits entered (e.g. autofill or partial paste)
      const pastedChars = rawVal.split('');
      for (let i = 0; i < pastedChars.length && idx + i < length; i++) {
        nextDigits[idx + i] = pastedChars[i];
      }
      const newVal = nextDigits.join('').slice(0, length);
      onChange(newVal);

      const nextFocus = Math.min(idx + pastedChars.length, length - 1);
      inputRefs.current[nextFocus]?.focus();

      if (newVal.length === length && onComplete) {
        onComplete(newVal);
      }
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[idx] && idx > 0) {
        // Move to previous and delete
        const nextDigits = [...digits];
        nextDigits[idx - 1] = '';
        const newVal = nextDigits.join('');
        onChange(newVal);
        inputRefs.current[idx - 1]?.focus();
      } else {
        const nextDigits = [...digits];
        nextDigits[idx] = '';
        onChange(nextDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasteData) return;

    onChange(pasteData);
    const focusTarget = Math.min(pasteData.length, length - 1);
    inputRefs.current[focusTarget]?.focus();

    if (pasteData.length === length && onComplete) {
      onComplete(pasteData);
    }
  };

  return (
    <div className={clsx("flex items-center justify-center gap-2 sm:gap-2.5", className)}>
      {digits.map((digit, idx) => {
        const isFilled = Boolean(digit);
        return (
          <input
            key={idx}
            ref={el => { inputRefs.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={idx === 0 ? "one-time-code" : "off"}
            value={digit}
            disabled={disabled}
            onChange={e => handleInputChange(idx, e)}
            onKeyDown={e => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            className={clsx(
              "w-10 h-13 sm:w-12 sm:h-14 text-xl sm:text-2xl font-mono font-extrabold text-center rounded-2xl transition-all outline-none select-none",
              "bg-zinc-950/80 border text-white shadow-inner",
              hasError
                ? "border-rose-500/80 text-rose-300 ring-2 ring-rose-500/30 bg-rose-950/20"
                : isFilled
                  ? "border-[#f3aa18]/60 text-[#f3aa18] bg-zinc-900/90 shadow-[0_0_15px_rgba(169,255,93,0.1)]"
                  : "border-white/10 text-white hover:border-white/20 focus:border-[#f3aa18] focus:ring-2 focus:ring-[#f3aa18]/30"
            )}
          />
        );
      })}
    </div>
  );
};
