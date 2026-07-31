"use client";

import { User, Building2, Layers, Users } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Majestan CRM. Select a module from the sidebar.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder metric cards */}
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Total Leads</h3>
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Inbounds</h3>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Active Assets</h3>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Agents</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
      </div>
    </div>
  );
}
