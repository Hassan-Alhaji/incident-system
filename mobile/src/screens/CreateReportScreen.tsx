import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowRight,
  Camera,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  X,
  Send,
  AlertTriangle,
  Shield,
  Flame,
  FileWarning,
  Check,
} from 'lucide-react-native';
import { createTicketApi, uploadTicketAttachmentApi, fetchZonesApi } from '../services/api';

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

const INCIDENT_TYPES = [
  { id: 'OBSERVATION', labelAr: 'ملاحظة عامة', icon: '👁️', color: '#0284c7' },
  { id: 'UNSAFE_CONDITION', labelAr: 'بيئة غير آمنة', icon: '⚠️', color: '#ea580c' },
  { id: 'UNSAFE_ACT', labelAr: 'تصرف غير آمن', icon: '🛑', color: '#dc2626' },
  { id: 'NEAR_MISS', labelAr: 'حادث وشيك', icon: '⚡', color: '#f59e0b' },
  { id: 'ACCIDENT', labelAr: 'حادث عمل', icon: '💥', color: '#b91c1c' },
  { id: 'SECURITY', labelAr: 'بلاغ أمني', icon: '🛡️', color: '#3b82f6' },
  { id: 'FIRE', labelAr: 'حريق / دخان', icon: '🔥', color: '#ef4444' },
];

export const CreateReportScreen: React.FC<Props> = ({ onBack, onSuccess }) => {
  // Form State
  const [incidentType, setIncidentType] = useState('OBSERVATION');
  const [whatHappened, setWhatHappened] = useState('');
  const [hasInjury, setHasInjury] = useState(false);
  const [locationDescription, setLocationDescription] = useState('');

  // GPS Location State
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // Photos State
  const [photos, setPhotos] = useState<string[]>([]);

  // Zones State
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    fetchAutoGpsLocation();
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const data = await fetchZonesApi();
      if (Array.isArray(data)) setZones(data);
    } catch {
      // Non-critical if zones fail to load
    }
  };

  // 1. Auto GPS Location Fetching
  const fetchAutoGpsLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه الإذن', 'يرجى تفعيل صلاحية الموقع لتحديد مكان الحادث تلقائياً.');
        setLocationLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = loc.coords;
      setLocationCoords({ lat: latitude, lng: longitude });

      // Reverse geocode to get friendly street address
      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverse && reverse.length > 0) {
          const r = reverse[0];
          const parts = [r.name, r.street, r.district, r.city].filter(Boolean);
          const addr = parts.join('، ');
          setLocationAddress(addr || `إحداثيات: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } else {
          setLocationAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      } catch {
        setLocationAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch (e: any) {
      console.error('Location error:', e);
      Alert.alert('تنبيه', 'تعذر جلب الموقع الجغرافي تلقائياً. يمكنك كتابة الموقع يدوياً.');
    } finally {
      setLocationLoading(false);
    }
  };

  // 2. Camera Image Picker
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الكاميرا', 'يرجى السماح للتطبيق بالوصول للكاميرا لالتقاط صورة الحادث.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e: any) {
      Alert.alert('خطأ', 'تعذر فتح الكاميرا');
    }
  };

  // 3. Gallery Image Picker
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الصور', 'يرجى السماح للتطبيق بالوصول للصور لاختيار صور من الألبوم.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const uris = result.assets.map((a) => a.uri);
        setPhotos((prev) => [...prev, ...uris]);
      }
    } catch (e: any) {
      Alert.alert('خطأ', 'تعذر اختيار الصور من الألبوم');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // 4. Submit Incident Report
  const handleSubmit = async () => {
    if (!whatHappened.trim()) {
      Alert.alert('حقل مطلوب', 'يرجى كتابة وصف موجز لما حدث في الحادث أو الملاحظة.');
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress('جاري تسجيل بيانات البلاغ...');

      const now = new Date();
      const incidentDate = now.toISOString().split('T')[0];
      const incidentTime = now.toTimeString().slice(0, 5);

      const payload = {
        incidentType,
        incidentDate,
        incidentTime,
        whatHappened: whatHappened.trim(),
        hasInjury,
        locationLat: locationCoords?.lat || null,
        locationLng: locationCoords?.lng || null,
        locationAddress: locationAddress || 'موقع محدد عبر الجوال',
        locationDescription: locationDescription.trim() || null,
        zoneId: selectedZoneId || null,
      };

      const created = await createTicketApi(payload);
      const ticketId = created.id;
      const ticketNo = created.ticketNo;

      // Upload photos if any
      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          setUploadProgress(`جاري رفع الصورة (${i + 1} من ${photos.length})...`);
          try {
            await uploadTicketAttachmentApi(
              ticketId,
              photos[i],
              `mobile_incident_${i + 1}.jpg`
            );
          } catch (uploadErr) {
            console.warn('Failed to upload image:', uploadErr);
          }
        }
      }

      Alert.alert(
        'تم رفع البلاغ بنجاح! 🎉',
        `رقم البلاغ: ${ticketNo}\nتم إرسال البلاغ لغرفة عمليات السلامة والأمن للمتابعة.`,
        [{ text: 'موافق', onPress: onSuccess }]
      );
    } catch (e: any) {
      const msg = e.response?.data?.message || 'تعذر إرسال البلاغ. يرجى المحاولة مجدداً.';
      Alert.alert('خطأ في الإرسال', msg);
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} disabled={submitting}>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>رفع تقرير / بلاغ ميداني جديد</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 1. Auto GPS Location Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.refreshLocBtn}
              onPress={fetchAutoGpsLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : (
                <RefreshCw size={14} color="#38bdf8" />
              )}
            </TouchableOpacity>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>موقع الحادث (GPS تلقائي)</Text>
              <MapPin size={16} color="#38bdf8" />
            </View>
          </View>

          <View style={styles.locationBox}>
            <Text style={styles.locationAddressText}>
              {locationAddress || (locationLoading ? 'جاري تحديد إحداثيات موقعك...' : 'اضغط على التحديث لتحديد الموقع')}
            </Text>
            {locationCoords && (
              <Text style={styles.coordsText}>
                الإحداثيات: {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
              </Text>
            )}
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="تفاصيل إضافية للموقع (مثال: بالقرب من البوابة 4، الدور الأول...)"
            placeholderTextColor="#64748b"
            value={locationDescription}
            onChangeText={setLocationDescription}
          />
        </View>

        {/* 2. Photos & Attachments */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>صور ومرفقات الحادث (الكاميرا / المعرض)</Text>
            <ImageIcon size={16} color="#38bdf8" />
          </View>

          <View style={styles.mediaButtonsRow}>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <Camera size={18} color="#ffffff" />
              <Text style={styles.mediaBtnText}>التقاط بالكاميرا</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaBtn, { backgroundColor: '#1e293b' }]}
              onPress={handlePickFromGallery}
              activeOpacity={0.7}
            >
              <ImageIcon size={18} color="#38bdf8" />
              <Text style={[styles.mediaBtnText, { color: '#38bdf8' }]}>من الألبوم</Text>
            </TouchableOpacity>
          </View>

          {/* Photo Previews */}
          {photos.length > 0 && (
            <ScrollView horizontal style={styles.photosScroll} showsHorizontalScrollIndicator={false}>
              {photos.map((uri, idx) => (
                <View key={idx} style={styles.photoThumbWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => handleRemovePhoto(idx)}
                  >
                    <X size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* 3. Incident Type Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>تصنيف ونوع البلاغ:</Text>
          <View style={styles.typesGrid}>
            {INCIDENT_TYPES.map((type) => {
              const isSelected = incidentType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeChip,
                    isSelected && { borderColor: type.color, backgroundColor: `${type.color}20` },
                  ]}
                  onPress={() => setIncidentType(type.id)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[styles.typeText, isSelected && { color: '#ffffff', fontWeight: '800' }]}>
                    {type.labelAr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. What Happened? (Description) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ماذا حدث؟ (وصف الحادث أو الملاحظة) *</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            placeholder="اشرح ما شاهدته بوضوح (الأسباب المحتملة، الأشخاص المعنيين، والمخاطر المباشرة)..."
            placeholderTextColor="#64748b"
            value={whatHappened}
            onChangeText={setWhatHappened}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 5. Has Injury Switch */}
        <View style={[styles.sectionCard, styles.switchCard]}>
          <Switch
            value={hasInjury}
            onValueChange={setHasInjury}
            trackColor={{ false: '#334155', true: '#ef4444' }}
            thumbColor={hasInjury ? '#ffffff' : '#94a3b8'}
          />
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchTitle}>هل توجد إصابات بشرية؟</Text>
            <Text style={styles.switchDesc}>فعّل هذا الخيار إذا نتج عن الحادث أي إصابة لأي شخص.</Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.submitBtnText}>{uploadProgress || 'جاري الإرسال...'}</Text>
            </View>
          ) : (
            <View style={styles.submitRow}>
              <Send size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>إرسال البلاغ الآن 🚀</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  refreshLocBtn: {
    padding: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  locationBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  locationAddressText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 18,
  },
  coordsText: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    padding: 12,
    fontSize: 13,
    textAlign: 'right',
  },
  multilineInput: {
    minHeight: 90,
    marginTop: 8,
  },
  mediaButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 10,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  mediaBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  photosScroll: {
    marginTop: 12,
    flexDirection: 'row-reverse',
  },
  photoThumbWrapper: {
    position: 'relative',
    marginLeft: 10,
  },
  photoThumb: {
    width: 74,
    height: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  typeChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  typeIcon: {
    fontSize: 14,
  },
  typeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  switchTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  switchDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
  },
  submitBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  submittingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
