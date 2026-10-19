import { useQuery } from "@tanstack/react-query";
import { getEvolution, getPortfolio, getStatus, getTemplates, seedPortfolio } from "./api";

/** Content comes from the API; the bundled seed shows instantly and covers a sleeping server. */
export function usePortfolio() {
  const q = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio,
    placeholderData: seedPortfolio,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return { ...q, data: q.data ?? seedPortfolio };
}

export const useStatus = () => useQuery({ queryKey: ["status"], queryFn: getStatus, staleTime: 30_000, retry: 1 });
export const useEvolution = () => useQuery({ queryKey: ["evolution"], queryFn: getEvolution, staleTime: 60_000, retry: 1 });
export const useTemplates = () => useQuery({ queryKey: ["templates"], queryFn: getTemplates, staleTime: Infinity, retry: 1 });
