import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { projectsApi } from "@/lib/projects-api";

interface UseProjectsListArgs {
  pagination: { pageIndex: number; pageSize: number };
  debouncedSearchQuery: string;
  activeTab: string;
  filters: { projectType: string };
}

export function useProjectsList() {
  const [projects, setProjects] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProjects = useCallback(async (args: UseProjectsListArgs) => {
    const { pagination, debouncedSearchQuery, activeTab, filters } = args;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      };
      if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();
      if (activeTab !== "All") params.status = activeTab.toLowerCase();
      if (filters.projectType) params.projectType = filters.projectType;

      const data = await projectsApi.list(params); // Assuming apiFetch doesn't easily take signal yet, we'll check manually
      
      if (controller.signal.aborted) return;

      if (data && data.success !== false) {
        setProjects(data.data ?? []);
        setTotalCount(data.meta?.total ?? 0);
      } else {
        setProjects([]);
        setTotalCount(0);
        setError(data?.message || "Failed to load projects");
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setError(err.message || "Network error");
      setProjects([]);
      setTotalCount(0);
      toast.error("Failed to load projects.");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const deleteBulk = async (ids: number[]) => {
    try {
      const results = await Promise.all(
        ids.map((id) => projectsApi.remove(id).then(() => true).catch(() => false))
      );
      const failed = results.filter((r) => !r).length;
      const ok = results.filter((r) => r).length;
      if (failed > 0) toast.error(`Failed to delete ${failed} projects`);
      if (ok > 0) {
        toast.success(`${ok} project${ok === 1 ? "" : "s"} deleted successfully`);
        setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
        setTotalCount(prev => Math.max(0, prev - ok));
      }
      return { ok, failed };
    } catch {
      toast.error("Failed to delete projects");
      return { ok: 0, failed: ids.length };
    }
  };

  return { projects, totalCount, isLoading, error, fetchProjects, deleteBulk };
}
