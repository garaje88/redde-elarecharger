/** Up to two initials from the name, or the email when there is no name. */
export function userInitials(name: string | null | undefined, email: string | null | undefined) {
  return (
    (name ?? email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}
