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
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 pt-4 lg:p-0 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
        <div className="hidden md:flex items-center justify-between pr-0 md:pr-[150px] min-h-[48px]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-bold tracking-tight">{project.name}</h1>
              {project.projectCode && (
                <span className="font-mono text-xs font-bold text-muted-foreground bg-muted border px-2 py-1 rounded-md">
                  {project.projectCode}
                </span>
              )}
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
            <Button className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
              <Edit className="h-4 w-4 mr-2" /> Edit Project
            </Button>
          </Link>
        </div>

        {/* ── Mobile Header Strip ── */}
        <div className="md:hidden flex flex-col gap-3 px-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {project.projectCode && (
              <span className="font-mono text-xs font-bold text-muted-foreground bg-muted border px-2 py-1 rounded-md">
                {project.projectCode}
              </span>
            )}
            <Badge className="font-medium shadow-sm border whitespace-nowrap capitalize bg-blue-100 text-blue-800 border-blue-200">
              {project.projectType}
            </Badge>
            <Badge className="font-medium shadow-sm border whitespace-nowrap capitalize bg-gray-100 text-gray-800 border-gray-200">
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {project.city}
            {project.sublocation ? ` · ${project.sublocation}` : ""} · {formatPriceRange(ranges.minPrice, ranges.maxPrice)}
          </p>
          <Link href={`/projects/new?edit=${project.id}`} className="w-full">
            <Button variant="outline" className="w-full h-11 rounded-xl text-foreground font-semibold border-border/60">
              <Edit className="w-4 h-4 mr-2 text-muted-foreground" /> Edit Project
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
            {project.projectType === "apartment" && <Field label="Towers" value={project.towers} />}
            <Field label="Total Floors" value={project.totalFloors} />
            <Field
              label="Project Area"
              value={project.projectAreaSqft ? `${Number(project.projectAreaSqft).toLocaleString("en-IN")} sqft` : undefined}
            />
            <Field label="Total Units" value={project.totalUnits} />
            <Field label="Pincode" value={project.pincode} />
            <Field label="Possession Date" value={project.possessionDate ? String(project.possessionDate).split("T")[0] : undefined} />
          </div>
          {project.description && <p className="text-muted-foreground mt-6 whitespace-pre-wrap break-words">{project.description}</p>}
          {project.highlights && (
            <>
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6 mt-8">Highlights</h3>
              <p className="text-muted-foreground whitespace-pre-wrap break-words">{project.highlights}</p>
            </>
          )}
          {Array.isArray(project.specifications) && project.specifications.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6 mt-8">Specifications</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {project.specifications.map((s: any, i: number) => (
                  <Field key={i} label={s.label} value={s.value} />
                ))}
              </div>
            </>
          )}
          {project.projectType === "apartment" && Array.isArray(project.towerDetails) && project.towerDetails.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6 mt-8">Tower Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {project.towerDetails.map((t: any, i: number) => (
                  <Field
                    key={i}
                    label={t.tower ? `Tower ${t.tower}` : `Tower ${i + 1}`}
                    value={[t.floors ? `${t.floors} floors` : null, t.units ? `${t.units} units` : null].filter(Boolean).join(" · ") || "-"}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {(project.projectAmenities ?? []).length > 0 && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {(project.projectAmenities ?? []).map((pa: any) => (
                <span key={pa.amenityId} className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[13px] font-medium capitalize">
                  {pa.amenity?.name ?? `Amenity ${pa.amenityId}`}
                </span>
              ))}
            </div>
          </div>
        )}

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
                    <th className="py-3 pr-4 font-medium">Type</th>
                    <th className="py-3 pr-4 font-medium">BHK</th>
                    <th className="py-3 pr-4 font-medium">Area (sqft)</th>
                    <th className="py-3 pr-4 font-medium">Floor</th>
                    <th className="py-3 pr-4 font-medium">Price</th>
                    <th className="py-3 pr-4 font-medium">Facing</th>
                    <th className="py-3 pr-4 font-medium">Furnishing</th>
                    <th className="py-3 pr-4 font-medium">Parking</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {units.map((u: any) => (
                    <tr key={u.id ?? u.unitCode}>
                      <td className="py-3 pr-4 font-mono text-xs">{u.unitCode}</td>
                      <td className="py-3 pr-4 capitalize">{u.unitType?.replace(/_/g, " ") ?? "-"}</td>
                      <td className="py-3 pr-4">{u.bedrooms != null ? `${u.bedrooms}BHK` : "-"}</td>
                      <td className="py-3 pr-4">{u.builtupAreaSqft ?? u.carpetAreaSqft ?? "-"}</td>
                      <td className="py-3 pr-4">{u.floorNo != null ? (u.totalFloors ? `${u.floorNo} of ${u.totalFloors}` : `${u.floorNo}`) : "-"}</td>
                      <td className="py-3 pr-4 font-semibold">{formatPrice(Number(u.price))}</td>
                      <td className="py-3 pr-4 capitalize">{u.facing?.replace(/_/g, " ") ?? "-"}</td>
                      <td className="py-3 pr-4 capitalize">{u.furnishedStatus?.replace(/_/g, " ") ?? "-"}</td>
                      <td className="py-3 pr-4 capitalize">
                        {[
                          u.parking != null ? `${u.parking}` : null,
                          u.parkingType ? String(u.parkingType).replace(/_/g, " ") : null,
                          u.unitGuestParking ? "Guest" : null,
                        ].filter(Boolean).join(" · ") || "-"}
                      </td>
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
