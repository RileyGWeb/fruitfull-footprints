import type { PathNode } from '@/lib/studies';
import s from './Studies.module.css';

/** “The path so far”: one dot per series, the current one in terracotta, then “What’s next?”. Scrolls sideways on phones. */
export function StudyPath({ nodes }: { nodes: PathNode[] }) {
  if (!nodes.length) return null;
  return (
    <section className={s.path} aria-labelledby="path-so-far">
      <h2 id="path-so-far" className={s.pathTitle}>The path so far</h2>
      <ol className={s.track}>
        {nodes.map(n => (
          <li key={n.key} className={s.node} aria-current={n.state === 'current' ? 'step' : undefined}>
            <div className={s.nodeLine} aria-hidden>
              <span className={s.dot} style={{ background: n.dot, boxShadow: `0 0 0 5px ${n.ring}` }} />
              <span className={s.dash} />
            </div>
            <div>
              <div className={s.nodeName}>{n.name}</div>
              <div className={s.nodeSub}>{n.when} · {n.n}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
