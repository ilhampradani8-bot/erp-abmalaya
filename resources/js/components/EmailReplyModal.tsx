import React, { useState } from 'react';
import { Quotation, RFQ } from '../types/erp';
import { Mail, Send, Paperclip, CheckCircle2, X, Loader2, Sparkles, FileText } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface EmailReplyModalProps {
  rfq: RFQ;
  quotation: Quotation;
  onClose: () => void;
  onSuccessSend: (replyBody: string, replySender?: string) => void;
}

export const EmailReplyModal: React.FC<EmailReplyModalProps> = ({
  rfq,
  quotation,
  onClose,
  onSuccessSend,
}) => {
  const [toEmail, setToEmail] = useState(rfq.sender_email || quotation.client_email);
  const [subject, setSubject] = useState(
    `Re: ${rfq.subject} - Quotation Document (${quotation.quotation_number})`
  );
  const [body, setBody] = useState(
    `Dear ${rfq.sender_name || quotation.client_name},\n` +
    `${rfq.company || quotation.company_name}\n\n` +
    `Thank you for your Request for Quotation (RFQ) submitted to AB Malaya Industry.\n\n` +
    `Please find attached our official Quotation Document No. ${quotation.quotation_number} with a grand total of RM ${quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (inclusive of 11% tax) for your review.\n\n` +
    `Quotation Summary:\n` +
    `- Quotation No: ${quotation.quotation_number}\n` +
    `- Valid Until: ${quotation.valid_until}\n` +
    `- Grand Total: RM ${quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
    `Should you have any questions regarding technical specifications or commercial terms, please feel free to reply to this email or contact us.\n\n` +
    `Best regards,\n` +
    `Sales & Business Development Team\n` +
    `AB MALAYA INDUSTRY`
  );

  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [fromEmail, setFromEmail] = useState(
    rfq.recipient_email || 'sales@abmalaya.com'
  );

  // AI Generation States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLanguage, setAiLanguage] = useState('English');
  const [generatingAI, setGeneratingAI] = useState(false);

  const handleSend = () => {
    setSending(true);
    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: rfq.id,
        status: 'penawaran_terkirim',
        reply_body: body,
        reply_sender: fromEmail,
        user_name: 'Admin'
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setSending(false);
        if (data.status === 'success') {
          setSentSuccess(true);
          setTimeout(() => {
            onSuccessSend(body, fromEmail);
          }, 1500);
        } else {
          alert('Failed to send email: ' + data.message);
        }
      })
      .catch((err) => {
        setSending(false);
        console.error(err);
        alert('Network error when sending email.');
      });
  };

  const handleGenerateAI = () => {
    setGeneratingAI(true);

    // Build a rich items list for AI context
    const itemsSummary = quotation.items.map((item, i) =>
      `${i + 1}. ${item.description} — Qty: ${item.quantity} ${item.unit} x RM ${item.unit_price.toFixed(2)} = RM ${item.total.toFixed(2)}`
    ).join('\n');

    fetch(getApiUrl('/api_generate_reply.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: aiPrompt,
        language: aiLanguage,
        original_subject: rfq.subject,
        original_body: rfq.message_body,
        client_name: rfq.sender_name || quotation.client_name,
        client_company: rfq.company || quotation.company_name,
        quotation_number: quotation.quotation_number,
        date_issued: quotation.date_issued,
        valid_until: quotation.valid_until,
        grand_total: quotation.grand_total,
        subtotal: quotation.subtotal,
        tax_percent: quotation.tax_percent,
        tax_amount: quotation.tax_amount,
        currency: quotation.currency || 'MYR',
        items_summary: itemsSummary,
        items_count: quotation.items.length,
        notes: quotation.notes || '',
        terms_conditions: quotation.terms_conditions || ''
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.reply) {
          setBody(data.reply);
        } else {
          alert('AI Generation failed: ' + (data.message || 'Unknown error'));
        }
      })
      .catch((err) => {
        console.error('AI Reply error:', err);
        alert('Could not generate AI reply: network connection failed.');
      })
      .finally(() => {
        setGeneratingAI(false);
      });
  };

  return (
    <div className="fixed inset-0 z-50 bg-white w-screen h-screen flex flex-col font-sans overflow-hidden animate-in fade-in">
      
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-950 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-emerald-900 text-emerald-300 border border-emerald-800">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white" style={{ fontFamily: "'Eurostile', monospace" }}>
              Reply Email & Send Quotation SPH
            </h3>
            <p className="text-[10px] text-slate-400">
              Compose email response to the client along with the SPH document attachments.
            </p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-sm border border-red-700 transition cursor-pointer flex items-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span>Close Reply View</span>
        </button>
      </div>

      {sentSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-8 h-8 animate-bounce" />
          </div>
          <h4 className="text-lg font-extrabold text-slate-900">Email Dispatched Successfully!</h4>
          <p className="text-xs text-slate-600 max-w-md text-center leading-relaxed">
            Quotation SPH <strong className="text-blue-700">{quotation.quotation_number}</strong> has been successfully dispatched to <strong className="text-slate-900">{toEmail}</strong>. Status updated to <span className="text-emerald-700 font-semibold">Quotation Sent</span>.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 w-full">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left side: Standard Email Form */}
            <div className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-lg p-5 space-y-4">
              <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Email Message Editor</span>
              </h4>

              {/* From Select */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">From (Sender Address)</label>
                <select
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
                >
                  <option value="sales@abmalaya.com">AB Malaya Sales & Estimating (sales@abmalaya.com)</option>
                  <option value="info@abmalaya.com">AB Malaya Info Desk (info@abmalaya.com)</option>
                  <option value="abmalayaindustry@gmail.com">AB Malaya Primary (abmalayaindustry@gmail.com)</option>
                </select>
              </div>

              {/* To */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">To (Recipient Address)</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Email Content Message</label>
                <textarea
                  rows={14}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md p-3 text-xs text-slate-800 font-sans leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* PDF Attachment Flag */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                    className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                    <Paperclip className="w-4 h-4 text-amber-600" />
                    Attach PDF SPH Document ({quotation.quotation_number}.pdf)
                  </span>
                </label>
                <span className="text-[9px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono font-bold">
                  Stamped PDF
                </span>
              </div>
            </div>

            {/* Right side: AI Generation Helper Panel */}
            <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-lg p-5 space-y-4 sticky top-6">
              <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>AI Email Draft Assistant (Gemini)</span>
              </h4>

              {/* AI Instruction Prompt */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">AI Prompt / Guidelines Instruction</label>
                <textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder='e.g., "Request client to specify local port shipping date details, and thank them for choosing AB Malaya Sdn. Bhd."'
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-xs text-slate-800 leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Language Selector */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Output Response Language</label>
                <select
                  value={aiLanguage}
                  onChange={(e) => setAiLanguage(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                >
                  <option value="English">English (Recommended)</option>
                  <option value="Bahasa Malaysia">Bahasa Malaysia / Melayu</option>
                  <option value="Arabic">Arabic / العربية</option>
                  <option value="Chinese Simplified">Chinese Simplified / 简体中文</option>
                  <option value="Tamil">Tamil / தமிழ்</option>
                </select>
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={generatingAI}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold px-4 py-2.5 rounded-md shadow-sm transition cursor-pointer disabled:opacity-50 text-xs"
              >
                {generatingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Generating Professional AI Response...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>Draft Email reply with Gemini AI</span>
                  </>
                )}
              </button>

              <div className="bg-amber-50/70 border-l-4 border-amber-500 p-3 text-[10px] text-amber-900 leading-relaxed rounded-r-md">
                <strong>Contextual AI Writing:</strong> Gemini analyzes the original email subject, body content, and catalog quotation values (total cost, valid date, catalog descriptions) automatically to craft a high-converting, context-aware reply email.
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      {!sentSuccess && (
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition font-extrabold text-xs cursor-pointer"
          >
            Cancel / Go Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const invUrl = `/view_doc.php?type=invoice&id=${encodeURIComponent(quotation.id)}`;
                window.open(invUrl, '_blank');
              }}
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold px-4 py-2 rounded-md shadow-xs transition cursor-pointer text-xs"
              title="Generate and view Official Invoice for this quotation"
            >
              <FileText className="w-4 h-4 text-purple-200" />
              <span>Buat Invoice / Generate Invoice</span>
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50 text-xs"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Email to Client</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
