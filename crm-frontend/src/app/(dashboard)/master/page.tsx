"use client";

import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MapPin, Map, Filter, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

function RegistryCard({ icon: Icon, title, description, href, color, bg }: any) {
  const router = useRouter();
  return (
    <div 
      onClick={() => router.push(href)}
      className="bg-card border rounded-2xl p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all shadow-sm hover:shadow-md"
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
        <Icon size={24} />
      </div>
      <div>
        <h3 className="font-semibold text-[17px] tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

export default function MasterRegistryOverview() {
  return (
    <div className="flex flex-col space-y-6 mb-20 md:mb-0 px-4 md:px-8 mt-2 md:mt-0">
      <MobileHeader title="Master Registry" showBack />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-0 md:pr-10 min-h-12">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight hidden md:block">Master Registry</h1>
          <p className="text-muted-foreground text-sm mt-0.5 hidden md:block">Manage system-wide dropdown options and configuration data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RegistryCard
          icon={Filter}
          title="Lead Sources"
          description="Manage marketing channels and origins for incoming leads."
          href="/master/sources"
          color="text-blue-600"
          bg="bg-blue-500/10"
        />
        <RegistryCard
          icon={MapPin}
          title="Cities"
          description="Configure active cities for property listings and operations."
          href="/master/cities"
          color="text-emerald-600"
          bg="bg-emerald-500/10"
        />
        <RegistryCard
          icon={Map}
          title="Sublocations"
          description="Manage localities and areas mapped to specific cities."
          href="/master/sublocations"
          color="text-amber-600"
          bg="bg-amber-500/10"
        />
        {/*
        <RegistryCard
          icon={Building2}
          title="Property Types"
          description="Configure property classifications."
          href="/master/property-types"
          color="text-purple-600"
          bg="bg-purple-500/10"
        />
        */}
      </div>
    </div>
  );
}