export const SPORT_LABELS: Record<string, string> = {
  touringbicycle: "Touring Bike",
  racebike: "Road Bike",
  mtb: "MTB",
  e_mtb: "E-MTB",
  e_touringbicycle: "E-Bike",
  cycling: "Cycling",
  running: "Running",
  jogging: "Jogging",
  hiking: "Hiking",
  hike: "Hiking",
  mountaineering: "Mountaineering",
  nordic_walking: "Nordic Walking",
  skating: "Skating",
  swimming: "Swimming",
  rowing: "Rowing",
  other: "Other",
};

export function SportTag({ sport }: { sport: string }) {
  const label = SPORT_LABELS[sport] ?? sport;
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider text-green-400/80 border border-green-400/30 rounded px-1.5 py-0.5 bg-green-400/5">
      {label}
    </span>
  );
}
