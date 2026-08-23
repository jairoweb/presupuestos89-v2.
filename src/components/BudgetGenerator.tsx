import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, FileDown, Printer, MessageCircle, Loader2, BookmarkPlus, Users } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import TechMenu from "./TechMenu";
import { budgetStorage, type SavedBudget } from "@/lib/budgetStorage";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BudgetItem {
  id: string;
  description: string;
  amount: number;
}

const BudgetGenerator = () => {
  const budgetRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [numeroPresupuesto, setNumeroPresupuesto] = useState("");
  const [datosCliente, setDatosCliente] = useState("");
  const [items, setItems] = useState<BudgetItem[]>([
    { id: crypto.randomUUID(), description: "", amount: 0 },
  ]);
  const [iva10, setIva10] = useState(false);
  const [iva21, setIva21] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [productPickerOpenFor, setProductPickerOpenFor] = useState<string | null>(null);

  const savedClients = useMemo(() => budgetStorage.getClients(), [clientPickerOpen]);
  const savedProducts = useMemo(() => budgetStorage.getProducts(), [productPickerOpenFor]);

  // El formulario siempre arranca vacío: se descarta cualquier borrador previo
  useEffect(() => {
    budgetStorage.clearDraft();
  }, []);

  // Antes de imprimir, expandimos los textareas para que no se corte el texto
  useEffect(() => {
    const expand = () => {
      pageRef.current?.querySelectorAll("textarea").forEach((t) => {
        const el = t as HTMLTextAreaElement;
        el.dataset.prevHeight = el.style.height;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight + 2}px`;
      });
    };
    const restore = () => {
      pageRef.current?.querySelectorAll("textarea").forEach((t) => {
        const el = t as HTMLTextAreaElement;
        el.style.height = el.dataset.prevHeight ?? "";
      });
    };
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  const shareToWhatsApp = async () => {
    if (!pageRef.current) return;


    setIsSharing(true);
    try {
      const filename = `presupuesto-${numeroPresupuesto || 'sin-numero'}.pdf`;
      const pdfBlob = await generatePdfBlob();
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      // Save to history
      saveCurrentToHistory();
      
      // Share via Web Share API if available
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Presupuesto ${numeroPresupuesto || ''}`,
          text: `Presupuesto ${numeroPresupuesto || ''}`
        });
        toast.success("¡Compartido correctamente!");
      } else {
        // Fallback: download the PDF
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.info("PDF descargado. Compártelo manualmente en WhatsApp.");
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error("Error al compartir. Inténtalo de nuevo.");
    } finally {
      setIsSharing(false);
    }
  };

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: "", amount: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const ivaAmount10 = iva10 ? subtotal * 0.1 : 0;
  const ivaAmount21 = iva21 ? subtotal * 0.21 : 0;
  const total = subtotal + ivaAmount10 + ivaAmount21;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Renders the whole screen (toolbar + budget card) to a PDF.
  // Content flows to extra A4 pages when it is too long instead of being cropped.
  const generatePdfBlob = async (): Promise<Blob> => {
    const element = pageRef.current!;
    const A4_PX = 794; // ancho A4 a 96dpi
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      width: A4_PX,
      windowWidth: A4_PX,
      onclone: (clonedDoc: Document) => {
        applyPdfStyles(clonedDoc);
        prepareCloneForPdf(clonedDoc);
      },
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const margin = 4;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;


    const imgW = maxW;
    const pxPerMm = canvas.width / imgW;
    const sliceHeightPx = Math.floor(maxH * pxPerMm);

    let renderedPx = 0;
    let page = 0;
    while (renderedPx < canvas.height) {
      const currentSlice = Math.min(sliceHeightPx, canvas.height - renderedPx);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSlice;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, currentSlice, 0, 0, canvas.width, currentSlice);

      if (page > 0) pdf.addPage();
      pdf.addImage(
        sliceCanvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        margin,
        margin,
        imgW,
        currentSlice / pxPerMm,
        undefined,
        "FAST"
      );

      renderedPx += currentSlice;
      page += 1;
    }

    return pdf.output("blob");
  };

  const exportToPDF = async () => {
    if (!pageRef.current) return;
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presupuesto-${numeroPresupuesto || "sin-numero"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      saveCurrentToHistory();
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };


  // Replace form fields with static text and hide UI-only controls in the clone.
  const prepareCloneForPdf = (doc: Document) => {
    doc.querySelectorAll("textarea").forEach((textarea) => {
      const div = doc.createElement("div");
      div.style.whiteSpace = "pre-wrap";
      div.style.wordBreak = "break-word";
      div.style.overflow = "visible";
      div.style.height = "auto";
      div.style.minHeight = "0";
      div.style.border = "0";
      div.style.padding = "2px 4px 8px";
      div.style.fontSize = "13px";
      div.style.lineHeight = "1.3";
      div.style.fontFamily = "Helvetica, Arial, sans-serif";
      div.textContent = (textarea as HTMLTextAreaElement).value;
      textarea.parentNode?.replaceChild(div, textarea);
    });

    doc.querySelectorAll("input").forEach((input) => {
      const el = input as HTMLInputElement;
      if (el.type === "checkbox") return;
      const span = doc.createElement("span");
      span.style.display = "inline-block";
      span.style.width = "100%";
      span.style.border = "0";
      span.style.padding = "1px 2px";
      span.style.fontSize = "13px";
      span.style.fontFamily = "Helvetica, Arial, sans-serif";
      span.style.textAlign = el.classList.contains("text-right") ? "right" : "left";
      span.textContent = el.value;
      el.parentNode?.replaceChild(span, el);
    });

    doc.querySelectorAll(".print\\:hidden").forEach((el) => {
      (el as HTMLElement).style.display = "none";
    });
  };

  // Inject compact, professional PDF styles into the cloned document.
  const applyPdfStyles = (doc: Document) => {
    const style = doc.createElement("style");
    style.textContent = `
      html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
      .max-w-4xl { max-width: 794px !important; width: 794px !important; margin: 0 !important; }
      .budget-card {
        font-family: Helvetica, Arial, sans-serif !important;
        color: #1a1a1a !important;
        border: 1px solid #1a1a1a !important;
        box-shadow: none !important;
        padding: 12px 14px !important;
        margin: 0 !important;
        background: #ffffff !important;
        width: 100% !important;
        max-width: 100% !important;
        font-size: 13px !important;
      }
      .budget-card * {
        box-shadow: none !important;
        max-height: none !important;
        overflow: visible !important;
        line-height: 1.3 !important;
      }

      .budget-card h1, .budget-card h2, .budget-card h3 {
        letter-spacing: 0.5px;
        margin: 0 !important;
      }
      /* Compact vertical rhythm so everything fits on one page */
      .budget-card .mb-6, .budget-card .mb-8,
      .budget-card .sm\\:mb-8 { margin-bottom: 6px !important; }
      .budget-card .mt-1 { margin-top: 1px !important; }
      .budget-card .gap-3, .budget-card .gap-4,
      .budget-card .sm\\:gap-4, .budget-card .sm\\:gap-8 { gap: 6px !important; }
      .budget-card .p-2, .budget-card .sm\\:p-3 { padding: 3px 6px !important; }
      .budget-card .p-1, .budget-card .sm\\:p-2 { padding: 2px 4px !important; }
      .budget-card .pt-2, .budget-card .sm\\:pt-4 { padding-top: 2px !important; }
      .budget-card .space-y-0\\.5 > * + *, .budget-card .sm\\:space-y-1 > * + * { margin-top: 1px !important; }
      .budget-card label { font-size: 12px !important; }
      .budget-card p { margin: 0 !important; }
      .budget-card .pdf-divider { border-top: 2px solid #1a1a1a; }
    `;
    doc.head.appendChild(style);
  };


  const saveCurrentToHistory = () => {
    const snap: SavedBudget = {
      id: crypto.randomUUID(),
      numero: numeroPresupuesto,
      fecha,
      cliente: datosCliente,
      items: items.map(({ description, amount }) => ({ description, amount })),
      iva10,
      iva21,
      total,
      createdAt: Date.now(),
    };
    budgetStorage.addToHistory(snap);
  };

  const saveCurrentClient = () => {
    if (!datosCliente.trim()) {
      toast.error("Rellena los datos del cliente primero");
      return;
    }
    const firstLine = datosCliente.split("\n")[0].trim() || "Cliente";
    budgetStorage.upsertClient({
      id: crypto.randomUUID(),
      name: firstLine,
      data: datosCliente,
      updatedAt: Date.now(),
    });
    toast.success("Cliente guardado");
  };

  const loadBudget = (b: SavedBudget) => {
    setFecha(b.fecha);
    setNumeroPresupuesto(b.numero);
    setDatosCliente(b.cliente);
    setItems(b.items.map((i) => ({ id: crypto.randomUUID(), ...i })));
    setIva10(b.iva10);
    setIva21(b.iva21);
  };

  return (
    <div className="min-h-screen bg-muted p-2 sm:p-4 md:p-8">
      <div ref={pageRef} className="max-w-4xl mx-auto">
        <div className="print-toolbar flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">

          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Generador de Presupuestos</h1>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Button onClick={handlePrint} variant="outline" className="gap-2 flex-1 sm:flex-none text-sm">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
            <Button onClick={exportToPDF} className="gap-2 bg-primary hover:bg-primary/90 flex-1 sm:flex-none text-sm">
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span> PDF
            </Button>
            <Button 
              onClick={shareToWhatsApp}
              disabled={isSharing}
              className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] flex-1 sm:flex-none text-sm text-white"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Enviar</span> WhatsApp
            </Button>
          </div>
        </div>

        <Card ref={budgetRef} className="budget-card p-4 sm:p-6 md:p-8 bg-card shadow-lg print:shadow-none">
          {/* Header */}
          <div className="budget-header flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 sm:w-24 sm:h-24">
                {/* Paint splash logo */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(var(--paint-yellow))] via-[hsl(var(--paint-green))] to-[hsl(var(--paint-blue))] opacity-60" />
                <div className="absolute inset-1 sm:inset-2 rounded-full bg-[hsl(var(--paint-magenta))] flex items-center justify-center">
                  <div className="text-center text-white">
                    <p className="font-bold text-[10px] sm:text-sm leading-tight">GENDY</p>
                    <p className="font-bold text-[10px] sm:text-sm leading-tight">FONSECA</p>
                    <p className="text-[6px] sm:text-[8px] leading-tight">PINTURA Y COLOR</p>
                  </div>
                </div>
                {/* Paint drops */}
                <div className="absolute -top-1 left-1/2 w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[hsl(var(--paint-yellow))]" />
                <div className="absolute top-0 -right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[hsl(var(--paint-green))]" />
                <div className="absolute -bottom-1 right-3 sm:right-4 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[hsl(var(--paint-blue))]" />
                <div className="absolute bottom-1 sm:bottom-2 -left-1 sm:-left-2 w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[hsl(var(--paint-orange))]" />
              </div>
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-foreground">PRESUPUESTO</h2>
          </div>

          {/* Date and Budget Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6">
            <div>
              <Label htmlFor="fecha" className="text-xs sm:text-sm font-semibold text-foreground">
                FECHA:
              </Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 border-b-2 border-t-0 border-x-0 rounded-none bg-transparent print:border-foreground text-sm"
              />
            </div>
            <div>
              <Label htmlFor="numero" className="text-xs sm:text-sm font-semibold text-foreground">
                Nº DE PRESUPUESTO:
              </Label>
              <Input
                id="numero"
                type="text"
                value={numeroPresupuesto}
                onChange={(e) => setNumeroPresupuesto(e.target.value)}
                placeholder="001"
                className="mt-1 border-b-2 border-t-0 border-x-0 rounded-none bg-transparent print:border-foreground text-sm"
              />
            </div>
          </div>

          {/* Client Data */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cliente" className="text-xs sm:text-sm font-semibold text-foreground">
                DATOS DEL CLIENTE:
              </Label>
              <div className="flex gap-1 print:hidden">
                <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      <Users className="h-3 w-3" /> Cargar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 max-h-72 overflow-y-auto" align="end">
                    {savedClients.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">
                        No hay clientes guardados.
                      </p>
                    ) : (
                      savedClients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setDatosCliente(c.data);
                            setClientPickerOpen(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm"
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {c.data}
                          </div>
                        </button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={saveCurrentClient}
                >
                  <BookmarkPlus className="h-3 w-3" /> Guardar
                </Button>
              </div>
            </div>
            <Textarea
              id="cliente"
              value={datosCliente}
              onChange={(e) => setDatosCliente(e.target.value)}
              placeholder="Nombre, dirección, teléfono..."
              className="mt-1 min-h-[60px] sm:min-h-[80px] border-2 bg-transparent print:border-foreground text-sm"
            />
          </div>

          {/* Items Table */}
          <div className="border-2 border-foreground mb-6 overflow-x-auto">
            <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_150px] bg-muted min-w-[280px]">
              <div className="p-2 sm:p-3 font-bold text-center border-r-2 border-foreground text-foreground text-xs sm:text-base">
                DESCRIPCIÓN
              </div>
              <div className="p-2 sm:p-3 font-bold text-center text-foreground text-xs sm:text-base">IMPORTE</div>
            </div>
            
            {items.map((item) => (
              <div key={item.id} className="budget-row grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_150px] border-t-2 border-foreground group min-w-[280px]">
                <div className="p-1 sm:p-2 border-r-2 border-foreground relative">
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    placeholder="Descripción del trabajo..."
                    className="min-h-[50px] sm:min-h-[60px] max-h-[120px] sm:max-h-[150px] border-0 bg-transparent resize-none focus-visible:ring-0 text-sm overflow-y-auto"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 print:hidden">
                    <Popover
                      open={productPickerOpenFor === item.id}
                      onOpenChange={(o) => setProductPickerOpenFor(o ? item.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          title="Cargar del catálogo"
                        >
                          <BookmarkPlus className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2 max-h-72 overflow-y-auto" align="end">
                        {savedProducts.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2">
                            Catálogo vacío. Añade desde el menú técnico (Ctrl+Alt+M).
                          </p>
                        ) : (
                          savedProducts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                updateItem(item.id, "description", p.description);
                                updateItem(item.id, "amount", p.amount);
                                setProductPickerOpenFor(null);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm"
                            >
                              <div className="font-medium line-clamp-2">{p.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(p.amount)}
                              </div>
                            </button>
                          ))
                        )}
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="h-6 w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-1 sm:p-2 flex items-center justify-center">
                  <Input
                    type="number"
                    value={item.amount || ""}
                    onChange={(e) => updateItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="text-right border-0 bg-transparent focus-visible:ring-0 text-sm"
                  />
                </div>
              </div>
            ))}

            <Button
              variant="ghost"
              onClick={addItem}
              className="w-full border-t-2 border-foreground gap-2 rounded-none hover:bg-muted print:hidden text-sm"
            >
              <Plus className="h-4 w-4" />
              Añadir línea
            </Button>
          </div>

          {/* Footer with business info and totals */}
          <div className="budget-footer flex flex-col sm:grid sm:grid-cols-[1fr_auto] gap-3 sm:gap-4">
            <div className="text-[9px] sm:text-xs text-muted-foreground space-y-0.5 sm:space-y-1 pt-2 sm:pt-4 order-2 sm:order-1">
              <p className="font-semibold">GENDY OMAR FONSECA MORA. N.I.F: X8970860G</p>
              <p>Avd. de Bormujos - Bloque C.2.a - Piso 5-Puerta 2 - Bormujos (Sevilla)</p>
              <p>gendyfonseca2014@gmail.com | Tlf: 679 28 41 82</p>
            </div>

            <div className="budget-totals border-2 border-foreground w-full sm:w-auto order-1 sm:order-2">
              <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[100px_100px] text-xs sm:text-sm">
                <div className="p-2 font-bold border-b border-r border-foreground text-foreground">SUBTOTAL:</div>
                <div className="p-2 text-right border-b border-foreground">{formatCurrency(subtotal)}</div>
                
                <div className="p-2 font-bold border-b border-r border-foreground flex items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={iva10}
                    onChange={(e) => setIva10(e.target.checked)}
                    className="print:hidden w-4 h-4"
                  />
                  IVA 10%:
                </div>
                <div className="p-2 text-right border-b border-foreground">{formatCurrency(ivaAmount10)}</div>
                
                <div className="p-2 font-bold border-b border-r border-foreground flex items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={iva21}
                    onChange={(e) => setIva21(e.target.checked)}
                    className="print:hidden w-4 h-4"
                  />
                  IVA 21%:
                </div>
                <div className="p-2 text-right border-b border-foreground">{formatCurrency(ivaAmount21)}</div>
                
                <div className="p-2 font-bold border-r border-foreground bg-muted text-foreground">TOTAL:</div>
                <div className="p-2 text-right font-bold bg-muted">{formatCurrency(total)}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      <TechMenu onLoadBudget={loadBudget} />
    </div>
  );
};

export default BudgetGenerator;
