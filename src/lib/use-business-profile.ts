"use client";

import { useEffect, useState } from "react";
import { currentUser } from "@/lib/api";
import { profileFor, type BusinessProfile } from "@/lib/business-profiles";

/**
 * Tenant type lives in localStorage. First render must match SSR (unknown → garage),
 * then the real profile is applied after mount.
 */
export function useBusinessProfile(): BusinessProfile {
  const [type, setType] = useState<string | undefined>(undefined);
  useEffect(() => {
    setType(currentUser()?.tenant?.business_type);
  }, []);
  return profileFor(type);
}
