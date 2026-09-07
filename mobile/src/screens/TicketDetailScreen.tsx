import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  Paperclip,
  Send,
  FileText,
  User as UserIcon,
} from 'lucide-react-native';
import { fetchTicketDetailApi, replyToTicketApi } from '../services/api';
import { Ticket } from '../types';

interface Props {
  ticketId: string;
  onBack: () => void;
}

const STAGES = [
  { key: 'SUBMITTED', labelAr: 'تم الاستلام' },
  { key: 'UNDER_REVIEW', labelAr: 'قيد المراجعة' },
  { key: 'IN_PROGRESS', labelAr: 'جاري المعالجة' },
  { key: 'CLOSED', labelAr: 'مغلق ومكتمل' },
];

const getStageIndex = (status: string) => {
  if (status === 'SUBMITTED') return 0;
  if (status === 'UNDER_REVIEW') return 1;
  if (['ASSIGNED', 'ASSIGNED_TO_HR', 'RETURNED_TO_DEPARTMENT', 'PENDING_REMINDER', 'ESCALATED', 'RETURNED_TO_REPORTER'].includes(status)) return 2;
  if (['CLOSED', 'CLOSED_REJECTED'].includes(status)) return 3;
  return 0;
};

export const TicketDetailScreen: React.FC<Props> = ({ ticketId, onBack }) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [ticketId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await fetchTicketDetailApi(ticketId);
      setTicket(data);
    } catch (e: any) {
      Alert.alert('خطأ', 'تعذر تحميل تفاصيل البلاغ');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة الرد أو التوضيح المطلوب');
      return;
    }
    try {
      setReplying(true);
      await replyToTicketApi(ticketId, replyText.trim());
      Alert.alert('تم الإرسال', 'تم إرسال ردك إلى مراقب السلامة بنجاح.');
      setReplyText('');
      loadDetail();
    } catch (e: any) {
      Alert.alert('خطأ', e.response?.data?.message || 'تعذر إرسال الرد');
    } finally {
      setReplying(false);
    }
  };

  if (loading || !ticket) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل البلاغ...</Text>
      </View>
    );
  }

  const currentStage = getStageIndex(ticket.status);
  const isReturned = ticket.status === 'RETURNED_TO_REPORTER';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.ticketNo}>{ticket.ticketNo}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Status Stepper */}
        <View style={styles.stepperCard}>
          <Text style={styles.sectionHeading}>مراحل معالجة البلاغ:</Text>
          <View style={styles.stepperRow}>
            {STAGES.map((stage, idx) => {
              const isPassed = idx <= currentStage;
              const isCurrent = idx === currentStage;
              return (
                <View key={stage.key} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      isPassed && styles.stepCirclePassed,
                      isCurrent && styles.stepCircleCurrent,
                    ]}
                  >
                    {isPassed ? (
                      <CheckCircle2 size={16} color="#ffffff" />
                    ) : (
                      <Clock size={16} color="#64748b" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isPassed && styles.stepLabelPassed,
                      isCurrent && styles.stepLabelCurrent,
                    ]}
                  >
                    {stage.labelAr}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 2. Action Required Banner (If Returned to Reporter) */}
        {isReturned && (
          <View style={styles.actionRequiredCard}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>⚠️ مطلوب إجراء وتوضيح منك</Text>
              <AlertCircle size={18} color="#b91c1c" />
            </View>
            <Text style={styles.actionDesc}>
              قام مراقب السلامة بإعادة البلاغ لك لطلب استيضاح أو مستندات إضافية. يرجى كتابة الرد أدناه:
            </Text>

            <TextInput
              style={styles.replyInput}
              placeholder="اكتب ردك وتوضيحك هنا..."
              placeholderTextColor="#64748b"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.replyBtn, replying && styles.btnDisabled]}
              onPress={handleSendReply}
              disabled={replying}
            >
              {replying ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Text style={styles.replyBtnText}>إرسال الرد والتأكيد</Text>
                  <Send size={16} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Incident Overview Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>تفاصيل البلاغ:</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{ticket.type}</Text>
            <Text style={styles.infoLabel}>نوع الحادث:</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>
              {new Date(ticket.incidentDate || ticket.createdAt).toLocaleDateString('ar-SA')}
            </Text>
            <Text style={styles.infoLabel}>تاريخ الرصد:</Text>
          </View>

          {ticket.location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{ticket.location}</Text>
              <Text style={styles.infoLabel}>الموقع:</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: ticket.hasInjury ? '#ef4444' : '#10b981' }]}>
              {ticket.hasInjury ? 'نعم، توجد إصابات' : 'لا توجد إصابات'}
            </Text>
            <Text style={styles.infoLabel}>الإصابات:</Text>
          </View>
        </View>

        {/* 4. Description */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>وصف الحادث أو الملاحظة:</Text>
          <Text style={styles.descriptionText}>
            {ticket.offCircuitReport?.whatHappened || ticket.description || 'لا يوجد وصف إضافي.'}
          </Text>
        </View>

        {/* 5. Attachments */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>
              المرفقات والصور ({ticket.attachments.length}):
            </Text>
            {ticket.attachments.map((att) => (
              <View key={att.id} style={styles.attachmentItem}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {att.filename}
                </Text>
                <Paperclip size={16} color="#38bdf8" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 45,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  backBtn: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginLeft: 12,
  },
  ticketNo: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepperCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  sectionHeading: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCirclePassed: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  stepCircleCurrent: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8',
    transform: [{ scale: 1.1 }],
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepLabelPassed: {
    color: '#e2e8f0',
  },
  stepLabelCurrent: {
    color: '#38bdf8',
    fontWeight: '900',
  },
  actionRequiredCard: {
    backgroundColor: '#450a0a',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  actionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  actionTitle: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '900',
  },
  actionDesc: {
    color: '#fee2e2',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 12,
  },
  replyInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef444450',
    color: '#ffffff',
    padding: 12,
    fontSize: 13,
    textAlign: 'right',
    minHeight: 75,
    marginBottom: 10,
  },
  replyBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  replyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  descriptionText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
  attachmentItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  attachmentName: {
    color: '#e2e8f0',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
});
