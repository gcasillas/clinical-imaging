/**
 * Simulates an AI Vision Model finding an anomaly based on DICOMweb metadata
 */
export function detectAnomalies(dicom: any) {
    // DICOM Tag 0010,0010 is Patient Name
    const patientName = dicom['00100010']?.Value?.[0]?.Alphabetic || "";
    
    // Logical Trigger: Specifically for your mock study to demonstrate the "Critical Path"
    if (patientName.includes("CASILLAS")) {
      return {
        status: "ANOMALY_DETECTED",
        finding: "Acute Intracranial Hemorrhage",
        probability: 0.98,
        segObject: {
          '00080016': { Value: ["1.2.840.10008.5.1.4.1.1.66.4"] }, // SEG SOP Class
          '00620002': { Value: ["SEMIAUTOMATIC"] },
          '00620005': { Value: ["Brain Tissue"] },
          'referencedSOP': dicom['0020000D']?.Value?.[0] || "1.2.3"
        }
      };
    }
    
    return { 
      status: "NORMAL", 
      finding: "No anomalies detected", 
      probability: 0.01,
      segObject: null 
    };
  }