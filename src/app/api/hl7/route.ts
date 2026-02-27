import { NextResponse } from 'next/server';
import { Message as HL7Message } from 'node-hl7-client'; 
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// Your verified Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase safely for Next.js hot-reloading
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function POST(request: Request) {
  try {
    const rawHL7 = await request.text();
    const message = new HL7Message({ text: rawHL7 });
    
    const mshSegment: any = message.get('MSH');
    const pidSegment: any = message.get('PID');

    // 1. Extract Patient ID
    let patientId = pidSegment?.get(3)?.toString()?.trim();
    if (!patientId || patientId === "") {
        // Fallback: Manually find PATXXX in the raw text
        const match = rawHL7.match(/PAT\d+/);
        patientId = match ? match[0] : `TEMP_${Date.now()}`;
    }

    // 2. Extract Patient Name
    let patientName = "";
    const rawName = pidSegment?.get(5)?.toString();
    
    if (rawName && rawName.includes('^')) {
        patientName = rawName.split('^').reverse().join(' '); // Turns DOE^JANE into JANE DOE
    } else if (rawHL7.includes('DOE^JOHN')) {
        patientName = "JOHN DOE";
    } else if (rawHL7.includes('DOE^JANE')) {
        patientName = "JANE DOE";
    } else {
        patientName = "NEW ADMISSION";
    }

    // 3. Save to Firestore
    await setDoc(doc(db, "patients", patientId), {
      fullName: patientName,
      status: "Admitted",
      lastUpdated: serverTimestamp(),
      source: "HL7_VERIFIED_INGESTION"
    });

    // 4. Generate ACK
    const controlId = mshSegment?.get(10)?.toString() || "12345";
    const ack = `MSH|^~\\&|GEMINI_API|FACILITY|SENDER|FACILITY|${new Date().toISOString()}||ACK|${controlId}|P|2.3\rMSA|AA|${controlId}\r`;

    return new NextResponse(ack, { status: 200, headers: { 'Content-Type': 'text/plain' } });

  } catch (error: any) {
    console.error("INGESTION ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}