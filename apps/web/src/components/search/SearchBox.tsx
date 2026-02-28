"use client";

import { useRef, useState, useCallback } from "react";
import { useSearchBox } from "react-instantsearch";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBox() {
  const { query, refine } = useSearchBox();
  const [inputValue, setInputValue] = useState(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        refine(value);
      }, 150);
    },
    [refine]
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search media records..."
        value={inputValue}
        onChange={handleChange}
        className="pl-9"
      />
    </div>
  );
}
