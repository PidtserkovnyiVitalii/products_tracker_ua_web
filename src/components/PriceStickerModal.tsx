import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import { useI18n } from '../i18n/i18n'
import {
  X,
  Printer,
  Sparkles,
  AlertCircle,
  Settings2,
  Copy,
  Layers,
  Save,
  Check,
  Tag,
  Grid2x2,
  Grid,
} from 'lucide-react'
import { api } from '../api/api'
import { generateInternalEan13 } from '../utils/barcode'

export interface StickerProduct {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  category?: {
    id: string
    name: string
  }
}

interface PriceStickerModalProps {
  isOpen: boolean
  onClose: () => void
  products: StickerProduct[]
  onProductUpdated?: (updatedProduct: StickerProduct) => void
}

export type StickerTemplate =
  | 'standard'
  | 'split4_barcode'
  | 'split4_sku'
  | 'split6_barcode'
  | 'split6_sku'

type PresetSize = '58x40' | '40x30' | '50x25' | 'custom'

interface SizeDimensions {
  width: number
  height: number
  nameUk: string
  nameEn: string
}

const PRESETS: Record<Exclude<PresetSize, 'custom'>, SizeDimensions> = {
  '58x40': { width: 58, height: 40, nameUk: '58 × 40 мм (Стандарт)', nameEn: '58 × 40 mm (Standard)' },
  '40x30': { width: 40, height: 30, nameUk: '40 × 30 мм (Компакт)', nameEn: '40 × 30 mm (Compact)' },
  '50x25': { width: 50, height: 25, nameUk: '50 × 25 мм (Вузький)', nameEn: '50 × 25 mm (Narrow)' },
}

const TEMPLATES: {
  id: StickerTemplate
  nameUk: string
  nameEn: string
  icon: typeof Tag
  descUk: string
  descEn: string
}[] = [
  {
    id: 'standard',
    nameUk: 'Стандартний цінник',
    nameEn: 'Standard Price Tag',
    icon: Tag,
    descUk: 'Без штрихкоду • Назва + SKU + Ціна',
    descEn: 'No barcode • Name + SKU + Price',
  },
  {
    id: 'split4_barcode',
    nameUk: '4 комірки: Штрихкоди (2×2)',
    nameEn: '4 Cells: Barcodes (2×2)',
    icon: Grid2x2,
    descUk: '4 скановані штрихкоди',
    descEn: '4 scannable barcodes',
  },
  {
    id: 'split4_sku',
    nameUk: '4 комірки: Артикули SKU (2×2)',
    nameEn: '4 Cells: SKUs (2×2)',
    icon: Grid2x2,
    descUk: '4 великі артикули SKU',
    descEn: '4 large bold SKUs',
  },
  {
    id: 'split6_barcode',
    nameUk: '6 комірок: Штрихкоди (2×3)',
    nameEn: '6 Cells: Barcodes (2×3)',
    icon: Grid,
    descUk: '6 компактних штрихкодів',
    descEn: '6 compact barcodes',
  },
  {
    id: 'split6_sku',
    nameUk: '6 комірок: Артикули SKU (2×3)',
    nameEn: '6 Cells: SKUs (2×3)',
    icon: Grid,
    descUk: '6 компактних артикулів SKU',
    descEn: '6 compact SKUs',
  },
]

/**
 * Format currency with Ukrainian Hryvnia symbol
 */
function formatPrice(price: number): string {
  return `${Number(price || 0).toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₴`
}

/**
 * Single SVG Barcode Renderer
 */
function BarcodeSvg({
  code,
  widthMm,
  heightMm,
  compact = false,
}: {
  code: string
  widthMm: number
  heightMm: number
  compact?: boolean
}) {
  const { tr } = useI18n()
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !code) return

    // Pick barcode format: EAN13 if 13 digits, else Code 128
    const format = /^\d{13}$/.test(code) ? 'EAN13' : 'CODE128'
    const barWidth = compact ? (widthMm < 30 ? 1.0 : 1.1) : widthMm < 45 ? 1.2 : widthMm < 55 ? 1.5 : 1.8
    const barHeight = compact ? (heightMm < 18 ? 14 : 18) : heightMm < 30 ? 22 : heightMm < 38 ? 30 : 38
    const fontSize = compact ? 8 : widthMm < 45 ? 9 : 11

    try {
      JsBarcode(svgRef.current, code, {
        format,
        lineColor: '#000000',
        width: barWidth,
        height: barHeight,
        displayValue: true,
        fontSize,
        font: 'monospace',
        textMargin: 0,
        margin: 0,
      })
    } catch {
      // Fallback to Code 128 on error
      try {
        JsBarcode(svgRef.current, code, {
          format: 'CODE128',
          lineColor: '#000000',
          width: barWidth,
          height: barHeight,
          displayValue: true,
          fontSize: compact ? 8 : 10,
          font: 'monospace',
          textMargin: 0,
          margin: 0,
        })
      } catch (err) {
        console.error('Failed to render barcode:', err)
      }
    }
  }, [code, widthMm, heightMm, compact])

  if (!code) {
    return (
      <div className="h-full w-full flex items-center justify-center border border-dashed border-slate-300 rounded text-[9px] text-slate-400 p-1 text-center font-mono">
        {tr('Без коду', 'No code')}
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center w-full h-full overflow-hidden">
      <svg ref={svgRef} className="max-w-full max-h-full" />
    </div>
  )
}

/**
 * Visual Sticker Layout
 */
function StickerCard({
  product,
  widthMm,
  heightMm,
  template = 'standard',
  isPrintMode = false,
}: {
  product: StickerProduct
  widthMm: number
  heightMm: number
  template?: StickerTemplate
  isPrintMode?: boolean
}) {
  const isCompact = heightMm <= 30 || widthMm <= 40

  if (template === 'split4_barcode') {
    return (
      <div
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
        }}
        className={`bg-white text-black box-border grid grid-cols-2 grid-rows-2 overflow-hidden ${
          isPrintMode
            ? 'sticker-label-page'
            : 'rounded-xl border border-slate-300 shadow-sm transition-all'
        }`}
      >
        {[0, 1, 2, 3].map((cellIdx) => (
          <div
            key={cellIdx}
            className={`flex items-center justify-center p-1 overflow-hidden ${
              cellIdx % 2 === 0 ? 'border-r border-dashed border-slate-300' : ''
            } ${cellIdx < 2 ? 'border-b border-dashed border-slate-300' : ''}`}
          >
            <BarcodeSvg
              code={product.barcode || ''}
              widthMm={widthMm / 2}
              heightMm={heightMm / 2}
              compact
            />
          </div>
        ))}
      </div>
    )
  }

  if (template === 'split4_sku') {
    return (
      <div
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
        }}
        className={`bg-white text-black box-border grid grid-cols-2 grid-rows-2 overflow-hidden ${
          isPrintMode
            ? 'sticker-label-page'
            : 'rounded-xl border border-slate-300 shadow-sm transition-all'
        }`}
      >
        {[0, 1, 2, 3].map((cellIdx) => (
          <div
            key={cellIdx}
            className={`flex items-center justify-center p-1.5 overflow-hidden ${
              cellIdx % 2 === 0 ? 'border-r border-dashed border-slate-300' : ''
            } ${cellIdx < 2 ? 'border-b border-dashed border-slate-300' : ''}`}
          >
            <span
              className={`font-mono font-black text-slate-950 tracking-tight text-center break-all leading-tight ${
                product.sku.length > 14
                  ? 'text-[9px] sm:text-[10px]'
                  : product.sku.length > 8
                  ? 'text-xs sm:text-sm'
                  : 'text-sm sm:text-base'
              }`}
            >
              {product.sku}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (template === 'split6_barcode') {
    return (
      <div
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
        }}
        className={`bg-white text-black box-border grid grid-cols-2 grid-rows-3 overflow-hidden ${
          isPrintMode
            ? 'sticker-label-page'
            : 'rounded-xl border border-slate-300 shadow-sm transition-all'
        }`}
      >
        {[0, 1, 2, 3, 4, 5].map((cellIdx) => (
          <div
            key={cellIdx}
            className={`flex items-center justify-center p-0.5 overflow-hidden ${
              cellIdx % 2 === 0 ? 'border-r border-dashed border-slate-300' : ''
            } ${cellIdx < 4 ? 'border-b border-dashed border-slate-300' : ''}`}
          >
            <BarcodeSvg
              code={product.barcode || ''}
              widthMm={widthMm / 2}
              heightMm={heightMm / 3}
              compact
            />
          </div>
        ))}
      </div>
    )
  }

  if (template === 'split6_sku') {
    return (
      <div
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
        }}
        className={`bg-white text-black box-border grid grid-cols-2 grid-rows-3 overflow-hidden ${
          isPrintMode
            ? 'sticker-label-page'
            : 'rounded-xl border border-slate-300 shadow-sm transition-all'
        }`}
      >
        {[0, 1, 2, 3, 4, 5].map((cellIdx) => (
          <div
            key={cellIdx}
            className={`flex items-center justify-center p-1 overflow-hidden ${
              cellIdx % 2 === 0 ? 'border-r border-dashed border-slate-300' : ''
            } ${cellIdx < 4 ? 'border-b border-dashed border-slate-300' : ''}`}
          >
            <span
              className={`font-mono font-black text-slate-950 tracking-tight text-center break-all leading-tight ${
                product.sku.length > 14
                  ? 'text-[8px] sm:text-[9px]'
                  : product.sku.length > 8
                  ? 'text-[9px] sm:text-[10px]'
                  : 'text-[11px] sm:text-xs'
              }`}
            >
              {product.sku}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // Default: Standard Price Tag (No barcode)
  // Top: Product Name (prominent, nicely sized to fill top section)
  // Bottom: SKU on left, Price on right (clean, no "SKU" or "Price" labels)
  const nameLen = product.name.length
  const nameFontSize = isCompact
    ? nameLen > 45
      ? 'text-[10px] leading-tight'
      : nameLen > 25
      ? 'text-[11px] leading-snug'
      : 'text-xs sm:text-sm leading-snug'
    : nameLen > 55
    ? 'text-xs sm:text-[13px] leading-tight'
    : nameLen > 30
    ? 'text-sm sm:text-base leading-snug'
    : 'text-base sm:text-lg leading-snug'

  return (
    <div
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
      }}
      className={`bg-white text-black box-border flex flex-col justify-between overflow-hidden ${
        isPrintMode
          ? 'sticker-label-page p-[2.5mm]'
          : 'p-3 rounded-xl border border-slate-300 shadow-sm transition-all'
      }`}
    >
      {/* Top section: Product Name */}
      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden border-b border-slate-200/70 pb-1 mb-1">
        <h4
          className={`font-black text-slate-950 line-clamp-3 ${nameFontSize}`}
          title={product.name}
        >
          {product.name}
        </h4>
      </div>

      {/* Bottom section: SKU on left, Price on right (clean, no label captions) */}
      <div className="shrink-0 flex items-center justify-between gap-2 pt-0.5">
        {/* Left: SKU */}
        <div className="min-w-0 flex-1 flex items-center">
          <span
            className={`font-mono font-bold text-slate-800 break-all leading-tight line-clamp-2 ${
              product.sku.length > 16
                ? 'text-[9px] sm:text-[10px]'
                : product.sku.length > 10
                ? 'text-[10px] sm:text-[11px]'
                : 'text-xs sm:text-[13px]'
            }`}
            title={product.sku}
          >
            {product.sku}
          </span>
        </div>

        {/* Right: Price */}
        <div className="shrink-0 flex items-center pl-2 border-l border-slate-200/70">
          <span
            className={`font-black text-slate-950 tracking-tight whitespace-nowrap ${
              isCompact ? 'text-sm' : 'text-base sm:text-lg'
            }`}
          >
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PriceStickerModal({
  isOpen,
  onClose,
  products: initialProducts,
  onProductUpdated,
}: PriceStickerModalProps) {
  const { tr } = useI18n()
  const [items, setItems] = useState<StickerProduct[]>(initialProducts)
  const [template, setTemplate] = useState<StickerTemplate>('standard')
  const [preset, setPreset] = useState<PresetSize>('58x40')
  const [customWidth, setCustomWidth] = useState<number>(58)
  const [customHeight, setCustomHeight] = useState<number>(40)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0)
  const [isPrinting, setIsPrinting] = useState(false)

  // Missing Barcode Handling State
  const [barcodeInputs, setBarcodeInputs] = useState<Record<string, string>>({})
  const [savingBarcodeId, setSavingBarcodeId] = useState<string | null>(null)
  const [barcodeSavedSuccess, setBarcodeSavedSuccess] = useState<string | null>(null)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)

  // Sync products and quantities when opened
  useEffect(() => {
    setItems(initialProducts)
    const initialQty: Record<string, number> = {}
    const initialBarcodes: Record<string, string> = {}
    initialProducts.forEach((p) => {
      initialQty[p.id] = 1
      if (!p.barcode) {
        initialBarcodes[p.id] = generateInternalEan13()
      }
    })
    setQuantities(initialQty)
    setBarcodeInputs(initialBarcodes)
    setActivePreviewIndex(0)
  }, [initialProducts, isOpen])

  if (!isOpen || items.length === 0) return null

  const activeWidth = preset === 'custom' ? customWidth : PRESETS[preset].width
  const activeHeight = preset === 'custom' ? customHeight : PRESETS[preset].height

  const totalStickerCount = Object.values(quantities).reduce((acc, q) => acc + (q || 0), 0)
  const activePreviewProduct = items[activePreviewIndex] || items[0]

  // Any item missing barcode?
  const itemsMissingBarcode = items.filter((p) => !p.barcode)
  const requiresBarcode = template === 'split4_barcode' || template === 'split6_barcode'

  const handleQuantityChange = (productId: string, val: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }))
  }

  const handleSetAllQuantities = (qty: number) => {
    const updated: Record<string, number> = {}
    items.forEach((p) => {
      updated[p.id] = Math.max(0, qty)
    })
    setQuantities(updated)
  }

  const handleGenerateNewBarcode = (productId: string) => {
    const newCode = generateInternalEan13()
    setBarcodeInputs((prev) => ({ ...prev, [productId]: newCode }))
  }

  const handleSaveBarcode = async (product: StickerProduct) => {
    const code = barcodeInputs[product.id]?.trim()
    if (!code) {
      setBarcodeError(tr('Будь ласка, введіть штрихкод', 'Please provide a barcode'))
      return
    }
    setSavingBarcodeId(product.id)
    setBarcodeError(null)

    try {
      const res = await api.put(`/api/v1/products/${product.id}`, {
        product: { barcode: code },
      })
      const updated = res.data
      setItems((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, barcode: code } : item))
      )
      if (onProductUpdated) {
        onProductUpdated(updated)
      }
      setBarcodeSavedSuccess(product.id)
      setTimeout(() => setBarcodeSavedSuccess(null), 3000)
    } catch (err) {
      console.error(err)
      setBarcodeError(tr('Не вдалося зберегти штрихкод товару.', 'Failed to save barcode to product.'))
    } finally {
      setSavingBarcodeId(null)
    }
  }

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 250)
  }

  return (
    <>
      {/* Hidden Thermal Print Container rendered directly into body via Portal */}
      {createPortal(
        <div
          id="sticker-print-container"
          className="hidden print:block"
        >
          <style>
            {`
              @media print {
                @page {
                  size: ${activeWidth}mm ${activeHeight}mm;
                  margin: 0;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  height: auto !important;
                  min-height: 0 !important;
                  background: #ffffff !important;
                  overflow: visible !important;
                }
                #root {
                  display: none !important;
                }
                #sticker-print-container {
                  display: block !important;
                  position: static !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: ${activeWidth}mm !important;
                  background: #ffffff !important;
                }
                .sticker-label-page {
                  box-sizing: border-box !important;
                  width: ${activeWidth}mm !important;
                  height: ${activeHeight}mm !important;
                  max-height: ${activeHeight}mm !important;
                  overflow: hidden !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  margin: 0 !important;
                }
                .sticker-label-page:last-child {
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                }
              }
            `}
          </style>

          {items.map((prod) => {
            const qty = quantities[prod.id] || 0
            return Array.from({ length: qty }).map((_, idx) => (
              <StickerCard
                key={`${prod.id}-print-${idx}`}
                product={prod}
                widthMm={activeWidth}
                heightMm={activeHeight}
                template={template}
                isPrintMode
              />
            ))
          })}
        </div>,
        document.body
      )}

      {/* Screen Interactive Modal */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {items.length === 1
                    ? tr('Друк цінників та маркування', 'Print Price & Item Stickers')
                    : tr('Пакетний друк цінників та маркування', 'Batch Print Price & Item Stickers')}
                </h3>
                <p className="text-xs text-slate-500">
                  {items.length === 1
                    ? tr(`Налаштування етикетки для ${items[0].name}`, `Configuring sticker for ${items[0].name}`)
                    : tr(
                        `Вибрано товарів для друку: ${items.length}`,
                        `${items.length} products selected for printing`
                      )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls Column */}
            <div className="lg:col-span-7 space-y-5">
              {/* Template Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  {tr('Варіант етикетки / шаблону', 'Sticker Template Variation')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEMPLATES.map((tmpl) => {
                    const isSelected = template === tmpl.id
                    const Icon = tmpl.icon
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setTemplate(tmpl.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs ring-1 ring-blue-500'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">
                            {tr(tmpl.nameUk, tmpl.nameEn)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {tr(tmpl.descUk, tmpl.descEn)}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Missing Barcode Alert Banner (Context-aware: only when barcode template is active) */}
              {requiresBarcode && itemsMissingBarcode.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        {itemsMissingBarcode.length === 1
                          ? tr('Виявлено відсутній штрихкод', 'Missing Barcode Detected')
                          : tr(
                              `${itemsMissingBarcode.length} товарів не мають штрихкодів`,
                              `${itemsMissingBarcode.length} Products Have No Barcodes`
                            )}
                      </h4>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        {tr(
                          'Для друку штрихкодів призначте код EAN-13.',
                          'Assign an EAN-13 barcode to print scannable codes.'
                        )}
                      </p>
                    </div>
                  </div>

                  {barcodeError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                      {barcodeError}
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {itemsMissingBarcode.map((missingProd) => (
                      <div
                        key={missingProd.id}
                        className="p-3 bg-white border border-amber-100 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {missingProd.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            SKU: {missingProd.sku}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={barcodeInputs[missingProd.id] || ''}
                            onChange={(e) =>
                              setBarcodeInputs((prev) => ({
                                ...prev,
                                [missingProd.id]: e.target.value,
                              }))
                            }
                            placeholder={tr('Введіть штрихкод...', 'Enter barcode...')}
                            className="w-32 px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateNewBarcode(missingProd.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={tr('Згенерувати інший внутрішній код EAN-13', 'Generate another internal EAN-13 code')}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={savingBarcodeId === missingProd.id}
                            onClick={() => handleSaveBarcode(missingProd)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {savingBarcodeId === missingProd.id ? (
                              tr('Збереження...', 'Saving...')
                            ) : barcodeSavedSuccess === missingProd.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> {tr('Збережено', 'Saved')}
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" /> {tr('Зберегти', 'Save')}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Preset Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-blue-600" />
                  {tr('Розмір етикетки', 'Sticker Label Size')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(PRESETS) as Array<Exclude<PresetSize, 'custom'>>).map((key) => {
                    const isSelected = preset === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPreset(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs ring-1 ring-blue-500'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        <div className="text-xs leading-snug">
                          {tr(PRESETS[key].nameUk, PRESETS[key].nameEn)}
                        </div>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setPreset('custom')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      preset === 'custom'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="text-xs leading-snug">{tr('Власний розмір (мм)', 'Custom Size (mm)')}</div>
                  </button>
                </div>

                {/* Custom Dimensions Input */}
                {preset === 'custom' && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        {tr('Ширина (мм):', 'Width (mm):')}
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="120"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Math.max(20, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-slate-400 mt-4">×</span>
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        {tr('Висота (мм):', 'Height (mm):')}
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="100"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Math.max(15, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Quantities Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                    {tr('Кількість копій для друку', 'Print Quantities')}
                  </label>
                  {items.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500">{tr('Для всіх:', 'Set all:')}</span>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(1)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
                      >
                        1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(5)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
                      >
                        5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllQuantities(10)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
                      >
                        10
                      </button>
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {items.map((prod, idx) => {
                    const qty = quantities[prod.id] || 0
                    const isSelectedPreview = activePreviewIndex === idx
                    return (
                      <div
                        key={prod.id}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          isSelectedPreview ? 'bg-blue-50/40' : 'bg-white'
                        }`}
                      >
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => setActivePreviewIndex(idx)}
                        >
                          <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-mono">SKU: {prod.sku}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-800">{formatPrice(prod.price)}</span>
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(prod.id, qty - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={qty}
                            onChange={(e) => handleQuantityChange(prod.id, Number(e.target.value))}
                            className="w-12 h-7 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(prod.id, qty + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Live Preview Column */}
            <div className="lg:col-span-5 flex flex-col items-center justify-start bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80">
              <div className="w-full flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  {tr('Попередній перегляд етикетки', 'Live Sticker Preview')}
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {activeWidth} × {activeHeight} {tr('мм', 'mm')}
                </span>
              </div>

              {/* Physical Preview Render with drop shadow */}
              <div className="p-4 bg-slate-200/50 rounded-2xl border border-dashed border-slate-300 max-w-full overflow-auto flex items-center justify-center min-h-[190px]">
                <StickerCard
                  product={activePreviewProduct}
                  widthMm={activeWidth}
                  heightMm={activeHeight}
                  template={template}
                />
              </div>

              <div className="w-full mt-4 p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Шаблон:', 'Template:')}</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {tr(
                      TEMPLATES.find((t) => t.id === template)?.nameUk || '',
                      TEMPLATES.find((t) => t.id === template)?.nameEn || ''
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Вибрано товарів:', 'Selected Products:')}</span>
                  <span className="font-bold text-slate-900">{items.length}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Усього етикеток до друку:', 'Total Stickers to Print:')}</span>
                  <span className="font-bold text-blue-600 text-sm">{totalStickerCount}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{tr('Розмір рулону:', 'Roll Size:')}</span>
                  <span className="font-mono text-slate-800">
                    {activeWidth}mm × {activeHeight}mm
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              {tr('Скасувати', 'Cancel')}
            </button>

            <button
              type="button"
              disabled={totalStickerCount === 0 || isPrinting}
              onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {isPrinting
                ? tr('Підготовка...', 'Preparing...')
                : tr(
                    `Друкувати етикетки (${totalStickerCount})`,
                    `Print ${totalStickerCount} Sticker${totalStickerCount === 1 ? '' : 's'}`
                  )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
