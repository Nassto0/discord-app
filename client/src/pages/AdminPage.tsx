import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { fileUrl, getInitials, getAvatarColor, formatTime } from '@/lib/utils';
import {
  Shield, Users, MessageSquare, Flag, AlertTriangle, ArrowLeft,
  Check, X, Trash2, Crown, ChevronDown, BarChart3, FileText, Gavel, Clock, Ban,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '@/stores/toastStore';

interface AdminPageProps {
  onBack: () => void;
}

type AdminTab = 'overview' | 'reports' | 'users' | 'flagged';
type ReportFilter = 'all' | 'pending' | 'reviewed' | 'dismissed';

export function AdminPage({ onBack }: AdminPageProps) {
  const { user } = useAuthStore();
  const pushToast = useToastStore((s) => s.push);
  const [tab, setTab] = useState<AdminTab>('overview');

  // Data state
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<{ messages: any[]; posts: any[] }>({ messages: [], posts: [] });
  const [loading, setLoading] = useState(false);

  // Reports filter
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');

  // Role dropdown
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

  // Report action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [moderationModal, setModerationModal] = useState<{ userId: string; action: 'ban' | 'mute' | 'timeout' | 'unban' | 'unmute' | 'untimeout' } | null>(null);
  const [modReason, setModReason] = useState('');
  const [modMinutes, setModMinutes] = useState(60);
  const [userActionLog, setUserActionLog] = useState<Record<string, any[]>>({});

  // Review note modal
  const [reviewModal, setReviewModal] = useState<{ id: string; action: string } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [backendAdminMissing, setBackendAdminMissing] = useState(false);

  const isAuthorized = !!user && (user.role === 'owner' || user.role === 'admin' || user.email === 'nasstofa0@gmail.com');

  const fetchData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setBackendAdminMissing(false);
    try {
      switch (tab) {
        case 'overview': {
          const s = await api.admin.stats();
          setStats(s);
          break;
        }
        case 'reports': {
          const r = await api.admin.reports(reportFilter === 'all' ? undefined : reportFilter);
          setReports(r);
          break;
        }
        case 'users': {
          const u = await api.admin.users();
          setUsers(u);
          const entries = await Promise.all(u.slice(0, 12).map(async (x: any) => [x.id, await api.admin.userActions(x.id)] as const));
          setUserActionLog(Object.fromEntries(entries));
          break;
        }
        case 'flagged': {
          const f = await api.admin.flagged();
          setFlagged(f as any);
          break;
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      const message = (err as Error).message || '';
      if (message.toLowerCase().includes('not found')) {
        setBackendAdminMissing(true);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, reportFilter, isAuthorized]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Guard: only owner/admin can view (placed after all hooks)
  if (!isAuthorized) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-6">You do not have permission to access this page.</p>
          <button onClick={onBack} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleUpdateReport = async (id: string, status: string, note?: string) => {
    setActionLoading(id);
    try {
      await api.admin.updateReport(id, { status, reviewNote: note });
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status, reviewNote: note } : r)));
    } catch (err) {
      console.error('Failed to update report:', err);
    } finally {
      setActionLoading(null);
      setReviewModal(null);
      setReviewNote('');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content? This cannot be undone.')) return;
    try {
      await api.admin.deletePost(id);
      setFlagged((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => p.id !== id),
      }));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this message? This cannot be undone.')) return;
    try {
      await api.admin.deleteMessage(id);
      setFlagged((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== id),
      }));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleDeleteStory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this story? This cannot be undone.')) return;
    try {
      await api.admin.deleteStory(id);
      pushToast('Story deleted', 'success');
    } catch (err) {
      console.error('Failed to delete story:', err);
      pushToast('Failed to delete story', 'error');
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await api.admin.updateRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err) {
      console.error('Failed to update role:', err);
    } finally {
      setRoleDropdown(null);
    }
  };

  const handleModerate = async () => {
    if (!moderationModal) return;
    if (!modReason.trim()) return;
    setActionLoading(moderationModal.userId);
    try {
      await api.admin.moderateUser(moderationModal.userId, {
        action: moderationModal.action,
        reason: modReason.trim(),
        minutes: moderationModal.action === 'mute' || moderationModal.action === 'timeout' ? modMinutes : undefined,
      });
      const updatedUsers = await api.admin.users();
      setUsers(updatedUsers);
      const logs = await api.admin.userActions(moderationModal.userId);
      setUserActionLog((prev) => ({ ...prev, [moderationModal.userId]: logs }));
    } catch (err) {
      console.error('Moderation action failed:', err);
      pushToast((err as Error).message || 'Moderation action failed', 'error');
    } finally {
      setActionLoading(null);
      setModerationModal(null);
      setModReason('');
      setModMinutes(60);
    }
  };

  const tabList: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: Flag },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'flagged', label: 'Flagged', icon: AlertTriangle },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full bg-background">
      {/* Desktop sidebar */}
      <div className="w-64 shrink-0 border-r border-border bg-card/30 p-3 flex-col hidden md:flex">
        <div className="flex items-center gap-3 px-3 py-4 mb-2">
          <button onClick={onBack} className="group flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Admin</span>
          </div>
        </div>
        <nav className="space-y-1">
          {tabList.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98]
                ${tab === t.id ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <t.icon className={`h-4 w-4 ${tab === t.id ? 'text-primary-foreground' : 'opacity-70'}`} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">Admin Dashboard</span>
          </div>
          <div className="flex gap-1 px-3 py-2 overflow-x-auto">
            {tabList.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-none rounded-lg px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-colors
                  ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 md:px-10 py-8">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {backendAdminMissing && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              Admin backend routes are missing on the live API. Redeploy backend with latest server code to enable this page.
            </div>
          )}

          <AnimatePresence mode="wait">
            {!loading && (
              <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

                {/* ── Overview Tab ── */}
                {tab === 'overview' && stats && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground tracking-tight">Dashboard Overview</h2>
                        <p className="text-sm text-muted-foreground">Platform statistics at a glance</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <StatCard icon={Users} label="Total Users" value={stats.users} color="text-blue-400" bg="bg-blue-500/10" />
                      <StatCard icon={FileText} label="Total Posts" value={stats.posts} color="text-emerald-400" bg="bg-emerald-500/10" />
                      <StatCard icon={MessageSquare} label="Total Messages" value={stats.messages} color="text-violet-400" bg="bg-violet-500/10" />
                      <StatCard icon={Flag} label="Total Reports" value={stats.reports} color="text-orange-400" bg="bg-orange-500/10" />
                      <StatCard icon={AlertTriangle} label="Pending Reports" value={stats.pendingReports} color="text-amber-400" bg="bg-amber-500/10" accent={stats.pendingReports > 0} />
                      <StatCard icon={Shield} label="Flagged Content" value={(stats.flaggedMessages || 0) + (stats.flaggedPosts || 0)} color="text-red-400" bg="bg-red-500/10" accent={(stats.flaggedMessages || 0) + (stats.flaggedPosts || 0) > 0} />
                    </div>

                    {/* Quick breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-border bg-card/30 p-5">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Flagged Breakdown</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">Flagged Messages</span>
                            <span className="text-sm font-bold text-foreground">{stats.flaggedMessages || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">Flagged Posts</span>
                            <span className="text-sm font-bold text-foreground">{stats.flaggedPosts || 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-card/30 p-5">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Report Status</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">Pending</span>
                            <span className="text-sm font-bold text-amber-400">{stats.pendingReports || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">Total Handled</span>
                            <span className="text-sm font-bold text-emerald-400">{(stats.reports || 0) - (stats.pendingReports || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Reports Tab ── */}
                {tab === 'reports' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Flag className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-foreground tracking-tight">Reports</h2>
                        <p className="text-sm text-muted-foreground">Review and manage user reports</p>
                      </div>
                    </div>

                    {/* Filter bar */}
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'pending', 'reviewed', 'dismissed'] as ReportFilter[]).map((f) => (
                        <button key={f} onClick={() => setReportFilter(f)}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition-colors
                            ${reportFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                          {f}
                        </button>
                      ))}
                    </div>

                    {reports.length === 0 ? (
                      <EmptyState icon={Flag} message="No reports found" />
                    ) : (
                      <div className="space-y-3">
                        {reports.map((report) => (
                          <div key={report.id} className="rounded-2xl border border-border bg-card/30 p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                              <Avatar name={report.reporter?.username || 'Unknown'} src={report.reporter?.avatar} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-foreground">{report.reporter?.username || 'Unknown'}</span>
                                  <StatusBadge status={report.status} />
                                  <span className="text-xs text-muted-foreground">{formatTime(report.createdAt)}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                                    {report.targetType}
                                  </span>
                                  <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400 capitalize">
                                    {report.reason}
                                  </span>
                                </div>
                                {report.details && (
                                  <p className="text-sm text-foreground/80 mb-3 break-words">{report.details}</p>
                                )}
                                {report.reviewNote && (
                                  <p className="text-xs text-muted-foreground italic mb-3 border-l-2 border-border pl-3">
                                    Note: {report.reviewNote}
                                  </p>
                                )}

                                {report.status === 'pending' && (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => { setReviewModal({ id: report.id, action: 'reviewed' }); setReviewNote(''); }}
                                      disabled={actionLoading === report.id}
                                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                                      <Check className="h-3.5 w-3.5" />
                                      Mark Reviewed
                                    </button>
                                    <button
                                      onClick={() => { setReviewModal({ id: report.id, action: 'dismissed' }); setReviewNote(''); }}
                                      disabled={actionLoading === report.id}
                                      className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50">
                                      <X className="h-3.5 w-3.5" />
                                      Dismiss
                                    </button>
                                    {(report.targetType === 'post' || report.targetType === 'message' || report.targetType === 'story') && (
                                      <button
                                        onClick={() => {
                                          if (report.targetType === 'post') handleDeletePost(report.targetId);
                                          else if (report.targetType === 'message') handleDeleteMessage(report.targetId);
                                          else handleDeleteStory(report.targetId);
                                        }}
                                        disabled={actionLoading === report.id}
                                        className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete Content
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Users Tab ── */}
                {tab === 'users' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-foreground tracking-tight">Users</h2>
                        <p className="text-sm text-muted-foreground">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {users.length === 0 ? (
                      <EmptyState icon={Users} message="No users found" />
                    ) : (
                      <div className="space-y-2">
                        {users.map((u) => (
                          <div key={u.id} className="rounded-2xl border border-border bg-card/30 p-4 sm:p-5">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.username} src={u.avatar} size="md" />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-foreground truncate">{u.username}</span>
                                  <RoleBadge role={u.role} />
                                  {u.status === 'banned' && (
                                    <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">Banned</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                <div className="flex flex-wrap gap-3 mt-1.5">
                                  <span className="text-xs text-muted-foreground">
                                    <FileText className="inline h-3 w-3 mr-1 opacity-70" />{u.postCount || 0} posts
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    <MessageSquare className="inline h-3 w-3 mr-1 opacity-70" />{u.messageCount || 0} messages
                                  </span>
                                  <span className="text-xs text-amber-400">
                                    {u.nassPoints || 0} NassPoints
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Joined {formatTime(u.createdAt)}
                                  </span>
                                </div>
                                {u.isBanned && <p className="mt-1 text-xs text-red-400">Banned{u.banReason ? ` - ${u.banReason}` : ''}</p>}
                                {u.mutedUntil && <p className="mt-1 text-xs text-amber-400">Muted until {formatTime(u.mutedUntil)}{u.muteReason ? ` - ${u.muteReason}` : ''}</p>}
                                {u.timeoutUntil && <p className="mt-1 text-xs text-orange-400">Timed out until {formatTime(u.timeoutUntil)}{u.timeoutReason ? ` - ${u.timeoutReason}` : ''}</p>}
                              </div>

                              {/* Role dropdown */}
                              {u.role !== 'owner' && u.id !== user.id && (
                                <div className="relative flex items-center gap-2">
                                  <button
                                    onClick={() => setRoleDropdown(roleDropdown === u.id ? null : u.id)}
                                    className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
                                    Role
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${roleDropdown === u.id ? 'rotate-180' : ''}`} />
                                  </button>
                                  {roleDropdown === u.id && (
                                    <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                                      {['admin', 'user'].map((role) => (
                                        <button key={role} onClick={() => handleUpdateRole(u.id, role)}
                                          className={`flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-secondary capitalize
                                            ${u.role === role ? 'text-primary' : 'text-foreground'}`}>
                                          {role === 'admin' ? <Crown className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                                          {role}
                                          {u.role === role && <Check className="h-3.5 w-3.5 ml-auto" />}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <button onClick={() => setModerationModal({ userId: u.id, action: u.isBanned ? 'unban' : 'ban' })}
                                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20">
                                    <Ban className="inline h-3.5 w-3.5 mr-1" /> {u.isBanned ? 'Unban' : 'Ban'}
                                  </button>
                                  <button onClick={() => setModerationModal({ userId: u.id, action: u.mutedUntil ? 'unmute' : 'mute' })}
                                    className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20">
                                    <Clock className="inline h-3.5 w-3.5 mr-1" /> {u.mutedUntil ? 'Unmute' : 'Mute'}
                                  </button>
                                  <button onClick={() => setModerationModal({ userId: u.id, action: u.timeoutUntil ? 'untimeout' : 'timeout' })}
                                    className="rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/20">
                                    <Gavel className="inline h-3.5 w-3.5 mr-1" /> {u.timeoutUntil ? 'Untimeout' : 'Timeout'}
                                  </button>
                                </div>
                              )}
                            </div>
                            {!!userActionLog[u.id]?.length && (
                              <div className="mt-3 border-t border-border pt-3">
                                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Recent Admin Orders</p>
                                <div className="space-y-1">
                                  {userActionLog[u.id].slice(0, 3).map((a) => (
                                    <p key={a.id} className="text-xs text-foreground/80">{a.action} by {a.admin?.username}: {a.reason}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Flagged Content Tab ── */}
                {tab === 'flagged' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground tracking-tight">Flagged Content</h2>
                        <p className="text-sm text-muted-foreground">Auto-moderated content that requires review</p>
                      </div>
                    </div>

                    {/* Flagged Messages */}
                    <div>
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Flagged Messages ({flagged.messages?.length || 0})
                      </h3>
                      {(!flagged.messages || flagged.messages.length === 0) ? (
                        <EmptyState icon={MessageSquare} message="No flagged messages" small />
                      ) : (
                        <div className="space-y-2">
                          {flagged.messages.map((msg) => (
                            <div key={msg.id} className="rounded-2xl border border-border bg-card/30 p-4">
                              <div className="flex items-start gap-3">
                                <Avatar name={msg.sender?.username || msg.username || 'Unknown'} src={msg.sender?.avatar || msg.avatar} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-foreground">{msg.sender?.username || msg.username || 'Unknown'}</span>
                                    <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                                  </div>
                                  <p className="text-sm text-foreground/80 break-words mb-2">{msg.content}</p>
                                  {msg.flagReason && (
                                    <span className="inline-block rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 mb-2">
                                      {msg.flagReason}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="flex items-center gap-1.5 shrink-0 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Remove</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Flagged Posts */}
                    <div>
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Flagged Posts ({flagged.posts?.length || 0})
                      </h3>
                      {(!flagged.posts || flagged.posts.length === 0) ? (
                        <EmptyState icon={FileText} message="No flagged posts" small />
                      ) : (
                        <div className="space-y-2">
                          {flagged.posts.map((post) => (
                            <div key={post.id} className="rounded-2xl border border-border bg-card/30 p-4">
                              <div className="flex items-start gap-3">
                                <Avatar name={post.author?.username || post.username || 'Unknown'} src={post.author?.avatar || post.avatar} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-foreground">{post.author?.username || post.username || 'Unknown'}</span>
                                    <span className="text-xs text-muted-foreground">{formatTime(post.createdAt)}</span>
                                  </div>
                                  <p className="text-sm text-foreground/80 break-words mb-2">{post.content}</p>
                                  {post.imageUrl && (
                                    <img src={fileUrl(post.imageUrl)} alt="" className="max-h-40 rounded-lg object-cover mb-2" />
                                  )}
                                  {post.flagReason && (
                                    <span className="inline-block rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 mb-2">
                                      {post.flagReason}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="flex items-center gap-1.5 shrink-0 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Remove</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Review note modal */}
      <AnimatePresence>
        {moderationModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setModerationModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-foreground mb-1 capitalize">{moderationModal.action} user</h3>
              <p className="text-sm text-muted-foreground mb-4">This action is logged and users will be notified.</p>
              {(moderationModal.action === 'mute' || moderationModal.action === 'timeout') && (
                <input type="number" value={modMinutes} min={1} onChange={(e) => setModMinutes(Number(e.target.value || 1))}
                  className="mb-3 w-full rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-foreground outline-none"
                  placeholder="Duration in minutes" />
              )}
              <textarea
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="Reason shown to user..."
                className="w-full rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 resize-none h-24 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModerationModal(null)}
                  className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleModerate}
                  disabled={actionLoading === moderationModal.userId || !modReason.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 bg-primary hover:bg-primary/90">
                  {actionLoading === moderationModal.userId ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {reviewModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setReviewModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-foreground mb-1">
                {reviewModal.action === 'reviewed' ? 'Mark as Reviewed' : 'Dismiss Report'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Add an optional note for this action.</p>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Optional review note..."
                className="w-full rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 resize-none h-24 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setReviewModal(null)}
                  className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateReport(reviewModal.id, reviewModal.action, reviewNote || undefined)}
                  disabled={actionLoading === reviewModal.id}
                  className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50
                    ${reviewModal.action === 'reviewed' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-zinc-600 hover:bg-zinc-700'}`}>
                  {actionLoading === reviewModal.id ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Helper Components ── */

function StatCard({ icon: Icon, label, value, color, bg, accent }: {
  icon: any; label: string; value: number; color: string; bg: string; accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-card/30 p-5 transition-colors ${accent ? 'border-amber-500/30' : 'border-border'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value?.toLocaleString?.() ?? 0}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

function Avatar({ name, src, size = 'sm' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  if (src) {
    return <img src={fileUrl(src)} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} flex items-center justify-center rounded-full ${getAvatarColor(name)} ${textSize} font-bold text-white shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400',
    reviewed: 'bg-emerald-500/10 text-emerald-400',
    dismissed: 'bg-zinc-500/10 text-zinc-400',
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold capitalize ${styles[status] || 'bg-secondary text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-amber-500/10 text-amber-400',
    admin: 'bg-blue-500/10 text-blue-400',
    user: 'bg-secondary text-muted-foreground',
  };
  const icons: Record<string, any> = {
    owner: Crown,
    admin: Shield,
  };
  const Icon = icons[role];
  return (
    <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold capitalize ${styles[role] || styles.user}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {role}
    </span>
  );
}

function EmptyState({ icon: Icon, message, small }: { icon: any; message: string; small?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-border bg-card/30 ${small ? 'py-8' : 'py-16'}`}>
      <Icon className={`${small ? 'h-8 w-8' : 'h-12 w-12'} text-muted-foreground/30 mb-3`} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
