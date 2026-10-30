"use client";

import { use, useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Edit, Loader2, ChevronDown, Download, Play } from "lucide-react";
import { formatProjectArea } from "@/lib/project-area";
import { projectsApi } from "@/lib/projects-api";
import {
  PROJECT_FAQ_SECTIONS,
  sectionOf,
} from "@/lib/faq-sections";
import {
  computeProjectRanges,
  formatPrice,
  formatPriceRange,
} from "@/lib/project-ranges";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-[15px] font-medium text-foreground">
        {value ?? "-"}
      </div>
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingBrochure, setDownloadingBrochure] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(
    {},
  );

  const handleBrochureDownload = async () => {
    if (!project?.brochureUrl || downloadingBrochure) return;
    // Force a real download instead of opening the PDF in a new tab, with
    // a new-tab fallback if the fetch fails (e.g. storage CORS).
    setDownloadingBrochure(true);
    try {
      const res = await fetch(project.brochureUrl);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download =
        project.brochureName ??
        `${project.projectCode ? `${project.projectCode}-` : ""}brochure.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      window.open(project.brochureUrl, "_blank", "noopener");
    } finally {
      setDownloadingBrochure(false);
    }
  };

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
  const connectivityRows = Array.isArray(project.connectivity)
    ? project.connectivity
    : [];
  const nearbyGroups = Array.isArray(project.nearbyCategories)
    ? project.nearbyCategories
    : [];
  const hasConnectivity =
    connectivityRows.length > 0 || nearbyGroups.length > 0;

  return (
    <>
      <MobileHeader title={project.name} showBack />
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 pt-4 lg:p-0 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0 pb-10 lg:pb-16">
        <div className="hidden md:flex items-center justify-between pr-0 md:pr-[150px] min-h-[48px]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-bold tracking-tight">
                {project.name}
              </h1>
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
              {project.sublocation ? ` · ${project.sublocation}` : ""} ·{" "}
              {formatPriceRange(ranges.minPrice, ranges.maxPrice)}
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
            {project.sublocation ? ` · ${project.sublocation}` : ""} ·{" "}
            {formatPriceRange(ranges.minPrice, ranges.maxPrice)}
          </p>
          <Link href={`/projects/new?edit=${project.id}`} className="w-full">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-foreground font-semibold border-border/60"
            >
              <Edit className="w-4 h-4 mr-2 text-muted-foreground" /> Edit
              Project
            </Button>
          </Link>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Field
              label="Price Range"
              value={formatPriceRange(ranges.minPrice, ranges.maxPrice)}
            />
            <Field
              label="BHK"
              value={
                ranges.bhk.length
                  ? ranges.bhk.map((b) => `${b}BHK`).join(", ")
                  : "-"
              }
            />
            <Field
              label="Area Range"
              value={
                ranges.minArea && ranges.maxArea
                  ? `${ranges.minArea.toLocaleString("en-IN")} - ${ranges.maxArea.toLocaleString("en-IN")} sqft`
                  : "-"
              }
            />
            <Field
              label="Possession"
              value={project.possessionStatus?.replace(/_/g, " ")}
            />
            <Field label="Builder" value={project.builderName} />
            <Field label="RERA" value={project.reraNumber} />
            {project.projectType === "apartment" && (
              <Field label="Towers" value={project.towers} />
            )}
            <Field label="Total Floors" value={project.totalFloors} />
            <Field
              label="Project Area"
              value={formatProjectArea(project.projectAreaSqft)}
            />
            <Field label="Total Units" value={project.totalUnits} />
            <Field label="Pincode" value={project.pincode} />
            <Field
              label="Possession Date"
              value={
                project.possessionDate
                  ? String(project.possessionDate).split("T")[0]
                  : undefined
              }
            />
          </div>
          {project.description && (
            <p className="text-muted-foreground mt-6 whitespace-pre-wrap break-words">
              {project.description}
            </p>
          )}
          {project.projectType !== "plot" && project.highlights && (
            <>
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6 mt-8">
                Highlights
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap break-words">
                {project.highlights}
              </p>
            </>
          )}
          {project.projectType !== "plot" &&
            Array.isArray(project.specifications) &&
            project.specifications.length > 0 && (
              <>
                <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6 mt-8">
                  Specifications
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {project.specifications.map((s: any, i: number) => (
                    <Field
                      key={i}
                      label={s.label}
                      value={
                        <ul className="list-disc pl-4 space-y-0.5">
                          {String(s.value ?? "")
                            .split("\n")
                            .filter((point: string) => point.trim())
                            .map((point: string, k: number) => (
                              <li key={k}>{point}</li>
                            ))}
                        </ul>
                      }
                    />
                  ))}
                </div>
              </>
            )}
          {project.projectType === "apartment" &&
            Array.isArray(project.towerDetails) &&
            project.towerDetails.length > 0 && (
              <>
                <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6 mt-8">
                  Tower Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {project.towerDetails.map((t: any, i: number) => (
                    <Field
                      key={i}
                      label={t.tower ? `Tower ${t.tower}` : `Tower ${i + 1}`}
                      value={
                        [
                          t.floors ? `${t.floors} floors` : null,
                          t.units ? `${t.units} units` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "-"
                      }
                    />
                  ))}
                </div>
              </>
            )}
        </div>

        {(project.projectAmenities ?? []).length > 0 && (
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
                Amenities
              </h3>
              <div className="flex flex-wrap gap-2">
                {(project.projectAmenities ?? []).map((pa: any) => (
                  <span
                    key={pa.amenityId}
                    className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[13px] font-medium capitalize"
                  >
                    {pa.amenity?.name ?? `Amenity ${pa.amenityId}`}
                  </span>
                ))}
              </div>
            </div>
          )}

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Location
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Field label="City" value={project.city} />
            <Field label="Sublocation" value={project.sublocation} />
            <Field label="State" value={project.state} />
            <Field label="Pincode" value={project.pincode} />
            <div className="col-span-2 md:col-span-4">
              <Field label="Address" value={project.address} />
            </div>
            <Field label="Latitude" value={project.latitude} />
            <Field label="Longitude" value={project.longitude} />
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Media
          </h3>
          {project.coverImageUrl && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Cover Image (Desktop)
              </p>
              <img
                src={project.coverImageUrl}
                alt={`${project.name} cover`}
                className="w-full max-w-md h-52 rounded-xl object-cover border border-border/60"
              />
            </div>
          )}
          {project.mobileCoverImageUrl && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Cover Image (Mobile)
              </p>
              <img
                src={project.mobileCoverImageUrl}
                alt={`${project.name} mobile cover`}
                className="w-40 h-52 rounded-xl object-cover border border-border/60"
              />
            </div>
          )}
          {Array.isArray(project.galleryImageUrls) &&
            project.galleryImageUrls.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Gallery ({project.galleryImageUrls.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {project.galleryImageUrls.map((g: any, i: number) => (
                    <img
                      key={i}
                      src={
                        typeof g === "string"
                          ? g
                          : (g.imageUrl ?? g.imageKey ?? "")
                      }
                      alt={`Gallery ${i + 1}`}
                      className="h-24 w-full rounded-xl object-cover border border-border/60 bg-muted/20"
                    />
                  ))}
                </div>
              </div>
            )}
          {Array.isArray(project.videoUrls) &&
            project.videoUrls.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Videos ({project.videoUrls.length})
                </p>
                <div className="space-y-1.5">
                  {project.videoUrls.map((v: any, i: number) => (
                    <a
                      key={i}
                      href={String(v)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-[#0052FF] hover:underline truncate"
                    >
                      <Play className="h-4 w-4 shrink-0" />
                      <span className="truncate">{String(v)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          {(project.brochureUrl || project.brochureKey) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Brochure
              </p>
              {project.brochureUrl ? (
                <button
                  type="button"
                  onClick={handleBrochureDownload}
                  disabled={downloadingBrochure}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0052FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0040CC] disabled:opacity-70"
                >
                  <Download className="h-4 w-4" />{" "}
                  {downloadingBrochure
                    ? "Downloading..."
                    : project.brochureName || "Download brochure"}
                </button>
              ) : (
                <p className="text-[15px] font-medium text-foreground">
                  {project.brochureName || project.brochureKey}
                </p>
              )}
            </div>
          )}
          {!project.coverImageUrl &&
            !project.mobileCoverImageUrl &&
            !(project.galleryImageUrls ?? []).length &&
            !(project.videoUrls ?? []).length &&
            !project.brochureKey && (
              <p className="text-sm text-muted-foreground italic">
                No media uploaded.
              </p>
            )}
        </div>

        {hasConnectivity && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              Connectivity & Nearby
            </h3>
            {connectivityRows.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                {connectivityRows.map((c: any, i: number) => (
                  <Field
                    key={i}
                    label={c.label || "Highlight"}
                    value={c.detail}
                  />
                ))}
              </div>
            )}
            {nearbyGroups.map((cat: any, i: number) => (
              <div key={i} className="mb-4 last:mb-0">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {cat.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(cat.places ?? []).map((pl: any, j: number) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[13px] font-medium"
                    >
                      {pl.name}
                      {pl.distance && (
                        <span className="text-muted-foreground">
                          · {pl.distance}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Units ({units.length})
          </h3>
          {units.length === 0 ? (
            <p className="text-muted-foreground">No units added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] text-left">
                <thead>
                  <tr className="text-[12px] text-muted-foreground uppercase border-b">
                    <th
                      className="py-3 pr-2 font-medium w-8"
                      aria-label="Expand"
                    />
                    <th className="py-3 pr-4 font-medium">Code</th>
                    <th className="py-3 pr-4 font-medium">Type</th>
                    {project.projectType !== "plot" && (
                      <th className="py-3 pr-4 font-medium">BHK</th>
                    )}
                    <th className="py-3 pr-4 font-medium">
                      {project.projectType === "plot" ? "Area" : "Area (sqft)"}
                    </th>
                    {project.projectType !== "plot" && (
                      <th className="py-3 pr-4 font-medium">Floor Nos</th>
                    )}
                    <th className="py-3 pr-4 font-medium">Price</th>
                    <th className="py-3 pr-4 font-medium">Facing</th>
                    {project.projectType !== "plot" && (
                      <th className="py-3 pr-4 font-medium">Furnishing</th>
                    )}
                    {project.projectType !== "plot" && (
                      <th className="py-3 pr-4 font-medium">Parking</th>
                    )}
                    <th className="py-3 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {units.map((u: any, idx: number) => {
                    const key = String(u.id ?? u.unitCode ?? idx);
                    const open = expandedUnits[key] ?? false;
                    const floorPlans: Array<{ floorName: string; imageKey?: string; imageUrl?: string }> = Array.isArray(u.floorPlans)
                      ? u.floorPlans
                      : (u.floorPlanImageUrl || u.floorPlanImageKey)
                        ? [{ floorName: "Existing plan", imageKey: u.floorPlanImageKey ?? u.floorPlanImageUrl, imageUrl: u.floorPlanImageUrl }]
                        : [];
                    return (
                      <Fragment key={u.id ?? u.unitCode}>
                        <tr
                          key={u.id ?? u.unitCode}
                          className={open ? "bg-muted/30" : undefined}
                        >
                          <td className="py-3 pr-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUnits((prev) => ({
                                  ...prev,
                                  [key]: !open,
                                }))
                              }
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              aria-label={
                                open
                                  ? `Collapse unit ${u.unitCode}`
                                  : `Expand unit ${u.unitCode}`
                              }
                              aria-expanded={open}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs">
                            {u.unitCode}
                          </td>
                          <td className="py-3 pr-4 capitalize">
                            {u.unitType?.replace(/_/g, " ") ?? "-"}
                          </td>
                          {project.projectType !== "plot" && (
                            <td className="py-3 pr-4">
                              {u.bedrooms != null ? `${u.bedrooms}BHK` : "-"}
                            </td>
                          )}
                          <td className="py-3 pr-4">
                            {project.projectType === "plot"
                              ? u.plotAreaCents != null &&
                                String(u.plotAreaCents).trim() !== ""
                                ? `${String(parseFloat(Number(u.plotAreaCents).toFixed(2)))} cents`
                                : "-"
                              : (u.builtupAreaSqft ?? u.carpetAreaSqft ?? "-")}
                          </td>
                          {project.projectType !== "plot" && (
                            <td className="py-3 pr-4">
                              {u.floorNo != null && String(u.floorNo).trim() !== ""
                                ? u.totalFloors
                                  ? `${u.floorNo} of ${u.totalFloors}`
                                  : `${u.floorNo}`
                                : "-"}
                            </td>
                          )}
                          <td className="py-3 pr-4 font-semibold">
                            {formatPrice(Number(u.price))}
                          </td>
                          <td className="py-3 pr-4 capitalize">
                            {u.facing?.replace(/_/g, " ") ?? "-"}
                          </td>
                          {project.projectType !== "plot" && (
                            <td className="py-3 pr-4 capitalize">
                              {u.furnishedStatus?.replace(/_/g, " ") ?? "-"}
                            </td>
                          )}
                          {project.projectType !== "plot" && (
                            <td className="py-3 pr-4 capitalize">
                              {[
                                u.parking != null ? `${u.parking}` : null,
                                u.parkingType
                                  ? String(u.parkingType).replace(/_/g, " ")
                                  : null,
                                u.unitGuestParking ? "Guest" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "-"}
                            </td>
                          )}
                          <td className="py-3 pr-4 capitalize">
                            {u.status ?? "-"}
                          </td>
                        </tr>
                        {open && (
                          <tr key={`${u.id ?? u.unitCode}-details`}>
                            <td
                              colSpan={project.projectType === "plot" ? 6 : 11}
                              className="py-4 pr-4 bg-muted/20"
                            >
                              {(() => {
                                const fmtArea = (v: any) =>
                                  v != null && String(v).trim() !== ""
                                    ? `${Number(v).toLocaleString("en-IN")} sqft`
                                    : undefined;
                                const isPlot = project.projectType === "plot";
                                const plotCents =
                                  u.plotAreaCents != null &&
                                  String(u.plotAreaCents).trim() !== ""
                                    ? Number(u.plotAreaCents)
                                    : null;
                                const details: [string, React.ReactNode][] = [
                                  ["Title", u.title],
                                  ...(!isPlot
                                    ? [
                                        ["Bathrooms", u.bathrooms],
                                        ["Balconies", u.balconies],
                                        [
                                          "Carpet Area",
                                          fmtArea(u.carpetAreaSqft),
                                        ],
                                        [
                                          "Built-up Area",
                                          fmtArea(u.builtupAreaSqft),
                                        ],
                                        [
                                          "Super Built-up",
                                          fmtArea(u.superBuiltupAreaSqft),
                                        ],
                                      ]
                                    : []),
                                  ...(isPlot &&
                                  plotCents != null &&
                                  Number.isFinite(plotCents)
                                    ? [
                                        [
                                          "Plot Area",
                                          `${String(parseFloat(plotCents.toFixed(2)))} cents`,
                                        ],
                                        [
                                          "Plot Area (sq.ft)",
                                          `${Math.round(plotCents * 435.6).toLocaleString("en-IN")} sqft`,
                                        ],
                                      ]
                                    : []),
                                  ...((project.projectType === "villa"
                                    ? [
                                        ["UDS Area", fmtArea(u.udsAreaSqft)],
                                        ["Plot Area", fmtArea(u.plotAreaSqft)],
                                      ]
                                    : []) as [string, React.ReactNode][]),
                                  ...((project.projectType === "villa" ||
                                  project.projectType === "plot"
                                    ? [
                                        ["Open Sides", u.openSides],
                                        ...(u.boundaryWall
                                          ? [["Boundary Wall", "Yes"]]
                                          : []),
                                      ]
                                    : []) as [string, React.ReactNode][]),
                                  ...(!isPlot && u.poojaRoom
                                    ? [
                                        ["Pooja Room", "Yes"] as [
                                          string,
                                          React.ReactNode,
                                        ],
                                      ]
                                    : []),
                                  ...(!isPlot && u.studyRoom
                                    ? [
                                        ["Study Room", "Yes"] as [
                                          string,
                                          React.ReactNode,
                                        ],
                                      ]
                                    : []),
                                  ...(!isPlot && u.totalFloors != null
                                    ? [
                                        [
                                          "Unit Total Floors",
                                          u.totalFloors,
                                        ] as [string, React.ReactNode],
                                      ]
                                    : []),
                                ].filter(
                                  ([, v]) =>
                                    v !== undefined &&
                                    v !== null &&
                                    String(v).trim() !== "",
                                ) as [string, React.ReactNode][];
                                if (
                                  details.length === 0 &&
                                  !(u.roomDimensions ?? []).length &&
                                  floorPlans.length === 0
                                ) {
                                  return (
                                    <p className="text-sm text-muted-foreground italic">
                                      No additional details.
                                    </p>
                                  );
                                }
                                return (
                                  <>
                                    {details.length > 0 && (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                                        {details.map(([label, value]) => (
                                          <Field
                                            key={label}
                                            label={label}
                                            value={value}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              {Array.isArray(u.roomDimensions) &&
                                u.roomDimensions.length > 0 && (
                                  <div className="mt-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                      {project.projectType === "plot"
                                        ? "Plot Dimensions"
                                        : "Room Dimensions"}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {u.roomDimensions.map(
                                        (r: any, i: number) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[13px] font-medium"
                                          >
                                            {r.name}: {r.dimensions}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              {floorPlans.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                    {project.projectType === "plot"
                                      ? "Plot Layout"
                                      : "Floor Plans"}
                                  </p>
                                  <div className="flex flex-wrap gap-4">
                                    {floorPlans.map((plan, planIndex) => {
                                      const image = plan.imageUrl || plan.imageKey;
                                      if (!image) return null;
                                      return (
                                        <div key={`${plan.floorName}-${planIndex}`} className="space-y-2">
                                          <p className="text-sm font-medium">{plan.floorName || "Existing plan"}</p>
                                          <img
                                            src={image}
                                            alt={`${plan.floorName || "Floor plan"} for ${u.unitCode}`}
                                            className="h-40 max-w-full rounded-xl object-contain border border-border/60 bg-white"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {Array.isArray(u.furnishingItems) &&
                                u.furnishingItems.length > 0 && (
                                  <div className="mt-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                      Furnishing Items
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {u.furnishingItems.map(
                                        (f: any, i: number) => (
                                          <span
                                            key={f.furnishingItemId ?? i}
                                            className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[13px] font-medium capitalize"
                                          >
                                            {f.furnishingItem?.name ??
                                              `Item ${f.furnishingItemId}`}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(project.projectFaqs ?? project.faqs ?? []).length > 0 && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              FAQs
            </h3>
            <div className="space-y-4">
              {(project.projectFaqs ?? project.faqs ?? []).map(
                (f: any, i: number) => (
                  <div
                    key={f.id ?? i}
                    className="rounded-xl border border-border/60 p-4"
                  >
                    <p className="text-[15px] font-bold text-foreground">
                      Q: {f.question}
                    </p>
                    <p className="text-[14px] text-muted-foreground mt-1 whitespace-pre-wrap">
                      A: {f.answer}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mt-2">
                      {PROJECT_FAQ_SECTIONS.find((tab) => tab.id === sectionOf(f))?.label ?? "Overview"}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
