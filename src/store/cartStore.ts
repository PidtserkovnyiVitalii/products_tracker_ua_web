import { create } from 'zustand'

export interface ProductStock {
  id?: string
  location_id: string
  location_name: string
  quantity: number
}

export interface ProductRecord {
  id: string
  name: string
  sku: string
  price: number
  barcode?: string
  description?: string
  category_id?: string
  category?: {
    id: string
    name: string
    slug: string
  }
  total_stock: number
  stocks: ProductStock[]
}

export interface CartItem {
  product: ProductRecord
  quantity: number
  price: number
}

interface CartState {
  items: CartItem[]
  locationId: string
  setLocationId: (id: string) => void
  addItem: (product: ProductRecord, quantity?: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemPrice: (productId: string, price: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  setItems: (items: CartItem[]) => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  locationId: '',
  setLocationId: (locationId) => set({ locationId }),
  addItem: (product, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        }
      }
      return {
        items: [
          ...state.items,
          {
            product,
            quantity,
            price: Number(product.price) || 0,
          },
        ],
      }
    }),
  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter((item) => item.product.id !== productId),
        }
      }
      return {
        items: state.items.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        ),
      }
    }),
  updateItemPrice: (productId, price) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, price } : item
      ),
    })),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    })),
  clearCart: () => set({ items: [] }),
  setItems: (items) => set({ items }),
}))
