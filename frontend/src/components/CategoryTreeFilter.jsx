import { useEffect, useMemo, useRef, useState } from "react";
import list from "./FilterListMenu.module.css";
import styles from "./CategoryTreeFilter.module.css";

const CategoryTreeFilter = ({ tree, value, onChange }) => {
  const [catOpen, setCatOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const catRef = useRef(null);
  const subRef = useRef(null);

  const selectedCategoryIds = useMemo(() => new Set(value.categoryIds || []), [value.categoryIds]);
  const selectedSubcategoryIds = useMemo(() => new Set(value.subcategoryIds || []), [value.subcategoryIds]);

  const selectedCategoryObjects = useMemo(
    () => tree.filter((c) => selectedCategoryIds.has(c.id)),
    [tree, selectedCategoryIds],
  );

  const visibleSubcategories = useMemo(() => {
    if (selectedCategoryObjects.length === 0) return [];
    const items = selectedCategoryObjects.flatMap((c) => c.children);
    if (!subSearch.trim()) return items;
    const q = subSearch.trim().toLowerCase();
    return items.filter((s) => s.title.toLowerCase().includes(q));
  }, [selectedCategoryObjects, subSearch]);

  const groupedSubcategories = useMemo(() => {
    const map = new Map();
    visibleSubcategories.forEach((s) => {
      if (!map.has(s.parentId)) map.set(s.parentId, []);
      map.get(s.parentId).push(s);
    });
    return map;
  }, [visibleSubcategories]);

  const subcategoryById = useMemo(() => {
    const m = new Map();
    tree.forEach((c) => c.children.forEach((s) => m.set(s.id, s)));
    return m;
  }, [tree]);

  useEffect(() => {
    const handler = (e) => {
      if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false);
      if (subRef.current && !subRef.current.contains(e.target)) setSubOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const emit = (catSet, subSet) => {
    onChange({ categoryIds: Array.from(catSet), subcategoryIds: Array.from(subSet) });
  };

  const toggleCategory = (cat) => {
    const nextCats = new Set(selectedCategoryIds);
    const nextSubs = new Set(selectedSubcategoryIds);
    if (nextCats.has(cat.id)) {
      nextCats.delete(cat.id);
      cat.children.forEach((s) => nextSubs.delete(s.id));
    } else {
      nextCats.add(cat.id);
    }
    emit(nextCats, nextSubs);
  };

  const removeCategory = (cat) => {
    const nextCats = new Set(selectedCategoryIds);
    const nextSubs = new Set(selectedSubcategoryIds);
    nextCats.delete(cat.id);
    cat.children.forEach((s) => nextSubs.delete(s.id));
    emit(nextCats, nextSubs);
  };

  const toggleSubcategory = (sub) => {
    const nextSubs = new Set(selectedSubcategoryIds);
    if (nextSubs.has(sub.id)) nextSubs.delete(sub.id);
    else nextSubs.add(sub.id);
    emit(new Set(selectedCategoryIds), nextSubs);
  };

  const removeSubcategory = (sub) => {
    const nextSubs = new Set(selectedSubcategoryIds);
    nextSubs.delete(sub.id);
    emit(new Set(selectedCategoryIds), nextSubs);
  };

  const selectedSubChips = useMemo(
    () => Array.from(selectedSubcategoryIds).map((id) => subcategoryById.get(id)).filter(Boolean),
    [selectedSubcategoryIds, subcategoryById],
  );

  return (
    <div className={styles.root}>
      <label className={styles.fieldLabel}>Категория</label>
      <div className={styles.dropdown} ref={catRef}>
        <div className={styles.control} onClick={() => setCatOpen((v) => !v)}>
          <div className={styles.chips}>
            {selectedCategoryObjects.map((c) => (
              <span key={c.id} className={styles.chip}>
                <span className={styles.chipLabel} title={c.title}>
                  {c.title}
                </span>
                <span className={styles.chipX} onClick={(e) => { e.stopPropagation(); removeCategory(c); }}>×</span>
              </span>
            ))}
          </div>
          <span className={styles.arrow}>&#9662;</span>
        </div>
        {catOpen && (
          <div className={list.menu} role="listbox">
            {tree.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${list.menuItem} ${selectedCategoryIds.has(c.id) ? list.menuItemSelected : ""}`}
                onClick={() => toggleCategory(c)}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className={styles.fieldLabel}>Подкатегория</label>
      <div className={styles.dropdown} ref={subRef}>
        <div
          className={styles.control}
          onClick={() => {
            if (selectedCategoryObjects.length > 0) setSubOpen((v) => !v);
          }}
        >
          <div className={styles.chips}>
            {selectedSubChips.map((s) => (
              <span key={s.id} className={styles.chip}>
                <span className={styles.chipLabel} title={s.title}>
                  {s.title}
                </span>
                <span className={styles.chipX} onClick={(e) => { e.stopPropagation(); removeSubcategory(s); }}>×</span>
              </span>
            ))}
            <input
              className={styles.searchInput}
              placeholder="Выберите подкатегорию"
              value={subSearch}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedCategoryObjects.length > 0) setSubOpen(true);
              }}
              onChange={(e) => {
                setSubSearch(e.target.value);
                setSubOpen(true);
              }}
            />
          </div>
          <span className={styles.arrow}>&#9662;</span>
        </div>
        {subOpen && (
          <div className={list.menu} role="listbox">
            {selectedCategoryObjects.length === 0 && (
              <p className={list.menuEmpty}>Сначала выберите категорию</p>
            )}
            {selectedCategoryObjects.map((cat) => {
              const items = groupedSubcategories.get(cat.id) || [];
              if (items.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div className={list.menuGroup}>{cat.title}</div>
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${list.menuItem} ${selectedSubcategoryIds.has(s.id) ? list.menuItemSelected : ""}`}
                      onClick={() => toggleSubcategory(s)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryTreeFilter;
