import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

interface PaintingRow {
  id: string;
  title: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Provide the current canvas as a Blob (PNG) when saving.
  getPngBlob: () => Promise<Blob | null>;
  // Called when user picks a painting to load.
  onLoad: (img: HTMLImageElement) => void;
}

export function SaveLoadDialog({ open, onOpenChange, getPngBlob, onLoad }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("Untitled");
  const [saving, setSaving] = useState(false);
  const [paintings, setPaintings] = useState<PaintingRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingList(true);
    supabase
      .from("paintings")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setPaintings(data ?? []);
        setLoadingList(false);
      });
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const blob = await getPngBlob();
      if (!blob) throw new Error("Could not capture canvas");
      const fileName = `${user.id}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("paintings")
        .upload(fileName, blob, { contentType: "image/png" });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("paintings").insert({
        user_id: user.id,
        title: title || "Untitled",
        storage_path: fileName,
      });
      if (dbErr) throw dbErr;
      toast.success("Painting saved");
      // Refresh list
      const { data } = await supabase
        .from("paintings")
        .select("*")
        .order("created_at", { ascending: false });
      setPaintings(data ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (row: PaintingRow) => {
    const { data } = supabase.storage.from("paintings").getPublicUrl(row.storage_path);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      onLoad(img);
      onOpenChange(false);
    };
    img.onerror = () => toast.error("Could not load image");
    img.src = data.publicUrl;
  };

  const handleDelete = async (row: PaintingRow) => {
    await supabase.storage.from("paintings").remove([row.storage_path]);
    const { error } = await supabase.from("paintings").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else setPaintings((p) => p.filter((r) => r.id !== row.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Your paintings</DialogTitle>
          <DialogDescription>
            Save your current canvas to your account or load a previous one.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="save">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="save">Save current</TabsTrigger>
            <TabsTrigger value="load">My paintings ({paintings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="save" className="space-y-3 pt-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Painting title"
            />
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save to my account
            </Button>
          </TabsContent>

          <TabsContent value="load" className="pt-3">
            {loadingList ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : paintings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No saved paintings yet.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {paintings.map((row) => {
                  const url = supabase.storage.from("paintings").getPublicUrl(row.storage_path).data.publicUrl;
                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-md border border-border p-2"
                    >
                      <img
                        src={url}
                        alt={row.title}
                        className="h-12 w-12 rounded border border-border bg-canvas object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => handleLoad(row)}>
                        Load
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(row)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
