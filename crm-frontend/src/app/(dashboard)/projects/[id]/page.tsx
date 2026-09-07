"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Edit, Loader2 } from "lucide-react";
import { projectsApi } from "@/lib/projects-api";
import { computeProjectRanges, formatPrice, formatPriceRange } from "@/lib/project-ranges";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-[15px] font-medium text-foreground">{value ?? "-"}</div>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    projectsApi
      .getOne(Number(id))
      .then((result) => {
        if (result && result.success !== false) {
          setProject(result.data ?? result);
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
  }, [id, router]);

  if (isLoading) {
    return (
      <>
        <MobileHeader title="Project" showBack />
        <TableSkeleton />
      </>
    );
  }
  if (!project) return null;

  const ranges = computeProjectRanges(project.units);
  const units = project.units ?? project.__units__ ?? [];

  return (
    <>
      <MobileHeader title={project.name} showBack />
      <div className="w-full flex flex-col gap-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-bold tracking-tight">{project.name}</h1>
              <Badge className="font-medium shadow-sm border whitespace-nowrap capitalize bg-blue-100 text-blue-800 border-blue-200">
                {project.projectType}
              </Badge>
              <Badge className="font-medium shadow-sm border whitespace-nowrap capitalize bg-gray-100 text-gray-800 border-gray-200">
                {project.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {project.city}
              {project.sublocation ? ` · ${project.sublocation}` : ""} · {formatPriceRange(ranges.minPrice, ranges.maxPrice)}
            </p>
          </div>
          <Link href={`/projects/new?edit=${project.id}`}>
            <Button variant="outline" className="h-11 rounded-full px-5">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </Link>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Field label="Price Range" value={formatPriceRange(ranges.minPrice, ranges.maxPrice)} />
            <Field label="BHK" value={ranges.bhk.length ? ranges.bhk.map((b) => `${b}BHK`).join(", ") : "-"} />
            <Field
              label="Area Range"
              value={ranges.minArea && ranges.maxArea ? `${ranges.minArea.toLocaleString("en-IN")} - ${ranges.maxArea.toLocaleString("en-IN")} sqft` : "-"}
            />
            <Field label="Possession" value={project.possessionStatus?.replace(/_/g, " ")} />
            <Field label="Builder" value={project.builderName} />
            <Field label="RERA" value={project.reraNumber} />
            <Field label="Towers" value={project.towers} />
            <Field label="Total Units" value={project.totalUnits} />
          </div>
          {project.description && <p className="text-muted-foreground mt-6 whitespace-pre-line">{project.description}</p>}
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Units ({units.length})</h3>
          {units.length === 0 ? (
            <p className="text-muted-foreground">No units added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] text-left">
                <thead>
                  <tr className="text-[12px] text-muted-foreground uppercase border-b">
                    <th className="py-3 pr-4 font-medium">Code</th>
                    <th className="py-3 pr-4 font-medium">BHK</th>
                    <th className="py-3 pr-4 font-medium">Area (sqft)</th>
                    <th className="py-3 pr-4 font-medium">Price</th>
                    <th className="py-3 pr-4 font-medium">Facing</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {units.map((u: any) => (
                    <tr key={u.id ?? u.unitCode}>
                      <td className="py-3 pr-4 font-mono text-xs">{u.unitCode}</td>
                      <td className="py-3 pr-4">{u.bedrooms != null ? `${u.bedrooms}BHK` : "-"}</td>
                      <td className="py-3 pr-4">{u.builtupAreaSqft ?? u.carpetAreaSqft ?? "-"}</td>
                      <td className="py-3 pr-4 font-semibold">{formatPrice(Number(u.price))}</td>
                      <td className="py-3 pr-4 capitalize">{u.facing?.replace(/_/g, " ") ?? "-"}</td>
                      <td className="py-3 pr-4 capitalize">{u.status ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
