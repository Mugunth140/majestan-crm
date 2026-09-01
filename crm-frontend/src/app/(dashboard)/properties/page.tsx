"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileHeader } from "@/components/layout/mobile-header";
import { propertiesApi } from "@/lib/properties-api";
import { PropertyTable, Property } from "./_components/PropertyTable";
import { BulkImportDialog } from "./_components/BulkImportDialog";
import { Plus, Search, Upload } from "lucide-react";

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial Space" },
  { value: "coworking", label: "Co-working" },
  { value: "farmland", label: "Farmland" },
  { value: "industrial", label: "Industrial" },
  { value: "individual_portion", label: "Independent House" },
];

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    propertyType: "",
    listingType: "",
    status: "",
    cityId: "",
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await propertiesApi.list({
        page,
        limit,
        ...filters,
      });
      if (data && data.success !== false) {
        setProperties(data.data ?? data.properties ?? []);
        setTotal(data.meta?.total ?? data.total ?? data.count ?? 0);
      } else {
        setProperties([]);
        setTotal(0);
      }
    } catch {
      toast.error("Failed to load properties.");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Reset to page 1 when filters change
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleVisibilityToggle = async (id: number) => {
    try {
      await propertiesApi.toggleVisibility(id);
      fetchProperties();
    } catch {
      toast.error("Failed to toggle visibility.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await propertiesApi.remove(id);
      toast.success("Property deleted.");
      fetchProperties();
    } catch {
      toast.error("Failed to delete property.");
    }
  };

  return (
    <>
      <MobileHeader title="Properties" />

      <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between pr-[150px]">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage your property listings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 rounded-xl border-border/60 flex items-center gap-2"
              onClick={() => setIsBulkImportOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </Button>
            <Link
              href="/properties/new"
              className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95"
            >
              <Plus size={18} />
              Add Property
            </Link>
          </div>
        </div>

        {/* ── Filter row ── */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3 px-6 py-4 border-b bg-muted/10">
            {/* Search */}
            <div className="relative w-full xl:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9 h-10 bg-background rounded-xl border-border/60 text-[13.5px] focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Property Type */}
            <select
              value={filters.propertyType}
              onChange={(e) => handleFilterChange("propertyType", e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-background px-3 text-[13.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Types</option>
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Listing Type */}
            <select
              value={filters.listingType}
              onChange={(e) => handleFilterChange("listingType", e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-background px-3 text-[13.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Listings</option>
              <option value="Sell">Buy</option>
              <option value="Rent">Rent</option>
            </select>

            {/* Status */}
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-background px-3 text-[13.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="rented">Rented</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          {/* ── Table ── */}
          <div className="overflow-x-auto">
            <PropertyTable
              properties={properties}
              onVisibilityToggle={handleVisibilityToggle}
              onDelete={handleDelete}
              loading={loading}
            />
          </div>

          {/* ── Pagination ── */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/5">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} &mdash; {total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onSuccess={fetchProperties}
      />
    </>
  );
}
