import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Sparkles } from 'lucide-react';
import {
  getRelatedContent,
  indexContent,
  isIndexed,
  itemPath,
  type ContentMatch,
  type ContentType,
} from '../lib/ai';
import { Skeleton } from './ui/Skeleton';
import { stripHtml } from '../utils/text';

interface RelatedContentProps {
  type: ContentType;
  id: string;
}

// "Related content" panel shown under a resource / learning item.
export function RelatedContent({ type, id }: RelatedContentProps) {
  const [items, setItems] = useState<ContentMatch[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        let related = await getRelatedContent(type, id);
        // First visit to an item that was never indexed: index it, then retry.
        if (related.length === 0 && !(await isIndexed(type, id))) {
          await indexContent([{ type, id }]);
          related = await getRelatedContent(type, id);
        }
        if (!cancelled) {
          setItems(related);
          setStatus('ready');
        }
      } catch (e) {
        console.warn('Related content unavailable:', e);
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  // AI not set up yet (migration / function missing): stay out of the way.
  if (status === 'unavailable') return null;

  return (
    <section className="mt-12 border-t border-border pt-8" aria-labelledby="related-heading">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 id="related-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Related in your library
        </h2>
      </div>

      {status === 'loading' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing similar in your library yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.item_type === 'resource' ? BookOpen : GraduationCap;
            return (
              <Link
                key={`${item.item_type}:${item.item_id}`}
                to={itemPath(item.item_type, item.item_id)}
                className="group rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {item.item_type === 'resource' ? 'Resource' : 'Learning'}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {Math.round(item.similarity * 100)}% similar
                  </span>
                </div>
                <div className="line-clamp-1 font-medium text-foreground group-hover:text-primary">{item.title}</div>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{stripHtml(item.description)}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
