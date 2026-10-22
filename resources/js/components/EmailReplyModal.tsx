import React, { useState } from 'react';
import { Quotation, RFQ, isOutboundEmail } from '../types/erp';
import { Mail, Send, Paperclip, CheckCircle2, X, Loader2, Sparkles, ShieldCheck, AlertTriangle, ArrowUpRight, Eye } from 'lucide-react';
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
  const isOutbound = isOutboundEmail(rfq);

  // If outbound / sent: we are forwarding/continuing communication to the destination recipient!
  // NEVER reply to our own internal company sender (e.g. sales@abmalaya.com / info@abmalaya.com).
  const initialToEmail = isOutbound
    ? (rfq.recipient_email || quotation?.client_email || '')
    : (rfq.sender_email || quotation?.client_email || '');

  const initialFromEmail = isOutbound
    ? (rfq.sender_email && rfq.sender_email.includes('@abmalaya.com') ? rfq.sender_email : 'sales@abmalaya.com')
    : (rfq.recipient_email && rfq.recipient_email.includes('@abmalaya.com') ? rfq.recipient_email : 'sales@abmalaya.com');

  const initialSubject = isOutbound
    ? `Follow-up / Fwd: ${rfq.subject} - Quotation Document (${quotation.quotation_number})`
    : `Re: ${rfq.subject} - Quotation Document (${quotation.quotation_number})`;

  // Determine proper client name and company for greeting:
  const recipientName = isOutbound
    ? (quotation?.client_name && !quotation.client_name.toLowerCase().includes('ab malaya')
        ? quotation.client_name
        : (rfq.recipient_email ? rfq.recipient_email.split('@')[0].toUpperCase() : 'Bapak/Ibu Pimpinan Rekanan'))
    : (rfq.sender_name || quotation?.client_name || 'Bapak/Ibu Klien');

  const recipientCompany = isOutbound
    ? (quotation?.company_name && !quotation.company_name.toLowerCase().includes('ab malaya')
        ? quotation.company_name
        : '')
    : (rfq.company || quotation?.company_name || '');

  const initialBody = isOutbound
    ? `Dear ${recipientName},\n` +
      `${recipientCompany ? recipientCompany + '\n\n' : '\n'}` +
      `Bersama email ini kami meneruskan tindak lanjut terkait penawaran harga resmi (${quotation.quotation_number}) dari AB Malaya Industry.\n\n` +
      `Berikut kami lampirkan dokumen penawaran harga resmi (Quotation) dengan total RM ${quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} untuk kebutuhan pengadaan terkait.\n\n` +
      `Ringkasan Penawaran:\n` +
      `- No. Quotation: ${quotation.quotation_number}\n` +
      `- Berlaku Hingga: ${quotation.valid_until}\n` +
      `- Grand Total: RM ${quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `Apabila terdapat pertanyaan atau kebutuhan penyesuaian spesifikasi, silakan hubungi tim kami atau balas pesan ini.\n\n` +
      `Best regards,\n` +
      `Sales & Business Development Team\n` +
      `AB MALAYA INDUSTRY`
    : `Dear ${recipientName},\n` +
      `${recipientCompany ? recipientCompany + '\n\n' : '\n'}` +
      `Thank you for your Request for Quotation (RFQ) submitted to AB Malaya Industry.\n\n` +
      `Please find attached our official Quotation Document No. ${quotation.quotation_number} with a grand total of RM ${quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (inclusive of 11% tax) for your review.\n\n` +
      `Quotation Summary:\n` +
      `- Quotation No: ${quotation.quotation_number}\n` +
      `- Valid Until: ${quotation.valid_until}\n` +
      `- Grand Total: RM ${quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `Should you have any questions regarding technical specifications or commercial terms, please feel free to reply to this email or contact us.\n\n` +
      `Best regards,\n` +
      `Sales & Business Development Team\n` +
      `AB MALAYA INDUSTRY`;

  const [toEmail, setToEmail] = useState(initialToEmail);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [fromEmail, setFromEmail] = useState(initialFromEmail);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);

  // AI Generation States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLanguage, setAiLanguage] = useState('English');
  const [generatingAI, setGeneratingAI] = useState(false);

  // ACC Approval Check & Modal States
  const [showAccModal, setShowAccModal] = useState(false);
  const [accNote, setAccNote] = useState('');
  const [isAccSubmitting, setIsAccSubmitting] = useState(false);

  const isQuotationAcc = () => {
    if (!quotation) return true;
    let hasApproval = false;
    try {
      if (quotation.approved_by) {
        const parsed = typeof quotation.approved_by === 'string' ? JSON.parse(quotation.approved_by) : quotation.approved_by;
        if (Array.isArray(parsed) && parsed.length > 0) hasApproval = true;
      }
    } catch (e) {}
    const st = (quotation.status || 'draft').toLowerCase();
    return hasApproval || st === 'approved' || st === 'acc' || st === 'disetujui' || st === 'ready_send' || st === 'done_send' || st === 'sent' || st === 'penawaran_terkirim' || st === 'deal';
  };

  const handleInitiateSend = () => {
    if (!isQuotationAcc()) {
      setShowAccModal(true);
      return;
    }
    handleSend();
  };

  const handleGrantAccAndSend = () => {
    setIsAccSubmitting(true);
    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        id: quotation.id,
        rfq_id: rfq.id,
        note: accNote.trim() || 'ACC Approval via Email Reply Modal',
        user_name: 'Admin',
        user_email: 'admin@abmalaya.com'
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAccSubmitting(false);
        if (data.status === 'success') {
          quotation.status = 'ready_send';
          quotation.approved_by = JSON.stringify([
            {
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
              user_name: 'Admin',
              note: accNote.trim() || 'ACC Approval via Email Reply Modal'
            }
          ]);
          setShowAccModal(false);
          handleSend();
        } else {
          alert('Failed to grant ACC approval: ' + (data.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsAccSubmitting(false);
        console.error(err);
        alert('Network error while recording ACC approval.');
      });
  };

  const handleSend = (forceOnlyFile = false) => {
    setSending(true);
    const finalBody = forceOnlyFile
      ? (body.trim() || `Bersama email ini kami lampirkan dokumen penawaran harga resmi (${quotation.quotation_number}) dari AB Malaya Industry.`)
      : body;
    const targetAttachFile = attachPdf
      ? (quotation.quotation_file || `${quotation.quotation_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`)
      : null;
    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: rfq.id,
        quotation_id: quotation.id,
        status: 'penawaran_terkirim',
        reply_body: finalBody,
        reply_sender: fromEmail,
        target_client_email: toEmail,
        attachment_file: targetAttachFile,
        user_name: 'Admin'
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setSending(false);
        if (data.status === 'success') {
          setSentSuccess(true);
          setTimeout(() => {
            onSuccessSend(finalBody, fromEmail);
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
          <div className={`p-2 rounded-md ${isOutbound ? 'bg-purple-900 text-purple-300 border border-purple-800' : 'bg-emerald-900 text-emerald-300 border border-emerald-800'}`}>
            {isOutbound ? <ArrowUpRight className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-white" style={{ fontFamily: "'Eurostile', monospace" }}>
                {isOutbound ? 'Meneruskan / Follow-up Pesan (Sent Email)' : 'Reply Email & Send Quotation'}
              </h3>
              {isOutbound && (
                <span className="px-2 py-0.5 bg-purple-700/80 text-white rounded text-[9px] font-black uppercase tracking-wider">
                  Outbound Sent Mode
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              {isOutbound
                ? `Email ini berstatus Terkirim (Sent). Pesan otomatis diteruskan ke alamat penerima (To: ${toEmail}), bukan ke pengirim internal.`
                : 'Compose email response to the client along with the official Quotation document attachment.'}
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
            Quotation <strong className="text-blue-700">{quotation.quotation_number}</strong> has been successfully dispatched to <strong className="text-slate-900">{toEmail}</strong>. Status updated to <span className="text-emerald-700 font-semibold">Quotation Sent</span>.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 w-full">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Left side: Standard Email Form */}
            <div className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-lg p-5 space-y-4">
              <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>{isOutbound ? 'Editor Meneruskan Pesan ke Klien' : 'Email Message Editor'}</span>
                </div>
                {isOutbound && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded text-[9px] font-extrabold flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-purple-600" />
                    Sent Email Mode (Kirim ke Recipient)
                  </span>
                )}
              </h4>

              {/* From Select */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">From (Pengirim Internal Perusahaan)</label>
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
                <label className="block font-bold text-slate-700 text-xs mb-1 flex items-center justify-between">
                  <span>To (Alamat Email Klien / Penerima)</span>
                  {isOutbound && (
                    <span className="text-[10px] text-purple-700 font-bold">
                      ✓ Otomatis ke Penerima (To), bukan ke pengirim internal
                    </span>
                  )}
                </label>
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

              {/* PDF Attachment Flag & Direct Server File Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                    className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                    <Paperclip className="w-4 h-4 text-amber-600" />
                    Attach PDF Quotation Document ({quotation.quotation_number}.pdf)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <a
                    href={getApiUrl(quotation.quotation_file || `/uploads/pdf/${quotation.quotation_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded text-[10px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    title="Buka dan pastikan berkas PDF resmi yang tersimpan di folder uploads/pdf/"
                  >
                    <Eye className="w-3 h-3 text-blue-600" />
                    <span>Preview File PDF yang Dikirim</span>
                  </a>
                  <span className="text-[9px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono font-bold">
                    Stamped PDF
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isQuotationAcc()) {
                        setShowAccModal(true);
                        return;
                      }
                      handleSend(true);
                    }}
                    disabled={sending}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                    title="Send only this official attached PDF without requiring message text"
                  >
                    <Send className="w-3 h-3 text-white" />
                    <span>Send Only File</span>
                  </button>
                </div>
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
                  placeholder='e.g., "Request client to specify local port shipping date details, and thank them for choosing PT Abmalaya Nusa Sejahtera."'
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
                  <option value="Bahasa Malaysia">Bahasa Melayu / Malaysia</option>
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
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

          <button
            type="button"
            onClick={handleInitiateSend}
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
                <span>{isOutbound ? `Teruskan / Kirim ke Penerima (${toEmail})` : 'Send Email to Client'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── POPUP: ACC APPROVAL REQUIRED BEFORE SENDING ── */}
      {showAccModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-none shadow-2xl border border-slate-700 max-w-md w-full overflow-hidden text-slate-800">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-none bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Quotation ACC Approval Required</h3>
                  <p className="text-[10px] text-slate-400">Management ACC Approval Before Sending</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isAccSubmitting}
                onClick={() => setShowAccModal(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs font-sans">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded space-y-1">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Quotation Not Yet ACC Approved</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  This quotation is currently marked as <strong>Draft</strong> and has not received ACC authorization. Under system policy, quotations must be ACC approved before generating an invoice or sending to client email.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Quotation Number:</span>
                  <span className="font-mono font-bold text-slate-900">{quotation.quotation_number || quotation.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Client / Company:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">{rfq.company || quotation.company_name}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-500 font-medium">Grand Total:</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-sm">
                    RM {quotation.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ACC Notes (Optional):
                </label>
                <input
                  type="text"
                  value={accNote}
                  onChange={(e) => setAccNote(e.target.value)}
                  placeholder="e.g., Approved by management / price confirmed..."
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isAccSubmitting}
                onClick={() => setShowAccModal(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAccSubmitting}
                onClick={handleGrantAccAndSend}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAccSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving & Sending...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>ACC & Send Email Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
