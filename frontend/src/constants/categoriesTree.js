/** Иерархия категорий для фильтра на странице списка заданий; источник данных — CATEGORIES. */
import { CATEGORIES } from "./categories.js";

const slugify = (value = "") =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яё0-9-_]/gi, "")
    .replace(/-+/g, "-");

export const CATEGORY_TREE = Object.entries(CATEGORIES).map(([categoryTitle, subcategories], categoryIndex) => {
  const categoryId = `cat-${categoryIndex}-${slugify(categoryTitle)}`;
  return {
    id: categoryId,
    slug: slugify(categoryTitle),
    title: categoryTitle,
    children: subcategories.map((subcategoryTitle, subcategoryIndex) => ({
      id: `sub-${categoryIndex}-${subcategoryIndex}-${slugify(subcategoryTitle)}`,
      slug: slugify(subcategoryTitle),
      title: subcategoryTitle,
      parentId: categoryId,
    })),
  };
});

export const SUBCATEGORY_BY_ID = CATEGORY_TREE.reduce((acc, category) => {
  category.children.forEach((subcategory) => {
    acc[subcategory.id] = subcategory;
  });
  return acc;
}, {});

export const CATEGORY_BY_ID = CATEGORY_TREE.reduce((acc, category) => {
  acc[category.id] = category;
  return acc;
}, {});
