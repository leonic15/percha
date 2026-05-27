/**
 * tiny class-name helper. Filters falsy + joins.
 * Replace with `clsx` or `tailwind-merge` si los necesitás.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
