import { createElement } from 'react';
import { toast as sonner } from 'sonner';
import { CircleCheck, XCircle, type LucideIcon } from 'lucide-react';

function tile(Icon: LucideIcon, tone: string) {
  return createElement(
    'span',
    { className: `grid h-[30px] w-[30px] flex-none place-items-center rounded-lg ${tone}` },
    createElement(Icon, { className: 'h-4 w-4', strokeWidth: 1.8, 'aria-hidden': true }),
  );
}

export const toast = {
  success(title: string, description?: string) {
    return sonner(title, { description, icon: tile(CircleCheck, 'text-st-done-fg bg-st-done-bg') });
  },
  error(title: string, description?: string) {
    return sonner(title, { description, icon: tile(XCircle, 'text-st-stop-fg bg-st-stop-bg') });
  },
};
