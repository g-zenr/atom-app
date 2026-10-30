"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The app navigation.
 *
 * The sections that are not built yet are listed as visibly disabled items —
 * honest placeholders that go nowhere and render no pages. They are not links
 * and do not pretend to work.
 */

const BUILT = [{ href: "/notes", label: "Notes" }] as const;

const NOT_BUILT = [
  "Projects",
  "Tasks",
  "Reimbursements",
  "Job applications",
  "Monitoring",
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Main">
      {BUILT.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav-link"
          aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
      {NOT_BUILT.map((label) => (
        <span
          key={label}
          className="nav-item-disabled"
          aria-disabled="true"
          title="Not built yet"
        >
          {label}
        </span>
      ))}
    </nav>
  );
}
