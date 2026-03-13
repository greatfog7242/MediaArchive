"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useInstantSearch } from "react-instantsearch";

// Simple router that syncs InstantSearch state to URL
export function useSearchRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const { use } = useInstantSearch();

  useEffect(() => {
    // Listen for InstantSearch state changes
    const unsubscribe = use(({ uiState }) => {
      const searchState = uiState.media_records;
      const params = new URLSearchParams();
      
      // Only update URL if there's actually a search state
      if (searchState.query) {
        params.set("q", searchState.query);
      }
      
      if (searchState.refinementList) {
        Object.entries(searchState.refinementList).forEach(([facet, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            params.set(facet, values.join(","));
          }
        });
      }
      
      if (searchState.page && searchState.page > 1) {
        params.set("page", searchState.page.toString());
      }
      
      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentUrl = window.location.pathname + window.location.search;
      
      // Only update if URL has changed
      if (newUrl !== currentUrl) {
        // Use replaceState to update URL without navigation
        window.history.replaceState(null, "", newUrl);
      }
    });
    
    return unsubscribe;
  }, [router, pathname, use]);
}