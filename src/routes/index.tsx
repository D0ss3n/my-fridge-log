import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Plus, RotateCcw, Search, Trash2, Refrigerator, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORIES,
  loadItems,
  saveItems,
  clearItems,
  newId,
  normalize,
  type Category,
  type Item,
} from "@/lib/fridge";
import { useAuth, signOut, signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { listItems, upsertItems, deleteItem } from "@/lib/fridge.functions";
import { useServerFn } from "@tanstack/react-start";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kylkoll – håll koll på vad du har hemma" },
      {
        name: "description",
        content:
          "Lägg in varor du köpt och pricka av när de tar slut. Sök snabbt i butiken för att se om du redan har varan hemma.",
      },
      { property: "og:title", content: "Kylkoll – håll koll på vad du har hemma" },
      {
        property: "og:description",
        content: "Din digitala kylskåpslista: lägg in varor, pricka av när de tar slut.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading: authLoading } = useAuth();
  const isCloud = !!user;

  const [localItems, setLocalItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Kylskåp");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"hemma" | "slut">("hemma");

  useEffect(() => {
    setLocalItems(loadItems());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !isCloud) saveItems(localItems);
  }, [localItems, loaded, isCloud]);

  const queryClient = useQueryClient();
  const fetchList = useServerFn(listItems);
  const doUpsert = useServerFn(upsertItems);
  const doDelete = useServerFn(deleteItem);

  const cloudQuery = useQuery({
    queryKey: ["fridge-items", user?.id],
    queryFn: async () => {
      const items = await fetchList({});
      return items;
    },
    enabled: isCloud,
    staleTime: 0,
  });

  const upsertMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      await doUpsert({ data: items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridge-items", user?.id] });
    },
    onError: (err) => {
      toast.error("Kunde inte spara i molnet: " + (err instanceof Error ? err.message : String(err)));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await doDelete({ data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fridge-items", user?.id] });
    },
    onError: (err) => {
      toast.error("Kunde inte ta bort: " + (err instanceof Error ? err.message : String(err)));
    },
  });

  // Migrate local items to cloud once after first login
  useEffect(() => {
    if (!isCloud || !loaded || cloudQuery.isLoading || cloudQuery.isError) return;
    const local = loadItems();
    if (local.length === 0) return;
    if ((cloudQuery.data ?? []).length > 0) return;

    const migrate = async () => {
      await doUpsert({ data: local });
      clearItems();
      queryClient.invalidateQueries({ queryKey: ["fridge-items", user?.id] });
      toast.success("Dina lokala varor har sparats i molnet");
    };
    migrate();
  }, [isCloud, loaded, cloudQuery.data, cloudQuery.isLoading, cloudQuery.isError, doUpsert, queryClient, user?.id]);

  const items: Item[] = isCloud ? (cloudQuery.data ?? []) : localItems;

  const home = useMemo(() => items.filter((i) => !i.finishedAt), [items]);
  const gone = useMemo(
    () => items.filter((i) => i.finishedAt).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [items],
  );

  const q = normalize(query);
  const list = (tab === "hemma" ? home : gone).filter((i) => !q || normalize(i.name).includes(q));
  const exactHome = q ? home.find((i) => normalize(i.name).includes(q)) : undefined;

  function setItems(updater: (prev: Item[]) => Item[]) {
    if (isCloud) {
      const current = cloudQuery.data ?? [];
      const next = updater(current);
      upsertMutation.mutate(next);
    } else {
      setLocalItems(updater);
    }
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = home.find((i) => normalize(i.name) === normalize(trimmed));
    if (existing) {
      setItems((prev) =>
        prev.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + 1 } : i)),
      );
      toast.success(`${existing.name} – nu ${existing.qty + 1} st hemma`);
    } else {
      setItems((prev) => [
        { id: newId(), name: trimmed, qty: 1, category, addedAt: Date.now() },
        ...prev,
      ]);
      toast.success(`${trimmed} tillagd i ${category.toLowerCase()}`);
    }
    setName("");
  }

  function changeQty(id: string, delta: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)),
    );
  }

  function markFinished(item: Item) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, finishedAt: Date.now(), qty: 1 } : i)),
    );
    toast(`${item.name} markerad som slut`, {
      action: {
        label: "Ångra",
        onClick: () =>
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, finishedAt: undefined } : i)),
          ),
      },
    });
  }

  function restore(item: Item) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, finishedAt: undefined, addedAt: Date.now() } : i)),
    );
    toast.success(`${item.name} är hemma igen`);
  }

  function remove(id: string) {
    if (isCloud) {
      deleteMutation.mutate(id);
    } else {
      setLocalItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  async function handleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Inloggning misslyckades: " + result.error.message);
      return;
    }
    if (result.redirected) return;
  }

  async function handleSignOut() {
    await signOut();
    toast.success("Du är utloggad");
  }

  return (
    <main className="min-h-screen px-4 pb-24 pt-10">
      <Toaster position="top-center" />
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Refrigerator className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold">Kylkoll</h1>
            <p className="text-sm text-muted-foreground">
              Vet alltid vad du har hemma – även när du står i butiken.
            </p>
          </div>
          {!authLoading && (
            <div className="flex shrink-0 items-center gap-2">
              {user ? (
                <>
                  <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
                    {user.email}
                  </span>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={handleSignOut}>
                    <LogOut className="size-4" />
                    <span className="hidden sm:inline">Logga ut</span>
                  </Button>
                </>
              ) : (
                <Button size="sm" className="rounded-full" onClick={handleSignIn}>
                  <LogIn className="size-4" />
                  Logga in
                </Button>
              )}
            </div>
          )}
        </header>

        {isCloud && (
          <p className="mb-4 text-xs text-muted-foreground">
            Synkad med molnet – dina varor följer med till alla enheter.
          </p>
        )}

        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <form onSubmit={addItem} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="vara">
              Lägg till vara
            </label>
            <div className="flex gap-2">
              <Input
                id="vara"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Mjölk, Ägg, Smör…"
                className="h-11 rounded-xl"
              />
              <Button type="submit" className="h-11 rounded-xl px-5">
                <Plus /> Lägg till
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </form>
        </section>

        <section className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Har jag detta hemma? Sök…"
              className="h-11 rounded-xl pl-9"
            />
          </div>
          {q && (
            <p
              className={`mt-2 rounded-xl px-3 py-2 text-sm font-medium ${
                exactHome
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {exactHome
                ? `Ja – du har ${exactHome.name} hemma (${exactHome.qty} st, ${exactHome.category.toLowerCase()}).`
                : "Nej – du har ingen sådan vara hemma just nu."}
            </p>
          )}
        </section>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "hemma" | "slut")}
          className="mt-6"
        >
          <TabsList className="rounded-xl">
            <TabsTrigger value="hemma" className="rounded-lg">
              Hemma ({home.length})
            </TabsTrigger>
            <TabsTrigger value="slut" className="rounded-lg">
              Slut ({gone.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ul className="mt-4 space-y-2">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-medium ${item.finishedAt ? "text-muted-foreground line-through" : ""}`}
                >
                  {item.name}
                </p>
                <Badge variant="secondary" className="mt-1 rounded-full text-[11px] font-normal">
                  {item.category}
                </Badge>
              </div>

              {!item.finishedAt ? (
                <>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      onClick={() => changeQty(item.id, -1)}
                      aria-label="Minska antal"
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{item.qty}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      onClick={() => changeQty(item.id, 1)}
                      aria-label="Öka antal"
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => markFinished(item)}
                  >
                    <Check /> Slut
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => restore(item)}
                  >
                    <RotateCcw /> Köpt igen
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full text-muted-foreground"
                    onClick={() => remove(item.id)}
                    aria-label="Ta bort"
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
          {list.length === 0 && (
            <li className="rounded-2xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
              {tab === "hemma"
                ? "Inget här ännu – lägg till din första vara ovan."
                : "Inga slutvaror ännu."}
            </li>
          )}
        </ul>
      </div>
    </main>
  );
}
