'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDialogs } from '@/components/dialogs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { ScreenState } from '@/components/ui/ScreenState';
import { Seg } from '@/components/ui/Seg';
import { useSnapshot } from '@/lib/hooks';
import { useDocumentTitle } from '@/lib/title';
import { ActivePrayerCard } from './ActivePrayerCard';
import { AnsweredPrayerCard } from './AnsweredPrayerCard';
import { activePrayers, answeredPrayers } from './views';
import s from './PrayerScreen.module.css';

export type PrayerTab = 'active' | 'answered';

/** Prototype screen 05 Prayer: `/prayer` (Active) and `/prayer/answered`. */
export function PrayerScreen({ tab }: { tab: PrayerTab }) {
  const { data, error, isLoading, mutate } = useSnapshot();
  const dialogs = useDialogs();
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  useDocumentTitle(tab === 'answered' ? 'Answered prayers' : 'Prayer');

  const active = data ? activePrayers(data.prayers, data.members) : [];
  const answered = data ? answeredPrayers(data.prayers, data.members) : [];

  const addRequest = async () => {
    const added = await dialogs.addPrayer();
    // A new request is active — show it where it landed.
    if (added && tab === 'answered') router.replace('/prayer', { scroll: false });
  };

  return (
    <div className={s.page} aria-busy={isLoading || undefined}>
      <div className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Prayer</h1>
          <p className={s.subtitle}>What we’re carrying together.</p>
        </div>
        <button type="button" className={`btn btn-primary ${s.add}`} onClick={addRequest}>
          <Icon name="plus" /> Add request
        </button>
      </div>

      {!data ? (
        <ScreenState error={error} what="Prayer requests" onRetry={() => void mutate()} loading={<Skeleton tab={tab} />} level={2} />
      ) : (
        <>
          <Seg
            className={s.seg}
            label="Prayer views"
            padX={18}
            options={[
              { label: `Active · ${active.length}`, href: '/prayer', active: tab === 'active' },
              { label: `Answered · ${answered.length}`, href: '/prayer/answered', active: tab === 'answered' },
            ]}
          />

          {tab === 'active' && (active.length === 0 ? (
            <EmptyState level={2} title="No active prayer requests" body="A quiet season is something to be thankful for." />
          ) : (
            <div className={s.list}>
              {active.map(v => (
                <ActivePrayerCard
                  key={v.prayer.id}
                  view={v}
                  updating={updatingId === v.prayer.id}
                  onUpdatingChange={open => setUpdatingId(open ? v.prayer.id : null)}
                  onAnswer={() => void dialogs.answerPrayer(v.prayer)}
                  onEdit={() => void dialogs.editPrayer(v.prayer)}
                />
              ))}
            </div>
          ))}

          {tab === 'answered' && (answered.length === 0 ? (
            <EmptyState level={2} title="Nothing marked answered yet" body="When a prayer is answered, it’s kept here so we can look back and remember." />
          ) : (
            <>
              <p className={s.intro}>Kept here on purpose. It’s good to look back and remember.</p>
              <div className={s.grid}>
                {answered.map(v => (
                  <AnsweredPrayerCard key={v.prayer.id} view={v} onEdit={() => void dialogs.editPrayer(v.prayer)} />
                ))}
              </div>
            </>
          ))}
        </>
      )}
    </div>
  );
}

/** Quiet placeholders while the first snapshot loads (no shimmer, nothing that flashes). */
function Skeleton({ tab }: { tab: PrayerTab }) {
  return (
    <div className={s.skeleton} aria-hidden>
      <div className={s.skSeg} />
      {tab === 'active' ? (
        <div className={s.list}>
          <div className={s.skCard} />
          <div className={s.skCard} />
          <div className={s.skCard} />
        </div>
      ) : (
        <div className={s.grid}>
          <div className={s.skAnswered} />
          <div className={s.skAnswered} />
        </div>
      )}
    </div>
  );
}
