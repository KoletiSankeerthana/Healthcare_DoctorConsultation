export type ConsultationType = 'online' | 'in-person' | 'both';

export interface Doctor {
  id: string;
  name: string;
  title: string;
  avatar: string;
  specialty: string;
  specialtySlug: string;
  qualifications: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  consultationFee: number; // in INR
  consultationTypes: ('online' | 'in-person')[];
  languages: string[];
  clinic: {
    name: string;
    address: string;
    city: string;
    pincode: string;
  };
  registrationNumber: string;
  about: string;
  expertise: string[];
  availability: {
    nextAvailable: string;
    days: string[];
    slots: string[];
  };
  verified: boolean;
  featured?: boolean;
}

export interface Specialty {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  doctorCount: number;
  commonSymptoms: string[];
}

export interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar: string;
  patientName: string;
  patientEmail: string;
  date: string;
  time: string;
  type: 'online' | 'in-person';
  status: 'upcoming' | 'completed' | 'cancelled' | 'in-progress';
  fee: number;
  clinicName?: string;
  meetingLink?: string;
  prescriptionAvailable?: boolean;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorRegistration: string;
  patientName: string;
  date: string;
  diagnosis: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
  advice: string[];
  nextFollowUp?: string;
}

export interface MedicalRecord {
  id: string;
  title: string;
  date: string;
  type: 'Lab Report' | 'Prescription' | 'Clinical Notes' | 'Scan & Imaging';
  doctorOrLab: string;
  fileSize: string;
  status: 'Reviewed' | 'Pending Review';
  summary?: string;
}

export interface Testimonial {
  id: string;
  authorName: string;
  role: string;
  location: string;
  rating: number;
  comment: string;
  date: string;
  consultedFor: string;
  avatar: string;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: 'symptom-check' | 'report-analysis' | 'doctor-recommendation' | 'general';
  suggestedFollowUps?: string[];
  recommendedSpecialties?: string[];
  recommendedDoctors?: string[];
  assessmentDisclaimer?: boolean;
}
