import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Server, Mail, Brain, FileCheck, Terminal, AlertTriangle, Clock, Zap } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface DaemonItem {
  file_name: string;
  status: string;
  status_label: string;
  description: string;
  info_diag: string;
  last_modified: string;
  last_executed?: string;
  log_snippet?: string;
  is_error: boolean;
}

interface DbErrorItem {
  id?: number;
  rfq_number?: string;
  subject?: string;
  error: string;
  created_at: string;
}

interface GmailStats {
  total_emails: number;
  client_rfqs: number;
  general_inquiries: number;
  junk_emails: number;
  latest_email_date: string | null;
  latest_email_sender: string | null;
  latest_email_subject: string | null;
}

interface OcrStats {
  total_quotations: number;
  ocr_done: number;
  ocr_waiting: number;
  ocr_error: number;
  ocr_pending: number;
}

export const DaemonMonitor: React.FC = () => {
  const [triggeringCron, setTriggeringCron] = useState<boolean>(false);
  const [cronMsg, setCronMsg] = useState<string | null>(null);
  
  const [daemons, setDaemons] = useState<DaemonItem[]>([]);
  const [dbErrors, setDbErrors] = useState<DbErrorItem[]>([]);
  const [cronLastRun, setCronLastRun] = useState<string | null>(null);
  const [cronRecentLogs, setCronRecentLogs] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<string>('CHECKING...');
  const [gmailStats, setGmailStats] = useState<GmailStats | null>(null);
  const [ocrStats, setOcrStats] = useState<OcrStats | null>(null);
  const [activeApiKeys, setActiveApiKeys] = useState<number>(0);
  const [fetchedAt, setFetchedAt] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'engines' | 'cron_logs' | 'errors'>('engines');

  const fetchDaemonStatus = () => {
    fetch(getApiUrl('/api_daemons.php'))
      .then(res => res.json())
      .then(resData => {
        if (resData.status === 'success') {
          setDaemons(resData.data || []);
          setDbErrors(resData.errors || []);
          setCronLastRun(resData.cron_last_run || null);
          setCronRecentLogs(resData.cron_recent_logs || []);
          setSystemStatus(resData.system_status || 'ONLINE');
          setGmailStats(resData.gmail_stats || null);
          setOcrStats(resData.ocr_stats || null);
          setActiveApiKeys(resData.active_api_keys || 0);
          setFetchedAt(resData.fetched_at || new Date().toLocaleString());
        }
      })
      .catch(err => console.error('Daemon fetch error:', err));
  };

  useEffect(() => {
    fetchDaemonStatus();
    const interval = setInterval(() => {
      fetchDaemonStatus();
    }, 15000); // 15s silent refresh
    return () => clearInterval(interval);
  }, []);

  const handleManualCronTrigger = () => {
    setTriggeringCron(true);
    setCronMsg('Triggering Master Cron Engine...');
    fetch(getApiUrl('/cron_trigger.php'))
      .then(res => res.json())
      .then(d => {
        if (d.status === 'success' || d.logs) {
          setCronMsg(`✓ Cron engine executed in ${d.elapsed_seconds || 0}s — Live Traffic Log Updated!`);
          fetchDaemonStatus();
        } else {
          setCronMsg(`Notice: ${d.message || 'Cron completed with partial notice.'}`);
        }
        setTimeout(() => setCronMsg(null), 7000);
      })
      .catch(() => {
        setCronMsg('Error connecting to cron engine.');
        setTimeout(() => setCronMsg(null), 5000);
      })
      .finally(() => setTriggeringCron(false));
  };

  const renderStatusBadge = (item: DaemonItem) => {
    const st = (item.status || '').toLowerCase();
    if (st === 'running') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-700 border border-emerald-400/40 text-[10px] font-black px-2 py-0.5 uppercase tracking-wide">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          {item.status_label || 'RUNNING (LIVE TRAFFIC)'}
        </span>
      );
    }
    if (st === 'active' || st === 'listening') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-black px-2 py-0.5 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          {item.status_label || 'STANDBY (READY)'}
        </span>
      );
    }
    if (st === 'idle') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {item.status_label || 'IDLE (NO TRAFFIC)'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold px-2 py-0.5 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        {item.status_label || 'SLEEPING (STALE)'}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-4 font-sans text-slate-800 bg-slate-50 min-h-screen">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 border text-xs font-black px-2.5 py-0.5 uppercase tracking-wide ${
              systemStatus.includes('LIVE')
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : systemStatus.includes('STANDBY')
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${systemStatus.includes('LIVE') ? 'bg-emerald-400 animate-ping' : 'bg-blue-400'}`}></span>
              SYSTEM TRAFFIC: {systemStatus}
            </span>
            <span className="text-xs text-slate-400">Last Checked: {fetchedAt}</span>
          </div>
          <h1 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Daemon & Automation System Monitor
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Real-time status monitoring for Gmail IMAP Sync, AI Classifier, cPanel Cron Job, and Vision OCR Engines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualCronTrigger}
            disabled={triggeringCron}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-4 py-2 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${triggeringCron ? 'animate-spin' : ''}`} />
            <span>{triggeringCron ? 'Executing Cron...' : 'Run Sync & Cron Engine Now'}</span>
          </button>
        </div>
      </div>

      {cronMsg && (
        <div className="bg-blue-950 border border-blue-700/50 text-blue-200 text-xs font-bold p-3 flex items-center gap-2 shadow-sm">
          <Zap className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{cronMsg}</span>
        </div>
      )}

      {/* Top 4 Metric Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Metric 1: Live Gmail Sync */}
        <div className="bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span className="flex items-center gap-1.5 text-blue-700">
              <Mail className="w-4 h-4 text-blue-600" /> Live Gmail IMAP Sync
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 uppercase">ACTIVE</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {gmailStats?.total_emails || 0} <span className="text-xs font-semibold text-slate-500">Emails Pulled</span>
          </div>
          <div className="mt-2 text-[11px] space-y-1 border-t border-slate-100 pt-2 text-slate-600">
            <div className="flex justify-between">
              <span>Client RFQs:</span>
              <span className="font-bold text-emerald-700">{gmailStats?.client_rfqs || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>General Inquiries:</span>
              <span className="font-semibold text-slate-700">{gmailStats?.general_inquiries || 0}</span>
            </div>
            <div className="truncate text-slate-500 text-[10px] pt-1">
              Latest: <span className="font-medium text-slate-800">{gmailStats?.latest_email_date || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: cPanel / Web Cron */}
        <div className="bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span className="flex items-center gap-1.5 text-indigo-700">
              <Clock className="w-4 h-4 text-indigo-600" /> cPanel / Web Cron Trigger
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 uppercase">EVERY 5M / 60S</span>
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">
            {cronLastRun ? (
              <span className="text-emerald-700 font-mono text-[11px]">{cronLastRun.substring(0, 45)}...</span>
            ) : (
              <span className="text-slate-400 italic">Cron trigger active</span>
            )}
          </div>
          <div className="mt-2 text-[11px] space-y-1 border-t border-slate-100 pt-2 text-slate-600">
            <div className="flex justify-between">
              <span>Schedule:</span>
              <span className="font-bold text-indigo-700">*/5 * * * *</span>
            </div>
            <div className="flex justify-between">
              <span>Auto Browser Cron:</span>
              <span className="font-bold text-emerald-600">Active (60s)</span>
            </div>
            <div className="text-[10px] text-slate-500 pt-1">
              Script: <code className="bg-slate-100 px-1 py-0.5 font-mono text-slate-800">cron_trigger.php</code>
            </div>
          </div>
        </div>

        {/* Metric 3: AI Classifier & Key Pool */}
        <div className="bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span className="flex items-center gap-1.5 text-purple-700">
              <Brain className="w-4 h-4 text-purple-600" /> AI Gemini Pool
            </span>
            <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 uppercase">{activeApiKeys} KEYS</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {activeApiKeys} <span className="text-xs font-semibold text-slate-500">Active API Keys</span>
          </div>
          <div className="mt-2 text-[11px] space-y-1 border-t border-slate-100 pt-2 text-slate-600">
            <div className="flex justify-between">
              <span>Models in Use:</span>
              <span className="font-mono text-[10px] text-purple-700">gemini-3.6-flash</span>
            </div>
            <div className="flex justify-between">
              <span>Key Rotation:</span>
              <span className="font-semibold text-emerald-700">Auto Retry</span>
            </div>
            <div className="text-[10px] text-slate-500 pt-1">
              Pool Status: <span className="font-bold text-emerald-700">Ready</span>
            </div>
          </div>
        </div>

        {/* Metric 4: OCR & IMPA Vision Engine */}
        <div className="bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span className="flex items-center gap-1.5 text-teal-700">
              <FileCheck className="w-4 h-4 text-teal-600" /> Vision OCR Engine
            </span>
            <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 uppercase">ONLINE</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {ocrStats?.ocr_done || 0} <span className="text-xs font-semibold text-slate-500">Scanned SPH</span>
          </div>
          <div className="mt-2 text-[11px] space-y-1 border-t border-slate-100 pt-2 text-slate-600">
            <div className="flex justify-between">
              <span>Waiting AI Limit:</span>
              <span className="font-bold text-amber-600">{ocrStats?.ocr_waiting || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>OCR Pending:</span>
              <span className="font-semibold text-slate-500">{ocrStats?.ocr_pending || 0}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Scan Errors (0 item):</span>
              <span className="font-bold text-rose-600">{ocrStats?.ocr_error || 0}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 pt-2">
        <button
          onClick={() => setActiveTab('engines')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer ${
            activeTab === 'engines'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Active Engines & API Endpoints ({daemons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cron_logs')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer ${
            activeTab === 'cron_logs'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Cron Execution Log ({cronRecentLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer ${
            activeTab === 'errors'
              ? 'border-rose-600 text-rose-700 bg-rose-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>System & AI Error Audit ({dbErrors.length})</span>
        </button>
      </div>

      {/* TAB 1: Active Engines Table */}
      {activeTab === 'engines' && (
        <div className="bg-white border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 uppercase text-[10px] font-black text-slate-700">
              <tr>
                <th className="p-3">Engine / Script File</th>
                <th className="p-3">Traffic & Status</th>
                <th className="p-3">Last Execution / Log</th>
                <th className="p-3">Diagnostic & Log Snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {daemons.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 font-mono font-bold text-blue-800">
                    <div>{item.file_name}</div>
                    <div className="text-[10px] text-slate-600 font-sans font-normal">{item.description}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {renderStatusBadge(item)}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{item.last_executed || item.last_modified}</div>
                    <div className="text-[10px] text-slate-600">File Mod: {item.last_modified}</div>
                  </td>
                  <td className="p-3 text-slate-700 font-medium">
                    <div className="text-[11px] text-slate-600">{item.info_diag}</div>
                    {item.log_snippet && (
                      <div className="mt-1 font-mono text-[10px] bg-slate-900 text-emerald-400 p-1.5 border-l-2 border-emerald-500 overflow-x-auto truncate max-w-md">
                        {item.log_snippet}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Cron Execution Terminal Logs */}
      {activeTab === 'cron_logs' && (
        <div className="bg-slate-950 text-slate-200 p-4 font-mono text-xs border border-slate-800 shadow-inner space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400 text-[11px]">
            <span className="flex items-center gap-2 font-bold text-blue-400">
              <Terminal className="w-4 h-4" /> Live Log File: daemon/logs/cron_trigger_active.log
            </span>
            <span>Showing last {cronRecentLogs.length} entries</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed">
            {cronRecentLogs.length > 0 ? (
              cronRecentLogs.map((logLine, lIdx) => (
                <div key={lIdx} className="hover:bg-slate-900/80 px-2 py-1 border-l-2 border-emerald-500/50 text-slate-300">
                  <span className="text-emerald-400 font-bold">{logLine}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 p-4 text-center italic">
                No recent cron execution logs found yet. Click "Run Sync & Cron Engine Now" to trigger a run.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: System Error Audit */}
      {activeTab === 'errors' && (
        <div className="bg-white border border-slate-200 shadow-2xs p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              System & AI Error Audit Trail
            </h3>
            <span className="text-xs text-slate-500">Total recorded errors: {dbErrors.length}</span>
          </div>

          {dbErrors.length > 0 ? (
            <div className="space-y-2">
              {dbErrors.map((err, errIdx) => (
                <div key={errIdx} className="border border-rose-200 bg-rose-50/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 font-mono">
                      RFQ #{err.rfq_number || 'SYSTEM'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{err.created_at}</span>
                  </div>
                  <div className="text-slate-700 font-medium">{err.subject || 'RFQ Processing'}</div>
                  <div className="bg-rose-100/70 border border-rose-300/50 text-rose-800 p-2 font-mono text-[11px] mt-1 font-bold">
                    {err.error}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-slate-500 font-semibold text-xs border border-dashed border-slate-200">
              ✓ No system errors detected! All RFQ processing and AI engines are running cleanly.
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default DaemonMonitor;
