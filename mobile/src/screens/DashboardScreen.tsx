import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StatusBar,
} from 'react-native';
import {
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  MapPin,
  Calendar,
  LogOut,
  Paperclip,
  ShieldAlert,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { fetchReporterTicketsApi } from '../services/api';
import { Ticket, TicketTab } from '../types';

interface Props {
  onOpenNewTicket: () => void;
  onSelectTicket: (ticketId: string) => void;
}

const STATUS_CONFIG: Record<string, { labelAr: string; bg: string; text: string }> = {
  SUBMITTED: { labelAr: 'تم الاستلام', bg: '#e0f2fe', text: '#0369a1' },
  UNDER_REVIEW: { labelAr: 'قيد المراجعة', bg: '#fef3c7', text: '#b45309' },
  ASSIGNED: { labelAr: 'محال للمتابعة', bg: '#e0e7ff', text: '#4338ca' },
  ASSIGNED_TO_HR: { labelAr: 'محال للموارد البشرية', bg: '#fae8ff', text: '#86198f' },
  RETURNED_TO_REPORTER: { labelAr: '⚠️ بانتظار ردك', bg: '#fee2e2', text: '#b91c1c' },
  RETURNED_TO_DEPARTMENT: { labelAr: 'معاد للإدارة', bg: '#ffedd5', text: '#c2410c' },
  PENDING_REMINDER: { labelAr: 'قيد التذكير', bg: '#f1f5f9', text: '#475569' },
  ESCALATED: { labelAr: 'مُصعّد للإدارة', bg: '#fce7f3', text: '#be185d' },
  CLOSED: { labelAr: '✅ مغلق ومكتمل', bg: '#dcfce7', text: '#15803d' },
  CLOSED_REJECTED: { labelAr: 'مرفوض', bg: '#f1f5f9', text: '#64748b' },
};

export const DashboardScreen: React.FC<Props> = ({ onOpenNewTicket, onSelectTicket }) => {
  const { user, logout } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TicketTab>('IN_PROGRESS');

  const loadTickets = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await fetchReporterTicketsApi(1, 100);
      const list = Array.isArray(data) ? data : data.tickets || [];
      setTickets(list);
    } catch (e) {
      console.error('Failed to load tickets:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Tab Filtering (Matching desktop behavior)
  const returnedCount = tickets.filter((t) => t.status === 'RETURNED_TO_REPORTER').length;
  const inProgressCount = tickets.filter(
    (t) =>
      ![
        'RETURNED_TO_REPORTER',
        'CLOSED',
        'CLOSED_REJECTED',
      ].includes(t.status)
  ).length;
  const closedCount = tickets.filter((t) =>
    ['CLOSED', 'CLOSED_REJECTED'].includes(t.status)
  ).length;

  const filteredTickets = tickets.filter((ticket) => {
    // 1. Tab condition
    if (activeTab === 'RETURNED' && ticket.status !== 'RETURNED_TO_REPORTER') return false;
    if (
      activeTab === 'IN_PROGRESS' &&
      ['RETURNED_TO_REPORTER', 'CLOSED', 'CLOSED_REJECTED'].includes(ticket.status)
    )
      return false;
    if (activeTab === 'CLOSED' && !['CLOSED', 'CLOSED_REJECTED'].includes(ticket.status))
      return false;

    // 2. Search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      const matchNo = ticket.ticketNo?.toLowerCase().includes(query);
      const matchDesc = ticket.description?.toLowerCase().includes(query);
      const matchWhat = ticket.offCircuitReport?.whatHappened?.toLowerCase().includes(query);
      const matchLoc = ticket.location?.toLowerCase().includes(query);
      return matchNo || matchDesc || matchWhat || matchLoc;
    }
    return true;
  });

  const renderTicketCard = ({ item }: { item: Ticket }) => {
    const statusCfg = STATUS_CONFIG[item.status] || {
      labelAr: item.status,
      bg: '#f1f5f9',
      text: '#475569',
    };
    const isUrgent = item.status === 'RETURNED_TO_REPORTER';

    return (
      <TouchableOpacity
        style={[styles.ticketCard, isUrgent && styles.urgentCard]}
        onPress={() => onSelectTicket(item.id)}
        activeOpacity={0.7}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.text }]}>
              {statusCfg.labelAr}
            </Text>
          </View>
          <Text style={styles.ticketNo}>{item.ticketNo}</Text>
        </View>

        {/* Title / Description */}
        <Text style={styles.ticketTitle} numberOfLines={2}>
          {item.offCircuitReport?.whatHappened || item.description || 'بلاغ ملاحظة سلامة'}
        </Text>

        {/* Warning if returned to reporter */}
        {isUrgent && (
          <View style={styles.urgentNotice}>
            <AlertCircle size={14} color="#b91c1c" />
            <Text style={styles.urgentNoticeText}>
              طلب المشرف معلومات إضافية منك. اضغط للرد والتوضيح.
            </Text>
          </View>
        )}

        {/* Card Footer / Metadata */}
        <View style={styles.cardFooter}>
          <ChevronLeft size={16} color="#94a3b8" />
          <View style={styles.metaRow}>
            {item.location && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.location}
                </Text>
                <MapPin size={12} color="#64748b" style={styles.metaIcon} />
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>
                {new Date(item.createdAt).toLocaleDateString('ar-SA')}
              </Text>
              <Calendar size={12} color="#64748b" style={styles.metaIcon} />
            </View>
            {item._count?.attachments ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>{item._count.attachments}</Text>
                <Paperclip size={12} color="#64748b" style={styles.metaIcon} />
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />

      {/* Top App Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
        <View style={styles.userProfile}>
          <Text style={styles.userName}>{user?.name || 'الموظف الميداني'}</Text>
          <View style={styles.userRoleBadge}>
            <Text style={styles.userRoleText}>المُبلّغ (Reporter)</Text>
          </View>
        </View>
      </View>

      {/* Action Button: Create New Ticket */}
      <TouchableOpacity
        style={styles.newReportButton}
        onPress={onOpenNewTicket}
        activeOpacity={0.85}
      >
        <Plus size={20} color="#ffffff" />
        <Text style={styles.newReportButtonText}>رفع بلاغ جديد (New Report)</Text>
      </TouchableOpacity>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{tickets.length}</Text>
          <Text style={styles.statLabel}>إجمالي بلاغاتي</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#38bdf8' }]}>{inProgressCount}</Text>
          <Text style={styles.statLabel}>قيد المعالجة</Text>
        </View>
        <View style={[styles.statCard, returnedCount > 0 && styles.statCardAlert]}>
          <Text
            style={[
              styles.statNum,
              { color: returnedCount > 0 ? '#ef4444' : '#94a3b8' },
            ]}
          >
            {returnedCount}
          </Text>
          <Text style={styles.statLabel}>تحتاج ردي</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#10b981' }]}>{closedCount}</Text>
          <Text style={styles.statLabel}>مغلقة ومكتملة</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <Search size={16} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث برقم البلاغ أو الوصف..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CLOSED' && styles.activeTabBtn]}
          onPress={() => setActiveTab('CLOSED')}
        >
          <Text
            style={[styles.tabBtnText, activeTab === 'CLOSED' && styles.activeTabText]}
          >
            المغلقة ({closedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'IN_PROGRESS' && styles.activeTabBtn]}
          onPress={() => setActiveTab('IN_PROGRESS')}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'IN_PROGRESS' && styles.activeTabText,
            ]}
          >
            قيد المعالجة ({inProgressCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'RETURNED' && styles.activeTabBtnAlert,
          ]}
          onPress={() => setActiveTab('RETURNED')}
        >
          {returnedCount > 0 && <View style={styles.tabBadgeDot} />}
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'RETURNED' && styles.activeTabTextAlert,
            ]}
          >
            تحتاج ردي ({returnedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tickets List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>جاري تحميل بلاغاتك...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicketCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTickets(true)}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={44} color="#334155" />
              <Text style={styles.emptyTitle}>لا توجد بلاغات في هذا التبويب</Text>
              <Text style={styles.emptyDesc}>
                يمكنك الضغط على زر "رفع بلاغ جديد" بالأعلى لتوثيق أي ملاحظة أمن أو سلامة.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 45,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  userProfile: {
    alignItems: 'flex-end',
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  userRoleBadge: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  userRoleText: {
    color: '#e0f2fe',
    fontSize: 10,
    fontWeight: '700',
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  newReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    marginHorizontal: 18,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  newReportButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 14,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statCardAlert: {
    borderColor: '#ef4444',
    backgroundColor: '#450a0a20',
  },
  statNum: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  searchWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'right',
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  activeTabBtn: {
    backgroundColor: '#1e293b',
  },
  activeTabBtnAlert: {
    backgroundColor: '#450a0a',
  },
  tabBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#38bdf8',
  },
  activeTabTextAlert: {
    color: '#ef4444',
  },
  tabBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  ticketCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  urgentCard: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNo: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ticketTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 8,
  },
  urgentNotice: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  urgentNoticeText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    marginRight: 2,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyDesc: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
