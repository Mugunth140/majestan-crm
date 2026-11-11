"use client";
import { cn } from "@/lib/utils";
import { PROPERTY_FIELD, PROPERTY_LABEL } from "./property-form-styles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceInput } from "@/components/shared/price-input";
import { PropertyFormSelect as Select } from "./PropertyFormSelect";
import { PropertyMultiSelect } from "./PropertyMultiSelect";
import {
  COMMERCIAL_RENT_USES,
  COMMERCIAL_SPECIAL_PURPOSES,
  asOptions,
} from "./property-type-options";
import {
  BHK_OPTIONS,
  CONTACT_ROLES,
  POWER_OPTIONS,
  STORAGE_OPTIONS,
  type AlternativeContact,
  type ContactDetails,
  type CurationDraft,
} from "./property-curation-two";

type ContactRowProps = {
  label: string;
  value: AlternativeContact;
  onChange: (next: AlternativeContact) => void;
  role?: boolean;
};
function ContactRow({ label, value, onChange, role }: ContactRowProps) {
  const fieldId = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-[14px] font-medium text-foreground">{label}</legend>
      <div
        className={`grid gap-4 ${role ? "md:grid-cols-3" : "md:grid-cols-2"}`}
      >
        {role && (
          <div className="space-y-2">
            <label className="text-sm" htmlFor={`${fieldId}-role`}>
              Alternative person
            </label>
            <Select
              id={`${fieldId}-role`}
              name={`${fieldId}-role`}
              placeholder="Select role"
              value={value.role}
              options={asOptions(CONTACT_ROLES)}
              onValueChange={(role) => onChange({ ...value, role })}
            />
          </div>
        )}
        {(["name", "phone"] as const).map((key) => (
          <div key={key} className="space-y-2">
            <label className="text-sm capitalize" htmlFor={`${fieldId}-${key}`}>
              {key}
            </label>
            <Input
              className={PROPERTY_FIELD}
              id={`${fieldId}-${key}`}
              aria-label={`${label} ${key}`}
              type={key === "phone" ? "tel" : "text"}
              value={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
export function OwnerAlternativeContacts({
  value,
  onChange,
}: {
  value: ContactDetails;
  onChange: (value: ContactDetails) => void;
}) {
  return (
    <div className="space-y-6">
      {value.ownerAlternatives.map((contact, index) => (
        <ContactRow
          key={index}
          label={`Alternative owner contact ${index + 1}`}
          role
          value={contact}
          onChange={(contact) =>
            onChange({
              ...value,
              ownerAlternatives: value.ownerAlternatives.map((old, i) =>
                i === index ? contact : old,
              ),
            })
          }
        />
      ))}
    </div>
  );
}
export function AgentContactFields({
  value,
  onChange,
  name,
  onNameChange,
}: {
  value: ContactDetails;
  onChange: (value: ContactDetails) => void;
  name: string;
  onNameChange: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="agentName" className="text-sm">
            Agent Name
          </label>
          <Input
            className={PROPERTY_FIELD}
            id="agentName"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="agentPhone" className="text-sm">
            Agent Phone
          </label>
          <Input
            className={PROPERTY_FIELD}
            id="agentPhone"
            type="tel"
            value={value.agentPhone}
            onChange={(event) =>
              onChange({ ...value, agentPhone: event.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="agentEmail" className="text-sm">
            Agent Email
          </label>
          <Input
            className={PROPERTY_FIELD}
            id="agentEmail"
            type="email"
            value={value.agentEmail}
            onChange={(event) =>
              onChange({ ...value, agentEmail: event.target.value })
            }
          />
        </div>
      </div>
      <ContactRow
        label="Alternative agent contact"
        value={value.agentAlternative}
        onChange={(agentAlternative) =>
          onChange({ ...value, agentAlternative })
        }
      />
    </>
  );
}

export function PortionFields({
  count,
  onCountChange,
  value,
  onChange,
}: {
  count: string;
  onCountChange: (value: string) => void;
  value: CurationDraft;
  onChange: (value: CurationDraft) => void;
}) {
  const total = value.portions.reduce(
    (n, row) => n + Number(row.count || 0),
    0,
  );
  return (
    <div
      className="space-y-4 md:col-span-2 lg:col-span-3"
      id="pf-numberOfPortions"
    >
      <label htmlFor="portion-count" className={PROPERTY_LABEL}>
        No of Portions
      </label>
      <Input
        className={PROPERTY_FIELD}
        id="portion-count"
        type="number"
        min={0}
        step={1}
        value={count}
        onChange={(event) => {
          const next = event.target.value;
          onCountChange(next);
          if (Number(next) > 0 && !value.portions.length)
            onChange({ ...value, portions: [{ bhk: "", count: next }] });
        }}
      />
      {value.portions.map((row, index) => (
        <div className="flex flex-wrap items-center gap-3" key={index}>
          <div className="min-w-40 flex-1">
            <Select
              name={`portion-${index}`}
              placeholder="Select BHK"
              options={asOptions(BHK_OPTIONS)}
              value={row.bhk}
              onValueChange={(bhk) =>
                onChange({
                  ...value,
                  portions: value.portions.map((p, i) =>
                    i === index ? { ...p, bhk } : p,
                  ),
                })
              }
            />
          </div>
          <span aria-hidden>×</span>
          <Input
            aria-label={`Portion configuration ${index + 1} count`}
            className={cn(PROPERTY_FIELD, "w-24")}
            type="number"
            min={1}
            step={1}
            value={row.count}
            onChange={(event) =>
              onChange({
                ...value,
                portions: value.portions.map((p, i) =>
                  i === index ? { ...p, count: event.target.value } : p,
                ),
              })
            }
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                ...value,
                portions: value.portions.filter((_, i) => i !== index),
              })
            }
          >
            Remove configuration {index + 1}
          </Button>
        </div>
      ))}
      {Number(count) > 0 && (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                ...value,
                portions: [...value.portions, { bhk: "", count: "1" }],
              })
            }
          >
            Add portion configuration
          </Button>
          <p className="text-sm text-muted-foreground">
            Configured {total} of {count} portions.
          </p>
        </>
      )}
    </div>
  );
}
export function ParkingFields({
  value,
  onChange,
  legacyParkingCount,
  legacyParkingType,
  legacyCarParking,
  legacyBikeParking,
}: {
  value: CurationDraft;
  onChange: (value: CurationDraft) => void;
  legacyParkingCount?: string;
  legacyParkingType?: string;
  /** Single car / bike counts saved before the breakdown was offered here. */
  legacyCarParking?: string;
  legacyBikeParking?: string;
}) {
  const legacyVehicles = [
    legacyCarParking && Number(legacyCarParking) > 0 ? `${legacyCarParking} car` : "",
    legacyBikeParking && Number(legacyBikeParking) > 0 ? `${legacyBikeParking} bike` : "",
  ].filter(Boolean).join(", ");
  return (
    <fieldset className="space-y-4 md:col-span-2 lg:col-span-3">
      <legend className="mb-3 text-[14px] font-medium text-foreground">Parking spaces</legend>
      {!value.parkingRecorded && value.parkingSpaces.length === 0 && (legacyParkingCount || legacyParkingType || legacyVehicles) && (
        <p className="text-sm text-muted-foreground">
          Existing parking: {legacyVehicles || (legacyParkingCount ? `${legacyParkingCount} spaces` : "count not recorded")}{legacyParkingType ? ` (${legacyParkingType})` : ""}. Breakdown not yet recorded. Existing values are kept until you add combinations or select No parking.
        </p>
      )}
      {value.parkingSpaces.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-2 items-end gap-3 md:grid-cols-4"
        >
          <Select
            name={`parking-vehicle-${index}`}
            placeholder="Vehicle"
            value={row.vehicle}
            options={asOptions(["Car", "Bike"])}
            onValueChange={(vehicle) =>
              onChange({
                ...value,
                parkingRecorded: true,
                parkingSpaces: value.parkingSpaces.map((p, i) =>
                  i === index ? { ...p, vehicle } : p,
                ),
              })
            }
          />
          <Select
            name={`parking-cover-${index}`}
            placeholder="Parking type"
            value={row.type}
            options={asOptions(["Open", "Covered"])}
            onValueChange={(type) =>
              onChange({
                ...value,
                parkingRecorded: true,
                parkingSpaces: value.parkingSpaces.map((p, i) =>
                  i === index ? { ...p, type } : p,
                ),
              })
            }
          />
          <Input
            className={PROPERTY_FIELD}
            aria-label={`Parking combination ${index + 1} count`}
            type="number"
            min={1}
            step={1}
            value={row.count}
            onChange={(event) =>
              onChange({
                ...value,
                parkingRecorded: true,
                parkingSpaces: value.parkingSpaces.map((p, i) =>
                  i === index ? { ...p, count: event.target.value } : p,
                ),
              })
            }
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                ...value,
                parkingRecorded: true,
                parkingSpaces: value.parkingSpaces.filter(
                  (_, i) => i !== index,
                ),
              })
            }
          >
            Remove parking {index + 1}
          </Button>
        </div>
      ))}
      {value.parkingSpaces.length < 4 && (
        <Button
          className="mr-2"
          type="button"
          variant="outline"
          onClick={() => {
            const next = (["Car", "Bike"] as const)
              .flatMap((vehicle) =>
                (["Open", "Covered"] as const).map((type) => ({
                  vehicle,
                  type,
                  count: "1",
                })),
              )
              .find(
                (next) =>
                  !value.parkingSpaces.some(
                    (p) => p.vehicle === next.vehicle && p.type === next.type,
                  ),
              );
            if (next)
              onChange({
                ...value,
                parkingRecorded: true,
                parkingSpaces: [...value.parkingSpaces, next],
              });
          }}
        >
          Add parking combination
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange({ ...value, parkingRecorded: true, parkingSpaces: [] })
        }
      >
        No parking
      </Button>
    </fieldset>
  );
}

export function AdditionalCurationFields({
  value,
  onChange,
  visible,
  hasRestroom,
  utilities,
  onCreateUtility,
  only,
}: {
  value: CurationDraft;
  onChange: (value: CurationDraft) => void;
  visible: (field: string) => boolean;
  hasRestroom: boolean;
  utilities: string[];
  /** Adds a missing utility to the master list from the search. */
  onCreateUtility?: (query: string) => void;
  /** Just these fields, so each can sit under its own Details heading. */
  only?: readonly string[];
}) {
  const show = (field: string) =>
    visible(field) && (!only || only.includes(field));
  const change = <K extends keyof CurationDraft>(
    key: K,
    next: CurationDraft[K],
  ) =>
    onChange({
      ...value,
      [key]: next,
      ...(["hasCanteen", "hasFreeRefreshment"].includes(key)
        ? { [`${key}Known`]: true }
        : {}),
    });
  return (
    <>
      {(
        [
          ["passengerLifts", "Passenger Lifts"],
          ["serviceLifts", "Service Lifts"],
          ["restroomCount", "No of Rest Rooms"],
        ] as const
      ).map(
        ([key, label]) =>
          show(key) &&
          (key !== "restroomCount" || hasRestroom) && (
            <div key={key} className="space-y-2">
              <label htmlFor={key} className={PROPERTY_LABEL}>
                {label}
              </label>
              <Input
                className={PROPERTY_FIELD}
                id={key}
                type="number"
                min={0}
                step={1}
                value={value[key]}
                onChange={(e) => change(key, e.target.value)}
              />
            </div>
          ),
      )}
      {(
        [
          ["storageTankCapacity", "Storage Tank Capacity", STORAGE_OPTIONS],
          ["powerSupplyCapacity", "Power Supply", POWER_OPTIONS],
          ["roadApproach", "Road Approach", ["Mud Road", "Tar Road"]],
          ["agricultureEb", "Agriculture EB", ["1", "2", "3"]],
        ] as const
      ).map(
        ([key, label, options]) =>
          show(key) && (
            <div key={key} className="space-y-2">
              <label htmlFor={key} className={PROPERTY_LABEL}>
                {label}
              </label>
              <Select
                id={key}
                name={key}
                value={value[key]}
                placeholder="Select option"
                options={asOptions(options)}
                onValueChange={(next) => change(key, next)}
              />
            </div>
          ),
      )}
      {show("availableFloorNumbers") && (
        <div className="space-y-2">
          <label
            htmlFor="availableFloorNumbers"
            className={PROPERTY_LABEL}
          >
            Available Floor Numbers
          </label>
          <Input
            className={PROPERTY_FIELD}
            id="availableFloorNumbers"
            value={value.availableFloorNumbers}
            placeholder="e.g. Ground, 1, 2"
            onChange={(e) => change("availableFloorNumbers", e.target.value)}
          />
        </div>
      )}
      {(
        [
          ["totalRentPerMonth", "Total Rent per Month (all portions)"],
          ["expectedRentPerMonth", "Expected Rent per Month"],
        ] as const
      ).map(
        ([key, label]) =>
          show(key) && (
            <div key={key} className="space-y-2">
              <label htmlFor={key} className={PROPERTY_LABEL}>
                {label}
              </label>
              <PriceInput className={PROPERTY_FIELD}
                id={key}
                value={value[key]}
                onChange={(next) => change(key, next)}
              />
            </div>
          ),
      )}
      {(
        [
          ["hasCanteen", "Has Canteen"],
          ["hasFreeRefreshment", "Has Free Refreshment"],
        ] as const
      ).map(
        ([key, label]) =>
          show(key) && (
            <label
              key={key}
              className="flex items-center gap-3 text-sm font-semibold"
            >
              <Checkbox
                checked={value[key]}
                onCheckedChange={(next) => change(key, next === true)}
              />
              {label}
            </label>
          ),
      )}
      {(
        [
          ["propertyUses", "Property Use", COMMERCIAL_RENT_USES],
          ["specialPurposes", "Special Purpose", COMMERCIAL_SPECIAL_PURPOSES],
          ["utilities", "Utilities Provided", utilities],
        ] as const
      ).map(
        ([key, label, options]) =>
          show(key) && (
            <div key={key} className="space-y-2">
              <label className={PROPERTY_LABEL}>{label}</label>
              <PropertyMultiSelect
                serializeAsJson
                name={label}
                value={value[key]}
                options={options}
                onChange={(next) => change(key, next)}
                onCreate={key === "utilities" ? onCreateUtility : undefined}
                createNoun="utility"
              />
            </div>
          ),
      )}
    </>
  );
}
