import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/i18n'

export interface PrintableItem {
  id: string
  name: string
  category?: string | null
  sku: string
  barcode?: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface PrintableWaybillData {
  docType: 'supply' | 'movement' | 'write_off'
  referenceNumber: string
  date: string
  status: string
  statusLabel: string
  partyFromLabel: string
  partyFromName: string
  partyFromExtra?: string | null
  partyToLabel: string
  partyToName: string
  partyToExtra?: string | null
  notes?: string | null
  completedAt?: string | null
  completedAtLabel?: string | null
  items: PrintableItem[]
  totalUnits: number
  totalAmount: number
}

interface PrintWaybillPortalProps {
  data: PrintableWaybillData
}

export function PrintWaybillPortal({ data }: PrintWaybillPortalProps) {
  const { tr } = useI18n()
  const portalNode = typeof document !== 'undefined' ? document.body : null
  if (!portalNode) return null

  const isSupply = data.docType === 'supply'
  const isWriteOff = data.docType === 'write_off'
  const title = isWriteOff
    ? tr(`АКТ СПИСАННЯ ТОВАРІВ № ${data.referenceNumber}`, `INVENTORY WRITE-OFF ACT #${data.referenceNumber}`)
    : isSupply
    ? tr(`ПРИБУТКОВА НАКЛАДНА № ${data.referenceNumber}`, `GOODS RECEIPT WAYBILL #${data.referenceNumber}`)
    : tr(`НАКЛАДНА НА ВНУТРІШНЄ ПЕРЕМІЩЕННЯ № ${data.referenceNumber}`, `INTERNAL STOCK TRANSFER WAYBILL #${data.referenceNumber}`)

  return createPortal(
    <div id="waybill-print-portal" className="hidden">
      <style>{`
        @media screen {
          #waybill-print-portal {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #root {
            display: none !important;
          }
          #waybill-print-portal,
          #waybill-print-portal * {
            visibility: visible !important;
          }
          #waybill-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          .waybill-table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 11px !important;
          }
          .waybill-table th,
          .waybill-table td {
            border: 1px solid #334155 !important;
            padding: 5px 7px !important;
          }
          .waybill-table th {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-weight: 700 !important;
            text-align: center !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '100%', margin: '0 auto', color: '#0f172a' }}>
        {/* Header Block */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600 }}>
                Products Tracker UA • {tr('Складський облік', 'Inventory Management')}
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0 0', color: '#0f172a' }}>
                {title}
              </h1>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px' }}>
              <div>
                <strong>{tr('Статус:', 'Status:')}</strong>{' '}
                <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                  {data.statusLabel}
                </span>
              </div>
              <div style={{ color: '#64748b', marginTop: '2px' }}>
                {tr('Створено:', 'Created:')} {data.date}
              </div>
              {data.completedAt && (
                <div style={{ color: '#64748b', marginTop: '2px' }}>
                  {data.completedAtLabel || tr('Проведено:', 'Completed:')} {data.completedAt}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Parties / Locations Information Box */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '10px 14px',
            marginBottom: '16px',
            backgroundColor: '#f8fafc',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            fontSize: '11px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              {data.partyFromLabel}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: '#0f172a' }}>
              {data.partyFromName}
            </div>
            {data.partyFromExtra && (
              <div style={{ color: '#475569', marginTop: '2px' }}>{data.partyFromExtra}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              {data.partyToLabel}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: '#0f172a' }}>
              {data.partyToName}
            </div>
            {data.partyToExtra && (
              <div style={{ color: '#475569', marginTop: '2px' }}>{data.partyToExtra}</div>
            )}
          </div>
        </div>

        {data.notes && (
          <div
            style={{
              fontSize: '11px',
              fontStyle: 'italic',
              color: '#334155',
              border: '1px dashed #cbd5e1',
              padding: '6px 10px',
              marginBottom: '14px',
              backgroundColor: '#fffbeb',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <strong>{tr('Примітки:', 'Notes:')}</strong> {data.notes}
          </div>
        )}

        {/* Excel-style Items Table */}
        <table className="waybill-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>№</th>
              <th style={{ textAlign: 'left' }}>{tr('Найменування товару', 'Product Name')}</th>
              <th style={{ width: '130px' }}>{tr('Артикул / SKU', 'SKU')}</th>
              <th style={{ width: '70px', textAlign: 'right' }}>{tr('К-сть', 'Qty')}</th>
              <th style={{ width: '85px', textAlign: 'right' }}>{tr('Ціна, ₴', 'Price, ₴')}</th>
              <th style={{ width: '95px', textAlign: 'right' }}>{tr('Сума, ₴', 'Total, ₴')}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={item.id} className="page-break-avoid">
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{index + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  {item.category && (
                    <div style={{ fontSize: '9px', color: '#64748b' }}>{item.category}</div>
                  )}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '10px', textAlign: 'center' }}>
                  {item.sku}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {item.quantity} {tr('шт.', 'pcs')}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {item.unitPrice.toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {item.lineTotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="page-break-avoid" style={{ fontWeight: 800, backgroundColor: '#f8fafc' }}>
              <td colSpan={3} style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tr('РАЗОМ:', 'TOTAL:')}
              </td>
              <td style={{ textAlign: 'right', fontSize: '12px' }}>
                {data.totalUnits} {tr('шт.', 'pcs')}
              </td>
              <td></td>
              <td style={{ textAlign: 'right', fontSize: '12px' }}>
                ₴{data.totalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer / Signatures Section */}
        <div
          className="page-break-avoid"
          style={{
            marginTop: '36px',
            paddingTop: '16px',
            borderTop: '1px solid #cbd5e1',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '36px',
            fontSize: '11px',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: '22px' }}>
              {isWriteOff
                ? tr('Відповідальна особа (Голова комісії):', 'Responsible Person (Head of Commission):')
                : isSupply
                ? tr('Відпустив (Постачальник):', 'Dispatched (Supplier):')
                : tr('Відпустив (Здав зі складу):', 'Dispatched (From Warehouse/Store):')}
            </div>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '4px' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '9px' }}>
              <span>({tr('підпис', 'signature')})</span>
              <span>({tr('П.І.Б.', 'Full Name')})</span>
            </div>
            <div style={{ marginTop: '14px', color: '#334155' }}>
              {tr('«____» _______________ 202__ р.', 'Date: ____/____/202__')}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: '22px' }}>
              {isWriteOff
                ? tr('Член комісії (Комірник / Одержувач):', 'Commission Member (Stockkeeper / Receiver):')
                : isSupply
                ? tr('Прийняв (Одержувач):', 'Received (Receiver):')
                : tr('Прийняв (Отримав на складі):', 'Received (Destination Store/Warehouse):')}
            </div>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '4px' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '9px' }}>
              <span>({tr('підпис', 'signature')})</span>
              <span>({tr('П.І.Б.', 'Full Name')})</span>
            </div>
            <div style={{ marginTop: '14px', color: '#334155' }}>
              {tr('«____» _______________ 202__ р.', 'Date: ____/____/202__')}
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalNode
  )
}
