import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Retry } from './Retry';
import s from './offline.module.css';

export const metadata: Metadata = { title: 'Offline · Fruitfull Footprints' };

/** Served by the service worker when a page that was never saved is opened without a connection. */
export default function OfflinePage() {
  return (
    <main className={s.wrap}>
      <div className={s.sun} />
      <div className={s.card}>
        <span className={s.mark}><Icon name="feetLg" /></span>
        <div className={s.kicker}>No connection</div>
        <h1 className={s.title}>You’re offline</h1>
        <p className={s.body}>This page hasn’t been saved on this device yet. Once you’re connected again it’ll open as usual — and anything you’ve already looked at is still here.</p>
        <div className={s.actions}>
          <Retry className={`btn btn-primary ${s.retry}`} />
          <Link href="/" className={`btn btn-ghost ${s.home}`}>Go to Home</Link>
        </div>
      </div>
    </main>
  );
}
