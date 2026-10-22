import React, { useState } from 'react';
import { Download, Monitor, ShieldCheck, Terminal, CheckCircle2, Laptop, Sparkles } from 'lucide-react';

export const ElectronDownloads: React.FC = () => {
  const [downloadingPlatform, setDownloadingPlatform] = useState<string | null>(null);

  const releaseVersions = [
    {
      platform: 'Windows Desktop App',
      version: 'v2.4.0 (x64 Installer)',
      filename: 'ERP-ABMALAYA-Setup-2.4.0.exe',
      size: '84.2 MB',
      os: 'Windows 10 / 11 (64-bit)',
      color: 'from-blue-600 to-indigo-700',
      badge: 'Recommended for PC',
      icon: Monitor,
      downloadUrl: '/downloads/ERP-ABMALAYA-Setup-2.4.0.exe',
    },
    {
      platform: 'macOS Desktop App',
      version: 'v2.4.0 (Universal Apple Silicon & Intel)',
      filename: 'ERP-ABMALAYA-2.4.0.dmg',
      size: '92.6 MB',
      os: 'macOS 12.0+ (Monterey, Ventura, Sonoma)',
      color: 'from-slate-800 to-slate-900',
      badge: 'Apple Silicon & Intel',
      icon: Laptop,
      downloadUrl: '/downloads/ERP-ABMALAYA-2.4.0.dmg',
    },
    {
      platform: 'Linux Desktop App',
      version: 'v2.4.0 (AppImage & Debian Package)',
      filename: 'ERP-ABMALAYA-2.4.0.AppImage',
      size: '89.1 MB',
      os: 'Ubuntu 20.04+, Debian, Fedora, Arch',
      color: 'from-emerald-700 to-teal-800',
      badge: 'Linux AppImage',
      icon: Terminal,
      downloadUrl: '/downloads/ERP-ABMALAYA-2.4.0.AppImage',
    },
  ];

  const handleTriggerDownload = (item: typeof releaseVersions[0]) => {
    setDownloadingPlatform(item.platform);
    
    // Simulate triggering download of Electron launcher / setup file
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = item.downloadUrl;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadingPlatform(null);
    }, 800);
  };

  return (
    <div className="w-full h-full bg-[#f4f6f9] overflow-y-auto font-sans p-6 space-y-6">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-xl p-6 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Native Desktop Client — Powered by Electron 31</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            ABMALAYA ERP Desktop App (Windows, macOS & Linux)
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Dapatkan pengalaman manajemen RFQ, Quotation Builder, dan AI OCR Vision Scanner dengan performa tinggi, notifikasi desktop native 24/7, serta integrasi printer offline.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-lg text-center shrink-0 space-y-1">
          <p className="text-[10px] uppercase font-mono font-bold text-blue-200">Current App Build</p>
          <p className="text-lg font-black font-mono text-emerald-400">v2.4.0 Stable</p>
          <p className="text-[9px] text-slate-300 font-mono">Build Date: Sep 2026</p>
        </div>
      </div>

      {/* Downloads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {releaseVersions.map((item, idx) => {
          const IconComponent = item.icon;
          const isDownloading = downloadingPlatform === item.platform;

          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${item.color} text-white shadow-xs`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    {item.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{item.platform}</h3>
                  <p className="text-xs text-slate-500 font-mono font-bold mt-0.5">{item.version}</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Name:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[140px]" title={item.filename}>{item.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Size:</span>
                    <span className="font-bold text-slate-800">{item.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Compatibility:</span>
                    <span className="font-bold text-slate-800 text-[10px]">{item.os}</span>
                  </div>
                </div>
              </div>

              {/* Download Action Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => handleTriggerDownload(item)}
                  disabled={isDownloading}
                  className={`w-full py-2.5 px-4 bg-gradient-to-r ${item.color} text-white font-bold text-xs rounded-lg shadow-xs hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
                >
                  <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                  <span>{isDownloading ? 'Downloading Executable...' : `Download for ${item.platform.split(' ')[0]}`}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature & Installation Guide */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
            Why Use ABMALAYA ERP Desktop (Electron)?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Direct Local Printing</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Print Commercial Quotation documents directly to local printers without opening extra browser tabs.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Native Desktop Push Notifications</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Receive instant system notifications when new RFQ emails arrive from Gmail IMAP on the server.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Enhanced AI Vision Hardware Access</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Kinerja ekstraksi Vision OCR yang lebih cepat dengan akselerasi hardware GPU bawaan Electron.
            </p>
          </div>
        </div>

        {/* Local Developer Command Guide */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Terminal className="w-4 h-4 text-slate-500" />
            <span>Developer Mode: Run <code className="bg-slate-100 px-2 py-0.5 rounded text-blue-700 font-bold border border-slate-300">npm run electron:start</code> in terminal</span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">Electron Config: <code className="text-slate-700 font-bold">electron/main.js</code></span>
        </div>
      </div>

    </div>
  );
};

export default ElectronDownloads;
