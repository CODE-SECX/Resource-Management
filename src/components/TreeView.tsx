import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Search, FolderPlus, Tag, Hash } from 'lucide-react';

export type TreeNode = {
  id: string;
  label: string;
  type: string; // e.g., 'category' | 'subcategory' | 'tag'
  hasChildren?: boolean;
  badgeText?: string;
  color?: string | null;
  description?: string;
};

export type NodeActions = {
  onAddChild?: (parent: TreeNode) => Promise<void> | void;
  onRename?: (node: TreeNode) => Promise<void> | void;
  onDelete?: (node: TreeNode) => Promise<void> | void;
};

export interface TreeViewProps {
  rootNodes: TreeNode[];
  loadChildren: (node: TreeNode) => Promise<TreeNode[]>;
  actionsByType?: Record<string, NodeActions>;
  className?: string;
  version?: number; // bump this to reset/reload internal caches after external mutations
  filter?: string; // optional search query to filter and highlight nodes
}

export const TreeView: React.FC<TreeViewProps> = ({
  rootNodes,
  loadChildren,
  actionsByType = {},
  className,
  version = 0,
  filter = ''
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, TreeNode[]>>({});
  const [loadingMap, setLoadingMap] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);

  // Reset caches when version changes
  useEffect(() => {
    setExpanded(new Set());
    setChildrenMap({});
    setLoadingMap(new Set());
    setFocusId(null);
  }, [version]);

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded]);

  const toggleNode = useCallback(async (node: TreeNode) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });

    if (!(childrenMap[node.id]) && node.hasChildren !== false) {
      setLoadingMap(prev => new Set(prev).add(node.id));
      try {
        const kids = await loadChildren(node);
        setChildrenMap(prev => ({ ...prev, [node.id]: kids }));
      } finally {
        setLoadingMap(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    }
  }, [childrenMap, loadChildren]);

  const handleKeyDown = (e: React.KeyboardEvent, node: TreeNode) => {
    // Basic keyboard navigation: Left collapse, Right expand, Up/Down move focus
    if (e.key === 'ArrowRight') {
      if (!isExpanded(node.id)) {
        e.preventDefault();
        void toggleNode(node);
      }
    } else if (e.key === 'ArrowLeft') {
      if (isExpanded(node.id)) {
        e.preventDefault();
        setExpanded(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Compute flat list of visible nodes to move focus
      e.preventDefault();
      const flat = buildFlatVisibleTree(rootNodes, childrenMap, expanded);
      const idx = flat.findIndex(n => n.node.id === node.id);
      if (idx !== -1) {
        const nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, flat.length - 1) : Math.max(idx - 1, 0);
        setFocusId(flat[nextIdx].node.id);
        const el = document.getElementById(`tree-node-${flat[nextIdx].node.id}`);
        el?.focus();
      }
    }
  };

  const matchesFilter = useCallback((label: string) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return label.toLowerCase().includes(q);
  }, [filter]);

  const renderLabelWithHighlight = (label: string) => {
    const q = filter.trim();
    if (!q) return label;
    const idx = label.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return label;
    const before = label.slice(0, idx);
    const hit = label.slice(idx, idx + q.length);
    const after = label.slice(idx + q.length);
    return (
      <span>
        {before}<span className="bg-yellow-500/30 rounded px-0.5">{hit}</span>{after}
      </span>
    );
  };

  const buildFlatVisibleTree = (
    roots: TreeNode[],
    cmap: Record<string, TreeNode[]>,
    exp: Set<string>
  ): { node: TreeNode; depth: number }[] => {
    const result: { node: TreeNode; depth: number }[] = [];
    const pushNode = (n: TreeNode, d: number) => {
      if (matchesFilter(n.label)) {
        result.push({ node: n, depth: d });
      }
      if (exp.has(n.id)) {
        (cmap[n.id] || []).forEach(k => pushNode(k, d + 1));
      }
    };
    roots.forEach(r => pushNode(r, 0));
    return result;
  };

  const [localFilter, setLocalFilter] = useState(filter);
  useEffect(() => setLocalFilter(filter), [filter]);

  const rootsFiltered = useMemo(() => {
    if (!localFilter.trim()) return rootNodes;
    return rootNodes.filter(n => matchesFilter(n.label));
  }, [rootNodes, localFilter, matchesFilter]);

  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case 'category':
        return <FolderPlus className="w-4 h-4 text-blue-400" />;
      case 'subcategory':
        return <Tag className="w-4 h-4 text-green-400" />;
      case 'tag':
        return <Hash className="w-4 h-4 text-purple-400" />;
      default:
        return <span className="w-4 h-4" />;
    }
  };

  const getNodeStyles = (node: TreeNode, depth: number) => {
    const baseStyles = "group flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 outline-none border";
    const depthPadding = { paddingLeft: `${depth * 20 + 12}px` };
    
    let typeStyles = "";
    switch (node.type) {
      case 'category':
        typeStyles = "bg-gradient-to-r from-blue-900/20 to-blue-800/10 border-blue-700/30 hover:from-blue-800/30 hover:to-blue-700/20 hover:border-blue-600/50";
        break;
      case 'subcategory':
        typeStyles = "bg-gradient-to-r from-green-900/20 to-green-800/10 border-green-700/30 hover:from-green-800/30 hover:to-green-700/20 hover:border-green-600/50";
        break;
      case 'tag':
        typeStyles = "bg-gradient-to-r from-purple-900/20 to-purple-800/10 border-purple-700/30 hover:from-purple-800/30 hover:to-purple-700/20 hover:border-purple-600/50";
        break;
      default:
        typeStyles = "bg-gray-800/50 border-gray-700 hover:bg-gray-700/50";
    }
    
    const focusStyles = focusId === node.id ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900" : "";
    
    return {
      className: `${baseStyles} ${typeStyles} ${focusStyles}`,
      style: depthPadding
    };
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const actions = actionsByType[node.type] || {};
    const isLoading = loadingMap.has(node.id);
    const expandedNow = isExpanded(node.id);
    const hasChildren = node.hasChildren !== false;
    const nodeStyles = getNodeStyles(node, depth);

    return (
      <div key={node.id} className="select-none mb-1">
        <div
          id={`tree-node-${node.id}`}
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown(e, node)}
          className={nodeStyles.className}
          style={nodeStyles.style}
          onFocus={() => setFocusId(node.id)}
        >
          {/* Expand/Collapse Button */}
          <button
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
            onClick={() => toggleNode(node)}
            disabled={!hasChildren}
            title={hasChildren ? (expandedNow ? 'Collapse' : 'Expand') : ''}
          >
            {hasChildren ? (
              expandedNow ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}
          </button>

          {/* Node Icon */}
          <div className="flex-shrink-0">
            {getNodeIcon(node)}
          </div>

          {/* Color Indicator for Subcategories */}
          {node.color && (
            <div 
              className="w-3 h-3 rounded-full border-2 border-white/20 shadow-sm" 
              style={{ backgroundColor: node.color }}
              title={`Color: ${node.color}`}
            />
          )}

          {/* Node Label and Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-100 font-medium text-sm truncate">
                {renderLabelWithHighlight(node.label)}
              </span>
              {node.badgeText && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-900/50 text-indigo-200 border border-indigo-700/50">
                  {node.badgeText}
                </span>
              )}
            </div>
            {node.description && (
              <div className="text-xs text-gray-400 mt-0.5 truncate">
                {node.description}
              </div>
            )}
          </div>

          {/* Always Visible Action Buttons */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {actions.onAddChild && (
              <button 
                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-900/20 rounded transition-all duration-200" 
                onClick={() => actions.onAddChild?.(node)} 
                title={`Add ${node.type === 'category' ? 'subcategory or tag' : node.type === 'subcategory' ? 'tag' : 'item'}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {actions.onRename && (
              <button 
                className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-all duration-200" 
                onClick={() => actions.onRename?.(node)} 
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {actions.onDelete && (
              <button 
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-all duration-200" 
                onClick={() => actions.onDelete?.(node)} 
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Children */}
        {expandedNow && (
          <div className="mt-1">
            {isLoading ? (
              <div className="flex items-center gap-2 py-2 px-4 text-xs text-gray-400" style={{ paddingLeft: `${(depth + 1) * 20 + 12}px` }}>
                <div className="animate-spin rounded-full h-3 w-3 border border-indigo-600 border-t-transparent"></div>
                Loading...
              </div>
            ) : (
              (childrenMap[node.id] || []).map(child => renderNode(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="max-h-[32rem] overflow-auto pr-2 space-y-1">
        {rootsFiltered.map(n => renderNode(n, 0))}
        {!rootsFiltered.length && (
          <div className="text-center text-gray-400 py-8">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No results found</div>
            <div className="text-xs mt-1">Try adjusting your search terms</div>
          </div>
        )}
      </div>
    </div>
  );
};
