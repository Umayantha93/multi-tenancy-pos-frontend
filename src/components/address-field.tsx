"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { inputClass } from "@/components/ui";
import { useT } from "@/lib/locale";

type AddressFieldProps = {
  name: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
};

async function resolveAddressFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } },
    );
    if (response.ok) {
      const data = (await response.json()) as { display_name?: string };
      if (data.display_name?.trim()) {
        return data.display_name.trim().slice(0, 255);
      }
    }
  } catch {
    // Fall through to coordinates when reverse-geocode is unavailable.
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function AddressField({
  name,
  label,
  value,
  defaultValue,
  onChange,
  required,
  className,
  placeholder,
}: AddressFieldProps) {
  const t = useT();
  const fieldLabel = label ?? t("address.label");
  const fieldPlaceholder = placeholder ?? t("address.placeholder");
  const [internal, setInternal] = useState(defaultValue ?? "");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const current = value ?? internal;

  function setAddress(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  function useLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(t("address.unsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const address = await resolveAddressFromCoords(
            position.coords.latitude,
            position.coords.longitude,
          );
          setAddress(address);
        } catch {
          setLocationError(t("address.resolve_failed"));
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? t("address.denied")
            : t("address.read_failed"),
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">
          {fieldLabel}
          {required && <span className="text-[#b84837]"> *</span>}
        </p>
        <button
          type="button"
          onClick={useLocation}
          disabled={locating}
          className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#167c73] disabled:opacity-60"
        >
          <MapPin size={14} />
          {locating ? t("common.locating") : t("common.use_location")}
        </button>
      </div>
      <input
        name={name}
        value={current}
        required={required}
        onChange={(event) => setAddress(event.target.value)}
        placeholder={fieldPlaceholder}
        className={inputClass}
        maxLength={255}
      />
      {locationError && <p className="mt-2 text-xs text-[#b84837]">{locationError}</p>}
    </div>
  );
}
