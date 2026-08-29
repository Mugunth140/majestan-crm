"use client";

import { PropertyForm } from "../_components/PropertyForm";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Add Property</h1>
        <p className="text-muted-foreground">Create a new property listing</p>
      </div>
      <PropertyForm mode="create" />
    </div>
  );
}
