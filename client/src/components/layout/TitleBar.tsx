import { useState } from 'react';
import { Minus, Square, X, MoreVertical, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

export function TitleBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!window.electronAPI) return null;

  const handleZoomIn = () => {
    const wc = (window as any).electronAPI?.webContents;
    if (wc) { wc.zoomIn(); return; }
    // Fallback: use Electron's built-in zoom via keyboard event simulation
    const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true });
    document.dispatchEvent(event);
  };
  const handleZoomOut = () => {
    const wc = (window as any).electronAPI?.webContents;
    if (wc) { wc.zoomOut(); return; }
    const event = new KeyboardEvent('keydown', { key: '-', ctrlKey: true });
    document.dispatchEvent(event);
  };
  const handleZoomReset = () => {
    const wc = (window as any).electronAPI?.webContents;
    if (wc) { wc.zoomReset(); return; }
  };

  return (
    <div className="flex h-8 items-center justify-between bg-background border-b border-border shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2 pl-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <img src="/icon.png" alt="" className="h-4 w-4" />
        <span className="text-[11px] font-semibold text-muted-foreground">Nasscord</span>

        <div className="relative ml-1">
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <MoreVertical className="h-3 w-3" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[200]" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-6 z-[201] min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-2xl">
                <button onClick={() => { handleZoomIn(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors">
                  <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" /> Zoom In
                </button>
                <button onClick={() => { handleZoomOut(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors">
                  <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" /> Zoom Out
                </button>
                <button onClick={() => { handleZoomReset(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors">
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Reset Zoom
                </button>
                <div className="h-px bg-border my-1 mx-2" />
                <div className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" /> Made by Nassto
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={() => window.electronAPI?.minimize()}
          className="flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => window.electronAPI?.maximize()}
          className="flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
          <Square className="h-3 w-3" />
        </button>
        <button onClick={() => window.electronAPI?.close()}
          className="flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
