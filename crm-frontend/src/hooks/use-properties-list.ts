import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { propertiesApi } from "@/lib/properties-api";

interface UsePropertiesListArgs {
  pagination: { pageIndex: number; pageSize: number };
  debouncedSearchQuery: string;
  activeTab: string;
  filters: { propertyType: string; listingType: string; cityId: string };
}

export function usePropertiesList() {
  const [properties, setProperties] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [cities, setCities] = useState<{ id: number; cityName: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load cities robustly
  useEffect(() => {
    let isMounted = true;
    propertiesApi.formData()
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.cities ?? res?.cities ?? [];
        setCities(list.map((c: any) => ({ id: c.id, cityName: c.cityName ?? c.city_name ?? "" })));
      })
      .catch((err) => {
        console.error("Failed to load cities", err);
        // Could retry here if needed
      });
    return () => { isMounted = false; };
  }, []);

  const fetchProperties = useCallback(async (args: UsePropertiesListArgs) => {
    const { pagination, debouncedSearchQuery, activeTab, filters } = args;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      };
      if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();
      params.status = activeTab === "Archived" ? "archived" : "available";
      if (filters.propertyType) params.propertyType = filters.propertyType;
      if (filters.listingType) params.listingType = filters.listingType;
      if (filters.cityId) params.cityId = filters.cityId;

      const data = await propertiesApi.list(params);
      
      if (controller.signal.aborted) return;

      if (data && data.success !== false) {
        setProperties(data.data ?? []);
        setTotalCount(data.meta?.total ?? 0);
      } else {
        setProperties([]);
        setTotalCount(0);
      }
    } catch {
      if (controller.signal.aborted) return;
      toast.error("Failed to load properties.");
      setProperties([]);
      setTotalCount(0);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const toggleVisibility = async (id: number) => {
    try {
      await propertiesApi.toggleVisibility(id);
      toast.success("Visibility updated.");
      // We don't call fetchProperties directly here. 
      // We return success so caller can trigger refresh.
      return true;
    } catch {
      toast.error("Failed to toggle visibility.");
      return false;
    }
  }

  const deleteBulk = async (ids: number[]) => {
    try {
      const results = await Promise.all(
        ids.map((id) => propertiesApi.remove(id).then(() => true).catch(() => false))
      );
      const failed = results.filter((r) => !r).length;
      const ok = results.filter((r) => r).length;
      if (failed > 0) toast.error(`Failed to delete ${failed} properties`);
      if (ok > 0) {
        toast.success(`${ok} propert${ok === 1 ? "y" : "ies"} deleted successfully`);
        setProperties((prev) => prev.filter((p) => !ids.includes(p.id)));
        setTotalCount(prev => Math.max(0, prev - ok));
      }
      return { ok, failed };
    } catch {
      toast.error("Failed to delete properties");
      return { ok: 0, failed: ids.length };
    }
  };

  return { properties, totalCount, isLoading, cities, fetchProperties, toggleVisibility, deleteBulk };
}
