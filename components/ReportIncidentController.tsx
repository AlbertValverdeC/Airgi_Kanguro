
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Incident, ChatMessage, FileAttachment, IncidentStatus, ExtractedBugInfo, User } from '../types';
import { INITIAL_SYSTEM_PROMPT_TEMPLATE, FINAL_SUMMARY_REQUEST_PROMPT, ACKNOWLEDGE_SUMMARY_PROMPT, GEMINI_ERROR_MESSAGE, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES, ATTACHMENT_PREVIEW_MAX_HEIGHT, ATTACHMENT_PREVIEW_MAX_WIDTH, KANGURO_LOGO_URL, RECHAT_SYSTEM_PROMPT_TEMPLATE, BRAND_BLUE } from '../constants';
import { SendIcon, PaperClipIcon, UserCircleIcon, SparklesIcon, TrashIcon, XMarkIcon, CheckCircleIcon, KanguroLogo, MicrophoneIcon, DownloadIcon, EnvelopeIcon, ClipboardIcon, ClipboardTickIcon, ArrowLeftIcon } from './Icons';
import { isGeminiAvailable, startChatSession, sendMessageToChatStream } from '../services/geminiService';


declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    jspdf: any; // For jsPDF library
  }
}

interface ReportIncidentControllerProps {
  initialDescription: string;
  existingIncident?: Incident; 
  onSaveIncident: (
    incidentData: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Incident>; // Modified: onSaveIncident now returns a Promise<Incident>
  onCancel: () => void;
  apiKeyAvailable: boolean;
  currentUser: User; // Now includes uid
  users: User[]; // List of all users (with uid) for assignee selection
}

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center space-x-1">
    <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse delay-0"></div>
    <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse delay-150"></div>
    <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse delay-300"></div>
  </div>
);

const ChatBubble: React.FC<{ message: ChatMessage; }> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isAI = message.sender === 'ai';
  const isSystem = message.sender === 'system';

  const bubbleClasses = isUser
    ? `bg-blue-600 text-white self-end` 
    : isAI
    ? 'bg-slate-200 text-slate-800 self-start'
    : 'bg-transparent text-slate-500 self-center text-[10px] italic my-0.5';
  
  const IconComponent = isUser ? UserCircleIcon : SparklesIcon;

  if (isSystem) {
    return (
      <div className={`my-0.5 px-2 py-0.5 max-w-full text-center ${bubbleClasses}`}>
        <p className="text-[10px] whitespace-pre-wrap">{message.text}</p>
      </div>
    );
  }

  return (
    <div className={`flex my-1.5 items-end ${isUser ? 'flex-row-reverse' : 'flex-row'} w-full group`}>
       <IconComponent className={`w-6 h-6 rounded-full p-0.5 ${isUser ? `ml-1.5 bg-blue-100 text-blue-600` : `mr-1.5 bg-slate-100 text-slate-500`}`} />
      <div className={`p-2 rounded-lg shadow-sm max-w-[80%] ${bubbleClasses}`} style={{backgroundColor: isUser ? BRAND_BLUE : undefined}}>
        <p className="text-xs whitespace-pre-wrap">{message.text}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {message.attachments.map(att => (
              <div key={att.id} className={`text-[10px] p-1.5 rounded-md ${isUser ? 'bg-black/20' : 'bg-slate-300/60'}`}>
                 {att.dataUrl && att.type.startsWith('image/') ? (
                   <img 
                    src={att.dataUrl} 
                    alt={att.name} 
                    className="max-w-full rounded mb-0.5"
                    style={{ 
                      maxWidth: `${ATTACHMENT_PREVIEW_MAX_WIDTH * 0.5}px`, 
                      maxHeight: `${ATTACHMENT_PREVIEW_MAX_HEIGHT * 0.5}px`,
                      objectFit: 'contain' 
                    }}
                  />
                ) : null}
                <p className="font-medium truncate text-[11px]">{att.name}</p>
                <p className="text-[10px] opacity-80">{(att.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ))}
          </div>
        )}
        <p className={`text-[9px] mt-1 ${isUser ? 'text-blue-100/90': 'text-slate-500/80'} opacity-0 group-hover:opacity-100 transition-opacity`}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  );
};

// Fix: Added export default to the component. This addresses the import error in App.tsx
// and should also help TypeScript correctly infer the component's return type, resolving the FC assignability error.
const ReportIncidentController: React.FC<ReportIncidentControllerProps> = ({ 
    initialDescription, 
    existingIncident, 
    onSaveIncident, 
    onCancel, 
    apiKeyAvailable,
    currentUser,
    users
}) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null); 
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [summaryMode, setSummaryMode] = useState(false);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedBugInfo | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const [lastSavedIncidentForActions, setLastSavedIncidentForActions] = useState<Incident | null>(null);
  const [showPostSaveActions, setShowPostSaveActions] = useState(false);
  const [slackCopySuccess, setSlackCopySuccess] = useState(false);
  const [selectedAssigneeUid, setSelectedAssigneeUid] = useState<string | null>(null); // Store UID now


  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      speechRecognitionRef.current = new SpeechRecognitionAPI();
      speechRecognitionRef.current.continuous = false;
      speechRecognitionRef.current.interimResults = true;
      speechRecognitionRef.current.lang = 'es-ES';
      speechRecognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setUserInput(prev => prev + transcript.substring(prev.length > 0 && transcript.startsWith(prev.slice(-10)) ? transcript.indexOf(prev.slice(-10)) + 10 : 0) );
      };
      speechRecognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setTranscriptionError(`Error de transcripción: ${event.error}`);
        setIsListening(false);
      };
      speechRecognitionRef.current.onend = () => setIsListening(false);
    } else {
      setTranscriptionError('Reconocimiento de voz no compatible.');
    }
    return () => { if (speechRecognitionRef.current && isListening) speechRecognitionRef.current.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicrophoneClick = async () => {
    if (!speechRecognitionRef.current) { setTranscriptionError('Reconocimiento de voz no disponible.'); return; }
    setTranscriptionError(null);
    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        setTranscriptionError('No se pudo iniciar el reconocimiento. Verifique permisos.');
        setIsListening(false);
      }
    }
  };

  const parseLLMSummary = (summaryText: string): ExtractedBugInfo => {
    const info: ExtractedBugInfo = {
        title: "Título no especificado",
        stepsToReproduce: "No especificado",
        expectedBehavior: "No especificado",
        actualBehavior: "No especificado",
        impact: "No especificado",
        NombreDelReportador: currentUser.name // Default to current user's name, LLM might override
    };

    const lines = summaryText.split('\n');
    let currentFieldKey: keyof ExtractedBugInfo | null = null;
    
    const fieldMap: Record<string, keyof ExtractedBugInfo> = {
        "titulosugerido:": "title",
        "pasosparareproducir:": "stepsToReproduce",
        "comportamientoesperado:": "expectedBehavior",
        "comportamientoactual:": "actualBehavior",
        "impactodelproblema:": "impact",
        "entornopotencial:": "environment",
        "categoriasugerida:": "suggestedCategory",
        "prioridadsugerida:": "priority",
        "nombredelreportador:": "NombreDelReportador", 
    };

    let buffer = "";

    for (const line of lines) {
        const normalizedLineStart = line.toLowerCase().replace(/\s+/g, '').split(':')[0] + ":";
        let fieldMatchedThisLine = false;

        for (const keyInMap in fieldMap) {
            if (normalizedLineStart === keyInMap) {
                if (currentFieldKey && buffer.trim() && (info[currentFieldKey] === "No especificado" || fieldMap[keyInMap] === "NombreDelReportador" )) { 
                    (info[currentFieldKey] as string) = buffer.trim();
                }
                currentFieldKey = fieldMap[keyInMap];
                buffer = line.substring(line.toLowerCase().indexOf(keyInMap.replace(/:$/, '')) + keyInMap.length -1).trim();
                if (buffer.startsWith(':')) buffer = buffer.substring(1).trim();
                fieldMatchedThisLine = true;
                break;
            }
        }
        if (!fieldMatchedThisLine && currentFieldKey) {
            buffer += `\n${line}`;
        } else if (fieldMatchedThisLine && currentFieldKey && (info[currentFieldKey] === "No especificado" || currentFieldKey === "NombreDelReportador") && buffer.trim()) {
             (info[currentFieldKey] as string) = buffer.trim();
             buffer = ""; 
        }
    }
    if (currentFieldKey && buffer.trim() && (info[currentFieldKey] === "No especificado" || currentFieldKey === "NombreDelReportador")) {
        (info[currentFieldKey] as string) = buffer.trim();
    }
    
    if (!info.NombreDelReportador || info.NombreDelReportador === "No especificado") {
        info.NombreDelReportador = currentUser.name;
    }

    if (info.title === "Título no especificado") {
        info.title = existingIncident?.title || initialDescription.substring(0,40) || "Incidencia Reportada";
        if (info.title.length === 40 && !info.title.endsWith("...")) info.title += "...";
    }

    return info;
  };

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!apiKeyAvailable || !isGeminiAvailable()) {
      setError("Asistente IA no disponible (API Key).");
      return;
    }

    let systemInstructionText: string;
    let historyToLoad: ChatMessage[] | undefined;
    let firstMessageFromUser: string | null = null;

    if (existingIncident) {
      const rechatPrompts = RECHAT_SYSTEM_PROMPT_TEMPLATE(existingIncident.title, currentUser.name, existingIncident.llmSummary);
      systemInstructionText = rechatPrompts[0].text;
      historyToLoad = existingIncident.chatTranscript; 
      setChatMessages(existingIncident.chatTranscript); 
      setSelectedAssigneeUid(existingIncident.assignedTo || null); 
    } else {
      const initialPrompts = INITIAL_SYSTEM_PROMPT_TEMPLATE(initialDescription, currentUser.name);
      systemInstructionText = initialPrompts[0].text;
      setChatMessages(initialPrompts);
      
      const firstUserMsg: ChatMessage = {
        id: `user-${Date.now()}`, sender: 'user', text: initialDescription, timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, firstUserMsg]);
      firstMessageFromUser = initialDescription;
    }
    
    const session = startChatSession(systemInstructionText, historyToLoad);
    if (!session) { setError(GEMINI_ERROR_MESSAGE); return; }
    setChatSession(session);
    
    const processResponse = async (messageToSend?: string) => {
        setIsSending(true);
        try {
            const effectiveMessage = messageToSend || (existingIncident ? "Hola, ¿qué deseas añadir o modificar?" : "Hola"); 
            const stream = await sendMessageToChatStream(session, effectiveMessage);
            let aiResponseText = '';
            for await (const chunk of stream) aiResponseText += chunk.text;
            
            setChatMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: aiResponseText, timestamp: new Date() }]);
        } catch (e) {
            console.error(e); setError(GEMINI_ERROR_MESSAGE);
            setChatMessages(prev => [...prev, { id: `system-error-${Date.now()}`, sender: 'system', text: GEMINI_ERROR_MESSAGE, timestamp: new Date() }]);
        } finally { setIsSending(false); }
    };

    if (firstMessageFromUser) { 
        processResponse(firstMessageFromUser);
    } else if (existingIncident) { 
        processResponse(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyAvailable, initialDescription, existingIncident, currentUser.name]); // currentUser.name to re-init if name changes (though uid is main ID)


  const processFilesForAttachment = (filesToProcess: FileList | File[]) => {
    const newAttachments: FileAttachment[] = [];
    let processingErrors = "";

    Array.from(filesToProcess).forEach(file => {
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            processingErrors += `Archivo no permitido: ${file.name}.\n`;
            return;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            processingErrors += `Archivo grande: ${file.name} (máx ${MAX_FILE_SIZE_MB}MB).\n`;
            return;
        }
        const attachment: FileAttachment = {
            id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type,
            size: file.size,
            file: file,
        };
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                attachment.dataUrl = reader.result as string;
                setAttachments(prev => prev.map(a => a.id === attachment.id ? attachment : a));
            };
            reader.readAsDataURL(file);
        }
        newAttachments.push(attachment);
    });
    
    if (processingErrors) setError(prevError => (prevError ? prevError + "\n" : "") + processingErrors.trim());
    else setError(null);
    
    setAttachments(prev => [...prev, ...newAttachments.filter(na => !prev.find(pa => pa.id === na.id))]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
    if (event.target.files) {
      processFilesForAttachment(event.target.files);
    }
    event.target.value = ''; 
  };

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length > 0) {
      event.preventDefault(); setError(null); processFilesForAttachment(imageFiles);
    }
  }, []); 

  useEffect(() => {
    const currentTextInputRef = textInputRef.current;
    if (currentTextInputRef) {
      currentTextInputRef.addEventListener('paste', handlePaste);
      return () => currentTextInputRef.removeEventListener('paste', handlePaste);
    }
  }, [handlePaste]);


  const removeAttachment = (fileId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== fileId));
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() && attachments.length === 0) return;
    if (!chatSession || !apiKeyAvailable || !isGeminiAvailable()) { setError(GEMINI_ERROR_MESSAGE + (apiKeyAvailable ? "" : " (API Key)")); return; }
    setError(null); setTranscriptionError(null);

    const messageToSend = userInput.trim() || (attachments.length > 0 ? "(Archivo adjunto)" : "");
    const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: messageToSend, timestamp: new Date(), attachments: attachments };

    setChatMessages(prev => [...prev, newUserMessage]);
    setUserInput(''); setAttachments([]); setIsSending(true);

    try {
      const stream = await sendMessageToChatStream(chatSession, messageToSend, newUserMessage.attachments);
      let aiResponseText = '';
      for await (const chunk of stream) aiResponseText += chunk.text;

      setChatMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: aiResponseText, timestamp: new Date() }]);
      
      if (aiResponseText.toLowerCase().includes("he preparado el siguiente resumen") || aiResponseText.toLowerCase().includes("resumen del problema")) {
        setSummaryMode(true); setFinalSummary(aiResponseText);
        const parsed = parseLLMSummary(aiResponseText); setExtractedInfo(parsed);
      }

    } catch (e) { console.error(e); setError(GEMINI_ERROR_MESSAGE); setChatMessages(prev => [...prev, { id: `system-error-${Date.now()}`, sender: 'system', text: GEMINI_ERROR_MESSAGE, timestamp: new Date() }]);
    } finally { setIsSending(false); }
  };
  
  const requestSummaryFromAI = async () => {
    if (!chatSession || !apiKeyAvailable || !isGeminiAvailable() || isSending) return;
    setIsSending(true); setError(null); setTranscriptionError(null);
    
    try {
        const finalSummaryPromptContent = FINAL_SUMMARY_REQUEST_PROMPT.replace(
            'antes de crear el ticket de incidencia?', 
            existingIncident ? 'antes de actualizar el ticket?' : 'antes de crear el ticket de incidencia?'
        );
        const stream = await sendMessageToChatStream(chatSession, finalSummaryPromptContent);
        let aiSummaryResponse = "";
        for await (const chunk of stream) aiSummaryResponse += chunk.text;

        setChatMessages(prev => [...prev, { id: `ai-summary-${Date.now()}`, sender: 'ai', text: aiSummaryResponse, timestamp: new Date() }]);
        setSummaryMode(true); setFinalSummary(aiSummaryResponse);
        const parsed = parseLLMSummary(aiSummaryResponse); setExtractedInfo(parsed);
    } catch (e) {
        console.error("Error requesting summary from AI:", e); setError("Error al generar resumen.");
        setChatMessages(prev => [...prev, { id: `system-error-${Date.now()}`, sender: 'system', text: "Error al generar resumen.", timestamp: new Date() }]);
    } finally { setIsSending(false); }
  };

  const handleConfirmOrSaveSummary = async () => {
    if (!extractedInfo || !chatSession || !currentUser) return;
    
    setIsSending(true);
    setError(null);

    try {
        // Step 1: Acknowledge summary with AI (optional)
        try {
            const stream = await sendMessageToChatStream(chatSession, "Sí, el resumen es correcto. Gracias.");
            let ackResponse = ""; for await (const chunk of stream) ackResponse += chunk.text;
            setChatMessages(prev => [...prev, { id: `ai-ack-${Date.now()}`, sender: 'ai', text: ackResponse || ACKNOWLEDGE_SUMMARY_PROMPT, timestamp: new Date() }]);
        } catch (e) {
            console.warn("Warning: Error sending summary confirmation to AI:", e);
            setChatMessages(prev => [...prev, { id: `ai-ack-fallback-${Date.now()}`, sender: 'ai', text: ACKNOWLEDGE_SUMMARY_PROMPT, timestamp: new Date() }]);
        }

        // Step 2: Prepare incident data
        const incidentAttachments = chatMessages.reduce((acc, msg) => {
            if (msg.attachments) return [...acc, ...msg.attachments];
            return acc;
        }, [] as FileAttachment[]);
        
        const incidentDataToPassToApp: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'> = {
          title: extractedInfo.title || (existingIncident?.title || 'Incidencia Reportada'),
          originalDescription: existingIncident?.originalDescription || initialDescription,
          chatTranscript: chatMessages,
          llmSummary: finalSummary || undefined,
          stepsToReproduce: extractedInfo.stepsToReproduce,
          expectedBehavior: extractedInfo.expectedBehavior,
          actualBehavior: extractedInfo.actualBehavior,
          impact: extractedInfo.impact,
          environment: extractedInfo.environment,
          attachments: incidentAttachments,
          reportedBy: currentUser.uid,
          assignedTo: selectedAssigneeUid || undefined,
          status: existingIncident?.status || IncidentStatus.NUEVO,
          priority: extractedInfo.priority,
          llmSuggestedCategory: extractedInfo.suggestedCategory
        };

        // Step 3: Call onSaveIncident and handle its outcome
        const finalizedIncident = await onSaveIncident(incidentDataToPassToApp);
        
        // Update state with the finalized incident
        setLastSavedIncidentForActions(finalizedIncident);
        setShowPostSaveActions(true); 
        setSummaryMode(false); 

    } catch (saveError: any) {
        console.error("Error during confirm/save summary process:", saveError);
        setError(saveError.message || "Ocurrió un error al guardar la incidencia. Por favor, inténtalo de nuevo.");
    } finally {
        setIsSending(false); 
    }
  };
  
  const handleReviseSummary = () => {
    setSummaryMode(false); setFinalSummary(null); setExtractedInfo(null);
    const reviseMessage = "Quisiera revisar o añadir algo más al resumen.";
    setUserInput(reviseMessage); 
    // Automatically send this message to the AI
    // Create a new user message object
     const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: reviseMessage, timestamp: new Date() };
    setChatMessages(prev => [...prev, newUserMessage]);
    
    if (chatSession && apiKeyAvailable && isGeminiAvailable()) {
      setIsSending(true);
      sendMessageToChatStream(chatSession, reviseMessage)
        .then(async (stream) => {
          let aiResponseText = '';
          for await (const chunk of stream) aiResponseText += chunk.text;
          setChatMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: aiResponseText, timestamp: new Date() }]);
        })
        .catch(e => {
          console.error(e); setError(GEMINI_ERROR_MESSAGE);
          setChatMessages(prev => [...prev, { id: `system-error-${Date.now()}`, sender: 'system', text: GEMINI_ERROR_MESSAGE, timestamp: new Date() }]);
        })
        .finally(() => {
            setIsSending(false);
            setUserInput(''); // Clear user input after sending revise message
        });
    } else {
       setError(GEMINI_ERROR_MESSAGE + (apiKeyAvailable ? "" : " (API Key)"));
    }
  };


  const generateSlackMessage = (incident: Incident | null): string => {
    if (!incident) return "";
    const reporter = users.find(u => u.uid === incident.reportedBy);
    const reporterName = reporter ? reporter.name : (incident.reportedBy || 'Desconocido');
    const assignee = incident.assignedTo ? users.find(u => u.uid === incident.assignedTo) : null;
    const assigneeName = assignee ? assignee.name : (incident.assignedTo || 'N/A');

    return `*Nueva Incidencia Reportada en AIRGI*
*ID:* ${incident.id.substring(0,8)}...
*Título:* ${incident.title}
*Reportado por:* ${reporterName}
*Asignado a:* ${assigneeName}
*Estado:* ${incident.status}
*Prioridad IA:* ${incident.priority || 'N/A'}
*Resumen IA:*
> *Pasos:* ${incident.stepsToReproduce || 'N/A'}
> *Esperado:* ${incident.expectedBehavior || 'N/A'}
> *Actual:* ${incident.actualBehavior || 'N/A'}
> *Impacto:* ${incident.impact || 'N/A'}
${incident.attachments.length > 0 ? `*Adjuntos:* ${incident.attachments.length} archivo(s)` : ''}
Puedes ver más detalles en la aplicación AIRGI.`;
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSlackCopySuccess(true);
      setTimeout(() => setSlackCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      setError("Error al copiar al portapapeles.");
    });
  };

  const handleDownloadPdf = (incident: Incident | null) => {
    if (!incident || !window.jspdf) {
      alert("No se puede generar PDF. La librería jsPDF no está cargada o no hay datos del incidente.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const reporter = users.find(u => u.uid === incident.reportedBy);
    const reporterName = reporter ? reporter.name : (incident.reportedBy || 'Desconocido');
    const assignee = incident.assignedTo ? users.find(u => u.uid === incident.assignedTo) : null;
    const assigneeName = assignee ? assignee.name : (incident.assignedTo || 'N/A');

    doc.setFontSize(16);
    doc.text(`AIRGI Incidencia: ${incident.id.substring(0,8)}...`, 14, 22);
    doc.setFontSize(10);
    let y = 35;
    const addLine = (text: string, indent = 0, isBold = false) => {
        if (y > 270) { doc.addPage(); y = 20; }
        if (isBold) doc.setFont(undefined, 'bold');
        const lines = doc.splitTextToSize(text, 180 - (indent * 4));
        doc.text(lines, 14 + (indent * 4), y);
        y += (lines.length * 5) + 1;
        if (isBold) doc.setFont(undefined, 'normal');
    };

    addLine(`ID: ${incident.id}`);
    addLine(`Título: ${incident.title}`, 0, true);
    addLine(`Reportado por: ${reporterName}`);
    addLine(`Asignado a: ${assigneeName}`);
    addLine(`Estado: ${incident.status}`);
    addLine(`Prioridad IA: ${incident.priority || 'N/A'}`);
    addLine(`Categoría IA: ${incident.llmSuggestedCategory || 'N/A'}`);
    addLine(`Creado: ${new Date(incident.createdAt).toLocaleString()}`);
    addLine(`Última Actualización: ${new Date(incident.updatedAt).toLocaleString()}`);
    y += 3;

    addLine("Descripción Original:", 0, true);
    addLine(incident.originalDescription, 1);
    y += 3;

    if (incident.llmSummary || incident.stepsToReproduce) {
        addLine("Resumen y Detalles por IA:", 0, true);
        if(incident.stepsToReproduce) addLine(`Pasos para Reproducir: ${incident.stepsToReproduce}`, 1);
        if(incident.expectedBehavior) addLine(`Comportamiento Esperado: ${incident.expectedBehavior}`, 1);
        if(incident.actualBehavior) addLine(`Comportamiento Actual: ${incident.actualBehavior}`, 1);
        if(incident.impact) addLine(`Impacto: ${incident.impact}`, 1);
        if(incident.environment) addLine(`Entorno: ${incident.environment}`, 1);
        if(!incident.stepsToReproduce && incident.llmSummary) addLine(incident.llmSummary, 1);
        y += 3;
    }

    if (incident.attachments.length > 0) {
        addLine("Adjuntos:", 0, true);
        incident.attachments.forEach(att => addLine(`- ${att.name} (${(att.size / 1024 / 1024).toFixed(2)} MB, ${att.type})`, 1));
        y += 3;
    }
    
    addLine("Transcripción del Chat (extracto):", 0, true);
    const relevantMessages = incident.chatTranscript
        .filter(msg => msg.sender === 'user' || (msg.sender === 'ai' && !msg.text.startsWith("He preparado el siguiente resumen") && !msg.text.startsWith("Gracias por confirmar.")))
        .slice(-10); // Last 10 relevant messages for brevity
    relevantMessages.forEach(msg => {
        addLine(`${msg.sender === 'user' ? 'Usuario:' : 'AIRGI:'} ${msg.text}`, 1);
    });

    doc.save(`AIRGI_Incidencia_${incident.id.substring(0,8)}.pdf`);
  };

  const handleSendByEmail = (incident: Incident | null) => {
    if (!incident) return;
    const reporter = users.find(u => u.uid === incident.reportedBy);
    const reporterName = reporter ? reporter.name : (incident.reportedBy || 'Desconocido');
    const assignee = incident.assignedTo ? users.find(u => u.uid === incident.assignedTo) : null;
    const assigneeName = assignee ? assignee.name : (incident.assignedTo || 'N/A');

    const subject = encodeURIComponent(`AIRGI Incidencia: ${incident.title}`);
    const bodyParts = [
      `Se ha ${existingIncident ? 'actualizado' : 'registrado'} la siguiente incidencia en AIRGI:`,
      `ID: ${incident.id}`,
      `Título: ${incident.title}`,
      `Reportado por: ${reporterName}`,
      `Asignado a: ${assigneeName}`,
      `Estado: ${incident.status}`,
      `Prioridad IA: ${incident.priority || 'N/A'}`,
      `\nResumen IA:`,
      `Pasos: ${incident.stepsToReproduce || 'N/A'}`,
      `Esperado: ${incident.expectedBehavior || 'N/A'}`,
      `Actual: ${incident.actualBehavior || 'N/A'}`,
      `Impacto: ${incident.impact || 'N/A'}`,
      `\nPor favor, revisa los detalles en la aplicación AIRGI.`,
    ];
    const body = encodeURIComponent(bodyParts.join('\n'));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  
  if (!currentUser) { // Should not happen if component is rendered, but good for safety
    return <div className="p-4 text-center text-red-500">Error: Usuario no definido.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 text-xs">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-slate-100 z-20">
        <div className="flex items-center">
            <KanguroLogo imageUrl={KANGURO_LOGO_URL} height={20} className="mr-2 opacity-80"/>
            <h2 className="text-sm font-semibold text-slate-700 truncate">
            {existingIncident ? `Editando: ${existingIncident.title.substring(0,30)}...` : 'Reportar Nueva Incidencia'}
            </h2>
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-blue-600 p-1 rounded-full hover:bg-slate-200">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-100 text-red-700 border-b border-red-200 text-[11px] flex items-start">
          {/* Fix: Wrap XMarkIcon in a button to handle onClick */}
          <button onClick={() => setError(null)} className="mr-1.5 text-red-500 flex-shrink-0 cursor-pointer">
            <XMarkIcon className="w-4 h-4" />
          </button>
          <div>{error.split('\n').map((e,i) => <p key={i}>{e}</p>)}</div>
        </div>
      )}
      {transcriptionError && (
         <div className="p-2 bg-yellow-100 text-yellow-800 border-b border-yellow-300 text-[11px] flex items-start">
            {/* Fix: Wrap XMarkIcon in a button to handle onClick */}
            <button onClick={() => setTranscriptionError(null)} className="mr-1.5 text-yellow-600 flex-shrink-0 cursor-pointer">
                <XMarkIcon className="w-4 h-4" />
            </button>
            {transcriptionError}
        </div>
      )}

      {/* Chat messages */}
      <div ref={chatContainerRef} className="flex-grow p-2 space-y-1.5 overflow-y-auto chat-container">
        {chatMessages.map(msg => <ChatBubble key={msg.id} message={msg} />)}
        {isSending && chatMessages[chatMessages.length - 1]?.sender === 'user' && (
          <div className="flex self-start items-center pl-8"> {/* Aligned with AI bubble */}
            <SparklesIcon className="w-6 h-6 rounded-full p-0.5 mr-1.5 bg-slate-100 text-slate-500" />
            <div className="p-2 rounded-lg shadow-sm bg-slate-200 text-slate-800">
              <LoadingSpinner />
            </div>
          </div>
        )}
      </div>

      {/* Summary Mode */}
      {summaryMode && extractedInfo && finalSummary && (
        <div className="p-2.5 border-t border-slate-200 bg-white shadow-top">
            <p className="text-xs font-semibold text-slate-700 mb-1.5">Resumen generado por IA:</p>
            <div className="text-[11px] bg-slate-50 p-2 rounded-md border border-slate-200 max-h-40 overflow-y-auto mb-2 whitespace-pre-wrap shadow-inner">
                <strong>Título Sugerido:</strong> {extractedInfo.title} <br />
                <strong>Pasos:</strong> {extractedInfo.stepsToReproduce} <br />
                <strong>Esperado:</strong> {extractedInfo.expectedBehavior} <br />
                <strong>Actual:</strong> {extractedInfo.actualBehavior} <br />
                <strong>Impacto:</strong> {extractedInfo.impact} <br />
                {extractedInfo.environment && <><strong>Entorno:</strong> {extractedInfo.environment} <br /></>}
                {extractedInfo.suggestedCategory && <><strong>Categoría IA:</strong> {extractedInfo.suggestedCategory} <br /></>}
                {extractedInfo.priority && <><strong>Prioridad IA:</strong> {extractedInfo.priority} <br /></>}
            </div>
            <p className="text-xs text-slate-600 mb-2.5">{finalSummary.substring(finalSummary.lastIndexOf("He preparado el siguiente resumen"), finalSummary.length)}</p>
            <div className="flex space-x-2">
                <button 
                    onClick={handleConfirmOrSaveSummary} 
                    disabled={isSending}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center"
                >
                    <CheckCircleIcon className="w-4 h-4 mr-1.5"/>
                    Confirmar y {existingIncident ? 'Actualizar' : 'Guardar'}
                </button>
                <button 
                    onClick={handleReviseSummary} 
                    disabled={isSending}
                    className="flex-1 bg-slate-200 text-slate-700 px-3 py-2 rounded-md text-xs font-semibold hover:bg-slate-300 transition-colors shadow-sm disabled:opacity-50"
                >
                    Revisar/Añadir Más
                </button>
            </div>
        </div>
      )}

      {/* Post Save Actions */}
      {showPostSaveActions && lastSavedIncidentForActions && (
        <div className="p-2.5 border-t border-slate-200 bg-green-50">
            <div className="flex items-center text-green-700 mb-2">
                <CheckCircleIcon className="w-5 h-5 mr-1.5 text-green-600"/>
                <p className="text-xs font-semibold">
                    ¡Incidencia {existingIncident ? 'actualizada' : 'registrada'} con éxito! (ID: {lastSavedIncidentForActions.id.substring(0,8)}...)
                </p>
            </div>
             <div className="mb-2">
                <label htmlFor="assignToUser" className="block text-[11px] font-medium text-slate-600 mb-0.5">Asignar a (opcional):</label>
                <select 
                    id="assignToUser"
                    value={selectedAssigneeUid || ""}
                    onChange={(e) => {
                        const newAssigneeUid = e.target.value || null;
                        setSelectedAssigneeUid(newAssigneeUid);
                        // Here you would typically call a function to update the incident in backend
                        // For now, we assume onSaveIncident has already run, and this is a post-save update.
                        // This might require another call to onSaveIncident or a dedicated updateAssignee function.
                        // For simplicity, let's log it for now.
                        console.log("Assignee changed to:", newAssigneeUid, "for incident:", lastSavedIncidentForActions.id);
                        // Ideally, trigger a save here:
                        // const updatedIncidentData = { ...lastSavedIncidentForActions, assignedTo: newAssigneeUid || undefined };
                        // const {id, createdAt, updatedAt, ...dataToSave} = updatedIncidentData; // Prepare for save
                        // onSaveIncident(dataToSave as any, () => console.log("Assignee updated")); // Simplified, needs proper typing
                    }}
                    className="w-full p-1.5 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent text-xs"
                >
                    <option value="">-- No asignar --</option>
                    {users.map(user => (
                        <option key={user.uid} value={user.uid}>{user.name} ({user.email})</option>
                    ))}
                </select>
            </div>
            <p className="text-[11px] text-slate-600 mb-1.5">Acciones rápidas:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                <button onClick={() => handleCopyToClipboard(generateSlackMessage(lastSavedIncidentForActions))} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors shadow-sm relative">
                    {slackCopySuccess ? <ClipboardTickIcon className="w-3.5 h-3.5 mr-1" /> : <ClipboardIcon className="w-3.5 h-3.5 mr-1" />}
                    {slackCopySuccess ? "Copiado!" : "P/ Slack"}
                </button>
                <button onClick={() => handleDownloadPdf(lastSavedIncidentForActions)} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-colors shadow-sm">
                    <DownloadIcon className="w-3.5 h-3.5 mr-1" /> PDF
                </button>
                 <button onClick={() => handleSendByEmail(lastSavedIncidentForActions)} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors shadow-sm">
                    <EnvelopeIcon className="w-3.5 h-3.5 mr-1" /> Email
                </button>
                <button onClick={onCancel} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-md transition-colors shadow-sm">
                    <ArrowLeftIcon className="w-3.5 h-3.5 mr-1" /> Volver
                </button>
            </div>
        </div>
      )}

      {/* Input Area */}
      {!summaryMode && !showPostSaveActions && (
        <div className="p-2.5 border-t border-slate-200 bg-slate-100">
          {attachments.length > 0 && (
            <div className="mb-1.5 space-y-1 max-h-20 overflow-y-auto pr-1">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center justify-between bg-slate-200 p-1 rounded text-[10px]">
                  <div className="flex items-center overflow-hidden">
                    {att.dataUrl && att.type.startsWith('image/') ? (
                      <img src={att.dataUrl} alt={att.name} className="w-5 h-5 rounded-sm object-cover mr-1 flex-shrink-0" />
                    ) : (
                      <PaperClipIcon className="w-3 h-3 mr-1 text-slate-500 flex-shrink-0" />
                    )}
                    <span className="truncate font-medium text-slate-700">{att.name}</span>
                    <span className="ml-1 text-slate-500 whitespace-nowrap">({(att.size / 1024 / 1024).toFixed(2)}MB)</span>
                  </div>
                  <button onClick={() => removeAttachment(att.id)} className="p-0.5 text-slate-400 hover:text-red-500"><XMarkIcon className="w-3 h-3"/></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end space-x-1.5">
             <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isSending || attachments.length >= 5}
                className="p-2 text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-200 disabled:opacity-50"
                aria-label="Adjuntar archivo"
            >
              <PaperClipIcon className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} />
            
            <button 
                onClick={handleMicrophoneClick} 
                disabled={isSending}
                className={`p-2 rounded-full hover:bg-slate-200 disabled:opacity-50 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-500 hover:text-blue-600'}`}
                aria-label={isListening ? "Detener grabación" : "Grabar voz"}
            >
                <MicrophoneIcon className="w-5 h-5" />
            </button>

            <input
              ref={textInputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => {if (e.key === 'Enter' && !isSending && (userInput.trim() || attachments.length > 0)) handleSendMessage();}}
              placeholder={isSending ? "Enviando..." : (isListening ? "Escuchando..." : "Escribe tu mensaje aquí...")}
              className="flex-grow p-2.5 bg-white text-slate-800 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:border-transparent text-xs placeholder-slate-400 disabled:bg-slate-50"
              disabled={isSending || isListening}
              style={{ borderColor: isListening ? '#fb7185' : BRAND_BLUE, outlineColor: BRAND_BLUE }} /* Rose-500 for listening */
            />
            
            {(userInput.trim() || attachments.length > 0) && !isSending && !isListening && (
                 <button 
                    onClick={handleSendMessage} 
                    className="p-2.5 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    style={{backgroundColor: BRAND_BLUE }}
                    aria-label="Enviar mensaje"
                >
                    <SendIcon className="w-4 h-4" />
                </button>
            )}
            {!isSending && !isListening && ( // Show "Finalizar" button if not sending/listening
                <button 
                    onClick={requestSummaryFromAI} 
                    className="px-3 py-2.5 text-xs font-semibold text-white rounded-lg shadow-sm transition-colors" // Adjusted padding
                    style={{backgroundColor: BRAND_BLUE }}
                    title="Finalizar chat y pedir resumen a IA"
                >
                    Finalizar
                </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportIncidentController;
