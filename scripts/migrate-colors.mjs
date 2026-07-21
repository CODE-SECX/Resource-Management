import fs from 'fs';
import path from 'path';

const replacements = [
  ['bg-gray-900/95', 'bg-background/95'],
  ['bg-gray-900', 'bg-background'],
  ['bg-slate-900', 'bg-background'],
  ['bg-slate-800/50', 'bg-card/50'],
  ['bg-slate-800', 'bg-card'],
  ['bg-slate-700/50', 'bg-muted/50'],
  ['bg-slate-700', 'bg-muted'],
  ['bg-slate-600', 'bg-muted'],
  ['bg-gray-800/70', 'bg-card/70'],
  ['bg-gray-800/50', 'bg-card/50'],
  ['bg-gray-800/30', 'bg-card/30'],
  ['bg-gray-800', 'bg-card'],
  ['bg-gray-700/50', 'bg-muted/50'],
  ['bg-gray-700', 'bg-muted'],
  ['bg-gray-600', 'bg-muted'],
  ['border-slate-700', 'border-border'],
  ['border-slate-600', 'border-border'],
  ['border-gray-800', 'border-border'],
  ['border-gray-700/50', 'border-border/50'],
  ['border-gray-700/30', 'border-border/30'],
  ['border-gray-700', 'border-border'],
  ['border-gray-600', 'border-border'],
  ['divide-slate-700', 'divide-border'],
  ['divide-gray-700', 'divide-border'],
  ['text-slate-100', 'text-foreground'],
  ['text-slate-200', 'text-foreground'],
  ['text-slate-300', 'text-muted-foreground'],
  ['text-slate-400', 'text-muted-foreground'],
  ['text-slate-500', 'text-muted-foreground'],
  ['text-gray-50', 'text-foreground'],
  ['text-gray-100', 'text-foreground'],
  ['text-gray-200', 'text-foreground'],
  ['text-gray-300', 'text-muted-foreground'],
  ['text-gray-400', 'text-muted-foreground'],
  ['text-gray-500', 'text-muted-foreground'],
  ['text-gray-600', 'text-muted-foreground'],
  ['hover:bg-slate-800', 'hover:bg-accent'],
  ['hover:bg-slate-700/50', 'hover:bg-accent/50'],
  ['hover:bg-slate-700', 'hover:bg-accent'],
  ['hover:bg-slate-600', 'hover:bg-accent'],
  ['hover:bg-gray-800/70', 'hover:bg-accent/70'],
  ['hover:bg-gray-800/30', 'hover:bg-accent/30'],
  ['hover:bg-gray-800', 'hover:bg-accent'],
  ['hover:bg-gray-700/50', 'hover:bg-accent/50'],
  ['hover:bg-gray-700', 'hover:bg-accent'],
  ['hover:text-white', 'hover:text-foreground'],
  ['hover:text-gray-200', 'hover:text-foreground'],
  ['hover:border-slate-600', 'hover:border-border'],
  ['hover:border-gray-600', 'hover:border-border'],
  ['ring-offset-gray-900', 'ring-offset-background'],
  ['placeholder-gray-400', 'placeholder:text-muted-foreground'],
  ['placeholder-gray-500', 'placeholder:text-muted-foreground'],
  ['placeholder:text-gray-500', 'placeholder:text-muted-foreground'],
  ['group-hover:bg-slate-600', 'group-hover:bg-muted'],
  ['group-hover:bg-slate-700', 'group-hover:bg-muted'],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
    else if (/\.(tsx|css)$/.test(entry.name) && !full.includes('index.css')) {
      let content = fs.readFileSync(full, 'utf8');
      const orig = content;
      for (const [from, to] of replacements) {
        content = content.split(from).join(to);
      }
      if (content !== orig) {
        fs.writeFileSync(full, content);
        console.log('Updated:', full);
      }
    }
  }
}

walk('src');
