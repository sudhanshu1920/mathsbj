import type { StudyModeApp } from "@/lib/studyMode";

export type StudyModeAppFilter = "all" | "user" | "system";

export function filterStudyModeApps(
  apps: StudyModeApp[],
  filter: StudyModeAppFilter,
  search: string,
): StudyModeApp[] {
  const query = search.trim().toLocaleLowerCase();
  return apps.filter((app) => {
    const matchesFilter = filter === "all"
      || (filter === "system" ? app.systemApp : !app.systemApp);
    if (!matchesFilter) return false;
    return !query
      || app.label.toLocaleLowerCase().includes(query)
      || app.packageName.toLocaleLowerCase().includes(query);
  });
}

export function countStudyModeApps(apps: StudyModeApp[]) {
  return {
    all: apps.length,
    user: apps.filter((app) => !app.systemApp).length,
    system: apps.filter((app) => app.systemApp).length,
  };
}

 
/** Keep this picker's selected packages at the top without changing the source array. */
export function sortStudyModeAppsSelectedFirst(
  apps: StudyModeApp[],
  selectedPackageNames: string[],
): StudyModeApp[] {
  const selectedPackages = new Set(selectedPackageNames);
  return [...apps].sort((left, right) => {
    const leftSelected = selectedPackages.has(left.packageName);
    const rightSelected = selectedPackages.has(right.packageName);
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;

    const labelOrder = left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    return labelOrder || left.packageName.localeCompare(right.packageName);
  });
}
