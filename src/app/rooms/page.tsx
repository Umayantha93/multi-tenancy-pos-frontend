"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Room = {
  id: number;
  name: string;
  capacity: number;
  nightly_rate: string;
  status: string;
  description: string | null;
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<Room[]>("/cottage-rooms")
      .then(setRooms)
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/cottage-rooms", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          capacity: Number(data.get("capacity") || 2),
          nightly_rate: Number(data.get("nightly_rate")),
          description: data.get("description") || null,
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save room.");
    }
  }

  return (
    <AppShell title="Rooms" eyebrow="Cottage inventory">
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Add room</h2>
          <form onSubmit={create} className="mt-4 space-y-3">
            <input name="name" required placeholder="Room name" className={inputClass} />
            <input name="capacity" type="number" min="1" placeholder="Capacity" className={inputClass} />
            <input name="nightly_rate" required type="number" min="0" step="0.01" placeholder="Nightly rate" className={inputClass} />
            <textarea name="description" rows={3} placeholder="Amenities / notes" className={inputClass} />
            <button className={buttonClass}><Plus size={16} /> Save room</button>
          </form>
        </Panel>
        <Panel>
          {error && <div className="p-4"><ErrorMessage message={error} /></div>}
          {loading ? <PageState message="Loading rooms..." /> : (
            <div className="divide-y divide-[#e2ded4]">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold">{room.name}</p>
                    <p className="text-sm text-[#6f746e]">Sleeps {room.capacity} · {money(room.nightly_rate)} / night</p>
                  </div>
                  <span className="bg-[#167c73]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#167c73]">{room.status}</span>
                </div>
              ))}
              {rooms.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No rooms yet.</p>}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
