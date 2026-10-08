import { Icon } from '@/components/ui/Icon';
import type { ReaderSection } from './sections';
import r from './StudyReader.module.css';

/** One study section, drawn by type exactly like the prototype's reader. Headings are h2s under the study's h1. */
export function StudySection({ section: x }: { section: ReaderSection }) {
  switch (x.type) {
    case 'text':
      return (
        <section className={r.section}>
          {x.heading && <h2 className={r.heading}>{x.heading}</h2>}
          {x.paras.map((t, i) => <p key={i} className={r.para}>{t}</p>)}
        </section>
      );
    case 'scripture':
      return (
        <section className={r.section}>
          <figure className={r.scripture}>
            <div className={r.quoteMark} aria-hidden>“</div>
            <figcaption className={r.readTogether}>Read together{x.ref && ` · ${x.ref}`}</figcaption>
            <blockquote className={r.verse}>
              {x.paras.map((t, i) => <p key={i}>{t}</p>)}
            </blockquote>
          </figure>
        </section>
      );
    case 'questions':
      return (
        <section className={r.section}>
          {x.heading && <h2 className={r.questionsHeading}>{x.heading}</h2>}
          <ol className={r.questions}>
            {x.items.map((t, i) => (
              <li key={i} className={r.question}>
                <span className={r.qn} aria-hidden>{i + 1}</span>
                <span className={r.qText}>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    case 'reflect':
      return (
        <section className={r.section}>
          <div className={r.reflect}>
            <div className={r.reflectBlob} aria-hidden />
            <h2 className={r.reflectHead}>
              <Icon name="leafSm" />
              <span className={r.reflectLabel}>{x.heading ?? 'Reflection'}</span>
            </h2>
            {x.paras.map((t, i) => <p key={i} className={r.reflectPara}>{t}</p>)}
          </div>
        </section>
      );
    case 'prayer':
      return (
        <section className={r.section}>
          <div className={r.prayer}>
            {x.heading && <h2 className={r.heading}>{x.heading}</h2>}
            {x.paras.map((t, i) => <p key={i} className={r.prayerPara}>{t}</p>)}
          </div>
        </section>
      );
  }
}
