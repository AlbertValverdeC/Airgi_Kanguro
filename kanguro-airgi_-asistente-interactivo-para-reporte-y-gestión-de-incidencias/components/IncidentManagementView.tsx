
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Incident, IncidentStatus, FileAttachment, ChatMessage, User } from '../types';
import { TrashIcon, PencilSquareIcon, XMarkIcon, SparklesIcon, UserCircleIcon, PaperClipIcon, DownloadIcon, EnvelopeIcon, ClipboardIcon, ClipboardTickIcon, ArrowLeftIcon, InboxArrowDownIcon } from './Icons'; 
import { ATTACHMENT_PREVIEW_MAX_HEIGHT, ATTACHMENT_PREVIEW_MAX_WIDTH, BRAND_BLUE } from '../constants';

interface IncidentListItemProps {
  incident: Incident;
  onViewDetails: (incident: Incident) => void;
  currentUser: User; // Now full User object with UID
  users: User[]; // Full list for name resolution, contains UIDs
  mode: 'reported' | 'received';
}

const IncidentListItem: React.FC<IncidentListItemProps> = ({ incident, onViewDetails, currentUser, users, mode }) => {
  const getStatusClass = (status: IncidentStatus) => {
    switch (status) {
      case IncidentStatus.NUEVO: return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-500' };
      case IncidentStatus.EN_PROGRESO: return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-500' };
      case IncidentStatus.RESUELTO: return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' };
      case IncidentStatus.CERRADO: return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-400' };
      case IncidentStatus.PENDIENTE_INFO: return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-400' };
    }
  };
  const statusStyle = getStatusClass(incident.status);
  const reporter = users.find(u => u.uid === incident.reportedBy);
  const reporterName = reporter ? reporter.name : (incident.reportedBy || 'Desconocido');
  
  const assignee = incident.assignedTo ? users.find(u => u.uid === incident.assignedTo) : null;
  const assigneeName = assignee ? assignee.name : incident.assignedTo;

  const itemBaseClasses = "bg-white shadow-md rounded-lg p-3 hover:shadow-lg transition-shadow duration-200 cursor-pointer";
  let modeSpecificClasses = "";

  if (mode === 'reported' && incident.reportedBy === currentUser.uid && currentUser.role !== 'admin') {
    modeSpecificClasses = "border-l-4 border-blue-500";
  } else if (mode === 'received') {
    modeSpecificClasses = "border-l-4 border-purple-500"; // Distinct color for received incidents
  }


  return (
    <div 
      className={`${itemBaseClasses} ${modeSpecificClasses}`}
      onClick={() => onViewDetails(incident)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onViewDetails(incident)}
    >
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-sm font-semibold text-slate-800 truncate pr-2" title={incident.title}>
          ID: {incident.id.substring(0, 6)}... - {incident.title}
        </h3>
        {incident.priority && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            incident.priority === 'Alta' ? 'text-red-600 bg-red-100' : 
            incident.priority === 'Media' ? 'text-yellow-700 bg-yellow-100' : 'text-green-600 bg-green-100'
          }`}>
            {incident.priority}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-1.5 line-clamp-1">
        {incident.originalDescription}
      </p>
       <p className="text-[10px] text-slate-400 mb-1">
        {mode === 'received' ? `Reportado por: ${reporterName}` : `Reportado por: ${incident.reportedBy === currentUser.uid ? `${currentUser.name} (Tú)` : reporterName}`}
      </p>
      {mode === 'reported' && assigneeName && (
         <p className="text-[10px] text-purple-600 font-medium mb-1.5">Asignado a: {assigneeName}</p>
      )}

      <div className="flex justify-between items-center">
        <span 
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}
        >
          {incident.status}
        </span>
        <span className="text-[10px] text-slate-400">
          {new Date(incident.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

interface ChatBubbleDetailViewProps { message: ChatMessage; }

const ChatBubbleDetailView: React.FC<ChatBubbleDetailViewProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isAI = message.sender === 'ai';
  const isSystem = message.sender === 'system';

  const IconComponent = isUser ? UserCircleIcon : SparklesIcon;

  if (isSystem) {
    return (
      <div className="my-0.5 px-1.5 py-0.5 max-w-full text-center text-slate-500 text-[10px] italic">
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
    );
  }

  return (
    <div className={`flex my-1 items-end ${isUser ? 'flex-row-reverse' : 'flex-row'} w-full group`}>
      <IconComponent className={`w-5 h-5 rounded-full p-0.5 ${isUser ? 'ml-1 bg-blue-100 text-blue-600' : 'mr-1 bg-slate-100 text-slate-500'}`} />
      <div className={`p-1.5 rounded-md shadow-sm max-w-[85%] text-xs ${isUser ? 'bg-blue-600 text-white self-end' : 'bg-slate-200 text-slate-800 self-start'}`}
           style={{backgroundColor: isUser ? BRAND_BLUE : undefined }}>
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {message.attachments.map(att => (
              <div key={att.id} className={`text-[10px] p-1 rounded ${isUser ? 'bg-black/20' : 'bg-slate-300/50'}`}>
                 {att.dataUrl && att.type.startsWith('image/') && (
                   <img src={att.dataUrl} alt={att.name} className="max-w-full rounded mb-0.5"
                    style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain' }}/>
                )}
                <p className="font-medium truncate text-[10px]">{att.name}</p>
                <p className="opacity-80 text-[9px]">{(att.size /1024/1024).toFixed(2)}MB</p>
              </div>
            ))}
          </div>
        )}
        <p className={`text-[8px] mt-0.5 ${isUser ? 'text-blue-100/80': 'text-slate-500/80'} opacity-0 group-hover:opacity-100`}>{new Date(message.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
      </div>
    </div>
  );
};


interface IncidentDetailViewProps {
  incident: Incident;
  currentUser: User; 
  users: User[]; 
  onBackToList: () => void;
  onStartEditReport: (incidentId: string) => void;
  onDeleteIncident: (incidentId: string) => void;
}

const IncidentDetailView: React.FC<IncidentDetailViewProps> = ({ incident, currentUser, users, onBackToList, onStartEditReport, onDeleteIncident }) => {
  const [slackCopySuccessModal, setSlackCopySuccessModal] = useState(false);
  const detailContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detailContentRef.current?.scrollTo(0, 0);
  }, [incident]);

  const canEdit = currentUser.role === 'admin' || incident.reportedBy === currentUser.uid;
  const canDelete = currentUser.role === 'admin' || incident.reportedBy === currentUser.uid;
  
  const reporter = users.find(u => u.uid === incident.reportedBy);
  const reporterDisplayName = reporter ? reporter.name : (incident.reportedBy || 'Desconocido');

  const assignee = incident.assignedTo ? users.find(u => u.uid === incident.assignedTo) : null;
  const assigneeDisplayName = assignee ? assignee.name : incident.assignedTo;


  const handleDownloadPdfModal = (incidentToDownload: Incident) => {
    if (!window.jspdf) { alert("No se puede generar PDF."); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`AIRGI Incidencia: ${incidentToDownload.id.substring(0,8)}...`, 14, 20); doc.setFontSize(10);
    let y = 30;
    const addLine = (text: string, isHeader = false) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(isHeader ? 11 : 9);
      doc.setTextColor(isHeader ? 0 : 80);
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 14, y);
      y += (lines.length * (isHeader ? 5 : 4.5)) + (isHeader ? 2 : 1);
    };
    
    addLine(`Título: ${incidentToDownload.title}`, true);
    addLine(`Reportado por: ${reporterDisplayName} | Estado: ${incidentToDownload.status}`);
    if (assigneeDisplayName) addLine(`Asignado a: ${assigneeDisplayName}`);
    addLine(`Prioridad IA: ${incidentToDownload.priority || 'N/A'} | Categoría IA: ${incidentToDownload.llmSuggestedCategory || 'N/A'}`);
    addLine(`Creado: ${new Date(incidentToDownload.createdAt).toLocaleString()} | Actualizado: ${new Date(incidentToDownload.updatedAt).toLocaleString()}`);
    y+=2;
    addLine("Descripción Original:", true); addLine(incidentToDownload.originalDescription); y+=2;
    if (incidentToDownload.stepsToReproduce || incidentToDownload.llmSummary) {
        addLine("Resumen IA:", true);
        if (incidentToDownload.stepsToReproduce) addLine(`Pasos: ${incidentToDownload.stepsToReproduce}`);
        if (incidentToDownload.expectedBehavior) addLine(`Esperado: ${incidentToDownload.expectedBehavior}`);
        if (incidentToDownload.actualBehavior) addLine(`Actual: ${incidentToDownload.actualBehavior}`);
        if (incidentToDownload.impact) addLine(`Impacto: ${incidentToDownload.impact}`);
        if (incidentToDownload.environment) addLine(`Entorno: ${incidentToDownload.environment}`);
        if (!incidentToDownload.stepsToReproduce && incidentToDownload.llmSummary) addLine(incidentToDownload.llmSummary);
        y+=2;
    }
    if (incidentToDownload.attachments.length > 0) {
        addLine("Adjuntos:", true);
        incidentToDownload.attachments.forEach(att => addLine(`- ${att.name} (${(att.size/1024/1024).toFixed(2)}MB, ${att.type})`));
        y+=2;
    }
    addLine("Transcripción Chat (Usuario/AIRGI):", true);
    incidentToDownload.chatTranscript.filter(m => m.sender !== 'system').forEach(msg => addLine(`${msg.sender === 'user' ? 'U:' : 'A:'} ${msg.text}`));
    doc.save(`AIRGI_Incidencia_${incidentToDownload.id}.pdf`);
  };

  const handleShareEmailModal = (incidentToShare: Incident) => {
    const subject = encodeURIComponent(`AIRGI Incidencia: ${incidentToShare.id.substring(0,8)}... - ${incidentToShare.title}`);
    const bodyParts = [
        `ID: ${incidentToShare.id}`, `Título: ${incidentToShare.title}`, `Reportado por: ${reporterDisplayName}`,
    ];
    if(assigneeDisplayName) bodyParts.push(`Asignado a: ${assigneeDisplayName}`);
    bodyParts.push(
        `Descripción: ${incidentToShare.originalDescription}`,
        `Resumen IA:\nPasos: ${incidentToShare.stepsToReproduce || 'N/A'}\nEsperado: ${incidentToShare.expectedBehavior || 'N/A'}\nActual: ${incidentToShare.actualBehavior || 'N/A'}`
    );
    const body = encodeURIComponent(bodyParts.join('\n\n'));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCopyForSlackModal = (incidentToCopy: Incident) => {
    const slackParts = [
        `*Incidencia AIRGI: ${incidentToCopy.id.substring(0,8)}...*`, `*Título:* ${incidentToCopy.title}`, `*Reportado por:* ${reporterDisplayName}`,
    ];
    if(assigneeDisplayName) slackParts.push(`*Asignado a:* ${assigneeDisplayName}`);
    slackParts.push(`*Resumen IA:*\n>Pasos: ${incidentToCopy.stepsToReproduce || 'N/A'}\n>Esperado: ${incidentToCopy.expectedBehavior || 'N/A'}\n>Actual: ${incidentToCopy.actualBehavior || 'N/A'}`);

    const slackText = slackParts.join('\n');
    navigator.clipboard.writeText(slackText).then(() => { setSlackCopySuccessModal(true); setTimeout(() => setSlackCopySuccessModal(false), 1500);});
  };
  
  const statusStyle = incident.status === IncidentStatus.NUEVO ? { backgroundColor: BRAND_BLUE, color: 'white', borderColor: BRAND_BLUE } : 
                      incident.status === IncidentStatus.EN_PROGRESO ? { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#f59e0b'} :
                      incident.status === IncidentStatus.RESUELTO ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#22c55e'} :
                      { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#9ca3af'};

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-3 border-b border-slate-200 flex items-center sticky top-0 bg-slate-100 z-10">
        <button onClick={onBackToList} className="text-slate-500 hover:text-blue-600 p-1.5 rounded-full hover:bg-slate-200 mr-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-slate-800 truncate">ID: {incident.id.substring(0,8)}... - {incident.title}</h2>
      </div>

      <div ref={detailContentRef} className="p-3 space-y-3 text-xs overflow-y-auto flex-grow">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div><strong>ID:</strong> <span className="text-slate-600">{incident.id}</span></div>
          <div><strong>Estado:</strong> 
            <span className="font-semibold px-1.5 py-0.5 rounded-full text-[10px] ml-1" style={statusStyle}>
                {incident.status}
            </span>
          </div>
          {incident.priority && <div><strong>Prioridad IA:</strong> <span className="font-semibold text-slate-600">{incident.priority}</span></div>}
          {incident.llmSuggestedCategory && <div><strong>Categoría IA:</strong> <span className="text-slate-600">{incident.llmSuggestedCategory}</span></div>}
          <div><strong>Reportado por:</strong> <span className="text-slate-600">{reporterDisplayName}</span></div>
          {assigneeDisplayName && <div><strong>Asignado a:</strong> <span className="text-purple-700 font-semibold">{assigneeDisplayName}</span></div>}
          <div><strong>Creado:</strong> <span className="text-slate-600">{new Date(incident.createdAt).toLocaleString()}</span></div>
           <div><strong>Actualizado:</strong> <span className="text-slate-600">{new Date(incident.updatedAt).toLocaleString()}</span></div>
        </div>
        <div>
          <h4 className="font-semibold text-slate-700 mb-1 text-xs">Descripción Original:</h4>
          <p className="text-xs text-slate-600 bg-white p-2 rounded-md whitespace-pre-wrap border border-slate-200 shadow-inner">{incident.originalDescription}</p>
        </div>
        {(incident.llmSummary || incident.stepsToReproduce) && (
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 text-xs">Resumen IA:</h4>
            <div className="text-xs text-slate-600 bg-white p-2 rounded-md whitespace-pre-wrap space-y-0.5 border border-slate-200 shadow-inner">
              {incident.stepsToReproduce && <p><strong>Pasos:</strong> {incident.stepsToReproduce}</p>}
              {incident.expectedBehavior && <p><strong>Esperado:</strong> {incident.expectedBehavior}</p>}
              {incident.actualBehavior && <p><strong>Actual:</strong> {incident.actualBehavior}</p>}
              {incident.impact && <p><strong>Impacto:</strong> {incident.impact}</p>}
              {incident.environment && <p><strong>Entorno:</strong> {incident.environment}</p>}
              {!incident.stepsToReproduce && incident.llmSummary && <p>{incident.llmSummary}</p>} 
            </div>
          </div>
        )}
        {incident.attachments.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 text-xs">Adjuntos:</h4>
            <ul className="list-disc list-inside pl-0.5 space-y-0.5">
              {incident.attachments.map(att => (
                <li key={att.id} className="text-xs text-slate-600">
                  {att.dataUrl && att.type.startsWith('image/') ? ( <img src={att.dataUrl} alt={att.name} className="my-0.5 rounded border max-h-16 shadow-sm" style={{ objectFit: 'contain' }} /> ) 
                  : ( <PaperClipIcon className="w-3.5 h-3.5 inline-block mr-1 text-slate-400" /> )}
                  {att.name} ({(att.size /1024/1024).toFixed(2)}MB)
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h4 className="font-semibold text-slate-700 mb-1 text-xs">Transcripción del Chat:</h4>
          <div className="bg-white p-2 rounded-md max-h-48 overflow-y-auto border border-slate-200 chat-container shadow-inner">
            {incident.chatTranscript.map(msg => <ChatBubbleDetailView key={msg.id} message={msg} />)}
          </div>
        </div>
      </div>
      <div className="p-2.5 border-t border-slate-200 bg-slate-100 sticky bottom-0 z-10">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
               <button onClick={() => handleDownloadPdfModal(incident)} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-colors shadow-sm">
                  <DownloadIcon className="w-3.5 h-3.5 mr-1" /> PDF
              </button>
              <button onClick={() => handleShareEmailModal(incident)} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors shadow-sm">
                  <EnvelopeIcon className="w-3.5 h-3.5 mr-1" /> Email
              </button>
              <button onClick={() => handleCopyForSlackModal(incident)} className="flex items-center justify-center text-[10px] px-1.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors shadow-sm relative">
                  {slackCopySuccessModal ? <ClipboardTickIcon className="w-3.5 h-3.5 mr-1" /> : <ClipboardIcon className="w-3.5 h-3.5 mr-1" />}
                  {slackCopySuccessModal ? "¡Ok!" : "Slack"}
              </button>
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && (
              <button
                  onClick={() => { onStartEditReport(incident.id); }}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors flex items-center justify-center shadow-sm"
              >
                  <PencilSquareIcon className="w-4 h-4 mr-1" />
                  Editar/Añadir
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                    if (window.confirm("¿Seguro que quieres eliminar esta incidencia?")) {
                        onDeleteIncident(incident.id);
                        onBackToList(); // Go back after deletion attempt
                    }
                }}
                className="flex-1 px-3 py-2 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors flex items-center justify-center shadow-sm"
                aria-label="Eliminar incidencia"
              >
                <TrashIcon className="w-4 h-4 mr-1" />
                Eliminar
              </button>
            )}
            {!canEdit && !canDelete && (
                 <p className="text-xs text-slate-500 text-center w-full">No tienes permisos para editar o eliminar esta incidencia.</p>
            )}
          </div>
      </div>
    </div>
  );
};


interface IncidentManagementViewProps {
  incidents: Incident[];
  currentUser: User;
  users: User[]; 
  onUpdateIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  onDeleteIncident: (incidentId: string) => void;
  onStartEditReport: (incidentId: string) => void;
  onNavigateToReportScreen: () => void;
  mode: 'reported' | 'received';
}

const IncidentManagementView: React.FC<IncidentManagementViewProps> = ({ 
  incidents, 
  currentUser, 
  users, 
  onUpdateIncidentStatus, 
  onDeleteIncident, 
  onStartEditReport, 
  onNavigateToReportScreen,
  mode 
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'TODOS'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      const statusMatch = filterStatus === 'TODOS' || incident.status === filterStatus;
      const term = searchTerm.toLowerCase().trim();
      
      const reporter = users.find(u => u.uid === incident.reportedBy);
      const reporterName = reporter ? reporter.name.toLowerCase() : '';
      const assignee = incident.assignedTo ? users.find(u => u.uid === incident.assignedTo) : null;
      const assigneeName = assignee ? assignee.name.toLowerCase() : '';

      const searchTermMatch = term === '' ||
        incident.id.toLowerCase().includes(term) ||
        incident.title.toLowerCase().includes(term) ||
        incident.originalDescription.toLowerCase().includes(term) ||
        (incident.reportedBy && incident.reportedBy.toLowerCase().includes(term)) || // search by UID
        reporterName.includes(term) || // search by resolved name
        (incident.assignedTo && incident.assignedTo.toLowerCase().includes(term)) || // search by UID
        assigneeName.includes(term) || // search by resolved name
        (incident.llmSuggestedCategory && incident.llmSuggestedCategory.toLowerCase().includes(term));
      
      let modeMatch = false;
      if (mode === 'reported') {
        modeMatch = currentUser.role === 'admin' || incident.reportedBy === currentUser.uid;
      } else if (mode === 'received') {
        modeMatch = incident.assignedTo === currentUser.uid;
      }

      return statusMatch && searchTermMatch && modeMatch;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); 
  }, [incidents, filterStatus, searchTerm, currentUser, users, mode]);

  const handleViewDetails = (incident: Incident) => setSelectedIncident(incident);
  const handleBackToList = () => setSelectedIncident(null);

  if (selectedIncident) {
    return (
      <IncidentDetailView 
        incident={selectedIncident} 
        currentUser={currentUser}
        users={users}
        onBackToList={handleBackToList} 
        onStartEditReport={onStartEditReport}
        onDeleteIncident={onDeleteIncident}
      />
    );
  }

  const viewTitle = mode === 'reported' ? 'Mis Incidencias Reportadas' : 'Mis Incidencias Recibidas';
  const viewSubtitle = mode === 'reported' 
    ? (currentUser.role === 'admin' ? 'Mostrando todas las incidencias reportadas.' : 'Mostrando tus incidencias reportadas.')
    : 'Mostrando incidencias asignadas a ti.';
  
  const emptyListMessage = mode === 'reported'
    ? (currentUser.role === 'admin' ? 'No hay incidencias reportadas en el sistema.' : 'Aún no has reportado ninguna incidencia.')
    : 'No tienes incidencias asignadas.';


  return (
    <div className="p-3 h-full flex flex-col">
      <div className="mb-3">
        <h1 className="text-lg font-bold text-slate-800 mb-0.5">{viewTitle}</h1>
        <p className="text-xs text-slate-500 mb-2">{viewSubtitle}</p>
        <div className="space-y-2 text-xs">
          <div>
            <label htmlFor="statusFilter" className="block text-[11px] font-medium text-slate-600 mb-0.5">Estado:</label>
            <select 
              id="statusFilter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as IncidentStatus | 'TODOS')} 
              className="w-full p-1.5 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent text-xs"
              style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE, boxShadow: `0 0 0 0px ${BRAND_BLUE}` }}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
              onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
            >
              <option value="TODOS">Todos</option>
              {Object.values(IncidentStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="searchTerm" className="block text-[11px] font-medium text-slate-600 mb-0.5">Buscar:</label>
            <input 
              type="text" id="searchTerm" placeholder="ID, título, persona (nombre o UID), etc." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full p-1.5 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:border-transparent text-xs placeholder-slate-400"
              style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE, boxShadow: `0 0 0 0px ${BRAND_BLUE}` }}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
              onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
            />
          </div>
        </div>
      </div>
      {filteredIncidents.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-500 bg-white shadow-md rounded-lg p-4">
            <p className="text-sm font-semibold">{emptyListMessage}</p>
            {searchTerm || filterStatus !== 'TODOS' ? 
                <p className="text-xs mt-1">Ajusta tus filtros o búsqueda.</p> : 
                (mode === 'reported' && (
                  <>
                    <p className="text-xs mt-1">Puedes empezar reportando una nueva.</p>
                    <button 
                        onClick={onNavigateToReportScreen}
                        className="mt-3 px-3 py-1.5 text-xs font-medium text-white rounded-md shadow-sm"
                        style={{backgroundColor: BRAND_BLUE}}
                    >
                        Reportar Nueva Incidencia
                    </button>
                  </>
                ))
            }
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto space-y-2 pb-1 pr-0.5 chat-container">
          {filteredIncidents.map(incident => (
              <IncidentListItem
                key={incident.id}
                incident={incident}
                currentUser={currentUser}
                users={users}
                mode={mode}
                onViewDetails={handleViewDetails}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};

export default IncidentManagementView;
