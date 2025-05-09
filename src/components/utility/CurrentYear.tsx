// src/components/utility/CurrentYear.tsx
"use client";

import { useState, useEffect } from 'react';

export function CurrentYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    // This code runs only on the client, after the component has mounted.
    setYear(new Date().getFullYear());
  }, []);

  // Render null or a placeholder on the server and during initial client render
  // to ensure no hydration mismatch for this dynamic value.
  // The actual year will fill in after useEffect runs on the client.
  if (year === null) {
    return null; // Or you could return a placeholder like '...' or an empty span
  }

  return <>{year}</>;
}
