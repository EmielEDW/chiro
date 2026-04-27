export const CATEGORY_COLOR_KEYS = [
  "blue",
  "amber",
  "red",
  "yellow",
  "gray",
  "green",
  "purple",
  "pink",
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLOR_KEYS)[number];

const COLOR_CLASSES: Record<CategoryColorKey, string> = {
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-yellow-100 text-yellow-800",
  gray: "bg-gray-100 text-gray-800",
  green: "bg-green-100 text-green-800",
  purple: "bg-purple-100 text-purple-800",
  pink: "bg-pink-100 text-pink-800",
};

const SWATCH_CLASSES: Record<CategoryColorKey, string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  gray: "bg-gray-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function categoryBadgeClass(color: string | null | undefined): string {
  if (color && color in COLOR_CLASSES) {
    return COLOR_CLASSES[color as CategoryColorKey];
  }
  return COLOR_CLASSES.gray;
}

export function categorySwatchClass(color: CategoryColorKey): string {
  return SWATCH_CLASSES[color];
}

export function isValidColorKey(value: string): value is CategoryColorKey {
  return (CATEGORY_COLOR_KEYS as readonly string[]).includes(value);
}
