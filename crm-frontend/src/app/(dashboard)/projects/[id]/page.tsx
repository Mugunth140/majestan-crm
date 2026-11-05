"use client";

import { CompletenessRing } from "@/components/record/score-ring";
import { projectScoreFields } from "@/lib/record-score";
import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, ChevronDown, Download, Edit, FileQuestion, ImageIcon, Info, LayoutGrid, Loader2, MapPin, Play } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldRow, Section } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { HEADER_BUTTON, StatusMenu } from "@/components/record/header-actions";
import { statusDot, statusPillClass } from "@/components/tables/cells";
import { formatProjectArea } from "@/lib/project-area";
import { projectsApi } from "@/lib/projects-api";
import { PROJECT_FAQ_SECTIONS, sectionOf } from "@/lib/faq-sections";
import { computeProjectRanges, formatPrice, formatPriceRange } from "@/lib/project-ranges";
import { cn } from "@/lib/utils";
import { ProjectForm, unitTypeLabel } from "../_components/ProjectForm";

type Tab = "overview" | "units" | "media" | "location" | "faqs";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the project API's shape
type Project = Record<string, any>;

const STATUSES = ["draft", "published", "booked", "archived"];
const words = (v?: string | null) => (v ? String(v).replace(/_/g, " ") : null);
const capital = (v?: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");

/** Kept from the old page: a label over its value, used inside a unit's details. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <div className="text-[14px] font-medium text-foreground">{value ?? "-"}</div>
    </div>
  );
}

/** A read-only row, styled like the editable fields on other record pages. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <FieldRow label={label}>
      <span className={cn("flex min-h-8 items-center px-2 text-[14px]", empty ? "text-muted-foreground/60" : "text-foreground")}>{empty ? "—" : children}</span>
    </FieldRow>
  );
}

/** One group of facts on a tab, two columns wide on desktop. */
function DataCard({ title, children, columns = true }: { title: string; children: ReactNode; columns?: boolean }) {
  return (
    <section className="@container overflow-hidden rounded-xl border bg-card">
      <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">{title}</h3>
      <div className={cn("px-3 py-2 md:px-4", columns && "grid gap-x-8 @xl:grid-cols-2")}>{children}</div>
    </section>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: typeof Info; label: string; count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
        active
          ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
          : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
      )}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
      {count ? (
        <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", active ? "bg-white/20 md:bg-foreground/[0.08]" : "bg-foreground/[0.08]")}>{count}</span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
    </button>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col md:h-full md:flex-row lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-11 items-center gap-5 border-b px-5 md:flex">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
        </div>
        <div className="space-y-5 p-4 md:p-10">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 border-l md:block xl:w-[360px]">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-12 w-16 rounded-lg" />
          <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
        </div>
        <div className="space-y-3 p-4">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [downloadingBrochure, setDownloadingBrochure] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

  const loadProject = useCallback(
    () => projectsApi.getOne(Number(id)).then((result) => {
      if (result && result.success !== false) return (result.data ?? result) as Project;
      toast.error("Project not found.");
      router.push("/projects");
      return null;
    }, () => {
      toast.error("Failed to load project.");
      router.push("/projects");
      return null;
    }),
    [id, router],
  );

  useEffect(() => {
    let live = true;
    loadProject().then((data) => {
      if (!live) return;
      if (data) setProject(data);
      setIsLoading(false);
    });
    return () => { live = false; };
  }, [loadProject]);

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
      a.download = project.brochureName ?? `${project.projectCode ? `${project.projectCode}-` : ""}brochure.pdf`;
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

  const changeStatus = async (status: string) => {
    try {
      const result = await projectsApi.updateStatus(Number(id), status);
      if (result && result.success === false) throw new Error(result.message);
      setProject((prev) => prev && { ...prev, status });
      toast.success(`Moved to ${capital(status)}`);
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Couldn't change the status");
    }
  };

  const ranges = useMemo(() => computeProjectRanges(project?.units), [project]);

  if (isLoading) return <><MobileHeader title="Project" showBack /><PageSkeleton /></>;
  if (!project) return null;

  const units = project.units ?? project.__units__ ?? [];
  const connectivityRows = Array.isArray(project.connectivity) ? project.connectivity : [];
  const nearbyGroups = Array.isArray(project.nearbyCategories) ? project.nearbyCategories : [];
  const gallery = Array.isArray(project.galleryImageUrls) ? project.galleryImageUrls : [];
  const videos = Array.isArray(project.videoUrls) ? project.videoUrls : [];
  const faqs = project.projectFaqs ?? project.faqs ?? [];
  const amenities = project.projectAmenities ?? [];
  const isPlot = project.projectType === "plot";
  const status = String(project.status || "draft").toLowerCase();
  const statusOptions = [...(STATUSES.includes(status) ? [] : [status]), ...STATUSES].map((s) => ({ value: s, label: capital(s), dot: statusDot(s) }));
  const priceRange = formatPriceRange(ranges.minPrice, ranges.maxPrice);
  const bhk = ranges.bhk.length ? ranges.bhk.map((b) => `${b}BHK`).join(", ") : null;
  const place = [project.sublocation, project.city].filter(Boolean).join(", ");
  const possessionDate = project.possessionDate ? String(project.possessionDate).split("T")[0] : null;
  const mediaCount = (project.coverImageUrl ? 1 : 0) + (project.mobileCoverImageUrl ? 1 : 0) + gallery.length + videos.length + (project.brochureKey || project.brochureUrl ? 1 : 0);

  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={capital(status)} options={statusOptions} pillClass={statusPillClass(status)} size={size} align={align}
      onChange={(v) => { if (v !== status) void changeStatus(v); }} />
  );
  const brochureButton = (project.brochureUrl ? (
    <button type="button" onClick={handleBrochureDownload} disabled={downloadingBrochure} className={HEADER_BUTTON}>
      {downloadingBrochure ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-muted-foreground" />} Brochure
    </button>
  ) : null);
  const editButton = (
    <button type="button" onClick={() => setEditing(true)} className={HEADER_BUTTON}>
      <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit
    </button>
  );

  const tabs: { key: Tab; label: string; icon: typeof Info; count?: number }[] = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "units", label: "Units", icon: LayoutGrid, count: units.length },
    { key: "media", label: "Media", icon: ImageIcon, count: mediaCount },
    { key: "location", label: "Location", icon: MapPin },
    { key: "faqs", label: "FAQs", icon: FileQuestion, count: faqs.length },
  ];

  const overview = (
    <div className="pb-6">
      <TabHeader title="Overview" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Project">
          <Fact label="Type"><span className="capitalize">{project.projectType}</span></Fact>
          <Fact label="Builder">{project.builderName}</Fact>
          <Fact label="RERA">{project.reraNumber}</Fact>
          <Fact label="Possession"><span className="capitalize">{words(project.possessionStatus)}</span></Fact>
          <Fact label="Possession date">{possessionDate}</Fact>
          <Fact label="Price range">{priceRange}</Fact>
          {!isPlot && <Fact label="BHK">{bhk}</Fact>}
          <Fact label="Area range">{ranges.minArea && ranges.maxArea ? `${ranges.minArea.toLocaleString("en-IN")} – ${ranges.maxArea.toLocaleString("en-IN")} sqft` : null}</Fact>
        </DataCard>

        <DataCard title="Size">
          {project.projectType === "apartment" && <Fact label="Towers">{project.towers}</Fact>}
          <Fact label="Total floors">{project.totalFloors}</Fact>
          <Fact label="Total units">{project.totalUnits}</Fact>
          <Fact label="Project area">{formatProjectArea(project.projectAreaSqft)}</Fact>
        </DataCard>

        {(project.description || (!isPlot && project.highlights)) && (
          <DataCard title="About" columns={false}>
            {project.description && <p className="whitespace-pre-wrap break-words px-1 py-2 text-[14px] leading-6 text-foreground">{project.description}</p>}
            {!isPlot && project.highlights && (
              <>
                <p className="mt-2 px-1 text-[13px] font-medium text-muted-foreground">Highlights</p>
                <p className="whitespace-pre-wrap break-words px-1 pb-2 pt-1 text-[14px] leading-6 text-foreground">{project.highlights}</p>
              </>
            )}
          </DataCard>
        )}

        {!isPlot && Array.isArray(project.specifications) && project.specifications.length > 0 && (
          <DataCard title="Specifications">
            {project.specifications.map((spec: Project, i: number) => (
              <FieldRow key={i} label={spec.label}>
                <ul className="list-disc space-y-0.5 py-1.5 pl-6 pr-2 text-[14px] text-foreground">
                  {String(spec.value ?? "").split("\n").filter((point: string) => point.trim()).map((point: string, k: number) => <li key={k}>{point}</li>)}
                </ul>
              </FieldRow>
            ))}
          </DataCard>
        )}

        {project.projectType === "apartment" && Array.isArray(project.towerDetails) && project.towerDetails.length > 0 && (
          <DataCard title="Towers">
            {project.towerDetails.map((t: Project, i: number) => (
              <Fact key={i} label={t.tower ? `Tower ${t.tower}` : `Tower ${i + 1}`}>
                {[t.floors ? `${t.floors} floors` : null, t.units ? `${t.units} units` : null].filter(Boolean).join(" · ") || null}
              </Fact>
            ))}
          </DataCard>
        )}

        {amenities.length > 0 && (
          <DataCard title={`Amenities (${amenities.length})`} columns={false}>
            <div className="flex flex-wrap gap-1.5 py-2">
              {amenities.map((pa: Project) => (
                <span key={pa.amenityId} className="inline-flex h-7 items-center rounded-md bg-foreground/[0.06] px-2.5 text-[13px] font-medium capitalize text-foreground">
                  {pa.amenity?.name ?? `Amenity ${pa.amenityId}`}
                </span>
              ))}
            </div>
          </DataCard>
        )}
      </div>
    </div>
  );

  const unitsTab = (
    <div className="pb-6">
      <TabHeader title={`Units (${units.length})`} />
      <div className="px-3 sm:px-10">
        {units.length === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="No units yet" hint="Add unit types, their sizes and prices from Edit → Units." />
        ) : (
          <ul className="space-y-3">
            {units.map((u: Project, idx: number) => {
              const key = String(u.id ?? u.unitCode ?? idx);
              const open = expandedUnits[key] ?? false;
              const floorPlans: Array<{ floorName: string; imageKey?: string; imageUrl?: string }> = Array.isArray(u.floorPlans)
                ? u.floorPlans
                : (u.floorPlanImageUrl || u.floorPlanImageKey)
                  ? [{ floorName: "Existing plan", imageKey: u.floorPlanImageKey ?? u.floorPlanImageUrl, imageUrl: u.floorPlanImageUrl }]
                  : [];
              const facts: [string, ReactNode][] = [
                ...(!isPlot ? [["BHK", u.bedrooms != null ? `${u.bedrooms} BHK` : null] as [string, ReactNode]] : []),
                [isPlot ? "Area" : "Area (sqft)", isPlot
                  ? u.plotAreaCents != null && String(u.plotAreaCents).trim() !== "" ? `${String(parseFloat(Number(u.plotAreaCents).toFixed(2)))} cents` : null
                  : (u.builtupAreaSqft ?? u.carpetAreaSqft)],
                ...(!isPlot ? [["Floor", u.floorNo != null && String(u.floorNo).trim() !== "" ? (u.totalFloors ? `${u.floorNo} of ${u.totalFloors}` : `${u.floorNo}`) : null] as [string, ReactNode]] : []),
                ["Facing", u.facing ? capital(String(u.facing).replace(/_/g, " ")) : null],
                ...(!isPlot ? [
                  ["Furnishing", u.furnishedStatus ? capital(String(u.furnishedStatus).replace(/_/g, " ")) : null],
                  ["Parking", [u.parking != null ? `${u.parking}` : null, u.parkingType ? String(u.parkingType).replace(/_/g, " ") : null, u.unitGuestParking ? "Guest" : null].filter(Boolean).join(" · ") || null],
                ] as [string, ReactNode][] : []),
              ];
              return (
                <li key={key} className="overflow-hidden rounded-xl border bg-card">
                  <button type="button" aria-expanded={open}
                    aria-label={open ? `Collapse unit ${u.unitCode}` : `Expand unit ${u.unitCode}`}
                    onClick={() => setExpandedUnits((prev) => ({ ...prev, [key]: !open }))}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30">
                    <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-xs text-muted-foreground">{u.unitCode}</span>
                        <span className="text-[14px] font-medium">{unitTypeLabel(u.unitType)}</span>
                        {u.status && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium capitalize", statusPillClass(u.status))}>{u.status}</span>
                        )}
                        <span className="ml-auto text-[14px] font-semibold">{formatPrice(Number(u.price))}</span>
                      </div>
                      <dl className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-4 gap-y-2">
                        {facts.map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-[12px] text-muted-foreground">{label}</dt>
                            <dd className="truncate text-[13px] capitalize">{value ?? "-"}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t bg-muted/20 px-4 py-4">
                              {(() => {
                                const fmtArea = (v: unknown) =>
                                  v != null && String(v).trim() !== ""
                                    ? `${Number(v).toLocaleString("en-IN")} sqft`
                                    : undefined;
                                const plotCents =
                                  u.plotAreaCents != null &&
                                  String(u.plotAreaCents).trim() !== ""
                                    ? Number(u.plotAreaCents)
                                    : null;
                                const details: [string, ReactNode][] = [
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
                                    : []) as [string, ReactNode][]),
                                  ...((project.projectType === "villa" ||
                                  project.projectType === "plot"
                                    ? [
                                        ["Open Sides", u.openSides],
                                        ...(u.boundaryWall
                                          ? [["Boundary Wall", "Yes"]]
                                          : []),
                                      ]
                                    : []) as [string, ReactNode][]),
                                  ...(!isPlot && u.poojaRoom
                                    ? [
                                        ["Pooja Room", "Yes"] as [
                                          string,
                                          ReactNode,
                                        ],
                                      ]
                                    : []),
                                  ...(!isPlot && u.studyRoom
                                    ? [
                                        ["Study Room", "Yes"] as [
                                          string,
                                          ReactNode,
                                        ],
                                      ]
                                    : []),
                                  ...(!isPlot && u.totalFloors != null
                                    ? [
                                        [
                                          "Unit Total Floors",
                                          u.totalFloors,
                                        ] as [string, ReactNode],
                                      ]
                                    : []),
                                ].filter(
                                  ([, v]) =>
                                    v !== undefined &&
                                    v !== null &&
                                    String(v).trim() !== "",
                                ) as [string, ReactNode][];
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
                                        (r: Project, i: number) => (
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
                                        (f: Project, i: number) => (
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const media = (
    <div className="pb-6">
      <TabHeader title="Media" action={brochureButton} />
      <div className="space-y-5 px-3 sm:px-10">
        {mediaCount === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="No media yet" hint="Covers, gallery photos, videos and the brochure are added from Edit → About and Media." />
        ) : (
          <>
            {(project.coverImageUrl || project.mobileCoverImageUrl) && (
              <DataCard title="Cover" columns={false}>
                <div className="flex flex-wrap items-end gap-4 py-2">
                  {project.coverImageUrl && (
                    <figure className="space-y-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- CDN images */}
                      <img src={project.coverImageUrl} alt={`${project.name} cover`} className="h-48 w-full max-w-md rounded-lg border object-cover" />
                      <figcaption className="text-[12px] text-muted-foreground">Desktop</figcaption>
                    </figure>
                  )}
                  {project.mobileCoverImageUrl && (
                    <figure className="space-y-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- CDN images */}
                      <img src={project.mobileCoverImageUrl} alt={`${project.name} mobile cover`} className="h-48 w-36 rounded-lg border object-cover" />
                      <figcaption className="text-[12px] text-muted-foreground">Mobile</figcaption>
                    </figure>
                  )}
                </div>
              </DataCard>
            )}
            {gallery.length > 0 && (
              <DataCard title={`Gallery (${gallery.length})`} columns={false}>
                <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3 md:grid-cols-4">
                  {gallery.map((g: string | Project, i: number) => (
                    // eslint-disable-next-line @next/next/no-img-element -- CDN images
                    <img key={i} src={typeof g === "string" ? g : (g.imageUrl ?? g.imageKey ?? "")} alt={`Gallery ${i + 1}`} className="h-28 w-full rounded-lg border bg-muted/20 object-cover" />
                  ))}
                </div>
              </DataCard>
            )}
            {videos.length > 0 && (
              <DataCard title={`Videos (${videos.length})`} columns={false}>
                <div className="space-y-1 py-2">
                  {videos.map((v: unknown, i: number) => (
                    <a key={i} href={String(v)} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate rounded-md px-1 py-1 text-[14px] font-medium text-[#017D58] hover:underline dark:text-[#2FB585]">
                      <Play className="h-4 w-4 shrink-0" /><span className="truncate">{String(v)}</span>
                    </a>
                  ))}
                </div>
              </DataCard>
            )}
            {(project.brochureUrl || project.brochureKey) && (
              <DataCard title="Brochure" columns={false}>
                <p className="py-2 text-[14px] text-foreground">{project.brochureName || project.brochureKey || "Brochure"}</p>
              </DataCard>
            )}
          </>
        )}
      </div>
    </div>
  );

  const location = (
    <div className="pb-6">
      <TabHeader title="Location" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Address">
          <Fact label="City">{project.city}</Fact>
          <Fact label="Locality">{project.sublocation}</Fact>
          <Fact label="State">{project.state}</Fact>
          <Fact label="Pincode">{project.pincode}</Fact>
          <Fact label="Address">{project.address}</Fact>
          <Fact label="Latitude">{project.latitude}</Fact>
          <Fact label="Longitude">{project.longitude}</Fact>
          {project.latitude != null && project.longitude != null && (
            <FieldRow label="Map">
              <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${project.latitude},${project.longitude}`)}`} target="_blank" rel="noopener noreferrer"
                className="flex h-8 items-center px-2 text-[14px] font-medium text-[#017D58] hover:underline dark:text-[#2FB585]">Open in Maps</a>
            </FieldRow>
          )}
        </DataCard>
        {connectivityRows.length > 0 && (
          <DataCard title="Connectivity">
            {connectivityRows.map((c: Project, i: number) => <Fact key={i} label={c.label || "Highlight"}>{c.detail}</Fact>)}
          </DataCard>
        )}
        {nearbyGroups.length > 0 && (
          <DataCard title="Nearby" columns={false}>
            <div className="space-y-3 py-2">
              {nearbyGroups.map((cat: Project, i: number) => (
                <div key={i}>
                  <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">{cat.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(cat.places ?? []).map((pl: Project, j: number) => (
                      <span key={j} className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground/[0.06] px-2.5 text-[13px] font-medium text-foreground">
                        {pl.name}{pl.distance && <span className="text-muted-foreground">· {pl.distance}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        )}
      </div>
    </div>
  );

  const faqTab = (
    <div className="pb-6">
      <TabHeader title="FAQs" />
      <div className="px-3 sm:px-10">
        {faqs.length === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="No FAQs yet" hint="Questions buyers ask, answered once. Add them from Edit → FAQs." />
        ) : (
          <section className="divide-y overflow-hidden rounded-xl border bg-card">
            {faqs.map((f: Project, i: number) => (
              <div key={f.id ?? i} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-[14px] font-medium text-foreground">{f.question}</p>
                  <span className="shrink-0 rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[12px] text-muted-foreground">
                    {PROJECT_FAQ_SECTIONS.find((tab) => tab.id === sectionOf(f))?.label ?? "Overview"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">{f.answer}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:h-full lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <MobileHeader title={project.name} showBack />

      <PageActions>
        <div className="flex items-center gap-2">
          {statusMenu("h-8")}
          {brochureButton}
          {editButton}
        </div>
      </PageActions>

      {/* ── Phone summary ── */}
      <div className="space-y-3 px-4 pb-4 pt-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          {statusMenu("h-7", "start")}
          {project.projectCode && <span>{project.projectCode}</span>}
          <span>{priceRange}</span>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground/[0.06] px-3 text-[15px] font-medium text-foreground">
          <Edit className="h-4 w-4 text-muted-foreground" /> Edit project
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div role="tablist" aria-label="Project sections"
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 flex shrink-0 gap-1.5 overflow-x-auto bg-background px-4 py-2 scrollbar-hide md:static md:gap-5 md:border-b md:px-5 md:py-0">
            {tabs.map((t) => (
              <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon} label={t.label} count={t.count} />
            ))}
          </div>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
            {activeTab === "overview" && overview}
            {activeTab === "units" && unitsTab}
            {activeTab === "media" && media}
            {activeTab === "location" && location}
            {activeTab === "faqs" && faqTab}
          </div>
        </div>

        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">
          <div className="flex items-center gap-3 border-b p-4">
            <CompletenessRing fields={projectScoreFields(project)} />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold leading-6 text-foreground" title={project.name}>{project.name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{[project.projectCode, place].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <Section title="Details">
            <Fact label="Status">
              <span className="inline-flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", statusDot(status))} />{capital(status)}</span>
            </Fact>
            <Fact label="Type"><span className="capitalize">{project.projectType}</span></Fact>
            <Fact label="Price">{priceRange}</Fact>
            {!isPlot && <Fact label="BHK">{bhk}</Fact>}
            <Fact label="Builder">{project.builderName}</Fact>
            <Fact label="Possession"><span className="capitalize">{words(project.possessionStatus)}</span></Fact>
            <Fact label="Units">{units.length || null}</Fact>
            <Fact label="Locality">{place}</Fact>
          </Section>
        </aside>
      </div>

      {editing && (
        <ProjectForm
          mode="edit"
          initialData={project}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            void loadProject().then((data) => { if (data) setProject(data); });
          }}
        />
      )}
    </div>
  );
}
