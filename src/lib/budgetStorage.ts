export interface SavedClient {
  id: string;
  name: string;
  data: string; // datos completos (nombre, dirección, teléfono...)
  updatedAt: number;
}

export interface SavedProduct {
  id: string;
  description: string;
  amount: number;
  updatedAt: number;
}

export interface BudgetItemSnap {
  description: string;
  amount: number;
}

export interface SavedBudget {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  items: BudgetItemSnap[];
  iva10: boolean;
  iva21: boolean;
  total: number;
  createdAt: number;
}

export interface BudgetDraft {
  fecha: string;
  numeroPresupuesto: string;
  datosCliente: string;
  items: BudgetItemSnap[];
  iva10: boolean;
  iva21: boolean;
}

const KEYS = {
  draft: "budget.draft.v1",
  clients: "budget.clients.v1",
  products: "budget.products.v1",
  history: "budget.history.v1",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const budgetStorage = {
  // Draft
  getDraft: (): BudgetDraft | null => read<BudgetDraft | null>(KEYS.draft, null),
  saveDraft: (draft: BudgetDraft) => write(KEYS.draft, draft),
  clearDraft: () => localStorage.removeItem(KEYS.draft),

  // Clients
  getClients: (): SavedClient[] => read<SavedClient[]>(KEYS.clients, []),
  saveClients: (list: SavedClient[]) => write(KEYS.clients, list),
  upsertClient: (client: SavedClient) => {
    const list = budgetStorage.getClients();
    const idx = list.findIndex((c) => c.id === client.id);
    if (idx >= 0) list[idx] = client;
    else list.push(client);
    budgetStorage.saveClients(list);
  },
  removeClient: (id: string) => {
    budgetStorage.saveClients(budgetStorage.getClients().filter((c) => c.id !== id));
  },

  // Products
  getProducts: (): SavedProduct[] => read<SavedProduct[]>(KEYS.products, []),
  saveProducts: (list: SavedProduct[]) => write(KEYS.products, list),
  upsertProduct: (p: SavedProduct) => {
    const list = budgetStorage.getProducts();
    const idx = list.findIndex((x) => x.id === p.id);
    if (idx >= 0) list[idx] = p;
    else list.push(p);
    budgetStorage.saveProducts(list);
  },
  removeProduct: (id: string) => {
    budgetStorage.saveProducts(budgetStorage.getProducts().filter((p) => p.id !== id));
  },

  // History
  getHistory: (): SavedBudget[] => read<SavedBudget[]>(KEYS.history, []),
  saveHistory: (list: SavedBudget[]) => write(KEYS.history, list),
  addToHistory: (b: SavedBudget) => {
    const list = budgetStorage.getHistory();
    list.unshift(b);
    budgetStorage.saveHistory(list.slice(0, 200));
  },
  removeFromHistory: (id: string) => {
    budgetStorage.saveHistory(budgetStorage.getHistory().filter((b) => b.id !== id));
  },

  exportAll: () => ({
    clients: budgetStorage.getClients(),
    products: budgetStorage.getProducts(),
    history: budgetStorage.getHistory(),
    exportedAt: Date.now(),
  }),
};