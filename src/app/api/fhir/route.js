/**
* Maps DICOMweb JSON metadata to a FHIR ImagingStudy Resource
* @param {Object} dicomJson - The JSON object from a DICOMweb C-STORE or Search
* @returns {Object} - A valid FHIR ImagingStudy resource
*/
export function mapDicomToFhir(dicomJson) {
    // DICOM Tags are usually hex keys in the JSON model (PS3.18)
    const studyInstanceUID = dicomJson['0020000D']?.Value?.[0];
    const patientName = dicomJson['00100010']?.Value?.[0]?.Alphabetic || "Anonymous";
    const modality = dicomJson['00080060']?.Value?.[0];
    const studyDate = dicomJson['00080020']?.Value?.[0]; // Format: YYYYMMDD
     return {
      resourceType: "ImagingStudy",
      status: "available",
      subject: {
        display: patientName
      },
      started: formatDicomDate(studyDate),
      modality: [{
        system: "http://dicom.nema.org/resources/ontology/DCM",
        code: modality
      }],
      identifier: [{
        system: "urn:dicom:uid",
        value: `urn:oid:${studyInstanceUID}`
      }]
    };
  }
   // Helper to make DICOM dates (YYYYMMDD) FHIR-compliant (YYYY-MM-DD)
  function formatDicomDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
 