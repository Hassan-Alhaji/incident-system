export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  uploadedAt: string;
  uploadedById?: string;
  uploadedBy?: { name: string };
}

export interface OffCircuitReport {
  id: string;
  incidentType: string;
  incidentDate: string;
  incidentTime?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  locationDescription?: string;
  whatHappened: string;
  hasInjury: boolean;
  isLateReport?: boolean;
  lateReportReason?: string;
  injuredPersons?: string;
  witnesses?: string;
  controllerNotes?: string;
}

export interface Ticket {
  id: string;
  ticketNo: string;
  type: string;
  status: string;
  priority: string;
  description: string;
  hasInjury: boolean;
  location?: string;
  incidentDate: string;
  incidentTime?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: { name: string; role: string };
  offCircuitReport?: OffCircuitReport;
  attachments?: Attachment[];
  zone?: { name: string };
  event?: { name: string };
  _count?: { attachments: number };
}

export type TicketTab = 'RETURNED' | 'IN_PROGRESS' | 'CLOSED';
