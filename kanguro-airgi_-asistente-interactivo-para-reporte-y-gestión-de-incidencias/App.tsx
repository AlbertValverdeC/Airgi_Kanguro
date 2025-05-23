
import React, { useState, useEffect, useCallback } from 'react';
// Fix: Use default import for ReportIncidentController
import ReportIncidentController from './components/ReportIncidentController';
import IncidentManagementView from './components/IncidentManagementView';
import LoginView from './components/LoginView';
import UserManagementView from './components/UserManagementView'; 
import { Incident, IncidentStatus, User as AppUser, FileAttachment, ChatMessage } from './types'; // Renamed User to AppUser to avoid conflict
import { initializeGemini, isGeminiAvailable } from './services/geminiService';
import { API_KEY_ERROR_MESSAGE, KANGURO_LOGO_URL, BRAND_BLUE, ADMIN_EMAIL } from './constants';
import { PlusCircleIcon, ExclamationTriangleIcon, KanguroLogo, ChatBubbleLeftEllipsisIcon, QueueListIcon, ArrowRightOnRectangleIcon, UsersIcon, InboxArrowDownIcon } from './components/Icons';
import { auth, db, firebaseInitializationError as rawFirebaseError } from './firebase'; // Firebase instances & initialization error
import { 
  onAuthStateChanged, 
  User as FirebaseUser, // Firebase Auth user type
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
// Import Firestore functions directly from the CDN module
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

type View = 'login' | 'report-welcome' | 'report-chat' | 'dashboard-reported' | 'dashboard-received' | 'admin-users';

interface WelcomeViewProps {
  initialDescription: string;
  onInitialDescriptionChange: (value: string) => void;
  onStartReport: () => void;
  apiKeyError: string | null;
  geminiAvailable: boolean;
  currentUser: AppUser; 
}

const WelcomeView: React.FC<WelcomeViewProps> = ({
  initialDescription,
  onInitialDescriptionChange,
  onStartReport,
  apiKeyError,
  geminiAvailable,
  currentUser
}) => (
  <div className="flex-grow flex flex-col items-center justify-center p-4 text-center overflow-y-auto">
    <KanguroLogo imageUrl={KANGURO_LOGO_URL} height={48} className="mb-4 mt-2" />
    <h1 className="text-xl font-bold text-slate-800 mb-1">
      Bienvenido a AIRGI, {currentUser.name.split(' ')[0]}
    </h1>
    <p className="text-sm text-slate-600 mb-6 max-w-xs">
      Asistente para Reporte y Gestión de Incidencias.
    </p>

    {apiKeyError && !geminiAvailable && (
      <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs flex items-start max-w-xs mx-auto">
        <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 text-red-500" />
        <span><strong className="font-semibold">Error:</strong> {apiKeyError} El asistente IA no estará disponible.</span>
      </div>
    )}

    <div className="w-full max-w-xs bg-white p-4 rounded-xl shadow-lg">
      <label htmlFor="initialDescription" className="block text-xs font-medium text-slate-700 mb-1.5 text-left">
        Describe brevemente el problema:
      </label>
      <textarea
        id="initialDescription"
        value={initialDescription}
        onChange={(e) => onInitialDescriptionChange(e.target.value)}
        placeholder="Ej: No puedo guardar el informe..."
        className="w-full p-2.5 bg-white text-slate-800 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:border-transparent mb-4 min-h-[80px] text-xs placeholder-slate-400"
        rows={3}
        style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE, outlineWidth: '0px', outlineOffset: '0px', boxShadow: `0 0 0 0px ${BRAND_BLUE}` }}
        onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
        onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
      />
      <button
        onClick={onStartReport}
        disabled={!initialDescription.trim() || !geminiAvailable}
        className="w-full font-semibold py-2.5 px-3 rounded-lg shadow-md transition-colors text-white flex items-center justify-center text-sm disabled:opacity-60"
        style={{ backgroundColor: (!initialDescription.trim() || !geminiAvailable) ? '#9DB2BF' : BRAND_BLUE }}
      >
        <PlusCircleIcon className="w-4 h-4 mr-2" />
        Reportar con IA
      </button>
    </div>
  </div>
);

interface NavItem {
  view: View;
  label: string;
  icon: React.FC<{ className?: string }>;
  count?: number;
}

interface BottomNavigationBarProps {
  currentView: View;
  onSetCurrentView: (view: View) => void;
  reportedIncidentCount: number;
  receivedIncidentCount: number;
  currentUser: AppUser | null;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ currentView, onSetCurrentView, reportedIncidentCount, receivedIncidentCount, currentUser }) => {
  if (!currentUser) return null; 

  const navItemsBase: NavItem[] = [
    { view: 'report-welcome' as View, label: 'Reportar', icon: ChatBubbleLeftEllipsisIcon },
    { view: 'dashboard-reported' as View, label: 'Reportadas', icon: QueueListIcon, count: reportedIncidentCount },
    { view: 'dashboard-received' as View, label: 'Recibidas', icon: InboxArrowDownIcon, count: receivedIncidentCount },
  ];

  const adminNavItem: NavItem = { view: 'admin-users' as View, label: 'Admin', icon: UsersIcon };

  const navItems: NavItem[] = currentUser.role === 'admin' ? [...navItemsBase, adminNavItem] : navItemsBase;

  return (
    <nav className="w-full bg-white border-t border-slate-200 shadow-top z-50 mt-auto rounded-b-lg">
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => {
          const isActive = item.view === 'report-welcome' 
            ? (currentView === 'report-welcome' || currentView === 'report-chat') 
            : currentView === item.view;
          return (
            <button
              key={item.label}
              onClick={() => onSetCurrentView(item.view)}
              className={`flex flex-col items-center justify-center p-1 rounded-md transition-colors w-full h-full ${ 
                isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium">{item.label} {item.count !== undefined && item.count > 0 ? `(${item.count})` : ''}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  const [firebaseInitError, setFirebaseInitError] = useState<string | null>(rawFirebaseError);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]); // Stores all user profiles from Firestore
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('login');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [initialDescriptionForReport, setInitialDescriptionForReport] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [geminiInitialized, setGeminiInitialized] = useState(false);
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null); // Firestore document ID
  const [dataLoading, setDataLoading] = useState(true);


  // Gemini API Key Initialization
  useEffect(() => {
    const key = process.env.API_KEY;
    if (key) {
      setApiKey(key);
      const initialized = initializeGemini(key);
      setGeminiInitialized(initialized);
      if (!initialized) setApiKeyError(API_KEY_ERROR_MESSAGE);
    } else {
      setApiKeyError(API_KEY_ERROR_MESSAGE);
      setGeminiInitialized(false);
    }
  }, []);

  // Firebase Auth State Listener
  useEffect(() => {
    if (firebaseInitError) {
      setAuthLoading(false);
      setDataLoading(false);
      setCurrentUser(null);
      setCurrentView('login');
      return;
    }
    if (!auth) { 
        setFirebaseInitError("Módulo Firebase Auth no disponible. La inicialización pudo haber fallado.");
        setAuthLoading(false);
        setDataLoading(false);
        setCurrentUser(null);
        setCurrentView('login');
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        if (!db) {
            setFirebaseInitError("Módulo Firebase Firestore no disponible. La inicialización pudo haber fallado.");
            setAuthLoading(false);
            setDataLoading(false);
            await signOut(auth); // Log out if db is not available
            return;
        }
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as Omit<AppUser, 'uid'>;
            setCurrentUser({ uid: firebaseUser.uid, ...userData });
            setCurrentView('report-welcome');
            setLoginError(null); // Clear login error on successful login/auth state change
          } else {
            console.error("User document not found in Firestore for UID:", firebaseUser.uid);
            await signOut(auth); 
            setCurrentUser(null);
            setCurrentView('login');
            setLoginError("No se encontró el perfil de usuario. Contacte al administrador.");
          }
        } catch (error) {
            console.error("Error fetching user data from Firestore:", error);
            setFirebaseInitError(`Error al obtener datos de usuario: ${(error as Error).message}`);
            await signOut(auth);
            setCurrentUser(null);
            setCurrentView('login');
        }
      } else {
        setCurrentUser(null);
        setCurrentView('login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [firebaseInitError]);

  // Fetch all users (for admin panel and assignee selection)
   useEffect(() => {
    if (firebaseInitError || !currentUser) { 
      setDataLoading(!!currentUser); 
      return;
    }
    if (!db) {
        setFirebaseInitError("Módulo Firebase Firestore no disponible para cargar usuarios.");
        setDataLoading(false);
        return;
    }
    setDataLoading(true);
    const usersCollectionRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
      const usersList = snapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() } as AppUser));
      setAllUsers(usersList);
      setDataLoading(false);
    }, (error) => {
      console.error("Error fetching all users:", error);
      setFirebaseInitError(`Error al obtener lista de usuarios: ${(error as Error).message}`);
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, firebaseInitError]);


  // Fetch incidents (real-time)
  useEffect(() => {
    if (firebaseInitError || !currentUser) { 
        setDataLoading(!!currentUser);
        return;
    }
    if (!db) {
        setFirebaseInitError("Módulo Firebase Firestore no disponible para cargar incidencias.");
        setDataLoading(false);
        return;
    }
    setDataLoading(true);
    const incidentsCollectionRef = collection(db, "incidents");
    const q = query(incidentsCollectionRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidentsList = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Ensure all timestamps are converted to Date objects
        const convertTimestampToDate = (timestamp: any): Date => {
          if (!timestamp) return new Date(); // Should not happen with serverTimestamp
          if (timestamp instanceof Timestamp) return timestamp.toDate();
          if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate(); // For older SDK or slight variations
          if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
          // If it's an object with seconds/nanoseconds (common Firestore Timestamp structure)
          if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
            return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
          }
          console.warn("Unrecognized timestamp format, using current date as fallback:", timestamp);
          return new Date(); // Fallback, though ideally this shouldn't be hit
        };
        
        return {
          ...data,
          id: docSnap.id,
          createdAt: convertTimestampToDate(data.createdAt),
          updatedAt: convertTimestampToDate(data.updatedAt),
          chatTranscript: (data.chatTranscript || []).map((msg: any) => ({
            ...msg,
            timestamp: convertTimestampToDate(msg.timestamp)
          }))
        } as Incident;
      });
      setIncidents(incidentsList);
      setDataLoading(false);
    }, (error) => {
      console.error("Error fetching incidents:", error);
      setFirebaseInitError(`Error al obtener incidencias: ${(error as Error).message}`);
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, firebaseInitError]);


  const handleLogin = async (emailInput: string, pass: string) => {
    if (firebaseInitError) {
        setLoginError(`Error de Firebase: ${firebaseInitError}`);
        setAuthLoading(false);
        return;
    }
    if (!auth) {
        setLoginError("Firebase Auth no está disponible.");
        setAuthLoading(false);
        return;
    }
    setAuthLoading(true);
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, emailInput, pass);
      // onAuthStateChanged will handle setting currentUser and view
    } catch (error: any) {
      setLoginError(error.message.includes("auth/invalid-credential") || error.message.includes("auth/user-not-found") || error.message.includes("auth/wrong-password") ? "Email o contraseña incorrectos." : "Error de inicio de sesión.");
      console.error("Login error:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelfRegisterUser = async (name: string, email: string, pass: string) => {
    if (firebaseInitError || !db || !auth) {
        throw new Error(`Firebase no está disponible. ${firebaseInitError || ''}`);
    }
    setAuthLoading(true);
    setLoginError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDataForFirestore = {
        name: name,
        email: email.toLowerCase(),
        role: 'user' as 'user' | 'admin', 
      };
      await setDoc(userDocRef, userDataForFirestore);
    } catch (error: any) {
      console.error("Self-registration error:", error);
      let errorMessage = "Error durante el registro.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este email ya está registrado. Intenta iniciar sesión.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "La contraseña es demasiado débil.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Error de red. Verifica tu conexión y la configuración de Firebase (dominios autorizados).";
      }
      setLoginError(errorMessage); 
      throw new Error(errorMessage); 
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) {
        console.error("Firebase Auth no disponible para cerrar sesión.");
        return;
    }
    try {
      await signOut(auth);
      setInitialDescriptionForReport('');
      setEditingIncidentId(null);
      setIncidents([]); 
      setAllUsers([]); 
      setLoginError(null); 
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleAddUser = async (newUserData: Omit<AppUser, 'uid' | 'role'> & { email: string, password?: string, role: 'admin' | 'user' }) => {
    if (firebaseInitError || !db || !auth) {
        throw new Error(`Firebase no inicializado. ${firebaseInitError || ''}`);
    }
    if (!newUserData.password) throw new Error("La contraseña es obligatoria para nuevos usuarios.");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newUserData.email, newUserData.password);
      const firebaseUser = userCredential.user;
      console.log(`✅ Firebase Auth user created successfully (by admin): ${firebaseUser.uid} (Email: ${firebaseUser.email})`);

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDataForFirestore = {
        name: newUserData.name,
        email: newUserData.email.toLowerCase(), 
        role: newUserData.role,
      };
      await setDoc(userDocRef, userDataForFirestore);
      console.log(`✅ Firestore user record created successfully for ${firebaseUser.uid}:`, userDataForFirestore);
      
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            console.error("Error adding user: Email already in use in Firebase Auth.", error);
            throw new Error("Este email ya está registrado en Firebase Authentication.");
        }
        console.error("❌ Error adding user:", error);
        throw new Error(error.message || "Error desconocido al crear usuario.");
    }
  };

  const handleEditUser = async (uid: string, updatedData: Partial<Omit<AppUser, 'uid' | 'email'>>) => {
    if (firebaseInitError || !db) {
        throw new Error(`Firebase no inicializado. ${firebaseInitError || ''}`);
    }
    const userDocRef = doc(db, "users", uid);
    try {
      await updateDoc(userDocRef, updatedData);
      if (currentUser && currentUser.uid === uid) {
        setCurrentUser(prev => prev ? { ...prev, ...updatedData } : null);
      }
    } catch (error:any) {
        console.error("Error editing user:", error);
        throw new Error(error.message || "Error al editar usuario.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (firebaseInitError || !db) {
        throw new Error(`Firebase no inicializado. ${firebaseInitError || ''}`);
    }
    if (currentUser && uid === currentUser.uid) throw new Error("No puedes eliminarte a ti mismo.");
    
    const userToDelete = allUsers.find(u => u.uid === uid);
    if (userToDelete && userToDelete.email === ADMIN_EMAIL && allUsers.filter(u=>u.role === 'admin').length <= 1) {
        throw new Error("No puedes eliminar al administrador principal si es el único.");
    }
    const userDocRef = doc(db, "users", uid);
    try {
      await deleteDoc(userDocRef);
      console.log(`User ${uid} deleted from Firestore 'users' collection.`);
    } catch (error: any) {
      console.error("Error deleting user from Firestore:", error);
      throw new Error(error.message || "Error al eliminar datos de usuario.");
    }
  };
  
  const sanitizeAttachmentsForFirestore = (attachments?: FileAttachment[]): (Omit<FileAttachment, 'file' | 'dataUrl'> & { dataUrl?: string })[] => {
    if (!attachments || attachments.length === 0) return [];
    return attachments.map(({ file, dataUrl, ...restOfAttachment }) => {
        const cleanedAttachment: Omit<FileAttachment, 'file' | 'dataUrl'> & { dataUrl?: string } = { ...restOfAttachment };
        if (typeof dataUrl === 'string' && dataUrl.trim() !== '') { 
            cleanedAttachment.dataUrl = dataUrl;
        }
        return cleanedAttachment;
    });
  };

  const toFirestoreChatMessage = (msg: ChatMessage): Omit<ChatMessage, 'attachments' | 'timestamp'> & { timestamp: Timestamp; attachments?: any[] } => {
    const { attachments, timestamp, ...restOfMessage } = msg;
    return {
      ...restOfMessage,
      timestamp: Timestamp.fromDate(new Date(timestamp)),
      attachments: sanitizeAttachmentsForFirestore(attachments),
    };
  };

  const handleSaveIncident = useCallback(
    async (
      incidentData: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<Incident> => {
      
      if (firebaseInitError || !currentUser || !db) {
        const errorMsg = `No se puede guardar la incidencia: ${firebaseInitError ? `Error Firebase: ${firebaseInitError}` : !currentUser ? 'Usuario no autenticado.' : 'Base de datos no disponible.'}`;
        console.error(errorMsg, { firebaseInitError, db: !!db, currentUser: !!currentUser });
        throw new Error(errorMsg);
      }

      const firestoreChatTranscript = incidentData.chatTranscript.map(toFirestoreChatMessage);
      const firestoreAttachments = sanitizeAttachmentsForFirestore(incidentData.attachments);

      const dataToSave: any = {
        title: incidentData.title,
        originalDescription: incidentData.originalDescription,
        chatTranscript: firestoreChatTranscript,
        attachments: firestoreAttachments,
        reportedBy: editingIncidentId ? incidentData.reportedBy : currentUser.uid,
        status: incidentData.status || IncidentStatus.NUEVO,
      };

      if (incidentData.llmSummary) dataToSave.llmSummary = incidentData.llmSummary;
      if (incidentData.stepsToReproduce) dataToSave.stepsToReproduce = incidentData.stepsToReproduce;
      if (incidentData.expectedBehavior) dataToSave.expectedBehavior = incidentData.expectedBehavior;
      if (incidentData.actualBehavior) dataToSave.actualBehavior = incidentData.actualBehavior;
      if (incidentData.impact) dataToSave.impact = incidentData.impact;
      if (incidentData.environment) dataToSave.environment = incidentData.environment;
      if (incidentData.assignedTo) dataToSave.assignedTo = incidentData.assignedTo;
      if (incidentData.priority) dataToSave.priority = incidentData.priority;
      if (incidentData.llmSuggestedCategory) dataToSave.llmSuggestedCategory = incidentData.llmSuggestedCategory;
      
      let finalIncidentData: Incident;

      try {
        if (editingIncidentId) { 
          const incidentDocRef = doc(db, "incidents", editingIncidentId);
          dataToSave.updatedAt = serverTimestamp();
          
          console.log("🔎 Payload for UPDATE (with serverTimestamp values):", dataToSave);
          await updateDoc(incidentDocRef, dataToSave);
          
          const updatedDocSnap = await getDoc(incidentDocRef); 
          if (!updatedDocSnap.exists()) throw new Error("Failed to fetch updated incident after save.");
          const savedData = updatedDocSnap.data();
          console.log("Raw saved data from Firestore (UPDATE):", savedData);

          finalIncidentData = { 
              ...savedData,
              id: editingIncidentId, 
              createdAt: (savedData.createdAt as Timestamp).toDate(),
              updatedAt: (savedData.updatedAt as Timestamp).toDate(),
              chatTranscript: (savedData.chatTranscript || []).map((msg: ChatMessage) => ({
                ...msg,
                timestamp: (msg.timestamp as unknown as Timestamp).toDate() 
             }))
          } as Incident;

        } else { 
          dataToSave.createdAt = serverTimestamp(); 
          dataToSave.updatedAt = serverTimestamp();
          
          console.log("🔎 Payload for ADD (with serverTimestamp values):", dataToSave);
          const incidentsCollectionRef = collection(db, "incidents");
          const incidentDocRef = await addDoc(incidentsCollectionRef, dataToSave);

          const newDocSnap = await getDoc(incidentDocRef); 
           if (!newDocSnap.exists()) throw new Error("Failed to fetch new incident after save.");
          const savedData = newDocSnap.data();
          console.log("Raw saved data from Firestore (ADD):", savedData);


          finalIncidentData = { 
            ...savedData,
            id: incidentDocRef.id,
            createdAt: (savedData.createdAt as Timestamp).toDate(),
            updatedAt: (savedData.updatedAt as Timestamp).toDate(),
            chatTranscript: (savedData.chatTranscript || []).map((msg: ChatMessage) => ({
                ...msg,
                timestamp: (msg.timestamp as unknown as Timestamp).toDate() 
             }))
          } as Incident;
        }
        console.log("Finalized incident data to be returned from handleSaveIncident:", finalIncidentData);
        return finalIncidentData;
      } catch (error: any) {
        console.error("❌ Error saving incident to Firestore:", error);
        throw error; 
      }
    },
    [editingIncidentId, currentUser, db, firebaseInitError] 
  );

  const handleCancelReportOrCloseChat = useCallback(() => {
    setCurrentView('dashboard-reported'); 
    setInitialDescriptionForReport('');
    setEditingIncidentId(null);
  }, []);

  const handleUpdateIncidentStatus = useCallback(async (incidentId: string, status: IncidentStatus) => {
    if (firebaseInitError || !db) {
        console.error("No se puede actualizar estado: Firebase no está listo.", { firebaseInitError, db: !!db });
        return;
    }
    const incidentDocRef = doc(db, "incidents", incidentId);
    try {
      await updateDoc(incidentDocRef, { status, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error("Error updating incident status:", error);
    }
  }, [db, firebaseInitError]); 

  const handleDeleteIncident = useCallback(async (incidentId: string) => {
    if (firebaseInitError || !db || !currentUser) {
         console.error("No se puede eliminar incidencia: Firebase no está listo o usuario no conectado.", { firebaseInitError, db: !!db, currentUser: !!currentUser });
        return;
    }
    const incidentToDelete = incidents.find(inc => inc.id === incidentId);
    if (!incidentToDelete) return;

    if (currentUser.role !== 'admin' && incidentToDelete.reportedBy !== currentUser.uid) { 
        alert("No tienes permiso para eliminar esta incidencia."); return; 
    }
    if (window.confirm("¿Estás seguro de que quieres eliminar esta incidencia? Esta acción no se puede deshacer.")) {
      const incidentDocRef = doc(db, "incidents", incidentId);
      try {
        await deleteDoc(incidentDocRef);
      } catch (error) {
        console.error("Error deleting incident:", error);
      }
    }
  }, [currentUser, incidents, db, firebaseInitError]); 

  const incidentToEdit = editingIncidentId ? incidents.find(inc => inc.id === editingIncidentId) : undefined;
  
  const reportedIncidentsCount = incidents.filter(inc => currentUser && (currentUser.role === 'admin' || inc.reportedBy === currentUser.uid)).length;
  const receivedIncidentsCount = incidents.filter(inc => currentUser && inc.assignedTo === currentUser.uid).length;


  if (firebaseInitError && !authLoading) {
    let detailedErrorMessage = firebaseInitError;
    if (firebaseInitError.includes("Could not reach Cloud Firestore backend") || firebaseInitError.includes("network-request-failed")) {
        detailedErrorMessage += "\n\nEsto usualmente indica un problema de conexión a internet o una configuración incorrecta de Firebase para esta extensión (revisa los dominios autorizados en la consola de Firebase).";
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-slate-100 text-xs">
        <KanguroLogo imageUrl={KANGURO_LOGO_URL} height={56} className="mb-5" />
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">Error Crítico</h1>
        <p className="text-sm text-slate-600 mb-1">No se pudo conectar con los servicios de Firebase.</p>
        <div className="text-xs text-red-700 bg-red-100 p-2 rounded-md max-w-md text-center mb-2 whitespace-pre-wrap">
            {detailedErrorMessage.split('\n').map((line, i) => <p key={i}>{line}</p>)}
        </div>
        <p className="text-[10px] text-slate-500">Por favor, verifica tu conexión a internet, la configuración de Firebase y la consola del navegador para más detalles. Intenta recargar la aplicación.</p>
      </div>
    );
  }

  const renderCurrentView = () => {
    if (authLoading || (currentUser && dataLoading && !firebaseInitError)) { 
      return <div className="flex-grow flex items-center justify-center"><p>Cargando...</p></div>;
    }
    if (!currentUser && !authLoading && !firebaseInitError) { 
      return <LoginView onLogin={handleLogin} onRegister={handleSelfRegisterUser} loginError={loginError} isLoading={authLoading} />;
    }
    if (!currentUser && !firebaseInitError) { 
         return <div className="flex-grow flex items-center justify-center"><p>Cargando sesión...</p></div>;
    }
    if (!currentUser && firebaseInitError) { 
      return <LoginView onLogin={handleLogin} onRegister={handleSelfRegisterUser} loginError={firebaseInitError} isLoading={false} />;
    }
    if(!currentUser) return null; 


    switch (currentView) {
      case 'report-welcome':
        return <WelcomeView initialDescription={initialDescriptionForReport} onInitialDescriptionChange={setInitialDescriptionForReport} onStartReport={handleStartReport} apiKeyError={apiKeyError} geminiAvailable={geminiInitialized && isGeminiAvailable()} currentUser={currentUser} />;
      case 'report-chat':
        if (initialDescriptionForReport || incidentToEdit) {
          return <ReportIncidentController initialDescription={initialDescriptionForReport} existingIncident={incidentToEdit} onSaveIncident={handleSaveIncident} onCancel={handleCancelReportOrCloseChat} apiKeyAvailable={!!apiKey && geminiInitialized} currentUser={currentUser} users={allUsers} />;
        }
        setCurrentView('report-welcome'); return null; 
      case 'dashboard-reported':
        return <IncidentManagementView incidents={incidents} currentUser={currentUser} users={allUsers} onUpdateIncidentStatus={handleUpdateIncidentStatus} onDeleteIncident={handleDeleteIncident} onStartEditReport={handleStartEditReport} onNavigateToReportScreen={() => setCurrentView('report-welcome')} mode="reported" />;
      case 'dashboard-received':
        return <IncidentManagementView incidents={incidents} currentUser={currentUser} users={allUsers} onUpdateIncidentStatus={handleUpdateIncidentStatus} onDeleteIncident={handleDeleteIncident} onStartEditReport={handleStartEditReport} onNavigateToReportScreen={() => setCurrentView('report-welcome')} mode="received" />;
      case 'admin-users':
        if (currentUser.role === 'admin') {
          return <UserManagementView users={allUsers} currentUser={currentUser} onAddUser={handleAddUser} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} onClose={() => setCurrentView('dashboard-reported')} />;
        }
        setCurrentView('dashboard-reported'); return null; 
      default: 
        return <LoginView onLogin={handleLogin} onRegister={handleSelfRegisterUser} loginError={loginError} isLoading={authLoading} />;
    }
  };

  const handleStartReport = () => {
    if (!initialDescriptionForReport.trim()) { alert("Por favor, describe brevemente tu problema para iniciar."); return; }
    if (!geminiInitialized && !isGeminiAvailable()) { alert(API_KEY_ERROR_MESSAGE + "\nNo se puede iniciar el asistente IA."); return; }
    setEditingIncidentId(null); 
    setCurrentView('report-chat');
  };

  const handleStartEditReport = (incidentId: string) => {
    const incidentToEditFound = incidents.find(inc => inc.id === incidentId);
    if (!currentUser || !incidentToEditFound) return;
    if (currentUser.role !== 'admin' && incidentToEditFound.reportedBy !== currentUser.uid) { 
      alert("No tienes permiso para editar esta incidencia."); return; 
    }
    setEditingIncidentId(incidentId);
    setInitialDescriptionForReport(incidentToEditFound.originalDescription || "Editando incidencia existente");
    setCurrentView('report-chat');
  };

  return (
    <>
      {currentUser && !firebaseInitError && ( 
        <header className="p-2.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center sticky top-0 z-20">
            <div className="flex items-center">
                <KanguroLogo imageUrl={KANGURO_LOGO_URL} height={20} className="mr-2 opacity-80"/>
                <span className="text-xs text-slate-600 font-medium">
                    Hola, {currentUser.name.split(' ')[0]} {currentUser.role === 'admin' ? <span className="text-blue-600 font-bold">(Admin)</span> : ''}
                </span>
            </div>
            <button 
                onClick={handleLogout} 
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center p-1 hover:bg-slate-200 rounded"
                aria-label="Cerrar sesión"
            >
                <ArrowRightOnRectangleIcon className="w-4 h-4 mr-1"/>
                Salir
            </button>
        </header>
      )}
      <main className="flex-grow overflow-y-auto w-full bg-slate-100">
        {renderCurrentView()}
      </main>
      {currentUser && !firebaseInitError && <BottomNavigationBar 
        currentView={currentView}
        onSetCurrentView={(view) => {
          if (view === 'report-welcome') setInitialDescriptionForReport(''); 
          setEditingIncidentId(null); 
          setCurrentView(view);
        }}
        reportedIncidentCount={reportedIncidentsCount}
        receivedIncidentCount={receivedIncidentsCount}
        currentUser={currentUser}
      />}
    </>
  );
};

export default App;
