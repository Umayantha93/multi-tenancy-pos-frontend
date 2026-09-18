"use client";

import { Check } from "lucide-react";
import type { FeatureKey } from "@/lib/api";
import { groupModules, nestGroupFeatures, togglePlanFeature, type ModuleFeature } from "@/lib/feature-modules";

type Props<T extends ModuleFeature> = {
  features: T[];
  enabled: string[];
  optional?: string[];
  garageAdmit?: boolean;
  columns?: 1 | 2;
  onChange: (next: FeatureKey[]) => void;
};

export function FeaturePlanToggles<T extends ModuleFeature>({
  features,
  enabled,
  optional = [],
  garageAdmit = false,
  columns = 2,
  onChange,
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
                  {children.length > 0 && (
                    <div className="mt-2 ml-5 space-y-2 border-l border-[#d7d3c8] pl-3">
                      {children.map((child) => (
                        <ToggleButton
                          key={child.key}
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
