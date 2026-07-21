import { Pencil, Trash2 } from 'lucide-react';

interface CategoryCardProps {
  title: string;
  totalItems: number;
  learningItems: number;
  resources: number;
  icon?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CategoryCard({
  title,
  totalItems,
  learningItems,
  resources,
  icon = title[0],
  onEdit,
  onDelete
}: CategoryCardProps) {
  return (
    <div className="card card-hover card-body">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center bg-primary/10">
            <span className="text-primary text-lg font-semibold">{icon}</span>
          </div>
          <div className="ml-4 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Total Items: {totalItems}</span>
              <span>Learning: {learningItems}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label={`Edit ${title}`}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete ${title}`}
              className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
            Resources: {resources}
          </span>
        </div>
      </div>
    </div>
  );
}
