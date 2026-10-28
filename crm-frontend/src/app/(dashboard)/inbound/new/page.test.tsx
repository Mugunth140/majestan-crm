import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NewInboundPage from "./page";

const device = vi.hoisted(() => ({ mobile: false, edit: null as string | null }));
vi.mock("@/hooks/use-device", () => ({ useIsMobile: () => device.mobile }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(device.edit ? { edit: device.edit } : {}),
  usePathname: () => "/inbound/new",
}));
vi.mock("@/components/layout/mobile-header", () => ({ MobileHeader: () => null }));
vi.mock("@/components/shared/form-select", () => ({
  FormSelect: ({ name, options, required }: { name: string; options: { value: string; label: string }[]; required?: boolean }) => (
    <select name={name} required={required}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  ),
}));

describe("inbound form variants", () => {
  it("shows category, required mobile and photo upload without coordinates on mobile", () => {
    device.mobile = true;
    device.edit = null;
    const html = renderToStaticMarkup(<NewInboundPage />);
    expect(html).toContain('name="_inbound_status"');
    expect(html).toContain("Available");
    expect(html).toContain("Not available");
    expect(html).toContain("Fixed verification");
    expect(html).toContain('name="alternate_contact"');
    expect(html.indexOf('name="alternate_contact"')).toBeLessThan(html.indexOf('name="_inbound_status"'));
    expect(html.indexOf('name="mobile_number"')).toBeLessThan(html.indexOf('name="alternate_contact"'));
    expect(html).toContain("Commercial");
    expect(html).toContain("Industrial");
    expect(html).toContain("Residential");
    expect(html).not.toContain('name="latitude"');
    expect(html).not.toContain('name="longitude"');
    expect(html).toMatch(/<input(?=[^>]*name="mobile_number")(?=[^>]*required)[^>]*>/);
    expect(html).toContain("Property category *");
    expect(html).not.toContain("Existing numbers are accepted");
    expect(html).not.toContain("Photo location is read");
    expect(html).toContain('capture="environment"');
    expect(html).toContain("Choose from Gallery");
    expect(html).not.toContain('name="property_title"');
    expect(html).not.toContain('name="_purpose"');
    expect(html).not.toContain('name="owner_name"');
  });

  it("keeps the full desktop form with separate coordinates", () => {
    device.mobile = false;
    device.edit = null;
    const html = renderToStaticMarkup(<NewInboundPage />);
    expect(html).toContain('name="property_title"');
    expect(html).toContain('name="_purpose"');
    expect(html).toContain('name="owner_name"');
    expect(html).toContain('name="latitude"');
    expect(html).toContain('name="longitude"');
    expect(html).not.toContain('name="google_map_location"');
  });
});
