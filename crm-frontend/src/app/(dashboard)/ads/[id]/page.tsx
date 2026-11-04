"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, ImageIcon, Info, Megaphone } from "lucide-react";
import { Section } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { HEADER_BUTTON, StatusMenu } from "@/components/record/header-actions";
import { DataCard, Fact, PHONE_EDIT, RecordPage, RecordSkeleton, RecordSummary } from "@/components/record/record-page";
import { formatTableDate, statusDot, statusPillClass } from "@/components/tables/cells";
import { adsApi, type Advertisement } from "@/lib/ads-api";
import { ADS_LINK_PRESETS, getPlacement, ratioLabel, type AdRatio } from "@/lib/ads-link-presets";
import { cn } from "@/lib/utils";
import { AdForm } from "../_components/AdForm";

type Tab = "overview" | "images";
type Ad = Advertisement & { createdAt?: string; updatedAt?: string };

const STATUS_OPTIONS = ["Active", "Inactive"].map((s) => ({ value: s, dot: statusDot(s) }));

function Creative({ label, src, ratio, example, className }: { label: string; src?: string | null; ratio: AdRatio; example: string; className?: string }) {
  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between gap-3 text-[14px] font-medium text-foreground">
        {label}
        <span className="text-[13px] font-normal text-muted-foreground">{ratioLabel(ratio)} · {example}</span>
      </figcaption>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN creative
        <img src={src} alt={label} style={{ aspectRatio: `${ratio[0]} / ${ratio[1]}` }} className={cn("rounded-lg border bg-muted object-cover", className)} />
      ) : (
        <div style={{ aspectRatio: `${ratio[0]} / ${ratio[1]}` }}
          className={cn("flex items-center justify-center rounded-lg border border-dashed bg-muted/30 text-[13px] text-muted-foreground", className)}>
          Uses the desktop image
        </div>
      )}
    </figure>
  );
}

export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ad, setAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  const load = useCallback(
    () => adsApi.getOne(Number(id)).then((result) => {
      const data = (result?.data ?? result) as Ad | undefined;
      if (data && Number(data.id) === Number(id)) return data;
      toast.error("Advertisement not found.");
      router.push("/ads");
      return null;
    }, (reason) => {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to load advertisement.");
      router.push("/ads");
      return null;
    }),
    [id, router],
  );

  useEffect(() => {
    let live = true;
    load().then((data) => {
      if (!live) return;
      if (data) setAd(data);
      setIsLoading(false);
    });
    return () => { live = false; };
  }, [load]);

  const changeStatus = async (next: string) => {
    const isActive = next === "Active";
    try {
      await adsApi.setStatus(Number(id), isActive);
      setAd((prev) => prev && { ...prev, isActive });
      toast.success(isActive ? "Advertisement activated." : "Advertisement deactivated.");
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to update ad status.");
    }
  };

  if (isLoading) return <RecordSkeleton title="Advertisement" />;
  if (!ad) return null;

  const spec = getPlacement(ad.placement);
  const status = ad.isActive ? "Active" : "Inactive";
  const audience = spec.audiences.length ? spec.audiences.find((a) => a.value === ad.audience)?.label ?? "All — fallback" : null;
  const destination = ad.linkType === "custom" ? "Custom path" : ADS_LINK_PRESETS.find((p) => p.value === ad.linkPreset)?.label ?? ad.linkPreset;
  const imageCount = (ad.desktopImage ? 1 : 0) + (ad.mobileImage ? 1 : 0);
  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={status} options={STATUS_OPTIONS} pillClass={statusPillClass(status)} size={size} align={align}
      onChange={(v) => void changeStatus(v)} />
  );

  const overview = (
    <div className="pb-6">
      <TabHeader title="Overview" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Placement">
          <Fact label="Placement">{spec.label}</Fact>
          {audience && <Fact label="Shows on">{audience}</Fact>}
          <Fact label="Order">{ad.sortOrder ?? null}</Fact>
          <Fact label="Status">{status}</Fact>
        </DataCard>
        <DataCard title="Click destination">
          <Fact label="Opens">{destination}</Fact>
          {ad.linkType === "custom" && <Fact label="Path"><code className="truncate font-mono text-[13px]">{ad.linkCustom}</code></Fact>}
        </DataCard>
        <p className="px-1 text-[13px] text-muted-foreground">{spec.description}</p>
      </div>
    </div>
  );

  const images = (
    <div className="pb-6">
      <TabHeader title="Images" />
      <div className="space-y-8 px-3 sm:px-10">
        {imageCount === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="No images" hint="Edit the ad to upload its images." />
        ) : (
          <>
            <Creative label={spec.desktop.label} src={ad.desktopImage} ratio={spec.desktop.ratio} example={spec.desktop.example} className="w-full" />
            {spec.mobile && (
              <Creative label="Mobile image" src={ad.mobileImage} ratio={spec.mobile.ratio} example={spec.mobile.example}
                className={spec.mobile.ratio[0] < spec.mobile.ratio[1] ? "w-48" : "w-full max-w-md"} />
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <RecordPage
        title={ad.title || "Advertisement"}
        tabs={[
          { key: "overview", label: "Overview", icon: Info },
          { key: "images", label: "Images", icon: ImageIcon, count: imageCount },
        ]}
        active={activeTab}
        onTab={setActiveTab}
        actions={
          <>
            {statusMenu("h-8")}
            <button type="button" onClick={() => setEditing(true)} className={HEADER_BUTTON}>
              <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit
            </button>
          </>
        }
        phone={
          <>
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
              {statusMenu("h-7", "start")}
              <span>{spec.label}</span>
            </div>
            <button type="button" onClick={() => setEditing(true)} className={PHONE_EDIT}>
              <Edit className="h-4 w-4 text-muted-foreground" /> Edit advertisement
            </button>
          </>
        }
        aside={
          <>
            <RecordSummary image={ad.desktopImage} icon={Megaphone} title={ad.title || "Advertisement"} subtitle={audience ? `${spec.label} · ${audience}` : spec.label} />
            <Section title="Details">
              <Fact label="Status">
                <span className="inline-flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", statusDot(status))} />{status}</span>
              </Fact>
              <Fact label="Placement">{spec.label}</Fact>
              {audience && <Fact label="Shows on">{audience}</Fact>}
              <Fact label="Opens">{ad.linkType === "custom" ? ad.linkCustom : destination}</Fact>
              <Fact label="Order">{ad.sortOrder ?? null}</Fact>
              <Fact label="Updated">{formatTableDate(ad.updatedAt)}</Fact>
            </Section>
          </>
        }
      >
        {activeTab === "overview" ? overview : images}
      </RecordPage>

      {editing && (
        <AdForm
          mode="edit"
          initial={ad}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            void load().then((data) => { if (data) setAd(data); });
          }}
        />
      )}
    </>
  );
}
