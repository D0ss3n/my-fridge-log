import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Barcode, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ScanResult = { code: string; name: string | null };

async function lookupProduct(code: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_sv,brands,generic_name_sv,generic_name`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: number;
      product?: Record<string, string | undefined>;
    };
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name =
      p["product_name_sv"] ||
      p["generic_name_sv"] ||
      p["product_name"] ||
      p["generic_name"] ||
      p["brands"];
    return name?.trim() || null;
  } catch {
    return null;
  }
}

export function BarcodeScanner({
  open,
  onOpenChange,
  title,
  description,
  onResult,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onResult: (result: ScanResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    const reader = new BrowserMultiFormatReader();
    setError(null);

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          async (result) => {
            if (!result || stopped) return;
            stopped = true;
            controls?.stop();
            await handleCode(result.getText());
          },
        );
      } catch {
        setError(
          "Kunde inte starta kameran. Tillåt kameraåtkomst eller skriv in koden manuellt.",
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleCode(code: string) {
    setBusy(true);
    const name = await lookupProduct(code);
    setBusy(false);
    setManual("");
    onOpenChange(false);
    onResult({ code, name });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="size-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border bg-muted">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </div>

        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Söker upp varan…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = manual.trim();
            if (code) handleCode(code);
          }}
          className="flex gap-2"
        >
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="Eller skriv streckkodens siffror"
            className="h-11 rounded-xl"
          />
          <Button type="submit" className="h-11 rounded-xl" disabled={busy}>
            Sök
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
