"use client";
import React, { useState, useEffect } from 'react';
import { Activity, Database, FileCode, Terminal, User, AlertCircle } from 'lucide-react';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot, query, orderBy } from "firebase/firestore";
// Import the processor we just created
import { detectAnomalies } from '@/lib/ai-processor';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default function PACSWorkqueue() {
  const [admittedPatients, setAdmittedPatients] = useState<any[]>([]);
  const [fhirResource, setFhirResource] = useState<any | null>(null);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const gabeMockStudy = {
    '00100010': { Value: [{ Alphabetic: "CASILLAS, GABE" }] },
    '00080060': { Value: ["MR"] },
    '00081030': { Value: ["BRAIN W/O CONTRAST"] },
    '00080020': { Value: ["20260227"] },
    '0020000D': { Value: ["1.2.840.113619.2.203.4.2147483647"] }
  };

  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("lastUpdated", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdmittedPatients(patients);
    });
    return () => unsubscribe();
  }, []);

  function formatDicomDate(dateStr: string | undefined): string {
    if (!dateStr || dateStr.length !== 8) return "2026-02-27";
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  const convertToFhir = (data: any) => {
    let resource: any;
    
    // 1. Run AI Detection first
    const aiDetection = detectAnomalies(data);
    setAiResult(aiDetection);
    setShowOverlay(false); // Reset overlay when switching patients

    // 2. Map to FHIR
    if (data['00100010']) {
      resource = {
        resourceType: "ImagingStudy",
        id: `fhir-${data['0020000D']?.Value?.[0]}`,
        status: "available",
        subject: { display: data['00100010']?.Value?.[0]?.Alphabetic },
        description: data['00081030']?.Value?.[0],
        started: formatDicomDate(data['00080020']?.Value?.[0]),
        modality: [{ code: data['00080060']?.Value?.[0] }]
      };
    } else {
      resource = {
        resourceType: "ImagingStudy",
        id: `fhir-${data.id}`,
        status: "available",
        subject: { display: data.fullName },
        description: "Inbound HL7 Admission",
        started: new Date().toISOString().split('T')[0],
        modality: [{ code: "CT" }]
      };
    }
    setFhirResource(resource);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans flex flex-col gap-8">
      {/* WORKSPACE SECTION */}
      <section className="flex-grow flex flex-col gap-6">
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="text-blue-500" /> Clinical Imaging Workspace
            </h1>
            <p className="text-slate-400 text-sm">AI-Enhanced HL7 Ingestion & DICOMweb Transformation</p>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-xl text-white">
            <div className="bg-slate-800 p-3 text-xs font-bold uppercase tracking-wider text-slate-400">Active Study Workqueue</div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-500 bg-slate-900/50">
                <tr><th className="p-4 text-white">Patient Name</th><th className="p-4 text-white">Modality/Status</th><th className="p-4 text-right text-white text-white">Action</th></tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800/50 bg-blue-900/10 hover:bg-blue-900/20">
                  <td className="p-4 font-bold text-white tracking-wide">{gabeMockStudy['00100010'].Value[0].Alphabetic}</td>
                  <td className="p-4">
                      <span className="bg-blue-900/40 text-blue-400 px-2 py-1 rounded text-xs font-bold mr-2">{gabeMockStudy['00080060'].Value[0]}</span>
                      <span className="text-[10px] text-slate-500 italic uppercase">Raw DICOM Meta</span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => convertToFhir(gabeMockStudy)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs font-bold transition-all shadow-lg active:scale-95 text-white">Process</button>
                  </td>
                </tr>
                {admittedPatients.map((patient) => (
                  <tr key={patient.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-medium text-slate-200">{patient.fullName}</td>
                    <td className="p-4">
                      <span className="bg-green-900/40 text-green-400 px-2 py-1 rounded text-xs font-bold mr-2">{patient.status}</span>
                      <span className="text-[10px] text-slate-500 italic">HL7 INBOUND</span>
                    </td>
                    <td className="p-4 text-right text-white">
                      <button onClick={() => convertToFhir(patient)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs transition-all active:scale-95 text-white">Map to FHIR</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="col-span-4 bg-slate-900 rounded-lg border border-slate-800 h-full flex flex-col min-h-[350px]">
            <div className="bg-slate-800 p-3 text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between">
              <span>FHIR Mapping Output</span>
              <FileCode size={16} />
            </div>
            <div className="p-4 flex-grow overflow-auto text-white">
              {fhirResource ? (
                <pre className="text-[11px] text-green-400 font-mono leading-relaxed bg-slate-950 p-4 rounded border border-slate-800 text-white">
                  {JSON.stringify(fhirResource, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-center text-sm">
                  <Terminal className="mb-2 opacity-20 text-white" size={48} />
                  Select study to trigger mapping.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ENTERPRISE EMR PORTAL */}
      <section className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-300 tracking-tight text-white uppercase tracking-widest text-white">Enterprise EMR Portal</h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-blue-100 min-h-[450px]">
          {fhirResource ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* EMR Header */}
              <div className="bg-gradient-to-r from-blue-50 to-white p-8 border-b border-blue-100 flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <div className="bg-blue-600 h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <User size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{fhirResource.subject.display}</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest">MRN: {fhirResource.id.substring(0, 15)}</p>
                  </div>
                </div>
              </div>

              {/* AI WARNING BLOCK - Gabe Specific */}
              {aiResult?.status === "ANOMALY_DETECTED" && (
                <div className="px-8 pt-8 animate-pulse">
                  <div className="bg-red-50 border-2 border-red-200 p-5 rounded-2xl flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="bg-red-600 p-2.5 rounded-xl text-white shadow-lg shadow-red-200">
                        <AlertCircle size={28} />
                      </div>
                      <div>
                        <h4 className="text-red-800 font-black text-xs uppercase tracking-[0.1em]">Critical Machine Vision Alert</h4>
                        <p className="text-red-700 text-xl font-black">{aiResult.finding} Detected</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-red-400 uppercase block tracking-widest mb-1">AI Confidence</span>
                      <span className="text-3xl font-black text-red-600">{(aiResult.probability * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Details & Diagnostic Viewer */}
              <div className="p-8 grid grid-cols-12 gap-8 bg-slate-50/30">
                <div className="col-span-7 space-y-6 text-sm">
                  <div className="bg-white p-6 rounded-xl border border-blue-50 shadow-sm">
                    <p className="text-[10px] font-bold text-blue-500 uppercase mb-3 tracking-widest">Clinical Imaging Report</p>
                    <p className="text-lg font-bold text-slate-800 mb-2 underline decoration-blue-100 underline-offset-8 decoration-4">{fhirResource.description}</p>
                    <p className="text-slate-500 italic leading-relaxed mt-4">
                      Interoperability engine successfully mapped legacy DICOM and HL7 data into a validated FHIR R4 resource.
                    </p>
                  </div>
                  
                  {/* PACS Metadata Card */}
                  <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-2xl">
                    <h4 className="font-bold text-blue-400 mb-4 text-xs uppercase tracking-widest border-b border-slate-800 pb-2">Technical Specs</h4>
                    <div className="space-y-3 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500 uppercase">Modality</span>
                        <span className="text-blue-300 font-bold">{fhirResource.modality[0].code}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-3">
                        <span className="text-slate-500 uppercase italic text-white">Source</span>
                        <span className="text-slate-300 uppercase">DICOMweb JSON (PS3.18)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- DIAGNOSTIC VIEWER SECTION --- */}
                <div className="col-span-5">
                   <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-2xl border border-slate-800">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                      <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-widest text-white">Diagnostic Viewer</h4>
                      {aiResult?.status === "ANOMALY_DETECTED" && (
                        <button 
                          onClick={() => setShowOverlay(!showOverlay)}
                          className={`px-3 py-1 rounded-full text-[9px] font-black transition-all duration-300 ${
                            showOverlay 
                              ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {showOverlay ? 'SEG OVERLAY: ON' : 'SEG OVERLAY: OFF'}
                        </button>
                      )}
                    </div>
                    
                      {/* Simulated DICOM Canvas */}
                      <div className="relative aspect-square w-full bg-black rounded-lg overflow-hidden border-2 border-slate-800 flex items-center justify-center group shadow-inner">
                        
                        {/* Background Visual - ONLY SHOW BRAIN FOR GABE */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {aiResult?.status === "ANOMALY_DETECTED" ? (
                           <img 
                           src="/Brain.jpg" 
                           alt="Axial Brain MRI"
                           className="w-full h-full object-cover opacity-80"
                         />
                          ) : (
                            <div className="flex flex-col items-center opacity-20">
                              <Database size={60} strokeWidth={1} className="text-slate-400" />
                              <p className="text-[10px] mt-2 font-mono uppercase tracking-widest text-slate-500">No Pixel Data</p>
                            </div>
                          )}
                        </div>

                      {/* DICOM Corner Tags */}
                      <div className="absolute top-2 left-2 text-[8px] font-mono text-white/70 uppercase flex flex-col z-10 bg-black/40 p-1 rounded">
                        <span>{fhirResource?.modality[0]?.code} | {fhirResource?.subject?.display}</span>
                        <span>ID: {fhirResource?.id?.substring(0, 12)}...</span>
                      </div>
                      <div className="absolute bottom-2 right-2 text-[8px] font-mono text-white/50 z-10 bg-black/40 p-1 rounded">
                        W: 400 L: 40
                      </div>

                      {/* AI OVERLAY RENDER */}
                      {showOverlay && aiResult?.status === "ANOMALY_DETECTED" && (
                        <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-95 duration-500 z-20">
                          {/* Pulsing Segmentation Area */}
                          <div className="w-32 h-32 border-2 border-red-500 rounded-full border-dashed animate-[spin_8s_linear_infinite] opacity-60"></div>
                          <div className="absolute bg-red-600/30 w-28 h-28 rounded-full blur-2xl animate-pulse"></div>
                          
                          {/* Targeting Label */}
                          <div className="absolute top-1/3 left-1/4 border-l-2 border-t-2 border-red-500 pl-2 pt-1 z-30">
                            <span className="text-red-500 text-[9px] font-black bg-black/80 px-1 py-0.5 tracking-tighter uppercase">
                              {aiResult.finding}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {!showOverlay && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 z-10">
                          <p className="text-[10px] text-white/60 italic">Raw Pixel Data (Unfiltered)</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-center">
                       <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold italic">Simulated DICOM Render Area</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[450px] flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
              <Database size={64} className="text-blue-100 mb-4 opacity-50" />
              <p className="text-xl font-bold text-slate-400 tracking-tight">Clinical Decision Support Offline</p>
              <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest">Awaiting HL7 Ingestion or DICOM Processing</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}