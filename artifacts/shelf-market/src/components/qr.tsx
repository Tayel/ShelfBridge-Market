import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

export const catalogUrl = (tokenId: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog/${tokenId}`;

export function ShelfQr({ tokenId, label, size = 220, download = true }: { tokenId: string; label: string; size?: number; download?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const url = catalogUrl(tokenId);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: size * 2, margin: 1, color: { dark: "#2a1d17", light: "#fffaf5" } })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => { if (alive) setErr("Couldn't draw the QR code."); });
    return () => { alive = false; };
  }, [url, size]);
  return (
    <div className="flex flex-col items-center gap-2">
      {src ? <img src={src} alt={`QR code for ${label}`} width={size} height={size} className="rounded-2xl border border-border" data-testid="img-qr" />
        : <div style={{ width: size, height: size }} className="animate-pulse rounded-2xl bg-muted" />}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <p className="max-w-[240px] break-all text-center text-[11px] text-muted-foreground" data-testid="text-qr-url">{url}</p>
      {download && src && (
        <a href={src} download={`inraf-${label}-qr.png`} data-testid="link-download-qr"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium hover:bg-muted">
          <Download className="h-4 w-4" /> Download QR
        </a>
      )}
    </div>
  );
}
