

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // For image previews
  file: File; // The actual file object
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
  attachments?: FileAttachment[]; 
}

export enum IncidentStatus {
  NUEVO = 'Nuevo',
  EN_PROGRESO = 'En Progreso',
  RESUELTO = 'Resuelto',
  CERRADO = 'Cerrado',
  PENDIENTE_INFO = 'Pendiente de Información',
}

export interface User {
  uid: string; // Firebase Authentication User ID
  email: string; // Primary identifier, e.g., user@kanguro.com
  name: string; // Display name
  role: 'admin' | 'user';
  // passwordHash is removed, Firebase Auth handles this.
}

export interface Incident {
  id: string; // Firestore document ID
  title: string;
  originalDescription: string;
  chatTranscript: ChatMessage[];
  llmSummary?: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  impact?: string;
  environment?: string; // e.g., Browser, OS
  attachments: FileAttachment[]; // Note: Storing large files directly in Firestore is not ideal. Consider Firebase Storage. For now, dataUrls for previews are fine.
  reportedBy: string; // User's UID
  assignedTo?: string; // User's UID
  createdAt: Date; // Or Firestore Timestamp
  updatedAt: Date; // Or Firestore Timestamp
  status: IncidentStatus;
  priority?: 'Baja' | 'Media' | 'Alta';
  llmSuggestedCategory?: string;
}


// For structured info extraction by LLM
export interface ExtractedBugInfo {
  title: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  impact: string;
  NombreDelReportador?: string; // LLM might still extract this, but primary reporter is from logged-in user
  environment?: string;
  suggestedCategory?: string;
  priority?: 'Baja' | 'Media' | 'Alta';
}