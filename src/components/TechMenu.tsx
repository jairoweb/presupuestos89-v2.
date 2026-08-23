import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Download, Upload } from "lucide-react";
import {
  budgetStorage,
  type SavedClient,
  type SavedProduct,
  type SavedBudget,
} from "@/lib/budgetStorage";
import { toast } from "sonner";

interface TechMenuProps {
  onLoadBudget?: (budget: SavedBudget) => void;
}

const TechMenu = ({ onLoadBudget }: TechMenuProps) => {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [history, setHistory] = useState<SavedBudget[]>([]);

  const refresh = () => {
    setClients(budgetStorage.getClients());
    setProducts(budgetStorage.getProducts());
    setHistory(budgetStorage.getHistory());
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        setOpen((v) => {
          if (!v) refresh();
          return !v;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  // ---------- Clients ----------
  const updateClient = (id: string, patch: Partial<SavedClient>) => {
    const next = clients.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
    setClients(next);
    budgetStorage.saveClients(next);
  };
  const deleteClient = (id: string) => {
    budgetStorage.removeClient(id);
    setClients(budgetStorage.getClients());
    toast.success("Cliente eliminado");
  };
  const addClient = () => {
    const c: SavedClient = {
      id: crypto.randomUUID(),
      name: "Nuevo cliente",
      data: "",
      updatedAt: Date.now(),
    };
    budgetStorage.upsertClient(c);
    setClients(budgetStorage.getClients());
  };

  // ---------- Products ----------
  const updateProduct = (id: string, patch: Partial<SavedProduct>) => {
    const next = products.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
    setProducts(next);
    budgetStorage.saveProducts(next);
  };
  const deleteProduct = (id: string) => {
    budgetStorage.removeProduct(id);
    setProducts(budgetStorage.getProducts());
    toast.success("Producto eliminado");
  };
  const addProduct = () => {
    const p: SavedProduct = {
      id: crypto.randomUUID(),
      description: "Nuevo trabajo / producto",
      amount: 0,
      updatedAt: Date.now(),
    };
    budgetStorage.upsertProduct(p);
    setProducts(budgetStorage.getProducts());
  };

  // ---------- History ----------
  const deleteBudget = (id: string) => {
    budgetStorage.removeFromHistory(id);
    setHistory(budgetStorage.getHistory());
    toast.success("Presupuesto eliminado");
  };

  // ---------- Backup ----------
  const exportBackup = () => {
    const data = budgetStorage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-presupuestos-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.clients) budgetStorage.saveClients(parsed.clients);
        if (parsed.products) budgetStorage.saveProducts(parsed.products);
        if (parsed.history) budgetStorage.saveHistory(parsed.history);
        refresh();
        toast.success("Backup importado");
      } catch {
        toast.error("Archivo no válido");
      }
    };
    reader.readAsText(file);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Menú técnico</DialogTitle>
          <DialogDescription>
            Gestiona clientes, catálogo y presupuestos. Atajo: Ctrl + Alt + M
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="clients" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="clients">Clientes ({clients.length})</TabsTrigger>
            <TabsTrigger value="products">Catálogo ({products.length})</TabsTrigger>
            <TabsTrigger value="history">Historial ({history.length})</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          {/* CLIENTS */}
          <TabsContent value="clients" className="flex-1 overflow-y-auto space-y-3 mt-4">
            <Button onClick={addClient} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Añadir cliente
            </Button>
            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay clientes guardados.</p>
            )}
            {clients.map((c) => (
              <div key={c.id} className="border rounded-md p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label className="text-xs">Nombre / Alias</Label>
                      <Input
                        value={c.name}
                        onChange={(e) => updateClient(c.id, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Datos completos</Label>
                      <Textarea
                        value={c.data}
                        rows={3}
                        onChange={(e) => updateClient(c.id, { data: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteClient(c.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* PRODUCTS */}
          <TabsContent value="products" className="flex-1 overflow-y-auto space-y-3 mt-4">
            <Button onClick={addProduct} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Añadir trabajo / producto
            </Button>
            {products.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay productos guardados.</p>
            )}
            {products.map((p) => (
              <div key={p.id} className="border rounded-md p-3 flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                  <div>
                    <Label className="text-xs">Descripción</Label>
                    <Textarea
                      value={p.description}
                      rows={2}
                      onChange={(e) => updateProduct(p.id, { description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Importe (€)</Label>
                    <Input
                      type="number"
                      value={p.amount || ""}
                      onChange={(e) =>
                        updateProduct(p.id, { amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteProduct(p.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="flex-1 overflow-y-auto space-y-2 mt-4">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay presupuestos guardados.</p>
            )}
            {history.map((b) => (
              <div
                key={b.id}
                className="border rounded-md p-3 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    Nº {b.numero || "—"} · {b.fecha}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.cliente.split("\n")[0] || "Sin cliente"} · {formatCurrency(b.total)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {onLoadBudget && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onLoadBudget(b);
                        setOpen(false);
                        toast.success("Presupuesto cargado");
                      }}
                    >
                      Abrir
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBudget(b.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* BACKUP */}
          <TabsContent value="backup" className="flex-1 overflow-y-auto space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Exporta todos los datos a un archivo JSON o restaura desde un backup anterior.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={exportBackup} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Exportar backup
              </Button>
              <Label className="cursor-pointer">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importBackup(f);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-2 h-10 px-4 border rounded-md text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" /> Importar backup
                </span>
              </Label>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TechMenu;