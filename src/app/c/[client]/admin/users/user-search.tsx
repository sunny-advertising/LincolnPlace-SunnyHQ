"use client";

export function UserSearch() {
  return (
    <input
      className="search"
      placeholder="Search users…"
      aria-label="Search users"
      onChange={(e) => {
        const v = e.target.value.toLowerCase();
        document.querySelectorAll<HTMLTableRowElement>("#users tbody tr").forEach((r) => {
          r.style.display = (r.dataset.search ?? "").includes(v) ? "" : "none";
        });
      }}
    />
  );
}
