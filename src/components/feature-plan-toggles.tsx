"use client";

import { ReactNode } from "react";
import { Check } from "lucide-react";
import type { FeatureKey } from "@/lib/api";
import { inputClass } from "@/components/ui";
import { groupModules, nestGroupFeatures, togglePlanFeature, type ModuleFeature } from "@/lib/feature-modules";

export type CommissionTypeOption = {
  key: string;
  label: string;
  summary: string;
};

type Props<T extends ModuleFeature> = {
  features: T[];
  enabled: string[];
  optional?: string[];
  garageAdmit?: boolean;
  columns?: 1 | 2;
  onChange: (next: FeatureKey[]) => void;
  renderExtra?: (feature: T) => ReactNode;
};

export function FeaturePlanToggles<T extends ModuleFeature>({
  features,
  enabled,
  optional = [],
  garageAdmit = false,
  columns = 2,
  onChange,
  renderExtra,
}: Props<T>) {
  return (
    <div className="space-y-6">
      {groupModules(features).map(({ group, features: groupFeatures }) => (
        <div key={group}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{group}</p>
          <div className={`grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
            {nestGroupFeatures(groupFeatures).map(({ feature, children }) => {
              const parentOff = !enabled.includes(feature.key);
              return (
                <div key={feature.key} className={children.length ? "sm:col-span-2" : ""}>
                  <ToggleButton
                    name={feature.name}
                    active={enabled.includes(feature.key)}
                    optional={optional.includes(feature.key)}
                    onClick={() => onChange(togglePlanFeature(enabled, feature.key, { garageAdmit }))}
                  />
                  {renderExtra?.(feature)}
                  {children.length > 0 && (
                    <div className="mt-2 ml-5 space-y-2 border-l border-[#d7d3c8] pl-3">
                      {children.map((child) => (
                        <div key={child.key}>
                          <ToggleButton
                            name={child.name}
                            active={enabled.includes(child.key)}
                            optional={optional.includes(child.key)}
                            disabled={parentOff}
                            nested
                            onClick={() => {
                              if (parentOff) return;
                              onChange(togglePlanFeature(enabled, child.key, { garageAdmit }));
                            }}
                          />
                          {renderExtra?.(child)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommissionTypeSelect({
  types,
  value,
  disabled = false,
  onChange,
}: {
  types: CommissionTypeOption[];
  value: string;
  disabled?: boolean;
  onChange: (key: string) => void;
}) {
  const selected = types.find((type) => type.key === value) ?? types[0];
  if (!selected) return null;

  return (
    <div className={`mt-2 border border-[#d7d3c8] bg-white p-3 ${disabled ? "opacity-50" : ""}`}>
      <label className="block text-[11px] font-bold uppercase">
        Commission type
        <select
          value={selected.key}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} mt-2 font-normal normal-case`}
        >
          {types.map((type) => (
            <option key={type.key} value={type.key}>{type.label}</option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs leading-relaxed text-[#6f746e]">{selected.summary}</p>
    </div>
  );
}

function ToggleButton({
  name,
  active,
  optional,
  disabled,
  nested,
  onClick,
}: {
  name: string;
  active: boolean;
  optional?: boolean;
  disabled?: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between border px-3 py-2 text-left text-sm font-semibold ${
        disabled
          ? "border-[#e7e4db] text-[#b7b3a8]"
          : active
            ? "border-[#167c73] bg-[#167c73]/7"
            : "border-[#d7d3c8] text-[#6f746e]"
      } ${nested ? "min-h-10" : ""}`}
    >
      <span>
        {name}
        {optional && <span className="ml-2 text-[10px] font-bold uppercase text-[#9a5b12]">Optional</span>}
      </span>
      <span className={`grid size-6 place-items-center ${active && !disabled ? "bg-[#167c73] text-white" : "bg-[#e7e4db]"}`}>
        {active && !disabled && <Check size={15} />}
      </span>
    </button>
  );
}
