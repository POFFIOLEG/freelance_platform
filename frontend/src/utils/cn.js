/** Склеивает className из условных фрагментов (удобнее, чем длинные шаблонные строки). */
export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}
