export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTimeJa(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateJa(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}
