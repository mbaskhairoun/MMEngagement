"use client";

import { useEffect, useState } from "react";
import { adminApi, errMsg } from "./api";
import type { Stats } from "./api";
import { Empty, PageHeader, Spinner, StatCard, useToast } from "./ui";

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "0%";
}

function HBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const rowH = 30;
  return (
    <svg className="adm-chart" viewBox={`0 0 400 ${items.length * rowH}`} role="img" aria-label="Bar chart">
      {items.map((it, i) => {
        const w = (it.value / max) * 230;
        return (
          <g key={it.label} transform={`translate(0 ${i * rowH})`}>
            <text x="0" y="19" className="adm-chart-label">{it.label.length > 18 ? `${it.label.slice(0, 17)}…` : it.label}</text>
            <rect x="130" y="5" width={Math.max(w, 2)} height="18" rx="4" className="adm-chart-bar" />
            <text x={130 + Math.max(w, 2) + 8} y="19" className="adm-chart-value">{it.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Timeline({ data }: { data: { date: string; count: number }[] }) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return <Empty>No responses yet.</Empty>;
  const W = 600;
  const H = 140;
  const pad = 24;
  const max = Math.max(1, ...sorted.map((d) => d.count));
  const step = sorted.length > 1 ? (W - pad * 2) / (sorted.length - 1) : 0;
  const pts = sorted.map((d, i) => [pad + i * step, H - pad - (d.count / max) * (H - pad * 2)] as const);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const bw = Math.min(28, (W - pad * 2) / sorted.length - 4);
  return (
    <svg className="adm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Responses per day">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="adm-chart-axis" />
      {sorted.map((d, i) => (
        <rect key={d.date} x={pts[i][0] - bw / 2} y={pts[i][1]} width={Math.max(bw, 2)} height={H - pad - pts[i][1]} className="adm-chart-bar-soft" rx="3">
          <title>{`${d.date}: ${d.count}`}</title>
        </rect>
      ))}
      {sorted.length > 1 && <polyline points={line} className="adm-chart-line" fill="none" />}
      {pts.map(([x, y], i) => <circle key={sorted[i].date} cx={x} cy={y} r="3" className="adm-chart-dot" />)}
      <text x={pad} y={H - 6} className="adm-chart-label">{sorted[0].date}</text>
      <text x={W - pad} y={H - 6} textAnchor="end" className="adm-chart-label">{sorted[sorted.length - 1].date}</text>
    </svg>
  );
}

export default function AnalyticsPanel() {
  const toast = useToast();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.stats().then(setS).catch((e) => toast.error(errMsg(e)));
  }, [toast]);

  if (!s) return <><PageHeader title="Analytics" /><Spinner /></>;

  const meals = Object.entries(s.meals ?? {}).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Live RSVP overview." />
      <div className="adm-stats">
        <StatCard label="Households invited" value={s.households} />
        <StatCard label="Individuals invited" value={s.individuals} />
        <StatCard label="Response rate" value={pct(s.responded, s.households)} hint={`${s.responded} of ${s.households} households`} />
        <StatCard label="Attendance rate" value={pct(s.attendingHouseholds, s.responded)} hint="of households that responded" />
        <StatCard label="Headcount attending" value={s.attendingIndividuals} hint={s.children ? `incl. ${s.children} children` : undefined} />
        <StatCard label="Declined households" value={s.declinedHouseholds} />
        <StatCard label="Pending households" value={s.pending} />
      </div>
      <div className="adm-grid-2">
        <div className="adm-card adm-pad">
          <h2>Attendance by event</h2>
          <HBars items={[
            { label: "Ceremony", value: s.byEvent?.ceremony ?? 0 },
            { label: "Reception", value: s.byEvent?.reception ?? 0 },
          ]} />
        </div>
        <div className="adm-card adm-pad">
          <h2>Household status</h2>
          <HBars items={[
            { label: "Attending", value: s.attendingHouseholds },
            { label: "Declined", value: s.declinedHouseholds },
            { label: "Pending", value: s.pending },
          ]} />
        </div>
        <div className="adm-card adm-pad">
          <h2>Meal preferences</h2>
          {meals.length ? <HBars items={meals} /> : <Empty>No meal choices yet.</Empty>}
        </div>
        <div className="adm-card adm-pad">
          <h2>Responses over time</h2>
          <Timeline data={s.timeline ?? []} />
        </div>
      </div>
    </>
  );
}
