import { SubcategoryItem, CategoryItem } from '../types';

/**
 * Recursively finds all descendant subcategory IDs of given node ID(s)
 * based strictly on unique IDs, ensuring safe cascade delete and moves.
 *
 * @param targetIds Single subcategory/category ID or array of IDs
 * @param allSubcategories Complete list of subcategories
 * @param allCategories Optional list of categories
 * @returns Array of unique descendant SubcategoryItem IDs
 */
export function getDescendantSubcategoryIds(
  targetIds: string | string[],
  allSubcategories: SubcategoryItem[],
  allCategories?: CategoryItem[]
): string[] {
  if (!targetIds) return [];
  const rootIdList = Array.isArray(targetIds) ? targetIds.filter(Boolean) : [targetIds].filter(Boolean);
  if (rootIdList.length === 0) return [];

  const visitedIds = new Set<string>(rootIdList);
  const descendantIds: string[] = [];
  const queue: string[] = [...rootIdList];

  const subMap = new Map<string, SubcategoryItem>();
  allSubcategories.forEach(s => {
    if (s && s.id) subMap.set(s.id, s);
  });

  const catMap = new Map<string, CategoryItem>();
  if (allCategories) {
    allCategories.forEach(c => {
      if (c && c.id) catMap.set(c.id, c);
    });
  }

  while (queue.length > 0) {
    const currentParentId = queue.shift()!;
    const parentSub = subMap.get(currentParentId);
    const parentCat = catMap.get(currentParentId);
    const parentName = parentSub ? parentSub.name.trim().toLowerCase() : (parentCat ? parentCat.name.trim().toLowerCase() : null);

    for (const s of allSubcategories) {
      if (!s || !s.id || visitedIds.has(s.id)) continue;

      let isChild = false;

      // 1. Exact parentCategoryId match (highest priority, strict ID matching)
      if (s.parentCategoryId && s.parentCategoryId === currentParentId) {
        isChild = true;
      }
      // 2. Direct parentCategory ID match
      else if (s.parentCategory && s.parentCategory === currentParentId) {
        isChild = true;
      }
      // 3. Fallback for legacy items without parentCategoryId: match parent name if parent belongs to this node
      else if (parentName && s.parentCategory && s.parentCategory.trim().toLowerCase() === parentName) {
        // If s does not have a different explicit parentCategoryId pointing elsewhere
        if (!s.parentCategoryId || s.parentCategoryId === currentParentId) {
          isChild = true;
        }
      }

      if (isChild) {
        visitedIds.add(s.id);
        descendantIds.push(s.id);
        queue.push(s.id);
      }
    }
  }

  return descendantIds;
}

/**
 * Check if a candidate node is a descendant of a given ancestor node.
 * Prevents cycles when moving or updating categories.
 */
export function isDescendantSubcategory(
  candidateNodeId: string,
  ancestorNodeId: string,
  allSubcategories: SubcategoryItem[]
): boolean {
  if (!candidateNodeId || !ancestorNodeId) return false;
  if (candidateNodeId === ancestorNodeId) return true;
  const descendants = getDescendantSubcategoryIds(ancestorNodeId, allSubcategories);
  return descendants.includes(candidateNodeId);
}

/**
 * Resolves all direct child subcategories for a given parent node by ID & fallback name.
 */
export function getDirectChildSubcategories(
  parentId: string,
  parentName: string,
  allSubcategories: SubcategoryItem[]
): SubcategoryItem[] {
  const normParentName = (parentName || '').trim().toLowerCase();
  return (allSubcategories || []).filter(s => {
    if (!s || s.id === parentId) return false;
    if (s.parentCategoryId && s.parentCategoryId === parentId) return true;
    if (s.parentCategory === parentId) return true;
    if (normParentName && s.parentCategory && s.parentCategory.trim().toLowerCase() === normParentName) {
      if (!s.parentCategoryId || s.parentCategoryId === parentId) return true;
    }
    return false;
  });
}
