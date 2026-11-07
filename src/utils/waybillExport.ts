import * as XLSX from 'xlsx'

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

function formatDate(isoString?: string | null): string {
  if (!isoString) return '-'
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

/**
 * Export Supply Waybill to .xlsx
 */
export function exportSupplyToExcel(supply: ExportableSupply, locale: string = 'uk') {
  const isUk = locale !== 'en'
  const ref = supply.reference_number || supply.id.slice(0, 8).toUpperCase()
  const docTitle = isUk
    ? `ПРИБУТКОВА НАКЛАДНА № ${ref}`
    : `GOODS RECEIPT WAYBILL #${ref}`

  const data: (string | number)[][] = [
    [docTitle],
    [],
    [
      isUk ? 'Дата створення:' : 'Created Date:',
      formatDate(supply.created_at),
      '',
      isUk ? 'Статус:' : 'Status:',
      getStatusLabel(supply.status, isUk),
    ],
    [
      isUk ? 'Постачальник:' : 'Supplier:',
      supply.supplier?.name || '-',
      '',
      isUk ? 'Локація призначення:' : 'Destination Location:',
      supply.location?.name || '-',
    ],
    [
      isUk ? 'Телефон постачальника:' : 'Supplier Phone:',
      supply.supplier?.phone || '-',
      '',
      isUk ? 'Дата отримання:' : 'Received Date:',
      formatDate(supply.received_at),
    ],
  ]

  if (supply.notes) {
    data.push([isUk ? 'Примітки:' : 'Notes:', supply.notes])
  }

  data.push([]) // spacer row
  data.push([
    '№',
    isUk ? 'Найменування товару' : 'Product Name',
    isUk ? 'Категорія' : 'Category',
    'SKU',
    isUk ? 'Штрихкод' : 'Barcode',
    isUk ? 'Кількість (шт.)' : 'Quantity (pcs)',
    isUk ? 'Ціна закупівлі (₴)' : 'Cost Price (₴)',
    isUk ? 'Сума закупівлі (₴)' : 'Line Total (₴)',
  ])

  supply.supply_items.forEach((item, index) => {
    data.push([
      index + 1,
      item.product?.name || '-',
      item.product?.category_name || '-',
      item.product?.sku || '-',
      item.product?.barcode || '-',
      item.quantity,
      Number(item.cost_price.toFixed(2)),
      Number(item.line_cost_total.toFixed(2)),
    ])
  })

  // Summary row
  data.push([
    isUk ? 'РАЗОМ:' : 'TOTAL:',
    '',
    '',
    '',
    '',
    supply.total_units_count,
    '',
    Number(supply.total_cost.toFixed(2)),
  ])

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  ws['!cols'] = [
    { wch: 6 },  // №
    { wch: 38 }, // Product
    { wch: 22 }, // Category
    { wch: 16 }, // SKU
    { wch: 18 }, // Barcode
    { wch: 18 }, // Qty
    { wch: 20 }, // Unit Price
    { wch: 22 }, // Total
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, isUk ? 'Накладна' : 'Waybill')

  const safeRef = ref.replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = isUk
    ? `nakladna_postavka_${safeRef}_${dateStr}.xlsx`
    : `supply_waybill_${safeRef}_${dateStr}.xlsx`

  XLSX.writeFile(wb, filename)
}

/**
 * Export Stock Movement / Transfer Waybill to .xlsx
 */
export function exportMovementToExcel(transfer: ExportableTransfer, locale: string = 'uk') {
  const isUk = locale !== 'en'
  const ref = transfer.reference_number || transfer.id.slice(0, 8).toUpperCase()
  const docTitle = isUk
    ? `НАКЛАДНА НА ВНУТРІШНЄ ПЕРЕМІЩЕННЯ № ${ref}`
    : `INTERNAL STOCK TRANSFER WAYBILL #${ref}`

  const data: (string | number)[][] = [
    [docTitle],
    [],
    [
      isUk ? 'Дата створення:' : 'Created Date:',
      formatDate(transfer.created_at),
      '',
      isUk ? 'Статус:' : 'Status:',
      getStatusLabel(transfer.status, isUk),
    ],
    [
      isUk ? 'З локації (Джерело):' : 'Source Location:',
      transfer.source_location?.name || '-',
      '',
      isUk ? 'До локації (Призначення):' : 'Destination Location:',
      transfer.destination_location?.name || '-',
    ],
    [
      isUk ? 'Дата завершення:' : 'Completed Date:',
      formatDate(transfer.completed_at),
    ],
  ]

  if (transfer.notes) {
    data.push([isUk ? 'Примітки:' : 'Notes:', transfer.notes])
  }

  data.push([]) // spacer row
  data.push([
    '№',
    isUk ? 'Найменування товару' : 'Product Name',
    isUk ? 'Категорія' : 'Category',
    'SKU',
    isUk ? 'Штрихкод' : 'Barcode',
    isUk ? 'Кількість (шт.)' : 'Quantity (pcs)',
    isUk ? 'Ціна (₴)' : 'Unit Price (₴)',
    isUk ? 'Сума (₴)' : 'Line Total (₴)',
  ])

  transfer.transfer_items.forEach((item, index) => {
    data.push([
      index + 1,
      item.product?.name || '-',
      item.product?.category_name || '-',
      item.product?.sku || '-',
      item.product?.barcode || '-',
      item.quantity,
      Number(item.unit_price.toFixed(2)),
      Number(item.line_retail_total.toFixed(2)),
    ])
  })

  // Summary row
  data.push([
    isUk ? 'РАЗОМ:' : 'TOTAL:',
    '',
    '',
    '',
    '',
    transfer.total_units_count,
    '',
    Number(transfer.total_retail_value.toFixed(2)),
  ])

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  ws['!cols'] = [
    { wch: 6 },  // №
    { wch: 38 }, // Product
    { wch: 22 }, // Category
    { wch: 16 }, // SKU
    { wch: 18 }, // Barcode
    { wch: 18 }, // Qty
    { wch: 20 }, // Unit Price
    { wch: 22 }, // Total
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, isUk ? 'Переміщення' : 'Transfer')

  const safeRef = ref.replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = isUk
    ? `nakladna_peremischennya_${safeRef}_${dateStr}.xlsx`
    : `transfer_waybill_${safeRef}_${dateStr}.xlsx`

  XLSX.writeFile(wb, filename)
}
