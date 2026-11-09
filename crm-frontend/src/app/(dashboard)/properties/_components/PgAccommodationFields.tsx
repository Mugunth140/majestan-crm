"use client";
import { cn } from "@/lib/utils";
import { PROPERTY_FIELD, PROPERTY_GROUP, PROPERTY_LABEL } from "./property-form-styles";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceInput } from "@/components/shared/price-input";
import { PropertyFormSelect } from "./PropertyFormSelect";
import { PropertyMultiSelect } from "./PropertyMultiSelect";
import {
  isPgFurnished,
  PG_SELECTS,
  PG_COUNTS,
  PG_MONEY,
  PG_MULTI,
  PG_FLAGS,
  PG_SERVICES,
  PG_ROOM_ITEMS,
  PG_COMMON_ITEMS,
  pgFieldVisible,
  readPgArray,
  type PgDraft,
} from "./pg-accommodation";
const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
export function PgAccommodationFields({
  value,
  onChange,
  furnishingStatus,
}: {
  value: PgDraft;
  onChange: (value: PgDraft) => void;
  furnishingStatus: string;
}) {
  const change = (key: string, next: string) =>
    onChange({
      ...value,
      [key]: next,
      ...(key === "roomType" && value.roomType && value.roomType !== next
        ? { sharingCount: "", totalCapacity: "", availableCapacity: "" }
        : {}),
    });
  const furnished = isPgFurnished(furnishingStatus);
  const select = (key: string, label: string, values: string[]) => (
    <div key={key} className="space-y-2">
      <label htmlFor={`pg-${key}`} className={PROPERTY_LABEL}>
        {label}
      </label>
      <PropertyFormSelect
        id={`pg-${key}`}
        name={`pg-${key}`}
        value={value[key] || null}
        placeholder="Select option"
        options={options(values)}
        onValueChange={(next) => change(key, next)}
      />
    </div>
  );
  return (
    <>
      <h4 className="text-[16px] font-medium text-foreground md:col-span-2 lg:col-span-3">
        Accommodation and occupancy
      </h4>
      {PG_SELECTS.slice(0, 3).map(([key, label, items]) =>
        select(key, label, items),
      )}
      {PG_COUNTS.slice(0, 5).map(
        ([key, label]) =>
          pgFieldVisible(key, value) && (
            <div key={key} className="space-y-2">
              <label htmlFor={`pg-${key}`} className={PROPERTY_LABEL}>
                {key === "totalCapacity"
                  ? `Total ${value.roomType === "Private" ? "rooms" : "beds"} in PG`
                  : key === "availableCapacity"
                    ? `${value.roomType === "Private" ? "Rooms" : "Beds"} available in PG`
                    : label}
              </label>
              <Input
                id={`pg-${key}`}
                type="number"
                min={key === "sharingCount" ? 2 : 0}
                step={1}
                className={PROPERTY_FIELD}
                value={value[key] ?? ""}
                onChange={(e) => change(key, e.target.value)}
              />
            </div>
          ),
      )}
      {PG_FLAGS.map(([key, label]) => (
        <label
          key={key}
          className="flex items-center gap-3 text-sm font-semibold"
        >
          <Checkbox
            checked={value[key] === "true"}
            onCheckedChange={(checked) => change(key, String(checked === true))}
          />
          {label}
        </label>
      ))}
      {PG_MULTI.slice(0, 2).map(([key, label, items]) => (
        <div key={key} className="space-y-2">
          <label className={PROPERTY_LABEL}>{label}</label>
          <PropertyMultiSelect
            name={label}
            value={value[key] ?? ""}
            options={items}
            serializeAsJson
            onChange={(next) => change(key, next)}
          />
        </div>
      ))}
      {furnished &&
        (
          [
            ["roomFurnishings", "In room furnishings", PG_ROOM_ITEMS],
            ["commonFurnishings", "Common area furnishings", PG_COMMON_ITEMS],
          ] as [string, string, string[]][]
        ).map(([key, label, items]) => (
          <details
            key={key}
            className={cn(PROPERTY_GROUP, "md:col-span-2 lg:col-span-3")}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              {label}
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const rows = readPgArray(value[key]);
                const row = rows.find((row) => row.item === item);
                return (
                  <div key={item} className="space-y-2">
                    <label className="text-sm" htmlFor={`pg-${key}-${item}`}>
                      {item}
                    </label>
                    <Input
                      id={`pg-${key}-${item}`}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Count"
                      className={PROPERTY_FIELD}
                      value={row?.count ?? ""}
                      onChange={(e) =>
                        change(
                          key,
                          JSON.stringify([
                            ...rows.filter((row) => row.item !== item),
                            ...(e.target.value
                              ? [{ item, count: Number(e.target.value) }]
                              : []),
                          ]),
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      <h4 className="text-[16px] font-medium text-foreground md:col-span-2 lg:col-span-3">
        Rent, deposit and services
      </h4>
      {PG_SELECTS.slice(3, 5).map(([key, label, items]) =>
        select(key, label, items),
      )}
      {PG_MONEY.slice(0, 4).map(
        ([key, label]) =>
          pgFieldVisible(key, value) && (
            <div key={key} className="space-y-2">
              <label htmlFor={`pg-${key}`} className={PROPERTY_LABEL}>
                {label}
              </label>
              <PriceInput className={PROPERTY_FIELD}
                placeholder="e.g. 3,000"
                id={`pg-${key}`}
                value={value[key] ?? ""}
                onChange={(next) => change(key, next)}
              />
            </div>
          ),
      )}
      {value.depositType === "Multiple of Rent" && (
        <div className="space-y-2">
          <label htmlFor="pg-depositMonths" className={PROPERTY_LABEL}>
            Deposit months
          </label>
          <Input
            id="pg-depositMonths"
            type="number"
            min={0}
            max={30}
            step={1}
            className={PROPERTY_FIELD}
            value={value.depositMonths ?? ""}
            onChange={(e) => change("depositMonths", e.target.value)}
          />
        </div>
      )}
      <div className="space-y-4 md:col-span-2 lg:col-span-3">
        <p className={PROPERTY_LABEL}>
          Services included in rent and additional charges
        </p>
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PG_SERVICES.map((name) => {
            const rows = readPgArray(value.services);
            const row = rows.find((row) => row.name === name) ?? { name };
            const update = (patch: Record<string, unknown>) =>
              change(
                "services",
                JSON.stringify([
                  ...rows.filter((row) => row.name !== name),
                  { ...row, ...patch },
                ]),
              );
            return (
              <div
                key={name}
                className={cn(PROPERTY_GROUP, "min-w-0 space-y-3")}
              >
                <div className="space-y-2">
                  <label htmlFor={`pg-service-${name}`} className="text-sm">
                    {name}
                  </label>
                  <PropertyFormSelect
                    id={`pg-service-${name}`}
                    name={`pg-service-${name}`}
                    placeholder="Select status"
                    value={row.status ?? ""}
                    options={options([
                      "Included in rent",
                      "Not available",
                      "Available for extra charge",
                    ])}
                    onValueChange={(status) =>
                      update({
                        status,
                        ...(status !== "Available for extra charge"
                          ? { amount: null, chargeType: "" }
                          : {}),
                      })
                    }
                  />
                </div>
                {row.status === "Available for extra charge" && (
                  <>
                    <div className="space-y-2">
                      <label
                        htmlFor={`pg-service-${name}-basis`}
                        className="text-sm"
                      >
                        Charge basis
                      </label>
                      <PropertyFormSelect
                        id={`pg-service-${name}-basis`}
                        name={`pg-service-${name}-basis`}
                        placeholder="Select basis"
                        value={row.chargeType ?? ""}
                        options={options([
                          "Fixed amount",
                          "On consumption basis",
                        ])}
                        onValueChange={(chargeType) =>
                          update({
                            chargeType,
                            ...(chargeType === "On consumption basis"
                              ? { amount: null }
                              : {}),
                          })
                        }
                      />
                    </div>
                    {row.chargeType !== "On consumption basis" && (
                      <div className="space-y-2">
                        <label
                          htmlFor={`pg-service-${name}-amount`}
                          className="text-sm"
                        >
                          {name} charge
                        </label>
                        <Input
                          id={`pg-service-${name}-amount`}
                          type="number"
                          min={0}
                          step="any"
                          className={PROPERTY_FIELD}
                          value={row.amount ?? ""}
                          onChange={(e) =>
                            update({
                              amount: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <h4 className="text-[16px] font-medium text-foreground md:col-span-2 lg:col-span-3">
        Food and meals
      </h4>
      {PG_SELECTS.slice(5, 8).map(
        ([key, label, items]) =>
          pgFieldVisible(key, value) && select(key, label, items),
      )}
      {PG_MULTI.slice(2).map(
        ([key, label, items]) =>
          pgFieldVisible(key, value) && (
            <div key={key} className="space-y-2">
              <label className={PROPERTY_LABEL}>{label}</label>
              <PropertyMultiSelect
                name={label}
                value={value[key] ?? ""}
                options={items}
                serializeAsJson
                onChange={(next) => change(key, next)}
              />
            </div>
          ),
      )}
      {PG_MONEY.slice(4, 8).map(
        ([key, label]) =>
          pgFieldVisible(key, value) && (
            <div key={key} className="space-y-2">
              <label htmlFor={`pg-${key}`} className={PROPERTY_LABEL}>
                {label}
              </label>
              <PriceInput className={PROPERTY_FIELD}
                placeholder="e.g. 3,000"
                id={`pg-${key}`}
                value={value[key] ?? ""}
                onChange={(next) => change(key, next)}
              />
            </div>
          ),
      )}
      <h4 className="text-[16px] font-medium text-foreground md:col-span-2 lg:col-span-3">
        Contract and house rules
      </h4>
      {PG_SELECTS.slice(8).map(([key, label, items]) =>
        select(key, label, items),
      )}
      {value.earlyLeavingType === "Fixed" && (
        <div className="space-y-2">
          <label
            htmlFor="pg-earlyLeavingAmount"
            className={PROPERTY_LABEL}
          >
            Early leaving amount
          </label>
          <PriceInput className={PROPERTY_FIELD}
            placeholder="e.g. 3,000"
            id="pg-earlyLeavingAmount"
            value={value.earlyLeavingAmount ?? ""}
            onChange={(next) => change("earlyLeavingAmount", next)}
          />
        </div>
      )}
      {value.earlyLeavingType === "Multiple of Rent" && (
        <div className="space-y-2">
          <label
            htmlFor="pg-earlyLeavingMonths"
            className={PROPERTY_LABEL}
          >
            Early leaving months
          </label>
          <Input
            id="pg-earlyLeavingMonths"
            type="number"
            min={0}
            step={1}
            className={PROPERTY_FIELD}
            value={value.earlyLeavingMonths ?? ""}
            onChange={(e) => change("earlyLeavingMonths", e.target.value)}
          />
        </div>
      )}
      <div className="space-y-2 md:col-span-2 lg:col-span-3">
        <label htmlFor="pg-otherRules" className={PROPERTY_LABEL}>
          Other house rules
        </label>
        <Input
          id="pg-otherRules"
          value={value.otherRules ?? ""}
          onChange={(e) => change("otherRules", e.target.value)}
          maxLength={2000}
          className={PROPERTY_FIELD}
        />
      </div>
    </>
  );
}
