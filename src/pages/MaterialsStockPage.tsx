import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, FolderTree, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_FINISH_SURCHARGE_TIERS,
  deleteGlobalFinishDirect,
  fetchGlobalFinishesDirect,
  renameFinishGroupDirect,
  reorderFinishGroupsDirect,
  fetchLiveGlobalFinishesDirect,
  updateAllGlobalFinishesDirect,
  saveFinishGroupSettingsDirect,
  saveGlobalFinishDirect,
  toggleFinishActiveDirect,
  toggleFinishStockDirect,
  type FinishGroupSetting,
  type FinishSurchargeTier,
  type GlobalFinish,
} from '../lib/wordpressBridge';
import {
  buildNewFinishPayload,
  canDeleteGroup,
  filterFinishes,
  finishCounts,
  groupFinishes,
  moveFinishInGroup,
  mergeDraftOntoFresh,
  moveGroup,
  orderedGroups,
  renameGroupSettings,
  type FinishDraft,
  type FinishStatus,
  type FinishStatusFilter,
} from '../lib/finishesEditor';
import { onWorkspaceRefresh } from '../lib/workspaceRefresh';
import { Button } from '../components/ds/Button';
import { IconButton } from '../components/ds/IconButton';
import { Card } from '../components/ds/Card';
import { Tabs } from '../components/ds/Tabs';
import { Select } from '../components/ds/Select';
import { SearchField } from '../components/ds/SearchField';
import { Modal } from '../components/ds/Modal';
import { toast } from '../components/ds/toast';
import { FinishRow } from '../components/finishes/FinishRow';
import { FinishEditPanel, type MediaRole } from '../components/finishes/FinishEditPanel';
import { FinishGroupsModal, describeGroupSetting } from '../components/finishes/FinishGroupsModal';
import { FinishSurchargeTiersModal } from '../components/modals/FinishSurchargeTiersModal';
import { MediaLibraryModal } from '../components/modals/MediaLibraryModal';

/** `finish` is the copy the panel opened with: its draft is compared against it, and it survives a refresh that drops the finish. */
type PanelState = { mode: 'edit'; finish: GlobalFinish } | { mode: 'create' } | null;

const MEDIA_TITLES: Record<MediaRole, { title: string; size: string }> = {
  thumbnail: { title: 'Swatch thumbnail', size: 'Square swatch (150x150 or 500x500)' },
  texture_url: { title: 'Master texture', size: 'Tileable texture (2000x3000)' },
  texture_big_url: { title: 'Big master texture', size: 'Large texture for laptops and tablets (3000x2000)' },
};

const STATUS_TABS: { key: FinishStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'out_of_stock', label: 'Out of stock' },
  { key: 'coming_soon', label: 'Coming soon' },
];

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Finishes & Stock: the one editor for global finishes, finish groups and price tiers. */
export const MaterialsStockPage: React.FC = () => {
  const [finishes, setFinishes] = useState<GlobalFinish[]>([]);
  const [storedGroups, setStoredGroups] = useState<string[]>([]);
  const [groupSettings, setGroupSettings] = useState<Record<string, FinishGroupSetting>>({});
  const [tiers, setTiers] = useState<FinishSurchargeTier[]>(DEFAULT_FINISH_SURCHARGE_TIERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 'fallback' means the list on screen is not WordPress's (storefront list, old per-PC copy or defaults): writes are off.
  const [source, setSource] = useState<'live' | 'fallback' | null>(null);
  const sourceRef = useRef<'live' | 'fallback' | null>(null);

  const [status, setStatus] = useState<FinishStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState(false);
  const [groupsBusy, setGroupsBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [panel, setPanel] = useState<PanelState>(null);
  const [deleting, setDeleting] = useState<GlobalFinish | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupsFocus, setGroupsFocus] = useState<string | null>(null);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [media, setMedia] = useState<{ role: MediaRole; current: string; apply: (url: string) => void } | null>(null);

  const load = useCallback(async (quiet: boolean) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetchGlobalFinishesDirect();
      const live = res.source === 'live';
      if (!live && sourceRef.current === 'live') {
        // Keep the last live list rather than swapping in a copy that may be out of date.
        toast.error('Could not refresh finishes', 'Showing the list loaded earlier.');
        return;
      }
      sourceRef.current = live ? 'live' : 'fallback';
      setSource(sourceRef.current);
      if (Array.isArray(res.finishes)) setFinishes(res.finishes);
      if (Array.isArray(res.groups) && res.groups.length > 0) setStoredGroups(res.groups);
      else if (Array.isArray(res.finishes)) setStoredGroups(orderedGroups([], res.finishes));
      if (res.group_settings) setGroupSettings(res.group_settings);
      if (Array.isArray(res.surcharge_tiers) && res.surcharge_tiers.length > 0) setTiers(res.surcharge_tiers);
    } catch (err) {
      toast.error('Could not load finishes', errorText(err, 'Try Refresh.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      void load(false);
    }
  }, [load]);
  useEffect(() => onWorkspaceRefresh(() => void load(true)), [load]);

  const groups = useMemo(() => orderedGroups(storedGroups, finishes), [storedGroups, finishes]);
  const counts = useMemo(() => finishCounts(finishes), [finishes]);
  const groupCounts = useMemo(() => {
    const out: Record<string, number> = {};
    finishes.forEach((f) => {
      out[f.group] = (out[f.group] || 0) + 1;
    });
    return out;
  }, [finishes]);
  const visible = useMemo(() => filterFinishes(finishes, { status, query, group: groupFilter }), [finishes, status, query, groupFilter]);
  const sections = useMemo(() => {
    const visibleIds = new Set(visible.map((f) => f.id));
    const filtering = status !== 'all' || query.trim() !== '' || groupFilter !== 'all';
    return groupFinishes(storedGroups, finishes)
      .map((s) => ({ ...s, all: s.finishes, finishes: s.finishes.filter((f) => visibleIds.has(f.id)) }))
      .filter((s) => (filtering ? s.finishes.length > 0 && (groupFilter === 'all' || s.group === groupFilter) : true));
  }, [storedGroups, finishes, visible, status, query, groupFilter]);

  const readOnly = source !== 'live';
  const panelFinish = panel?.mode === 'edit' ? panel.finish : null;
  const panelDeleted = panelFinish !== null && !loading && !finishes.some((f) => f.id === panelFinish.id);

  const markBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchFinish = (id: string, patch: Partial<GlobalFinish>) =>
    setFinishes((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const handleStock = async (finish: GlobalFinish, next: FinishStatus) => {
    const before = { status: finish.status, in_stock: finish.in_stock, is_coming_soon: finish.is_coming_soon };
    markBusy(finish.id, true);
    patchFinish(finish.id, { status: next, in_stock: next === 'in_stock', is_coming_soon: next === 'coming_soon' });
    try {
      const res = await toggleFinishStockDirect(finish.id, next);
      if (!res.success) throw new Error(res.error || 'The store did not accept the change.');
      toast.success('Stock updated', `${finish.name}: ${next === 'in_stock' ? 'in stock' : next === 'out_of_stock' ? 'out of stock' : 'coming soon'}.`);
    } catch (err) {
      patchFinish(finish.id, before);
      toast.error('Stock not updated', errorText(err, 'Could not reach the store.'));
    } finally {
      markBusy(finish.id, false);
    }
  };

  const handleActive = async (finish: GlobalFinish, next: boolean) => {
    const before = finish.is_active;
    markBusy(finish.id, true);
    patchFinish(finish.id, { is_active: next });
    try {
      const res = await toggleFinishActiveDirect(finish.id, next);
      if (!res.success) throw new Error(res.error || 'The store did not accept the change.');
      toast.success(next ? 'Finish shown' : 'Finish hidden', `${finish.name} is ${next ? 'now on' : 'hidden from'} the storefront.`);
    } catch (err) {
      patchFinish(finish.id, { is_active: before });
      toast.error('Not updated', errorText(err, 'Could not reach the store.'));
    } finally {
      markBusy(finish.id, false);
    }
  };

  const handleMove = async (finish: GlobalFinish, direction: 'up' | 'down') => {
    const next = moveFinishInGroup(finishes, finish.id, direction);
    if (!next) return;
    const before = finishes;
    setFinishes(next);
    setReordering(true);
    try {
      // The move is applied to a freshly loaded list so changes made elsewhere are not overwritten.
      const res = await updateAllGlobalFinishesDirect((live) => moveFinishInGroup(live, finish.id, direction));
      if (!res.success) throw new Error(res.error || 'The store did not accept the new order.');
      if (Array.isArray(res.finishes)) setFinishes(res.finishes);
      if (Array.isArray(res.groups) && res.groups.length > 0) setStoredGroups(res.groups);
    } catch (err) {
      setFinishes(before);
      toast.error('Order not saved', errorText(err, 'Could not reach the store.'));
    } finally {
      setReordering(false);
    }
  };

  const handleSave = async (draft: FinishDraft) => {
    setSaving(true);
    try {
      // Start from WordPress's current copy so order, stock or active changed elsewhere are kept.
      const fresh = await fetchLiveGlobalFinishesDirect();
      if (fresh.source !== 'live') throw new Error('Could not load the live finishes, so nothing was saved.');
      let payload: GlobalFinish;
      if (panelFinish) {
        const current = fresh.finishes.find((f) => f.id === panelFinish.id);
        if (!current) {
          setFinishes(fresh.finishes);
          throw new Error('This finish was deleted elsewhere.');
        }
        payload = mergeDraftOntoFresh(panelFinish, draft, current);
      } else {
        payload = buildNewFinishPayload(draft, fresh.finishes.length);
        if (fresh.finishes.some((f) => f.slug === payload.slug || f.id === payload.id)) {
          setFinishes(fresh.finishes);
          throw new Error(`A finish with the slug "${payload.slug}" already exists.`);
        }
      }
      const res = await saveGlobalFinishDirect(payload);
      if (!res.success) throw new Error(res.error || 'The store did not accept the finish.');
      if (Array.isArray(res.finishes)) setFinishes(res.finishes);
      else setFinishes((prev) => (panelFinish ? prev.map((f) => (f.id === payload.id ? payload : f)) : [...prev, payload]));
      if (Array.isArray(res.groups)) setStoredGroups(res.groups);
      toast.success(panelFinish ? 'Finish saved' : 'Finish added', `${payload.name} is updated on every configurator.`);
      setPanel(null);
    } catch (err) {
      toast.error('Not saved', errorText(err, 'Could not reach the store.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setSaving(true);
    try {
      const res = await deleteGlobalFinishDirect(target.id);
      if (!res.success) throw new Error(res.error || 'The store did not delete the finish.');
      if (Array.isArray(res.finishes)) setFinishes(res.finishes);
      else setFinishes((prev) => prev.filter((f) => f.id !== target.id));
      if (Array.isArray(res.groups)) setStoredGroups(res.groups);
      toast.success('Finish deleted', `${target.name} is no longer offered.`);
      setDeleting(null);
      setPanel(null);
    } catch (err) {
      toast.error('Not deleted', errorText(err, 'Could not reach the store.'));
    } finally {
      setSaving(false);
    }
  };

  const saveGroupOrder = async (next: string[], success: string): Promise<boolean> => {
    const before = storedGroups;
    setStoredGroups(next);
    setGroupsBusy(true);
    try {
      const res = await reorderFinishGroupsDirect(next);
      if (!res.success) throw new Error(res.error || 'The store did not accept the groups.');
      if (Array.isArray(res.groups)) setStoredGroups(res.groups);
      toast.success(success);
      return true;
    } catch (err) {
      setStoredGroups(before);
      toast.error('Groups not saved', errorText(err, 'Could not reach the store.'));
      return false;
    } finally {
      setGroupsBusy(false);
    }
  };

  const handleGroupMove = (group: string, direction: 'up' | 'down') => {
    const next = moveGroup(groups, group, direction);
    if (next) void saveGroupOrder(next, `${group} moved ${direction}`);
  };

  const handleGroupAdd = (name: string) => saveGroupOrder([...groups, name], `Group ${name} added`);

  const handleGroupDelete = (group: string) => {
    if (!canDeleteGroup(group, finishes)) {
      toast.error('Group not empty', `Move the finishes in ${group} to another group first.`);
      return;
    }
    if (groupFilter === group) setGroupFilter('all');
    void saveGroupOrder(
      groups.filter((g) => g !== group),
      `Group ${group} deleted`,
    );
  };

  const handleGroupRename = async (oldName: string, newName: string): Promise<boolean> => {
    setGroupsBusy(true);
    try {
      const res = await renameFinishGroupDirect(oldName, newName);
      if (!res.success) throw new Error(res.error || 'The store did not rename the group.');
      setStoredGroups(Array.isArray(res.groups) ? res.groups : (prev) => prev.map((g) => (g === oldName ? newName : g)));
      if (Array.isArray(res.finishes)) setFinishes(res.finishes);
      else setFinishes((prev) => prev.map((f) => (f.group === oldName ? { ...f, group: newName } : f)));
      if (groupFilter === oldName) setGroupFilter(newName);
      // Display settings are keyed by group name and the rename endpoint does not move them.
      const moved = renameGroupSettings(groupSettings, oldName, newName);
      if (moved) {
        const saved = await saveFinishGroupSettingsDirect(moved);
        if (saved.success) setGroupSettings(saved.group_settings || moved);
        else toast.error('Display settings not moved', `Set the display for ${newName} again. ${saved.error || ''}`.trim());
      }
      toast.success('Group renamed', `${oldName} is now ${newName}; ${res.updated_count ?? 0} finishes moved with it.`);
      return true;
    } catch (err) {
      toast.error('Not renamed', errorText(err, 'Could not reach the store.'));
      return false;
    } finally {
      setGroupsBusy(false);
    }
  };

  const handleGroupSetting = async (group: string, setting: FinishGroupSetting): Promise<boolean> => {
    const next = { ...groupSettings, [group]: setting };
    setGroupsBusy(true);
    try {
      const res = await saveFinishGroupSettingsDirect(next);
      if (!res.success) throw new Error(res.error || 'The store did not save the display settings.');
      setGroupSettings(res.group_settings || next);
      toast.success('Display saved', `${group}: ${describeGroupSetting(setting)}.`);
      return true;
    } catch (err) {
      toast.error('Display not saved', errorText(err, 'Could not reach the store.'));
      return false;
    } finally {
      setGroupsBusy(false);
    }
  };

  const openGroups = (focus: string | null) => {
    setGroupsFocus(focus);
    setGroupsOpen(true);
  };

  const groupOptions = [{ value: 'all', label: 'All groups' }, ...groups.map((g) => ({ value: g, label: g }))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">Finishes &amp; Stock</h1>
          <p className="mt-0.5 text-[14px] text-muted">
            Every skin finish, its stock and its storefront group. Changes reach all configurators.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <IconButton
            icon={RefreshCw}
            label="Refresh"
            onClick={() => void load(true)}
            disabled={refreshing || loading}
            className={refreshing ? '[&>svg]:animate-spin' : ''}
          />
          <Button icon={FolderTree} onClick={() => openGroups(null)} disabled={readOnly}>
            Groups
          </Button>
          <Button icon={Coins} onClick={() => setTiersOpen(true)} disabled={readOnly}>
            Price tiers
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setPanel({ mode: 'create' })} disabled={loading || readOnly}>
            Add finish
          </Button>
        </div>
      </div>

      {source === 'fallback' && !loading && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[12px] border border-st-wait-border bg-st-wait-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-[13.5px] text-st-wait-fg">Showing a saved copy, edits are off until finishes load.</p>
          <Button size="sm" icon={RefreshCw} onClick={() => void load(true)} disabled={refreshing}>
            Retry
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="max-w-full overflow-x-auto [&_button]:whitespace-nowrap">
          <Tabs
            items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], hot: t.key === 'out_of_stock' && counts.out_of_stock > 0 }))}
            value={status}
            onChange={(k) => setStatus(k as FinishStatusFilter)}
          />
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select aria-label="Group" className="w-full sm:w-[190px]" value={groupFilter} options={groupOptions} onChange={setGroupFilter} />
          <SearchField
            className="w-full sm:w-[260px]"
            placeholder="Search finishes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Card>
          <p className="py-10 text-center text-[13.5px] text-muted">Loading finishes...</p>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[14px] font-medium text-fg">No finishes match</p>
            <p className="mt-1 text-[13px] text-muted">Clear the search or pick another filter.</p>
            <Button
              className="mt-3"
              onClick={() => {
                setQuery('');
                setStatus('all');
                setGroupFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        </Card>
      ) : (
        sections.map((section) => (
          <Card
            key={section.group}
            title={section.group}
            count={section.all.length}
            actions={
              <Button size="sm" variant="ghost" icon={SlidersHorizontal} onClick={() => openGroups(section.group)} disabled={readOnly}>
                {describeGroupSetting(groupSettings[section.group])}
              </Button>
            }
          >
            {section.finishes.length === 0 ? (
              <p className="text-[13px] text-faint">No finishes in this group yet. Pick it as the group when you edit or add a finish.</p>
            ) : (
              <ul className="-my-3 divide-y divide-line">
                {section.finishes.map((f) => {
                  const pos = section.all.findIndex((x) => x.id === f.id);
                  return (
                    <FinishRow
                      key={f.id}
                      finish={f}
                      position={pos + 1}
                      isFirst={pos === 0}
                      isLast={pos === section.all.length - 1}
                      busy={busyIds.has(f.id)}
                      reorderDisabled={reordering}
                      readOnly={readOnly}
                      onStock={(s) => void handleStock(f, s)}
                      onActive={(a) => void handleActive(f, a)}
                      onMove={(d) => void handleMove(f, d)}
                      onEdit={() => setPanel({ mode: 'edit', finish: f })}
                    />
                  );
                })}
              </ul>
            )}
          </Card>
        ))
      )}

      <FinishEditPanel
        open={panel !== null}
        finish={panelFinish}
        deleted={panelDeleted}
        groups={groups}
        defaultGroup={groupFilter !== 'all' ? groupFilter : groups[0] || 'Signature skins'}
        existingSlugs={finishes.flatMap((f) => [f.slug, f.id])}
        saving={saving}
        blockClose={media !== null}
        onClose={() => setPanel(null)}
        onSave={(d) => void handleSave(d)}
        onDelete={(f) => setDeleting(f)}
        onBrowseMedia={(role, current, apply) => setMedia({ role, current, apply })}
      />

      <Modal
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`Delete ${deleting?.name ?? 'finish'}?`}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete finish'}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">
          It disappears from every configurator. Past orders keep their finish name. To hide it for now, switch Active off instead.
        </p>
      </Modal>

      <FinishGroupsModal
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        groups={groups}
        counts={groupCounts}
        settings={groupSettings}
        focusGroup={groupsFocus}
        busy={groupsBusy}
        onMove={handleGroupMove}
        onAdd={handleGroupAdd}
        onDelete={handleGroupDelete}
        onRename={handleGroupRename}
        onSaveSetting={handleGroupSetting}
      />

      <FinishSurchargeTiersModal isOpen={tiersOpen} onClose={() => setTiersOpen(false)} tiers={tiers} onTiersUpdated={setTiers} />

      <MediaLibraryModal
        isOpen={media !== null}
        onClose={() => setMedia(null)}
        onSelectImage={(url) => {
          media?.apply(url);
          setMedia(null);
        }}
        title={media ? `Select ${MEDIA_TITLES[media.role].title.toLowerCase()}` : undefined}
        recommendedDimensions={media ? MEDIA_TITLES[media.role].size : undefined}
        currentUrl={media?.current}
      />
    </div>
  );
};
