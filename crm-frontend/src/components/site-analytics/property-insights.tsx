"use client";
import { PropertyWorkspace } from "./property-workspace";
export function PropertyInsights({ from, to }: { from: string; to: string }) {
  return <PropertyWorkspace from={from} to={to} />;
}
