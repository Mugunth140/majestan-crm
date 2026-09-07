"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { projectsApi } from "@/lib/projects-api";
import { ProjectForm } from "../_components/ProjectForm";

function ProjectFormLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
        <p className="text-muted-foreground font-medium">Loading project data...</p>
      </div>
    </div>
  );
}

function ProjectFormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");

  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    setIsLoading(true);
    projectsApi
      .getOne(Number(editId))
      .then((result) => {
        if (result && result.success !== false) {
          setInitialData(result.data ?? result);
        } else {
          toast.error("Project not found.");
          router.push("/projects");
        }
      })
      .catch(() => {
        toast.error("Failed to load project.");
        router.push("/projects");
      })
      .finally(() => setIsLoading(false));
  }, [editId, router]);

  if (isLoading) return <ProjectFormLoader />;
  if (editId && !initialData) return null;

  return <ProjectForm mode={editId ? "edit" : "create"} initialData={initialData ?? undefined} />;
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<ProjectFormLoader />}>
      <ProjectFormPage />
    </Suspense>
  );
}
