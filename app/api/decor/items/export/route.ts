import { toCsv } from "@/lib/csv";
import { listItems } from "@/lib/data/decor";
import { listSections } from "@/lib/data/inspo";
import { decorRoute } from "@/lib/decor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = decorRoute(async () => {
  const [items, sections] = await Promise.all([listItems(), listSections()]);
  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
  const csv = toCsv(
    [
      "Name", "Category", "Status", "Quantity", "Unit", "Estimated Cost", "Currency", "Vendor", "Link",
      "Description", "Notes", "Added By", "Inspired By Pin", "Photos", "Created", "Updated",
    ],
    items.map((i) => [
      i.name, i.sectionId ? (sectionTitle.get(i.sectionId) ?? "") : "", i.status, i.quantity, i.unit,
      i.estimatedCost, i.currency, i.vendor, i.link, i.description, i.notes, i.addedBy, i.pin?.pinUrl ?? "",
      i.photos.map((p) => p.url).join("|"), i.createdAt, i.updatedAt,
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="decor-selections.csv"',
      "Cache-Control": "no-store",
    },
  });
});
