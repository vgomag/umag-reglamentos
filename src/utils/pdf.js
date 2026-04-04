/**
 * Utilidades compartidas para procesamiento de PDF.
 * Elimina duplicación entre RegulationDetail.jsx y Normativa.jsx.
 */

/**
 * Extrae texto de un archivo PDF usando pdf.js.
 * @param {File} file - Archivo PDF
 * @returns {Promise<string|null>} Texto extraído o null si falla
 */
export async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    alert('La librería PDF.js no está disponible. Recarga la página.');
    return null;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items || [];
      fullText += items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  } catch (e) {
    console.error('Error al extraer texto del PDF:', e);
    return null;
  }
}
