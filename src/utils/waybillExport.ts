import XLSX from 'xlsx-js-style'

export interface ExportableSupplyItem {
  id: string
  quantity: number
  cost_price: number
  line_cost_total: number
  product?: {
    name: string
    sku: string
    barcode?: string | null
    category_name?: string | null
  } | null
}

export interface ExportableSupply {
  id: string
  reference_number?: string | null
  notes?: string | null
  status: 'pending' | 'received' | 'cancelled'
  supplier?: {
    name: string
    phone?: string | null
  } | null
  location?: {
    name: string
  } | null
  total_units_count: number
  total_cost: number
  created_at: string
  received_at?: string | null
  supply_items: ExportableSupplyItem[]
}

export interface ExportableTransferItem {
  id: string
  quantity: number
  unit_price: number
  line_retail_total: number
  product?: {
    name: string
    sku: string
    barcode?: string | null
    category_name?: string | null
  } | null
}

export interface ExportableTransfer {
  id: string
  reference_number?: string | null
  notes?: string | null
  status: 'pending' | 'completed' | 'cancelled'
  source_location?: {
    name: string
  } | null
  destination_location?: {
    name: string
  } | null
  total_units_count: number
  total_retail_value: number
  created_at: string
  completed_at?: string | null
  transfer_items: ExportableTransferItem[]
}

export interface ExportableWriteOffItem {
  id: string
  quantity: number
  retail_price: number
  cost_price: number
  line_retail_total: number
  line_cost_total: number
  product?: {
    name: string
    sku: string
    barcode?: string | null
    category_name?: string | null
  } | null
}

export interface ExportableWriteOff {
  id: string
  reference_number?: string | null
  notes?: string | null
  reason: 'defect' | 'personal_use' | 'loss' | 'marketing' | 'other'
  status: 'pending' | 'completed' | 'cancelled'
  location?: {
    name: string
  } | null
  user?: {
    email: string
  } | null
  total_units_count: number
  total_retail_loss: number
  total_cost_loss: number
  created_at: string
  completed_at?: string | null
  write_off_items: ExportableWriteOffItem[]
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(isoString)
  }
}

function getStatusLabel(status: string, isUk: boolean): string {
  if (status === 'received') return isUk ? 'Отримано' : 'Received'
  if (status === 'completed') return isUk ? 'Завершено' : 'Completed'
  if (status === 'cancelled') return isUk ? 'Скасовано' : 'Cancelled'
  return isUk ? 'Очікує' : 'Pending'
}

// Visual Theme & Color Palette (Hex RGB without '#')
const THEME = {
  primary: '1E293B',       // Slate 800
  cardBg: 'F8FAFC',        // Slate 50
  zebraEven: 'FFFFFF',     // White
  zebraOdd: 'F8FAFC',      // Slate 50
  summaryBg: 'F1F5F9',     // Slate 100
  notesBg: 'FFFBEB',       // Amber 50
  notesBorder: 'FDE68A',   // Amber 200
  notesText: '92400E',     // Amber 800
  borderLight: 'E2E8F0',   // Slate 200
  borderDark: '334155',    // Slate 700
  textDark: '0F172A',      // Slate 900
  textMuted: '475569',     // Slate 600
  textLight: '64748B',     // Slate 500
  textWhite: 'FFFFFF',     // White
}

interface CommonItemData {
  id: string
  name: string
  category: string
  sku: string
  barcode: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface SheetBuilderOptions {
  docTitle: string
  sheetName: string
  isUk: boolean
  filename: string
  leftCard: { label: string; value: string }[]
  rightCard: { label: string; value: string }[]
  notes?: string | null
  unitPriceHeader: string
  lineTotalHeader: string
  items: CommonItemData[]
  totalUnits: number
  totalAmount: number
  dispatchedTitle: string
  receivedTitle: string
}

function generateStyledWaybillSheet(opts: SheetBuilderOptions) {
  const ws: Record<string, any> = {}
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  const rowHeights: { hpt: number }[] = []
  const encode = XLSX.utils.encode_cell

  let currentRow = 0

  // Helper to set individual cell
  const setCell = (
    r: number,
    c: number,
    val: string | number,
    type: 's' | 'n' = 's',
    style: Record<string, any> = {},
    format?: string
  ) => {
    const addr = encode({ r, c })
    ws[addr] = { v: val, t: type, s: style }
    if (format) ws[addr].z = format
  }

  // Helper to set merged block with uniform borders and background
  const setMergedBlock = (
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    val: string | number,
    type: 's' | 'n' = 's',
    style: Record<string, any> = {},
    format?: string
  ) => {
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const addr = encode({ r, c })
        ws[addr] = {
          v: r === r1 && c === c1 ? val : '',
          t: r === r1 && c === c1 ? type : 's',
          s: style,
        }
        if (format && r === r1 && c === c1) ws[addr].z = format
      }
    }
  }

  // --- Row 0: Prominent Title Banner ---
  setMergedBlock(
    currentRow,
    0,
    currentRow,
    7,
    opts.docTitle,
    's',
    {
      fill: { fgColor: { rgb: THEME.primary } },
      font: { name: 'Segoe UI', sz: 13, bold: true, color: { rgb: THEME.textWhite } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }
  )
  rowHeights[currentRow] = { hpt: 34 }
  currentRow++

  // --- Row 1: Spacer ---
  rowHeights[currentRow] = { hpt: 8 }
  currentRow++

  // --- Rows 2-4: Structured Info Cards (Cols A-D Left, Cols E-H Right) ---
  const maxCardRows = Math.max(opts.leftCard.length, opts.rightCard.length)
  for (let i = 0; i < maxCardRows; i++) {
    const leftItem = opts.leftCard[i]
    const rightItem = opts.rightCard[i]

    // Left Card: Col A-B Label, Col C-D Value
    if (leftItem) {
      setMergedBlock(
        currentRow,
        0,
        currentRow,
        1,
        leftItem.label,
        's',
        {
          fill: { fgColor: { rgb: THEME.cardBg } },
          font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: THEME.textMuted } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: THEME.borderLight } },
            bottom: { style: 'thin', color: { rgb: THEME.borderLight } },
            left: { style: 'thin', color: { rgb: THEME.borderLight } },
            right: { style: 'thin', color: { rgb: THEME.borderLight } },
          },
        }
      )
      setMergedBlock(
        currentRow,
        2,
        currentRow,
        3,
        leftItem.value,
        's',
        {
          fill: { fgColor: { rgb: THEME.cardBg } },
          font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: THEME.textDark } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: THEME.borderLight } },
            bottom: { style: 'thin', color: { rgb: THEME.borderLight } },
            left: { style: 'thin', color: { rgb: THEME.borderLight } },
            right: { style: 'thin', color: { rgb: THEME.borderLight } },
          },
        }
      )
    }

    // Right Card: Col E-F Label, Col G-H Value
    if (rightItem) {
      setMergedBlock(
        currentRow,
        4,
        currentRow,
        5,
        rightItem.label,
        's',
        {
          fill: { fgColor: { rgb: THEME.cardBg } },
          font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: THEME.textMuted } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: THEME.borderLight } },
            bottom: { style: 'thin', color: { rgb: THEME.borderLight } },
            left: { style: 'thin', color: { rgb: THEME.borderLight } },
            right: { style: 'thin', color: { rgb: THEME.borderLight } },
          },
        }
      )
      setMergedBlock(
        currentRow,
        6,
        currentRow,
        7,
        rightItem.value,
        's',
        {
          fill: { fgColor: { rgb: THEME.cardBg } },
          font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: THEME.textDark } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: THEME.borderLight } },
            bottom: { style: 'thin', color: { rgb: THEME.borderLight } },
            left: { style: 'thin', color: { rgb: THEME.borderLight } },
            right: { style: 'thin', color: { rgb: THEME.borderLight } },
          },
        }
      )
    }

    rowHeights[currentRow] = { hpt: 20 }
    currentRow++
  }

  // --- Optional Notes Banner ---
  if (opts.notes) {
    rowHeights[currentRow] = { hpt: 6 }
    currentRow++

    setMergedBlock(
      currentRow,
      0,
      currentRow,
      7,
      `${opts.isUk ? 'Примітки:' : 'Notes:'} ${opts.notes}`,
      's',
      {
        fill: { fgColor: { rgb: THEME.notesBg } },
        font: { name: 'Segoe UI', sz: 9, italic: true, color: { rgb: THEME.notesText } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: THEME.notesBorder } },
          bottom: { style: 'thin', color: { rgb: THEME.notesBorder } },
          left: { style: 'thin', color: { rgb: THEME.notesBorder } },
          right: { style: 'thin', color: { rgb: THEME.notesBorder } },
        },
      }
    )
    rowHeights[currentRow] = { hpt: 22 }
    currentRow++
  }

  // --- Spacer Before Table Header ---
  rowHeights[currentRow] = { hpt: 10 }
  currentRow++

  // --- Table Headers (Row ~8) ---
  const headers = [
    { text: '№', align: 'center' },
    { text: opts.isUk ? 'Найменування товару' : 'Product Name', align: 'left' },
    { text: opts.isUk ? 'Категорія' : 'Category', align: 'left' },
    { text: 'SKU', align: 'center' },
    { text: opts.isUk ? 'Штрихкод' : 'Barcode', align: 'center' },
    { text: opts.isUk ? 'К-сть (шт.)' : 'Quantity (pcs)', align: 'right' },
    { text: opts.unitPriceHeader, align: 'right' },
    { text: opts.lineTotalHeader, align: 'right' },
  ]

  headers.forEach((h, colIndex) => {
    setCell(currentRow, colIndex, h.text, 's', {
      fill: { fgColor: { rgb: THEME.primary } },
      font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: THEME.textWhite } },
      alignment: { horizontal: h.align, vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: THEME.borderDark } },
        bottom: { style: 'thin', color: { rgb: THEME.borderDark } },
        left: { style: 'thin', color: { rgb: THEME.borderDark } },
        right: { style: 'thin', color: { rgb: THEME.borderDark } },
      },
    })
  })
  rowHeights[currentRow] = { hpt: 26 }
  currentRow++

  // --- Data Rows with Zebra Striping ---
  const itemBorder = {
    top: { style: 'thin', color: { rgb: THEME.borderLight } },
    bottom: { style: 'thin', color: { rgb: THEME.borderLight } },
    left: { style: 'thin', color: { rgb: THEME.borderLight } },
    right: { style: 'thin', color: { rgb: THEME.borderLight } },
  }

  opts.items.forEach((item, index) => {
    const bg = index % 2 === 0 ? THEME.zebraEven : THEME.zebraOdd

    // Col 0: Index
    setCell(currentRow, 0, index + 1, 'n', {
      fill: { fgColor: { rgb: bg } },
      font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: THEME.textMuted } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: itemBorder,
    })

    // Col 1: Product Name (with wrapText)
    setCell(currentRow, 1, item.name, 's', {
      fill: { fgColor: { rgb: bg } },
      font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: itemBorder,
    })

    // Col 2: Category (with wrapText)
    setCell(currentRow, 2, item.category, 's', {
      fill: { fgColor: { rgb: bg } },
      font: { name: 'Segoe UI', sz: 8.5, color: { rgb: THEME.textLight } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: itemBorder,
    })

    // Col 3: SKU (Monospace, string type to avoid number truncation)
    setCell(currentRow, 3, String(item.sku), 's', {
      fill: { fgColor: { rgb: bg } },
      font: { name: 'Consolas', sz: 9, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: itemBorder,
    })

    // Col 4: Barcode (Monospace, string type to prevent scientific notation)
    setCell(currentRow, 4, String(item.barcode), 's', {
      fill: { fgColor: { rgb: bg } },
      font: { name: 'Consolas', sz: 9, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: itemBorder,
    })

    // Col 5: Quantity (Numeric, formatted)
    setCell(
      currentRow,
      5,
      item.quantity,
      'n',
      {
        fill: { fgColor: { rgb: bg } },
        font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: THEME.textDark } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: itemBorder,
      },
      '#,##0'
    )

    // Col 6: Unit Price (Currency formatted)
    setCell(
      currentRow,
      6,
      item.unitPrice,
      'n',
      {
        fill: { fgColor: { rgb: bg } },
        font: { name: 'Segoe UI', sz: 9, color: { rgb: THEME.textDark } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: itemBorder,
      },
      '#,##0.00 "₴"'
    )

    // Col 7: Line Total (Bold currency formatted)
    setCell(
      currentRow,
      7,
      item.lineTotal,
      'n',
      {
        fill: { fgColor: { rgb: bg } },
        font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: THEME.textDark } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: itemBorder,
      },
      '#,##0.00 "₴"'
    )

    rowHeights[currentRow] = { hpt: 24 }
    currentRow++
  })

  // --- Summary / Total Row ---
  const summaryBorder = {
    top: { style: 'thin', color: { rgb: THEME.borderDark } },
    bottom: { style: 'double', color: { rgb: THEME.textDark } },
    left: { style: 'thin', color: { rgb: THEME.borderLight } },
    right: { style: 'thin', color: { rgb: THEME.borderLight } },
  }

  // Merged Label Across Cols A-E
  setMergedBlock(
    currentRow,
    0,
    currentRow,
    4,
    opts.isUk ? 'РАЗОМ:' : 'TOTAL:',
    's',
    {
      fill: { fgColor: { rgb: THEME.summaryBg } },
      font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: summaryBorder,
    }
  )

  // Total Quantity (Col F)
  setCell(
    currentRow,
    5,
    opts.totalUnits,
    'n',
    {
      fill: { fgColor: { rgb: THEME.summaryBg } },
      font: { name: 'Segoe UI', sz: 10.5, bold: true, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: summaryBorder,
    },
    '#,##0'
  )

  // Empty Price Spacer Cell (Col G)
  setCell(currentRow, 6, '', 's', {
    fill: { fgColor: { rgb: THEME.summaryBg } },
    border: summaryBorder,
  })

  // Total Amount (Col H)
  setCell(
    currentRow,
    7,
    opts.totalAmount,
    'n',
    {
      fill: { fgColor: { rgb: THEME.summaryBg } },
      font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: summaryBorder,
    },
    '#,##0.00 "₴"'
  )
  rowHeights[currentRow] = { hpt: 26 }
  currentRow++

  // --- Spacer Before Signatures ---
  rowHeights[currentRow] = { hpt: 18 }
  currentRow++

  // --- Signature Block ---
  // Row: Titles
  setMergedBlock(
    currentRow,
    1,
    currentRow,
    2,
    opts.dispatchedTitle,
    's',
    {
      font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'left', vertical: 'center' },
    }
  )
  setMergedBlock(
    currentRow,
    5,
    currentRow,
    6,
    opts.receivedTitle,
    's',
    {
      font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: THEME.textDark } },
      alignment: { horizontal: 'left', vertical: 'center' },
    }
  )
  rowHeights[currentRow] = { hpt: 18 }
  currentRow++

  // Row: Signature Lines
  const signatureLineStyle = {
    border: {
      bottom: { style: 'thin', color: { rgb: THEME.textDark } },
    },
  }
  setMergedBlock(currentRow, 1, currentRow, 2, '', 's', signatureLineStyle)
  setMergedBlock(currentRow, 5, currentRow, 6, '', 's', signatureLineStyle)
  rowHeights[currentRow] = { hpt: 16 }
  currentRow++

  // Row: Subtext (підпис) / (П.І.Б.)
  setCell(currentRow, 1, `(${opts.isUk ? 'підпис' : 'signature'})`, 's', {
    font: { name: 'Segoe UI', sz: 8, italic: true, color: { rgb: THEME.textLight } },
    alignment: { horizontal: 'center', vertical: 'top' },
  })
  setCell(currentRow, 2, `(${opts.isUk ? 'П.І.Б.' : 'Full Name'})`, 's', {
    font: { name: 'Segoe UI', sz: 8, italic: true, color: { rgb: THEME.textLight } },
    alignment: { horizontal: 'center', vertical: 'top' },
  })
  setCell(currentRow, 5, `(${opts.isUk ? 'підпис' : 'signature'})`, 's', {
    font: { name: 'Segoe UI', sz: 8, italic: true, color: { rgb: THEME.textLight } },
    alignment: { horizontal: 'center', vertical: 'top' },
  })
  setCell(currentRow, 6, `(${opts.isUk ? 'П.І.Б.' : 'Full Name'})`, 's', {
    font: { name: 'Segoe UI', sz: 8, italic: true, color: { rgb: THEME.textLight } },
    alignment: { horizontal: 'center', vertical: 'top' },
  })
  rowHeights[currentRow] = { hpt: 14 }
  currentRow++

  // Row: Date Placeholders
  const datePlaceholder = opts.isUk ? '«____» _______________ 202__ р.' : 'Date: ____/____/202__'
  setMergedBlock(
    currentRow,
    1,
    currentRow,
    2,
    datePlaceholder,
    's',
    {
      font: { name: 'Segoe UI', sz: 8.5, color: { rgb: THEME.textMuted } },
      alignment: { horizontal: 'left', vertical: 'center' },
    }
  )
  setMergedBlock(
    currentRow,
    5,
    currentRow,
    6,
    datePlaceholder,
    's',
    {
      font: { name: 'Segoe UI', sz: 8.5, color: { rgb: THEME.textMuted } },
      alignment: { horizontal: 'left', vertical: 'center' },
    }
  )
  rowHeights[currentRow] = { hpt: 20 }
  currentRow++

  // --- Column Widths Configuration ---
  ws['!cols'] = [
    { wch: 6 },  // Col A: №
    { wch: 40 }, // Col B: Product Name
    { wch: 20 }, // Col C: Category
    { wch: 18 }, // Col D: SKU
    { wch: 18 }, // Col E: Barcode
    { wch: 14 }, // Col F: Quantity
    { wch: 16 }, // Col G: Unit Price
    { wch: 18 }, // Col H: Line Total
  ]

  ws['!merges'] = merges
  ws['!rows'] = rowHeights
  ws['!ref'] = `A1:H${currentRow}`

  // Build & write workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName)
  XLSX.writeFile(wb, opts.filename)
}

/**
 * Export Supply Waybill to .xlsx with Modern Dark Slate styling
 */
export function exportSupplyToExcel(supply: ExportableSupply, locale: string = 'uk') {
  const isUk = locale !== 'en'
  const ref = supply.reference_number || supply.id.slice(0, 8).toUpperCase()
  const docTitle = isUk
    ? `ПРИБУТКОВА НАКЛАДНА № ${ref}`
    : `GOODS RECEIPT WAYBILL #${ref}`

  const leftCard = [
    { label: isUk ? 'Постачальник:' : 'Supplier:', value: supply.supplier?.name || '—' },
    { label: isUk ? 'Телефон:' : 'Phone:', value: supply.supplier?.phone || '—' },
    { label: isUk ? 'Створено:' : 'Created:', value: formatDate(supply.created_at) },
  ]

  const rightCard = [
    { label: isUk ? 'Локація:' : 'Location:', value: supply.location?.name || '—' },
    { label: isUk ? 'Статус:' : 'Status:', value: getStatusLabel(supply.status, isUk) },
    { label: isUk ? 'Отримано:' : 'Received:', value: formatDate(supply.received_at) },
  ]

  const items: CommonItemData[] = supply.supply_items.map((item) => ({
    id: item.id,
    name: item.product?.name || '—',
    category: item.product?.category_name || '—',
    sku: item.product?.sku || '—',
    barcode: item.product?.barcode || '—',
    quantity: item.quantity,
    unitPrice: Number(item.cost_price.toFixed(2)),
    lineTotal: Number(item.line_cost_total.toFixed(2)),
  }))

  const safeRef = ref.replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = isUk
    ? `nakladna_postavka_${safeRef}_${dateStr}.xlsx`
    : `supply_waybill_${safeRef}_${dateStr}.xlsx`

  generateStyledWaybillSheet({
    docTitle,
    sheetName: isUk ? 'Накладна' : 'Waybill',
    isUk,
    filename,
    leftCard,
    rightCard,
    notes: supply.notes,
    unitPriceHeader: isUk ? 'Ціна закупівлі (₴)' : 'Cost Price (₴)',
    lineTotalHeader: isUk ? 'Сума закупівлі (₴)' : 'Line Total (₴)',
    items,
    totalUnits: supply.total_units_count,
    totalAmount: Number(supply.total_cost.toFixed(2)),
    dispatchedTitle: isUk ? 'Відпустив (Постачальник):' : 'Dispatched (Supplier):',
    receivedTitle: isUk ? 'Прийняв (Одержувач):' : 'Received (Receiver):',
  })
}

/**
 * Export Stock Movement / Transfer Waybill to .xlsx with Modern Dark Slate styling
 */
export function exportMovementToExcel(transfer: ExportableTransfer, locale: string = 'uk') {
  const isUk = locale !== 'en'
  const ref = transfer.reference_number || transfer.id.slice(0, 8).toUpperCase()
  const docTitle = isUk
    ? `НАКЛАДНА НА ВНУТРІШНЄ ПЕРЕМІЩЕННЯ № ${ref}`
    : `INTERNAL STOCK TRANSFER WAYBILL #${ref}`

  const leftCard = [
    { label: isUk ? 'З локації (Джерело):' : 'Source Location:', value: transfer.source_location?.name || '—' },
    { label: isUk ? 'Створено:' : 'Created Date:', value: formatDate(transfer.created_at) },
  ]

  const rightCard = [
    { label: isUk ? 'До локації (Призначення):' : 'Destination Location:', value: transfer.destination_location?.name || '—' },
    { label: isUk ? 'Статус:' : 'Status:', value: getStatusLabel(transfer.status, isUk) },
    { label: isUk ? 'Завершено:' : 'Completed Date:', value: formatDate(transfer.completed_at) },
  ]

  const items: CommonItemData[] = transfer.transfer_items.map((item) => ({
    id: item.id,
    name: item.product?.name || '—',
    category: item.product?.category_name || '—',
    sku: item.product?.sku || '—',
    barcode: item.product?.barcode || '—',
    quantity: item.quantity,
    unitPrice: Number(item.unit_price.toFixed(2)),
    lineTotal: Number(item.line_retail_total.toFixed(2)),
  }))

  const safeRef = ref.replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = isUk
    ? `nakladna_peremischennya_${safeRef}_${dateStr}.xlsx`
    : `transfer_waybill_${safeRef}_${dateStr}.xlsx`

  generateStyledWaybillSheet({
    docTitle,
    sheetName: isUk ? 'Переміщення' : 'Transfer',
    isUk,
    filename,
    leftCard,
    rightCard,
    notes: transfer.notes,
    unitPriceHeader: isUk ? 'Ціна (₴)' : 'Unit Price (₴)',
    lineTotalHeader: isUk ? 'Сума (₴)' : 'Line Total (₴)',
    items,
    totalUnits: transfer.total_units_count,
    totalAmount: Number(transfer.total_retail_value.toFixed(2)),
    dispatchedTitle: isUk ? 'Відпустив (Здав зі складу):' : 'Dispatched (From Warehouse):',
    receivedTitle: isUk ? 'Прийняв (Отримав на складі):' : 'Received (Destination):',
  })
}

export function getReasonLabel(reason: string, isUk: boolean): string {
  switch (reason) {
    case 'defect':
      return isUk ? 'Брак / Пошкодження' : 'Defect / Damaged'
    case 'personal_use':
      return isUk ? 'Власні потреби' : 'Personal Use'
    case 'loss':
      return isUk ? 'Втрата / Нестача' : 'Loss / Shortage'
    case 'marketing':
      return isUk ? 'Маркетинг / Зразки' : 'Marketing / Samples'
    case 'other':
    default:
      return isUk ? 'Інше' : 'Other'
  }
}

/**
 * Export Write-Off Act to .xlsx with Modern Dark Slate styling
 */
export function exportWriteOffToExcel(writeOff: ExportableWriteOff, locale: string = 'uk') {
  const isUk = locale !== 'en'
  const ref = writeOff.reference_number || writeOff.id.slice(0, 8).toUpperCase()
  const docTitle = isUk
    ? `АКТ СПИСАННЯ ТОВАРІВ № ${ref}`
    : `INVENTORY WRITE-OFF ACT #${ref}`

  const leftCard = [
    { label: isUk ? 'Локація (Склад):' : 'Location / Warehouse:', value: writeOff.location?.name || '—' },
    { label: isUk ? 'Відповідальна особа:' : 'Responsible Person:', value: writeOff.user?.email || '—' },
    { label: isUk ? 'Дата складання акта:' : 'Act Date:', value: formatDate(writeOff.created_at) },
  ]

  const rightCard = [
    { label: isUk ? 'Причина списання:' : 'Write-Off Reason:', value: getReasonLabel(writeOff.reason, isUk) },
    { label: isUk ? 'Статус:' : 'Status:', value: getStatusLabel(writeOff.status, isUk) },
    { label: isUk ? 'Дата завершення:' : 'Completed Date:', value: formatDate(writeOff.completed_at) },
  ]

  const items: CommonItemData[] = writeOff.write_off_items.map((item) => {
    const unitPrice = item.cost_price > 0 ? item.cost_price : item.retail_price
    const lineTotal = item.line_cost_total > 0 ? item.line_cost_total : item.line_retail_total

    return {
      id: item.id,
      name: item.product?.name || '—',
      category: item.product?.category_name || '—',
      sku: item.product?.sku || '—',
      barcode: item.product?.barcode || '—',
      quantity: item.quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      lineTotal: Number(lineTotal.toFixed(2)),
    }
  })

  const safeRef = ref.replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = isUk
    ? `akt_spysannya_${safeRef}_${dateStr}.xlsx`
    : `write_off_act_${safeRef}_${dateStr}.xlsx`

  const totalLoss = writeOff.total_cost_loss > 0 ? writeOff.total_cost_loss : writeOff.total_retail_loss

  generateStyledWaybillSheet({
    docTitle,
    sheetName: isUk ? 'Акт списання' : 'Write-off Act',
    isUk,
    filename,
    leftCard,
    rightCard,
    notes: writeOff.notes,
    unitPriceHeader: isUk ? 'Собівартість (₴)' : 'Cost Price (₴)',
    lineTotalHeader: isUk ? 'Сума списання (₴)' : 'Loss Total (₴)',
    items,
    totalUnits: writeOff.total_units_count,
    totalAmount: Number(totalLoss.toFixed(2)),
    dispatchedTitle: isUk ? 'Відповідальна особа (Голова комісії):' : 'Responsible Person (Head of Commission):',
    receivedTitle: isUk ? 'Член комісії (Комірник):' : 'Commission Member (Stockkeeper):',
  })
}
