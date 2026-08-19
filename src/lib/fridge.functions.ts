import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const categorySchema = z.enum(["Kylskåp", "Frys", "Skafferi"]);

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  category: categorySchema,
  addedAt: z.number(),
  finishedAt: z.number().optional(),
});

export const listItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.undefined())
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fridge_items")
      .select("*")
      .order("added_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      qty: row.qty,
      category: row.category as "Kylskåp" | "Frys" | "Skafferi",
      addedAt: new Date(row.added_at).getTime(),
      finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : undefined,
    }));
  });

export const upsertItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.array(itemSchema))
  .handler(async ({ context, data }) => {
    const rows = data.map((item) => ({
      id: item.id,
      user_id: context.userId,
      name: item.name,
      qty: item.qty,
      category: item.category,
      added_at: new Date(item.addedAt).toISOString(),
      finished_at: item.finishedAt ? new Date(item.finishedAt).toISOString() : null,
    }));

    const { error } = await context.supabase.from("fridge_items").upsert(rows, {
      onConflict: "id",
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("fridge_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
