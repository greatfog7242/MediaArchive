"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useInstantSearch } from "react-instantsearch";

export function useSearchRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const { addMiddlewares } = useInstantSearch();

  useEffect(() => {
    const middleware = () => {
      return {
        onStateChange({ uiState }: { uiState: any }) {
          const searchState = uiState.media_records;
          const params = new URLSearchParams();

          if (searchState.query && searchState.query !== "*") {
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

          if (newUrl !== currentUrl) {
            window.history.replaceState(null, "", newUrl);
          }
        },
      };
    };

    const unsubscribe = addMiddlewares(middleware);
    return unsubscribe;
  }, [router, pathname, addMiddlewares]);
}
