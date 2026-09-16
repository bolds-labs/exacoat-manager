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
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[#0d0f12]/95 group-[.toaster]:text-zinc-100 group-[.toaster]:border-white/[0.12] group-[.toaster]:backdrop-blur-2xl group-[.toaster]:shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.12)] group-[.toaster]:rounded-2xl font-sans p-4 border transition-all',
          description: 'group-[.toast]:text-zinc-400 group-[.toast]:text-xs font-sans font-normal leading-relaxed break-words whitespace-pre-wrap mt-0.5',
          title: 'font-bold text-xs leading-snug tracking-tight text-white font-sans',
          actionButton:
            'group-[.toast]:bg-[#f3aa18] group-[.toast]:text-zinc-950 font-bold group-[.toast]:rounded-xl font-sans text-xs',
          cancelButton:
            'group-[.toast]:bg-white/10 group-[.toast]:text-zinc-300 group-[.toast]:rounded-xl font-sans text-xs',
          success: '!border-emerald-500/30 !bg-[#0a140e]/95 text-white shadow-[0_15px_40px_-5px_rgba(16,185,129,0.25)]',
          error: '!border-rose-500/30 !bg-[#160a0d]/95 text-white shadow-[0_15px_40px_-5px_rgba(244,63,94,0.25)]',
          warning: '!border-amber-500/30 !bg-[#181105]/95 text-white shadow-[0_15px_40px_-5px_rgba(245,158,11,0.25)]',
          info: '!border-lime-500/30 !bg-[#0b140a]/95 text-white shadow-[0_15px_40px_-5px_rgba(169,255,93,0.25)]',
        },
      }}
      {...props}
    />
  );
};

export { toast };
