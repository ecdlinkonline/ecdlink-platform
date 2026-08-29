"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname } from "next/navigation";

export type BreadcrumbOverride = { pathname: string; label: string };

export const BreadcrumbLabelContext = createContext<React.Dispatch<React.SetStateAction<BreadcrumbOverride | null>> | null>(null);

export function BreadcrumbLabel({ label }: { label: string }) {
  const pathname = usePathname();
  const setBreadcrumbOverride = useContext(BreadcrumbLabelContext);

  useEffect(() => {
    setBreadcrumbOverride?.({ pathname, label });
    return () => setBreadcrumbOverride?.((current) => current?.pathname === pathname ? null : current);
  }, [label, pathname, setBreadcrumbOverride]);

  return null;
}
