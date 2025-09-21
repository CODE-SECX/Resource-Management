import React from 'react';
import { Check, Folder } from 'lucide-react';
import { type Category, type Subcategory } from '../lib/supabase';

interface SubcategoryWithCategory extends Subcategory {
  category: Category;
}

interface ColorCodedSubcategorySelectorProps {
  availableSubcategories: SubcategoryWithCategory[];
  selectedSubcategories: string[];
  onSubcategoryToggle: (subcategoryId: string) => void;
  selectedCategories: string[];
  allCategories: Category[];
}

export function ColorCodedSubcategorySelector({
  availableSubcategories,
  selectedSubcategories,
  onSubcategoryToggle,
  selectedCategories,
  allCategories
}: ColorCodedSubcategorySelectorProps) {
  // Group subcategories by category
  const subcategoriesByCategory = availableSubcategories.reduce((acc, sub) => {
    const categoryId = sub.category_id;
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(sub);
    return acc;
  }, {} as Record<string, SubcategoryWithCategory[]>);

  // Get selected categories data
  const selectedCategoriesData = allCategories.filter(cat => 
    selectedCategories.includes(cat.id)
  );

  if (selectedCategoriesData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Select categories first to see subcategories</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Folder className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-gray-300">
          Subcategories (Color-coded by Category)
        </h3>
      </div>

      {selectedCategoriesData.map(category => {
        const categorySubcategories = subcategoriesByCategory[category.id] || [];
        
        if (categorySubcategories.length === 0) return null;

        return (
          <div key={category.id} className="space-y-3">
            {/* Category Header */}
            <div 
              className="flex items-center space-x-3 p-3 rounded-lg border-l-4"
              style={{ 
                backgroundColor: `${category.color}15`,
                borderLeftColor: category.color 
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color }}
              ></div>
              <span className="text-sm font-medium text-gray-200">
                {category.name}
              </span>
              <span className="text-xs text-gray-400">
                ({categorySubcategories.length} subcategories)
              </span>
            </div>

            {/* Subcategories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
              {categorySubcategories.map(subcategory => {
                const isSelected = selectedSubcategories.includes(subcategory.id);
                
                return (
                  <div
                    key={subcategory.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/20'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/50 hover:bg-gray-700'
                    }`}
                    style={{ 
                      borderLeftColor: subcategory.color || category.color,
                      borderLeftWidth: '4px'
                    }}
                    onClick={() => onSubcategoryToggle(subcategory.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: subcategory.color || category.color }}
                        ></div>
                        <span className="text-sm font-medium text-gray-200">
                          {subcategory.name}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Category indicator for disambiguation */}
                    <div className="mt-2 text-xs text-gray-500">
                      from {category.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selection Summary */}
      {selectedSubcategories.length > 0 && (
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
          <h4 className="text-sm font-medium text-blue-300 mb-2">
            Selected Subcategories ({selectedSubcategories.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedSubcategories.map(subId => {
              const subcategory = availableSubcategories.find(sub => sub.id === subId);
              if (!subcategory) return null;
              
              return (
                <div
                  key={subId}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ 
                    backgroundColor: `${subcategory.category.color}20`,
                    border: `1px solid ${subcategory.category.color}40`
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: subcategory.category.color }}
                  ></div>
                  <span className="text-gray-200">
                    {subcategory.category.name} → {subcategory.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
