import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { RFQ, Quotation, UserAccount, RFQStatus, SMTPConfig } from './types/erp';
import { initialRFQs, sampleQuotation } from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { RFQInbox } from './components/RFQInbox';
import { QuotationList } from './components/QuotationList';
import { QuotationBuilder } from './components/QuotationBuilder';
import { InvoiceBuilder } from './components/InvoiceBuilder';
import { QuotationDoc } from './components/QuotationDoc';
import { Product } from './components/Product';
import { EmailClient } from './components/EmailClient';
import { AccountSettings } from './components/AccountSettings';
import { SystemSettings } from './components/SystemSettings';
import { NotificationLog } from './components/NotificationLog';
import { Trash } from './components/Trash';
import { LoginScreen } from './components/LoginScreen';
import { SwitchUserModal } from './components/SwitchUserModal';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getApiUrl } from './utils/api';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 p-8 bg-rose-50 border border-rose-300 m-4 text-rose-950 font-sans text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>ERP Component Recovery Mode</span>
          </div>
          <p className="font-mono bg-white p-3 border border-rose-200 text-xs text-rose-900 leading-relaxed">
            {this.state.error?.toString()}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload & Recover Application</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [rfqs, setRfqs] = useState<RFQ[]>(initialRFQs);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [currentQuotation, setCurrentQuotation] = useState<Quotation>(sampleQuotation);
  const [isFetchingLive, setIsFetchingLive] = useState<boolean>(false);
  const [isAttachmentPreviewOpen, setIsAttachmentPreviewOpen] = useState<boolean>(false);
  
  const isPreviewOpenRef = useRef<boolean>(false);
  useEffect(() => {
    isPreviewOpenRef.current = isAttachmentPreviewOpen;
  }, [isAttachmentPreviewOpen]);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const cachedUser = localStorage.getItem('abmalaya_user_session');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        if (parsed && parsed.email && !parsed.email.toLowerCase().includes('purchasing')) {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [quotationsCache, setQuotationsCache] = useState<Quotation[]>([]);
  const [hasFetchedQuotations, setHasFetchedQuotations] = useState<boolean>(false);

  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'tls',
    username: 'abmalayaindustry@gmail.com',
    app_password: '',
    from_name: 'ABMALAYA.COM (Malaysia)',
    from_email: 'abmalayaindustry@gmail.com',
    is_connected: true,
  });

  // Master Passphrase Authentication Gate State
  // Synchronously initialize from localStorage: requires valid token AND valid user session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem('erp_auth_token');
    const userSession = localStorage.getItem('abmalaya_user_session');
    return Boolean(token && token.length >= 20 && userSession);
  });

  // Verify session in background silently
  useEffect(() => {
    const token = localStorage.getItem('erp_auth_token');
    const userSession = localStorage.getItem('abmalaya_user_session');

    // If no token or no cached user session, MUST force login
    if (!token || !userSession) {
      localStorage.removeItem('erp_auth_token');
      localStorage.removeItem('erp_token_expires');
      localStorage.removeItem('erp_auth_active');
      localStorage.removeItem('abmalaya_user_session');
      setIsAuthenticated(false);
      setCurrentUser(null);
      return;
    }

    fetch(getApiUrl(`/api_auth.php?action=verify_session&token=${encodeURIComponent(token)}`))
      .then((res) => res.json())
      .then((data) => {
        if (data && data.valid === false) {
          // Token invalid -> force login
          localStorage.removeItem('erp_auth_token');
          localStorage.removeItem('erp_token_expires');
          localStorage.removeItem('erp_auth_active');
          localStorage.removeItem('abmalaya_user_session');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      })
      .catch((err) => {
        console.warn('Background auth session verification check:', err);
      });
  }, []);

  const handleLoginSuccess = (_token: string, _expiresAt: string, user?: any) => {
    setIsAuthenticated(true);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('abmalaya_user_session', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    const token = localStorage.getItem('erp_auth_token');
    if (token) {
      fetch(getApiUrl('/api_auth.php?action=logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
    localStorage.removeItem('erp_auth_token');
    localStorage.removeItem('erp_token_expires');
    localStorage.removeItem('erp_auth_active');
    localStorage.removeItem('abmalaya_user_session');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    fetch(getApiUrl('/api_users.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setUsers(resData.data);
          
          const rawCached = localStorage.getItem('abmalaya_user_session');
          if (rawCached) {
            try {
              const parsed = JSON.parse(rawCached);
              const matchedUser = resData.data.find((u: UserAccount) => u.email.toLowerCase() === parsed.email?.toLowerCase());
              if (matchedUser) {
                setCurrentUser(matchedUser);
                localStorage.setItem('abmalaya_user_session', JSON.stringify(matchedUser));
              } else {
                // If user no longer exists in MySQL -> FORCE RE-LOGIN immediately!
                console.warn('User session not found in active database users. Requiring re-login.');
                handleLogout();
              }
            } catch (e) {
              handleLogout();
            }
          }
        }
      })
      .catch((err) => console.log('MySQL Users fetch error:', err));
  }, []);

  const fetchLiveEmails = (isSync: boolean = false) => {
    if (isSync && isPreviewOpenRef.current) {
      console.log('Pausing background IMAP sync while file preview modal is open.');
      return;
    }

    setIsFetchingLive(true);
    const url = isSync
      ? getApiUrl('/api_fetch_live_gmail.php?sync=1')
      : getApiUrl('/api_fetch_live_gmail.php');

    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        try {
          const resData = JSON.parse(text);
          if (resData.status === 'success' && resData.data && resData.data.length > 0) {
            setRfqs(resData.data);
            if (!selectedRfqId) {
              setSelectedRfqId(resData.data[0].id);
            }
          }
        } catch (err) {
          console.log('Live Gmail Response Notice:', text.substring(0, 120));
        }
      })
      .catch((err) => console.log('Live Gmail IMAP network error:', err))
      .finally(() => setIsFetchingLive(false));
  };

  const fetchQuotationsList = () => {
    fetch(getApiUrl('/api_quotations.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setQuotationsCache(resData.data);
          setHasFetchedQuotations(true);
        }
      })
      .catch((err) => console.log('Quotations fetch error on App startup:', err));
  };

  useEffect(() => {
    fetchLiveEmails(false);
    fetchQuotationsList();

    const interval = setInterval(() => {
      if (!isPreviewOpenRef.current) {
        fetchLiveEmails(true);
        fetchQuotationsList();
      }
    }, 15000); // Fast 15 seconds sync interval

    return () => {
      clearInterval(interval);
    };
  }, []);

  const [viewMode, setViewModeState] = useState<'inbox' | 'builder' | 'invoice_builder' | 'doc_preview' | 'account_settings' | 'system_settings' | 'quotation_list' | 'product_catalog' | 'notification_log' | 'trash_quotation' | 'trash' | 'client_chat'>('inbox');
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setViewMode = (mode: 'inbox' | 'builder' | 'invoice_builder' | 'doc_preview' | 'account_settings' | 'system_settings' | 'quotation_list' | 'product_catalog' | 'notification_log' | 'trash_quotation' | 'trash' | 'client_chat') => {
    setViewModeState(mode);
    // Instant fetch from MySQL whenever user switches views to ensure 100% fresh data
    fetchQuotationsList();
  };

  const selectedRfq = rfqs.find((r) => r.id === selectedRfqId) || null;

  const handleSelectRfq = (rfq: RFQ) => {
    setSelectedRfqId(rfq.id);
  };

  const handleUpdateRfqStatus = (rfqId: string, status: RFQStatus) => {
    setRfqs((prev) =>
      prev.map((item) => (item.id === rfqId ? { ...item, status } : item))
    );

    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: rfqId,
        status: status,
        user_name: currentUser?.name || 'Admin',
        user_email: currentUser?.email || 'admin@abmalaya.com'
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== 'success') {
          console.error('MySQL RFQ status sync failed:', data.message);
        }
      })
      .catch((err) => console.error('MySQL RFQ status sync error:', err));
  };

  const handleConvertEmailToRfq = (rfqId: string) => {
    setIsLoading(true);
    setRfqs((prev) =>
      prev.map((item) =>
        item.id === rfqId
          ? { ...item, labels: ['Primary RFQ', 'Manually Converted'], status: 'masuk' as RFQStatus }
          : item
      )
    );
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleCreateQuotationFromRfq = (rfq: RFQ) => {
    setIsLoading(true);
    const uniqueQuoId = `QUO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newQuo: Quotation = {
      ...sampleQuotation,
      id: uniqueQuoId,
      rfq_id: rfq.id,
      quotation_number: `SPH-ABM/MY/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
      client_name: rfq.sender_name,
      client_email: rfq.sender_email,
      company_name: rfq.company,
      date_issued: new Date().toISOString().split('T')[0],
      items: [
        {
          id: 'item-autogen-1',
          description: rfq.item_requested || 'Industrial Equipment Specification',
          quantity: 1,
          unit: 'Package',
          unit_price: 0,
          discount_percent: 0,
          total: 0,
        }
      ],
      subtotal: 0,
      discount_total: 0,
      tax_percent: 11,
      tax_amount: 0,
      grand_total: 0,
    };

    setCurrentQuotation(newQuo);
    setViewModeState('builder');
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleNewQuotation = () => {
    setIsLoading(true);
    setCurrentQuotation(sampleQuotation);
    setViewModeState('builder');
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleOpenEmailReply = (rfq: RFQ) => {
    setSelectedRfqId(rfq.id);
    setShowEmailModal(true);
  };

  const handleSuccessEmailSend = (replyBody?: string, replySender?: string) => {
    setShowEmailModal(false);
    if (selectedRfqId) {
      setRfqs((prev) =>
        prev.map((item) =>
          item.id === selectedRfqId
            ? {
                ...item,
                status: 'penawaran_terkirim' as RFQStatus,
                replies: replyBody
                  ? [
                      {
                        body: replyBody,
                        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
                        sender: replySender || 'sales@abmalaya.com'
                      }
                    ]
                  : item.replies
              }
            : item
        )
      );
    }
    setViewMode('inbox');
  };

  const handleAddUser = (newUser: any) => {
    setIsLoading(true);
    const userId = newUser.id || `USR-${Date.now()}`;
    const user: UserAccount = {
      id: userId,
      name: newUser.name || 'Team Member',
      email: newUser.email || 'user@abmalaya.com',
      role: newUser.role || 'Karyawan',
      department: newUser.department || 'Sales Executive',
      status: newUser.status || 'Active',
      created_at: newUser.created_at || new Date().toISOString().split('T')[0],
    };

    fetch(getApiUrl('/api_users.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    })
      .then(() => {
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === user.id);
          if (exists) {
            return prev.map((u) => (u.id === user.id ? user : u));
          }
          return [...prev, user];
        });
      })
      .catch((err) => console.log('Save user MySQL error:', err))
      .finally(() => setIsLoading(false));
  };

  const handleDeleteUser = (userId: string) => {
    setIsLoading(true);
    fetch(getApiUrl('/api_users.php?action=delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId }),
    })
      .then(() => {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      })
      .catch((err) => console.log('Delete user MySQL error:', err))
      .finally(() => setIsLoading(false));
  };

  const [pendingSwitchUser, setPendingSwitchUser] = useState<UserAccount | null>(null);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState<boolean>(false);

  const handleSwitchUser = (user: UserAccount) => {
    setIsLoading(true);
    setCurrentUser(user);
    localStorage.setItem('abmalaya_user_session', JSON.stringify(user));

    // Record login activity in MySQL
    fetch(getApiUrl('/api_user_activity.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: user.name,
        user_email: user.email,
        action: 'LOGIN_SESSION',
        details: `Sesi login diaktifkan untuk akun ${user.name} (${user.email}).`
      })
    }).catch(err => console.error('Log login session error:', err));

    setTimeout(() => setIsLoading(false), 300);
  };

  const handlePromptSwitchUser = (targetUser: UserAccount) => {
    if (currentUser && targetUser.id === currentUser.id) return;
    setPendingSwitchUser(targetUser);
    setIsSwitchModalOpen(true);
  };

  const pendingCount = rfqs.filter((r) => r.status === 'masuk').length;
  const sentCount = rfqs.filter((r) => r.status === 'penawaran_terkirim').length;
  const dealCount = rfqs.filter((r) => r.status === 'deal').length;

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen bg-slate-100 text-slate-900 flex font-sans overflow-hidden relative">
        
        {/* Top Loading Progress Bar (NProgress / GitHub style) */}
        {isLoading && (
          <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-blue-100/70 overflow-hidden pointer-events-none">
            <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 w-full animate-pulse shadow-[0_0_12px_rgba(37,99,235,0.9)]"></div>
          </div>
        )}

        {/* Sidebar Navigation Component */}
        <Sidebar
          viewMode={viewMode}
          setViewMode={setViewMode}
          onNewQuotation={handleNewQuotation}
          pendingCount={pendingCount}
          sentCount={sentCount}
          dealCount={dealCount}
          currentUser={currentUser || undefined}
          users={users}
          onSwitchUser={handlePromptSwitchUser}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Full Width Edge-to-Edge Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          
          {/* Top Navbar ONLY for Non-Inbox Views */}
          {viewMode !== 'inbox' && (
            <Header
              viewMode={viewMode}
              sentCount={sentCount}
              dealCount={dealCount}
              pendingCount={pendingCount}
              onNewQuotation={handleNewQuotation}
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            />
          )}

          {/* Page Content Body - 100% Full Width Seamless Canvas */}
          <main className="flex-1 w-full flex flex-col bg-white overflow-hidden">
            
            {/* Dynamic Active View wrapped in Error Boundary */}
            <ErrorBoundary>
              {viewMode === 'inbox' && (
                <RFQInbox
                  rfqs={rfqs}
                  selectedRfqId={selectedRfqId}
                  onSelectRfq={handleSelectRfq}
                  onCreateQuotationFromRfq={handleCreateQuotationFromRfq}
                  onOpenEmailReply={handleOpenEmailReply}
                  onUpdateRfqStatus={handleUpdateRfqStatus}
                  onConvertEmailToRfq={handleConvertEmailToRfq}
                  onRefreshLiveEmails={() => fetchLiveEmails(true)}
                  isFetchingLive={isFetchingLive}
                  onNewQuotation={handleNewQuotation}
                  onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  onPreviewStateChange={(isOpen) => setIsAttachmentPreviewOpen(isOpen)}
                  sentCount={sentCount}
                  dealCount={dealCount}
                  pendingCount={pendingCount}
                  onNavigateView={(mode) => setViewMode(mode)}
                  currentUser={currentUser || undefined}
                />
              )}

              {viewMode === 'product_catalog' && (
                <Product />
              )}

              {viewMode === 'notification_log' && (
                <NotificationLog
                  onNavigateView={(mode) => setViewMode(mode)}
                />
              )}

              {viewMode === 'quotation_list' && (
                <QuotationList
                  onEditQuotation={(quo) => {
                    setCurrentQuotation(quo);
                    setViewMode('builder');
                  }}
                  onPreviewDoc={(quo) => {
                    setCurrentQuotation(quo);
                    setViewMode('doc_preview');
                  }}
                  onSendEmail={(quo) => {
                    setCurrentQuotation(quo);
                    setShowEmailModal(true);
                  }}
                  onOpenEmailClient={(targetQuo) => {
                    if (targetQuo) setCurrentQuotation(targetQuo);
                    setViewMode('client_chat');
                  }}
                  onNewQuotation={handleNewQuotation}
                  cachedQuotations={quotationsCache}
                  setCachedQuotations={(data) => {
                    setQuotationsCache(data);
                    setHasFetchedQuotations(true);
                  }}
                  hasFetched={hasFetchedQuotations}
                  setIsGlobalLoading={setIsLoading}
                  currentUser={currentUser || undefined}
                />
              )}

              {(viewMode === 'trash_quotation' || viewMode === 'trash') && (
                <Trash
                  quotations={quotationsCache}
                  setQuotations={setQuotationsCache}
                  isLoading={isLoading}
                  onRefresh={() => {
                    setHasFetchedQuotations(false);
                  }}
                  setViewMode={setViewMode}
                />
              )}

              {viewMode === 'builder' && (
                <QuotationBuilder
                  initialQuotation={currentQuotation}
                  onSaveAndPreviewDoc={(quo) => {
                    setCurrentQuotation(quo);
                    setViewMode('doc_preview');
                  }}
                  onSaveAndSendEmail={(quo) => {
                    setCurrentQuotation(quo);
                    setShowEmailModal(true);
                  }}
                  onCancel={() => setViewMode('inbox')}
                  onNavigateView={(mode) => setViewMode(mode)}
                  currentUser={currentUser || undefined}
                />
              )}

              {viewMode === 'invoice_builder' && (
                <InvoiceBuilder
                  onBack={() => setViewMode('inbox')}
                  onSendEmail={() => {
                    setShowEmailModal(true);
                  }}
                  onNavigateView={(mode) => setViewMode(mode)}
                />
              )}

              {viewMode === 'doc_preview' && (
                <QuotationDoc
                  quotation={currentQuotation}
                  currentUser={currentUser || undefined}
                  onBackToBuilder={() => setViewMode('builder')}
                  onSendEmail={() => setShowEmailModal(true)}
                />
              )}

              {viewMode === 'account_settings' && (
                <AccountSettings
                  users={users}
                  currentUser={currentUser}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  onSwitchUser={handlePromptSwitchUser}
                />
              )}

              {viewMode === 'client_chat' && (
                <EmailClient
                  isModalMode={false}
                  rfq={selectedRfq}
                  quotation={currentQuotation}
                  quotationsList={quotationsCache}
                  rfqList={rfqs}
                  onSuccessSend={handleSuccessEmailSend}
                />
              )}

              {viewMode === 'system_settings' && (
                <SystemSettings
                  smtpConfig={smtpConfig}
                  onSaveSmtpConfig={(cfg) => setSmtpConfig(cfg)}
                />
              )}
            </ErrorBoundary>

          </main>
        </div>

        {/* Telegram Client Email Chat Modal */}
        {showEmailModal && (
          <EmailClient
            isModalMode={true}
            rfq={selectedRfq || undefined}
            quotation={currentQuotation}
            quotationsList={quotationsCache}
            rfqList={rfqs}
            onClose={() => setShowEmailModal(false)}
            onSuccessSend={handleSuccessEmailSend}
          />
        )}

        {/* User Switch Passphrase Confirmation Modal */}
        <SwitchUserModal
          isOpen={isSwitchModalOpen}
          targetUser={pendingSwitchUser}
          onClose={() => {
            setIsSwitchModalOpen(false);
            setPendingSwitchUser(null);
          }}
          onSuccess={(targetUser) => {
            handleSwitchUser(targetUser);
            setIsSwitchModalOpen(false);
            setPendingSwitchUser(null);
          }}
        />
      </div>
    </ErrorBoundary>
  );
};
