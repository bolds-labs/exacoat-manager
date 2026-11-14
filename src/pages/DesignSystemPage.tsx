import { useState, type ReactNode } from 'react';
import {
  Archive, Copy, DollarSign, Download, Landmark, Package, Pencil, Plus, Printer, RefreshCw, Trash2, Undo2, Wallet,
} from 'lucide-react';
import type { Order } from '../types';
import {
  Button, IconButton, CountPill, TextField, Select, SearchField, Checkbox, Switch, RadioCard,
  Card, KpiCard, Tabs, StatusChip, WarrantyChip, Menu, Modal, toast,
} from '../components/ds';

const TOKENS: { name: string; cls: string }[] = [
  { name: 'bg', cls: 'bg-bg' },
  { name: 'panel', cls: 'bg-panel' },
  { name: 'card', cls: 'bg-card' },
  { name: 'field', cls: 'bg-field' },
  { name: 'chip', cls: 'bg-chip' },
  { name: 'accent', cls: 'bg-accent' },
  { name: 'accent-soft', cls: 'bg-accent-soft' },
  { name: 'fg', cls: 'bg-fg' },
  { name: 'muted', cls: 'bg-muted' },
  { name: 'faint', cls: 'bg-faint' },
  { name: 'line', cls: 'bg-line' },
  { name: 'st-act', cls: 'bg-st-act-fg' },
  { name: 'st-wait', cls: 'bg-st-wait-fg' },
  { name: 'st-prog', cls: 'bg-st-prog-fg' },
  { name: 'st-done', cls: 'bg-st-done-fg' },
  { name: 'st-stop', cls: 'bg-st-stop-fg' },
];

const STATUS_SAMPLES: { caption: string; order: Partial<Order> }[] = [
  { caption: 'pending', order: { status: 'pending' } },
  { caption: 'on-hold', order: { status: 'on-hold' } },
  { caption: 'pending-payment', order: { status: 'pending-payment' } },
  { caption: 'processing', order: { status: 'processing' } },
  { caption: 'preparing-order', order: { status: 'preparing-order' } },
  { caption: 'in-production', order: { status: 'in-production' } },
  { caption: 'ready-to-ship (courier)', order: { status: 'ready-to-ship' } },
  { caption: 'awaiting-pickup (courier)', order: { status: 'awaiting-pickup' } },
  { caption: 'ready-to-ship (store pickup)', order: { status: 'ready-to-ship', is_store_pickup: true } },
  { caption: 'smb-ready', order: { status: 'smb-ready' } },
  { caption: 'smb-picked', order: { status: 'smb-picked' } },
  { caption: 'shipped', order: { status: 'shipped' } },
  { caption: 'delivered', order: { status: 'delivered' } },
  { caption: 'completed (courier)', order: { status: 'completed' } },
  { caption: 'completed (store pickup)', order: { status: 'completed', is_store_pickup: true } },
  { caption: 'cancelled', order: { status: 'cancelled' } },
  { caption: 'refunded', order: { status: 'refunded' } },
  { caption: 'failed', order: { status: 'failed' } },
  { caption: 'unknown status', order: { status: 'mystery-state' } },
];

const WARRANTY_SAMPLES = (['pending', 'approved', 'rejected'] as const).map((status) => ({
  status,
  order: { status: 'processing', rma: { order_type: 'Warranty', status } } as unknown as Partial<Order>,
}));

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3.5 border-b border-line pb-2 text-[14px] font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      {label && <div className="mb-2 text-[12px] text-faint">{label}</div>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function DesignSystemPage() {
  const [tab, setTab] = useState('all');
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(false);
  const [radio, setRadio] = useState<'credit' | 'original' | 'bank'>('credit');
  const [select, setSelect] = useState('jne');
  const [modalOpen, setModalOpen] = useState(false);

  const menuItems = [
    { icon: Printer, title: 'Print shipping label', description: 'A6 thermal label', onSelect: () => toast.success('Label queued') },
    { icon: Copy, title: 'Copy order link', onSelect: () => toast.success('Link copied') },
    { icon: Pencil, title: 'Edit address', description: 'Change the delivery address', onSelect: () => undefined },
    'separator' as const,
    { icon: Archive, title: 'Archive order', onSelect: () => undefined },
    { icon: Trash2, title: 'Cancel order', description: 'Stops fulfilment', danger: true, onSelect: () => undefined },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-8 text-fg">
      <h1 className="mb-1 text-[26px] font-semibold tracking-[-0.025em]">Design system</h1>
      <p className="mb-9 text-[14px] text-muted">Every kit component and state. Compare against the design sheet in dark and light mode.</p>

      <Group title="Colour">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {TOKENS.map((t) => (
            <div key={t.name}>
              <div className={`h-12 rounded-[9px] border border-line ${t.cls}`} />
              <div className="mt-1.5 font-mono text-[11.5px] text-muted">{t.name}</div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Status">
        <Row label="One chip per status map row">
          {STATUS_SAMPLES.map((s) => (
            <div key={s.caption} className="flex flex-col items-start gap-1.5">
              <StatusChip order={s.order} />
              <span className="font-mono text-[11.5px] text-faint">{s.caption}</span>
            </div>
          ))}
        </Row>
        <Row label="Small size">
          {STATUS_SAMPLES.slice(3, 7).map((s) => (
            <StatusChip key={s.caption} order={s.order} size="sm" />
          ))}
        </Row>
        <Row label="Warranty claim chips">
          {WARRANTY_SAMPLES.map((w) => (
            <div key={w.status} className="flex flex-col items-start gap-1.5">
              <WarrantyChip order={w.order} />
              <span className="font-mono text-[11.5px] text-faint">{w.status}</span>
            </div>
          ))}
        </Row>
      </Group>

      <Group title="Type">
        <div className="space-y-2">
          <div className="text-[26px] font-semibold tracking-[-0.025em]">Page title 26 / 600</div>
          <div className="text-[14px] font-semibold">Card title 14 / 600</div>
          <div className="text-[14px]">Body 14 / 400</div>
          <div className="text-[14px] font-medium">Names and emphasis 14 / 500</div>
          <div className="text-[13px] text-muted">Secondary 13</div>
          <div className="text-[12px] text-faint">Labels and column headers 12</div>
          <div className="font-mono text-[14px]">#12345 Rp 450.000 JNE0012345678</div>
        </div>
      </Group>

      <Group title="Spacing and shape">
        <Row>
          <div className="h-14 w-24 rounded-[8px] border border-card-border bg-card p-2 text-[12px] text-muted">8px</div>
          <div className="h-14 w-24 rounded-[9px] border border-card-border bg-card p-2 text-[12px] text-muted">9px</div>
          <div className="h-14 w-24 rounded-[10px] border border-card-border bg-card p-2 text-[12px] text-muted">10px</div>
          <div className="h-14 w-24 rounded-[14px] border border-card-border bg-card p-2 text-[12px] text-muted">14px</div>
          <div className="h-14 w-24 rounded-2xl border border-card-border bg-card p-2 text-[12px] text-muted">16px</div>
        </Row>
      </Group>

      <Group title="Buttons">
        <Row label="Medium, 36px">
          <Button variant="primary" icon={Plus}>Primary</Button>
          <Button variant="secondary" icon={Download}>Secondary</Button>
          <Button variant="ghost" icon={RefreshCw}>Ghost</Button>
          <Button variant="danger" icon={Trash2}>Danger</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <IconButton icon={Pencil} label="Edit" />
          <IconButton icon={Trash2} label="Delete" variant="ghost" />
        </Row>
        <Row label="Small, 30px">
          <Button size="sm" variant="primary" icon={Plus}>Primary</Button>
          <Button size="sm" variant="secondary" icon={Download}>Secondary</Button>
          <Button size="sm" variant="ghost" icon={RefreshCw}>Ghost</Button>
          <Button size="sm" variant="danger" icon={Trash2}>Danger</Button>
          <IconButton size="sm" icon={Pencil} label="Edit" />
          <IconButton size="sm" icon={Trash2} label="Delete" variant="ghost" />
        </Row>
        <Row label="Count pills">
          <CountPill value={12} />
          <CountPill value={3} tone="hot" />
        </Row>
      </Group>

      <Group title="Fields">
        <div className="grid max-w-[640px] grid-cols-2 gap-4">
          <TextField label="Customer name" placeholder="Full name" />
          <TextField label="Tracking number" mono defaultValue="JNE0012345678" />
          <Select
            label="Courier"
            value={select}
            onChange={setSelect}
            tag="REG"
            options={[{ value: 'jne', label: 'JNE' }, { value: 'sicepat', label: 'SiCepat' }, { value: 'jnt', label: 'J&T' }]}
          />
          <div>
            <span className="mb-1.5 block text-[12px] text-faint">Search</span>
            <SearchField placeholder="Search orders" shortcut="/" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <Checkbox label="Checked" checked={check1} onChange={(e) => setCheck1(e.target.checked)} />
          <Checkbox label="Unchecked" checked={check2} onChange={(e) => setCheck2(e.target.checked)} />
          <Switch label="On" checked={sw1} onCheckedChange={setSw1} />
          <Switch label="Off" checked={sw2} onCheckedChange={setSw2} />
        </div>
        <div role="radiogroup" className="mt-5 grid max-w-[640px] grid-cols-3 gap-3">
          <RadioCard icon={Wallet} title="Store credit" description="Instant" selected={radio === 'credit'} onSelect={() => setRadio('credit')} />
          <RadioCard icon={Undo2} title="Original payment" description="3 to 5 days" selected={radio === 'original'} onSelect={() => setRadio('original')} />
          <RadioCard icon={Landmark} title="Bank transfer" description="1 to 2 days" selected={radio === 'bank'} onSelect={() => setRadio('bank')} />
        </div>
      </Group>

      <Group title="Tabs, switch and navigation">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: 'All', count: 128 },
            { key: 'act', label: 'To prepare', count: 7, hot: true },
            { key: 'ship', label: 'Shipped', count: 31 },
            { key: 'done', label: 'Completed' },
          ]}
          trailing={<Button size="sm" variant="ghost" icon={RefreshCw}>Refresh</Button>}
        />
      </Group>

      <Group title="Cards and KPIs">
        <div className="mb-4 grid grid-cols-3 gap-4">
          <KpiCard icon={Package} value="24" label="To prepare" highlight />
          <KpiCard icon={DollarSign} value="Rp 12.4M" label="Revenue this month" />
          <KpiCard icon={Package} value="9" label="Waiting for courier" />
        </div>
        <Card icon={Package} title="Order items" count={3} actions={<Button size="sm" variant="secondary" icon={Pencil}>Edit</Button>}>
          <p className="text-[13px] text-muted">Card body content sits here.</p>
        </Card>
      </Group>

      <Group title="Menu">
        <Row>
          <Menu trigger={<Button variant="secondary">Open menu</Button>} items={menuItems} align="start" />
        </Row>
      </Group>

      <Group title="Pop-up">
        <Row>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open Refund pop-up</Button>
        </Row>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Refund"
          reference="#12345"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { setModalOpen(false); toast.success('Refund issued'); }}>Issue refund</Button>
            </>
          }
        >
          <TextField label="Amount" mono defaultValue="450000" />
          <div role="radiogroup" className="flex flex-col gap-2.5">
            <RadioCard icon={Wallet} title="Store credit" description="Instant" selected={radio === 'credit'} onSelect={() => setRadio('credit')} />
            <RadioCard icon={Undo2} title="Original payment" description="3 to 5 days" selected={radio === 'original'} onSelect={() => setRadio('original')} />
          </div>
        </Modal>
      </Group>

      <Group title="Toast">
        <Row>
          <Button variant="secondary" onClick={() => toast.success('Order updated', 'Status changed to Shipped.')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not save', 'Check the connection and try again.')}>Error toast</Button>
        </Row>
      </Group>
    </div>
  );
}
