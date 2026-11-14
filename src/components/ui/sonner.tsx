import React from 'react';
import { Toaster as Sonner, toast } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster: React.FC<ToasterProps> = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group font-sans"
      position="bottom-center"
      gap={10}
      offset={{ top: 16, right: 16, bottom: 24, left: 16 }}
      mobileOffset={{
        top: 'calc(env(safe-area-inset-top) + 12px)',
        right: 'calc(env(safe-area-inset-right) + 14px)',
        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        left: 'calc(env(safe-area-inset-left) + 14px)',
      }}
      swipeDirections={['bottom', 'right', 'left']}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[320px] max-w-full items-center gap-3 rounded-xl border border-card-border bg-card px-3.5 py-3 font-sans text-fg shadow-[0_12px_30px_rgba(0,0,0,0.3)]',
          icon: 'flex-none',
          content: 'min-w-0',
          title: 'text-[13.5px] font-medium leading-snug text-fg',
          description: 'text-[12.5px] leading-snug text-faint break-words whitespace-pre-wrap',
          actionButton: 'rounded-[8px] bg-accent px-2.5 py-1 text-[12.5px] font-semibold text-accent-on',
          cancelButton: 'rounded-[8px] bg-chip px-2.5 py-1 text-[12.5px] text-fg',
        },
      }}
      {...props}
    />
  );
};

export { toast };
