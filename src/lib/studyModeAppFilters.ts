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
