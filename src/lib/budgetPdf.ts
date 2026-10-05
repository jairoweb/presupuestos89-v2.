import jsPDF from "jspdf";

export interface BudgetPdfItem {
  description: string;
  amount: number;
}

export interface BudgetPdfData {
  date: string;
  number: string;
  client: string;
  items: BudgetPdfItem[];
  iva10: boolean;
  iva21: boolean;
}

const COLORS = {
  ink: "#1a1a1a",
  muted: "#5f6368",
  light: "#f2f3f5",
  magenta: "#d51b78",
  yellow: "#f4c542",
  green: "#4cae50",
  blue: "#3f9bd3",
  orange: "#f28a35",
  white: "#ffffff",
};

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value: number) {
  return euro.format(Number.isFinite(value) ? value : 0);
}

function dateLabel(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function fill(pdf: jsPDF, color: string) {
  pdf.setFillColor(...rgb(color));
}

function text(pdf: jsPDF, color: string) {
  pdf.setTextColor(...rgb(color));
}

function drawLogo(pdf: jsPDF, logoDataUrl: string | null, x: number, y: number) {
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", x, y, 36, 36, undefined, "FAST");
    return;
  }

  // Fallback for environments where the public logo cannot be loaded.
  fill(pdf, COLORS.magenta);
  pdf.circle(x + 18, y + 18, 15, "F");
  text(pdf, COLORS.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("GENDY", x + 18, y + 16, { align: "center" });
  pdf.text("FONSECA", x + 18, y + 22, { align: "center" });
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch("/pwa-512x512.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildBudgetPdf(data: BudgetPdfData): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const bottom = pageH - margin;
  const gap = 5;
  let y = margin;
  const logoDataUrl = await loadLogoDataUrl();

  const addPage = () => {
    pdf.addPage();
    y = margin;
  };

  const ensure = (height: number, repeatTable = false) => {
    if (y + height <= bottom) return;
    addPage();
    if (repeatTable) drawTableHeader();
  };

  const drawTableHeader = () => {
    ensure(10);
    fill(pdf, COLORS.white);
    pdf.rect(margin, y, contentW, 9, "F");
    text(pdf, COLORS.ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("DESCRIPCIÓN", margin + 3, y + 5.8);
    pdf.text("IMPORTE", pageW - margin - 3, y + 5.8, { align: "right" });
    y += 9;
  };

  pdf.setProperties({
    title: `Presupuesto ${data.number || ""}`,
    subject: "Presupuesto",
    creator: "Gestor de Presupuestos Pro",
  });

  // Header: the logo, title and metadata stay together.
  ensure(42);
  drawLogo(pdf, logoDataUrl, margin + 2, y + 1);
  text(pdf, COLORS.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.text("PRESUPUESTO", pageW - margin, y + 17, { align: "right" });
  pdf.setDrawColor(...rgb(COLORS.magenta));
  pdf.setLineWidth(1.1);
  pdf.line(pageW - margin - 63, y + 22, pageW - margin, y + 22);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  text(pdf, COLORS.muted);
  pdf.text(`Fecha: ${dateLabel(data.date) || "—"}`, pageW - margin, y + 29, { align: "right" });
  pdf.text(`Nº de presupuesto: ${data.number || "—"}`, pageW - margin, y + 35, { align: "right" });
  y += 42;

  // Client block.
  const clientLines = pdf.splitTextToSize(data.client.trim() || "Sin datos del cliente", contentW - 8);
  const clientH = Math.max(18, clientLines.length * 4.4 + 10);
  ensure(clientH);
  fill(pdf, COLORS.light);
  pdf.roundedRect(margin, y, contentW, clientH, 2, 2, "F");
  text(pdf, COLORS.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("DATOS DEL CLIENTE", margin + 4, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(clientLines, margin + 4, y + 12, { lineHeightFactor: 1.25 });
  y += clientH + gap;

  drawTableHeader();
  const visibleItems = data.items.filter((item) => item.description.trim() || item.amount);
  for (const item of visibleItems.length ? visibleItems : [{ description: "", amount: 0 }]) {
    const lines = pdf.splitTextToSize(item.description.trim() || "—", contentW - 45);
    const rowH = Math.max(11, lines.length * 4.2 + 6);
    if (y + rowH > bottom) {
      addPage();
      drawTableHeader();
    }
    pdf.setDrawColor(...rgb(COLORS.ink));
    pdf.setLineWidth(0.25);
    pdf.rect(margin, y, contentW, rowH);
    pdf.line(pageW - margin - 37, y, pageW - margin - 37, y + rowH);
    text(pdf, COLORS.ink);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(lines, margin + 3, y + 5, { lineHeightFactor: 1.2 });
    pdf.text(money(item.amount), pageW - margin - 3, y + 5, { align: "right" });
    y += rowH;
  }

  y += gap;
  const subtotal = visibleItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const iva10 = data.iva10 ? subtotal * 0.1 : 0;
  const iva21 = data.iva21 ? subtotal * 0.21 : 0;
  const total = subtotal + iva10 + iva21;
  const taxes: Array<[string, number]> = [];
  if (data.iva10) taxes.push(["IVA 10%", iva10]);
  if (data.iva21) taxes.push(["IVA 21%", iva21]);
  const totalsH = 9 + taxes.length * 8 + 12;

  // Totals flow directly into the original fiscal footer.
  ensure(totalsH + gap + 19);
  const totalsX = pageW - margin - 78;
  const totalsW = 78;
  const row = (label: string, value: string, height: number, strong = false) => {
    fill(pdf, strong ? COLORS.light : COLORS.white);
    pdf.rect(totalsX, y, totalsW, height, "F");
    pdf.setDrawColor(...rgb(COLORS.ink));
    pdf.rect(totalsX, y, totalsW, height);
    text(pdf, COLORS.ink);
    pdf.setFont("helvetica", strong ? "bold" : "normal");
    pdf.setFontSize(strong ? 10 : 8.5);
    pdf.text(label, totalsX + 3, y + height / 2 + 1.2);
    pdf.text(value, totalsX + totalsW - 3, y + height / 2 + 1.2, { align: "right" });
    y += height;
  };
  row("SUBTOTAL", money(subtotal), 9);
  for (const [label, value] of taxes) row(label, money(value), 8);
  row("TOTAL", money(total), 12, true);
  y += gap;

  ensure(19);
  pdf.setDrawColor(...rgb(COLORS.light));
  pdf.line(margin, y, pageW - margin, y);
  y += 5;
  text(pdf, COLORS.muted);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("GENDY OMAR FONSECA MORA · N.I.F. X8970860G", pageW / 2, y, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Avd. de Bormujos · Bloque C.2.a · Piso 5-Puerta 2 · Bormujos (Sevilla)", pageW / 2, y + 4.5, { align: "center" });
  pdf.text("gendyfonseca2014@gmail.com · Tlf. 679 28 41 82", pageW / 2, y + 9, { align: "center" });

  return pdf.output("blob");
}
