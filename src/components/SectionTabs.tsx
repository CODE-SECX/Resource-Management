import { NavLink } from 'react-router-dom';
import { LayoutList, FolderTree } from 'lucide-react';
import { cn } from '../utils/cn';

const sections = {
  resources: { list: '/resources', index: '/resources/index' },
  learning: { list: '/learning', index: '/learning/index' },
} as const;

interface SectionTabsProps {
  section: keyof typeof sections;
  className?: string;
}

// Switches between the two views of a section (filterable list / category tree),
// so the top navigation only needs one entry per section.
export function SectionTabs({ section, className }: SectionTabsProps) {
  const { list, index } = sections[section];
  const tabs = [
    { to: list, label: 'All items', icon: LayoutList },
    { to: index, label: 'Browse by category', icon: FolderTree },
  ];

  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1', className)}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          role="tab"
          className={({ isActive }) =>
            cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}
