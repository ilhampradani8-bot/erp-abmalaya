import React from 'react';
import { Quotation } from '../types/erp';
import { Printer, Send, ArrowLeft } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface QuotationDocProps {
  quotation: Quotation;
  onBack?: () => void;
  onBackToBuilder?: () => void;
  onSendEmail?: () => void;
}

export const QuotationDoc: React.FC<QuotationDocProps> = ({
  quotation,
  onBack,
  onBackToBuilder,
  onSendEmail,
}) => {
  const handleBackNavigation = () => {
    if (onBackToBuilder) {
      onBackToBuilder();
    } else if (onBack) {
      onBack();
    }
  };

  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    const hasDec = num % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: hasDec ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const handlePrint = () => {
    window.print();
  };

  const safeQuotation = quotation || {};

  const items = safeQuotation.items && safeQuotation.items.length > 0 ? safeQuotation.items : [
    {
      id: 'item-1',
      description: safeQuotation.notes || 'Industrial Equipment & Services Specification',
      quantity: 1,
      unit: 'Package',
      unit_price: safeQuotation.grand_total || 0,
      discount_percent: 0,
      total: safeQuotation.grand_total || 0,
    }
  ];

  return (
    <div className="w-full p-6 sm:p-8 bg-slate-100 min-h-[calc(100vh-53px)] space-y-6 font-sans overflow-y-auto h-full">
      
      {/* Top Action Toolbar (Hidden during Print) */}
      <div className="no-print pb-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 w-full bg-white p-4 border shadow-2xs">
        <button
          onClick={handleBackNavigation}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 transition cursor-pointer border border-slate-300"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
          <span>Back to Quotation Builder</span>
        </button>

        <div className="flex items-center gap-2.5">
          <a
            href={getApiUrl(safeQuotation.quotation_file || `/uploads/pdf/${(safeQuotation.quotation_number || safeQuotation.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 transition cursor-pointer shadow-2xs"
            title="Buka berkas file PDF resmi di folder server /uploads/pdf/"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Buka Berkas PDF Server</span>
          </a>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 transition cursor-pointer shadow-2xs"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print / Save Quotation</span>
          </button>

          {onSendEmail && (
            <button
              onClick={onSendEmail}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 shadow-2xs transition cursor-pointer"
            >
              <Send className="w-4 h-4 text-white" />
              <span>Send via Email</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Quotation Document Sheet (Printable Area, Full Width Edge to Edge) */}
      <div id="quotation-pdf-document" className="bg-white text-slate-900 p-8 sm:p-12 font-sans border border-slate-300 shadow-xl w-full max-w-5xl mx-auto">
        
        {/* Letterhead Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 text-white font-black text-2xl flex items-center justify-center tracking-wider shrink-0">
              AB
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider text-slate-900 uppercase">
                ABMALAYA.COM (MALAYSIA)
              </h1>
              <p className="text-xs text-slate-600 font-bold">
                Industrial Equipment, Spareparts & Digital Enterprise Solutions
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Kuala Lumpur Tech Park, Block B-12, Wilayah Persekutuan Kuala Lumpur, Malaysia<br />
                Tel: +60 3-8900 1122 | Email: sales@abmalaya.com | Web: www.abmalaya.com
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block bg-slate-900 text-white text-xs font-extrabold px-3 py-1 uppercase tracking-wider mb-2">
              OFFICIAL COMMERCIAL QUOTATION
            </span>
            <div className="text-xs font-mono font-bold text-slate-800">
              No: {safeQuotation.quotation_number || safeQuotation.id || 'QUO-ABM/MY/2026/0403'}
            </div>
            <div className="text-[11px] text-slate-500">
              Date: {safeQuotation.date_issued || new Date().toISOString().split('T')[0]}
            </div>
          </div>
        </div>

        {/* Customer & Issue Metadata Grid */}
        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 border border-slate-200 text-xs mb-6 w-full">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Quotation Recipient (To):
            </span>
            <strong className="text-sm text-slate-900 block">{safeQuotation.company_name || 'Client Company'}</strong>
            <p className="text-slate-700 mt-0.5">Attn: <strong>{safeQuotation.client_name || 'Client Contact'}</strong></p>
            <p className="text-slate-500 mt-1">Email: {safeQuotation.client_email || 'client@company.com'}</p>
          </div>

          <div className="text-right space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Quotation Document Details:
            </span>
            <p><span className="text-slate-500">Date Issued:</span> <strong>{safeQuotation.date_issued || new Date().toISOString().split('T')[0]}</strong></p>
            <p><span className="text-slate-500">Valid Until:</span> <strong className="text-amber-700">{safeQuotation.valid_until || '14 Days'}</strong></p>
            <p><span className="text-slate-500">Currency:</span> <strong>MYR (Malaysian Ringgit)</strong></p>
            <p><span className="text-slate-500">Issued By:</span> <strong>{safeQuotation.created_by || 'Aiman Zaki'}</strong></p>
          </div>
        </div>

        {/* Introduction text */}
        <p className="text-xs text-slate-700 mb-4 leading-relaxed">
          Dear Valued Customer,<br />
          In response to your Request for Quotation (RFQ), <strong>ABMALAYA.COM (MALAYSIA)</strong> hereby submits our official quotation for the items/services detailed below:
        </p>

        {/* Quotation Table */}
        <div className="border border-slate-300 overflow-hidden mb-6 w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 uppercase">
              <tr>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3">Item Description / Service Specification</th>
                <th className="p-3 text-center w-20">Qty</th>
                <th className="p-3 text-center w-24">Unit</th>
                <th className="p-3 text-right w-44">Unit Price</th>
                <th className="p-3 text-center w-20">Disc</th>
                <th className="p-3 text-right w-44">Total (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="p-3 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="p-3 font-medium text-slate-900">{item.description}</td>
                  <td className="p-3 text-center font-mono">{item.quantity}</td>
                  <td className="p-3 text-center text-slate-600">{item.unit}</td>
                  <td className="p-3 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                  <td className="p-3 text-center font-mono text-amber-700">
                    {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations & Total Table */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 w-full">
          
          {/* Terms & Notes */}
          <div className="w-full sm:w-1/2 space-y-3 text-xs">
            <div className="bg-slate-50 p-3.5 border border-slate-200">
              <strong className="block text-slate-900 mb-1">Quotation Notes & Terms:</strong>
              <p className="text-slate-600 leading-relaxed">{safeQuotation.notes || 'Standard Quotation terms apply.'}</p>
            </div>
          </div>

          {/* Grand Total Box */}
          <div className="w-full sm:w-1/2 bg-slate-50 border border-slate-300 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(safeQuotation.subtotal || safeQuotation.grand_total || 0)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Tax / VAT ({safeQuotation.tax_percent || 11}%):</span>
              <span className="font-mono">{formatCurrency(safeQuotation.tax_amount || 0)}</span>
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
              <span>GRAND TOTAL:</span>
              <span className="font-mono text-blue-700 text-base">
                {formatCurrency(safeQuotation.grand_total || 0)}
              </span>
            </div>
          </div>

        </div>

        {/* Authorized Signature Block */}
        <div className="flex justify-between items-end pt-8 border-t border-slate-200 text-xs w-full">
          <div>
            <p className="text-slate-500">Accepted & Confirmed By,</p>
            <div className="h-16"></div>
            <p className="font-bold text-slate-900">({safeQuotation.client_name || 'Client Name'})</p>
            <p className="text-slate-500">{safeQuotation.company_name || 'Client Company'}</p>
          </div>

          <div className="text-right">
            <p className="text-slate-500">Sincerely,</p>
            <strong className="block text-slate-900 font-bold">ABMALAYA.COM (MALAYSIA)</strong>
            
            <div className="h-16 flex items-center justify-end my-1">
              <div className="w-32 h-12 border-2 border-blue-600 border-dashed flex items-center justify-center text-blue-600 text-[10px] font-black uppercase tracking-wider transform -rotate-3 opacity-80">
                [STAMP ABMALAYA]
              </div>
            </div>

            <p className="font-bold text-slate-900"><u>{safeQuotation.created_by || 'Aiman Zaki'}</u></p>
            <p className="text-slate-500">Head of Sales & Business Development</p>
          </div>
        </div>

      </div>

    </div>
  );
};

export default QuotationDoc;
