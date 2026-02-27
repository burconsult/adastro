import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Category, Tag } from '../types/index.js';

interface CategoryTagSelectorProps {
  categories: Category[];
  tags: Tag[];
  selectedCategoryIds: string[];
  selectedTagIds: string[];
  onCategoriesChange: (categoryIds: string[]) => void;
  onTagsChange: (tagIds: string[]) => void;
  onTagCreated?: (tag: Tag) => void;
}

export const CategoryTagSelector: React.FC<CategoryTagSelectorProps> = ({
  categories,
  tags,
  selectedCategoryIds,
  selectedTagIds,
  onCategoriesChange,
  onTagsChange,
  onTagCreated
}) => {
  const [categorySearch, setCategorySearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagList, setTagList] = useState<Tag[]>(tags);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  useEffect(() => {
    setTagList(tags);
  }, [tags]);

  const filteredTags = tagList.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const selectedCategories = categories.filter(category =>
    selectedCategoryIds.includes(category.id)
  );

  const selectedTags = tagList.filter(tag =>
    selectedTagIds.includes(tag.id)
  );

  const handleCategoryToggle = useCallback((categoryId: string) => {
    const newSelectedIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter(id => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    onCategoriesChange(newSelectedIds);
  }, [selectedCategoryIds, onCategoriesChange]);

  const handleTagToggle = useCallback((tagId: string) => {
    const newSelectedIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    onTagsChange(newSelectedIds);
  }, [selectedTagIds, onTagsChange]);

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          slug: newTagName.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-')
        })
      });

      if (response.ok) {
        const newTag = await response.json();
        setTagList((prev) => [...prev, newTag]);
        onTagsChange([...selectedTagIds, newTag.id]);
        onTagCreated?.(newTag);
        setNewTagName('');
        setTagSearch('');
        // Note: In a real implementation, you'd want to refresh the tags list
        // or add the new tag to the local state
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  }, [newTagName, selectedTagIds, onTagsChange]);

  const getCategoryHierarchy = (category: Category): string => {
    // Simple implementation - in a real app, you'd build the full hierarchy
    return category.name;
  };

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="card p-4">
        <h4 className="font-semibold mb-3">Categories</h4>
        
        {/* Selected Categories */}
        {selectedCategories.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map(category => (
                <span
                  key={category.id}
                  className="badge gap-1 bg-primary/10 text-primary text-sm"
                >
                  {category.name}
                  <button
                    type="button"
                    onClick={() => handleCategoryToggle(category.id)}
                    className="text-primary hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Category Search/Dropdown */}
        <div className="relative" ref={categoryDropdownRef}>
          <input
            type="text"
            value={categorySearch}
            onChange={(e) => {
              setCategorySearch(e.target.value);
              setShowCategoryDropdown(true);
            }}
            onFocus={() => setShowCategoryDropdown(true)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search categories..."
          />

          {showCategoryDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-input rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filteredCategories.length > 0 ? (
                filteredCategories.map(category => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      handleCategoryToggle(category.id);
                      setCategorySearch('');
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                      selectedCategoryIds.includes(category.id) ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{getCategoryHierarchy(category)}</span>
                      {selectedCategoryIds.includes(category.id) && (
                        <span className="text-primary">✓</span>
                      )}
                    </div>
                    {category.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {category.description}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No categories found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="card p-4">
        <h4 className="font-semibold mb-3">Tags</h4>
        
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className="badge gap-1 bg-primary/10 text-primary text-sm"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleTagToggle(tag.id)}
                    className="text-primary hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tag Search/Dropdown */}
        <div className="relative" ref={tagDropdownRef}>
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => {
              setTagSearch(e.target.value);
              setShowTagDropdown(true);
            }}
            onFocus={() => setShowTagDropdown(true)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search or create tags..."
          />

          {showTagDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-input rounded-md shadow-lg max-h-48 overflow-y-auto">
              {/* Create new tag option */}
              {tagSearch.trim() && !filteredTags.some(tag => 
                tag.name.toLowerCase() === tagSearch.toLowerCase()
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTagName(tagSearch);
                    handleCreateTag();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary">+</span>
                    <span>Create "{tagSearch}"</span>
                  </div>
                </button>
              )}

              {/* Existing tags */}
              {filteredTags.length > 0 ? (
                filteredTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      handleTagToggle(tag.id);
                      setTagSearch('');
                      setShowTagDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                      selectedTagIds.includes(tag.id) ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{tag.name}</span>
                      {selectedTagIds.includes(tag.id) && (
                        <span className="text-primary">✓</span>
                      )}
                    </div>
                  </button>
                ))
              ) : tagSearch.trim() ? null : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Start typing to search or create tags
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick tag suggestions */}
        <div className="mt-3">
          <div className="text-xs text-muted-foreground mb-2">Popular tags:</div>
          <div className="flex flex-wrap gap-1">
            {tagList.slice(0, 8).map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-2 py-1 text-xs rounded-md border ${
                  selectedTagIds.includes(tag.id)
                    ? 'bg-primary/10 text-primary border-primary/40'
                    : 'bg-muted text-muted-foreground border-input hover:bg-muted/80'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryTagSelector;
