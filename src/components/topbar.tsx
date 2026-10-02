import Link from "next/link";

/** Page header. Admins get the "Edit page" toggle, which adds ?edit=1 to the URL. */
export function TopBar({
  title, crumb, editHref, editing, children,
}: {
  title: string;
  crumb?: React.ReactNode;
  /** Current URL without the edit param; set only for admins on editable pages. */
  editHref?: string;
  editing?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="top">
      <div>
        <h1>{title}</h1>
        {crumb && <div className="crumb">{crumb}</div>}
      </div>
      <div className="top-right">
        {children}
        {editHref !== undefined && (
          <Link
            className={`btn${editing ? " on" : ""}`}
            href={editing ? editHref : editHref + (editHref.includes("?") ? "&" : "?") + "edit=1"}
            scroll={false}
          >
            {editing ? "Done editing" : "Edit page"}
          </Link>
        )}
      </div>
    </header>
  );
}
