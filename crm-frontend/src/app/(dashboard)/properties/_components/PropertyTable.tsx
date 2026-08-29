"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Edit, Trash2, Loader2 } from "lucide-react";

export interface Property {
  id: number;
  title: string;
  propertyType: string;
  listingType: string; // 'Sell' | 'Rent'
  city: string;
  locality?: string;
  price: number;
  status: string; // 'available' | 'unavailable' | 'sold' | 'rented'
  ownerName?: string;
  ownerPhone?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft?: number;
  description?: string;
  createdAt?: string;
}

interface PropertyTableProps {
  properties: Property[];
  onVisibilityToggle: (id: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}

function formatPrice(price: number): string {
  if (!price) return "-";
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

function formatPropertyType(type: string): string {
  if (!type) return "-";
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; clickable: boolean }
> = {
  available: {
    label: "Available",
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/50",
    clickable: true,
  },
  unavailable: {
    label: "Unavailable",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/50",
    clickable: true,
  },
  sold: {
    label: "Sold",
    className:
      "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed opacity-70",
    clickable: false,
  },
  rented: {
    label: "Rented",
    className:
      "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed opacity-70",
    clickable: false,
  },
};

export function PropertyTable({
  properties,
  onVisibilityToggle,
  onDelete,
  loading,
}: PropertyTableProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (deleteTargetId == null) return;
    setIsDeleting(true);
    try {
      onDelete(deleteTargetId);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading properties...
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <p className="font-medium">No properties found.</p>
        <p className="text-sm mt-1">Add a property or adjust your filters.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              ID
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Title
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Type
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Listing
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              City
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Price
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Owner
            </TableHead>
            <TableHead className="px-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map(property => {
            const statusKey = (property.status || "").toLowerCase();
            const statusConfig =
              STATUS_CONFIG[statusKey] ?? STATUS_CONFIG["unavailable"];

            return (
              <TableRow
                key={property.id}
                className="hover:bg-muted/40 transition-colors"
              >
                {/* ID */}
                <TableCell className="px-4 font-mono text-xs text-muted-foreground">
                  #{property.id}
                </TableCell>

                {/* Title */}
                <TableCell className="px-4 font-medium text-foreground max-w-[200px]">
                  <span title={property.title}>
                    {property.title && property.title.length > 40
                      ? property.title.slice(0, 40) + "…"
                      : property.title || "-"}
                  </span>
                </TableCell>

                {/* Type */}
                <TableCell className="px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                    {formatPropertyType(property.propertyType)}
                  </span>
                </TableCell>

                {/* Listing */}
                <TableCell className="px-4">
                  {property.listingType === "Rent" ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 font-semibold border shadow-sm">
                      Rent
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 font-semibold border shadow-sm">
                      Buy
                    </Badge>
                  )}
                </TableCell>

                {/* City */}
                <TableCell className="px-4 text-foreground">
                  {property.city || "-"}
                </TableCell>

                {/* Price */}
                <TableCell className="px-4 font-semibold text-foreground">
                  {formatPrice(property.price)}
                </TableCell>

                {/* Status */}
                <TableCell className="px-4">
                  {statusConfig.clickable ? (
                    <button
                      onClick={() => onVisibilityToggle(property.id)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${statusConfig.className}`}
                      title="Click to toggle visibility"
                    >
                      {statusConfig.label}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  )}
                </TableCell>

                {/* Owner */}
                <TableCell className="px-4">
                  {property.ownerName || property.ownerPhone ? (
                    <div>
                      {property.ownerName && (
                        <div className="font-medium text-foreground text-sm">
                          {property.ownerName}
                        </div>
                      )}
                      {property.ownerPhone && (
                        <div className="text-xs text-muted-foreground">
                          {property.ownerPhone}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell className="px-4">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/properties/${property.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/properties/${property.id}/edit`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete"
                      onClick={() => setDeleteTargetId(property.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={open => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this property? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTargetId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
