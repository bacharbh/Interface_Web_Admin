/**
 * Smart Shepherd - Excel Export Service
 * Service d'export Excel avec SheetJS (xlsx)
 */

import * as XLSX from 'xlsx';
import api from './api.js';

export interface HealthDataExport {
  'ID Animal': string;
  'ID Appareil': string;
  'Date/Heure': string;
  'Fréquence Cardiaque (BPM)': number;
  'Température (°C)': number;
  'Batterie (%)': number;
  'Activité': string;
  'Signal (dBm)': number;
  'Pas': number;
  'Vitesse (km/h)': number;
  'Cap (°)': number;
  'Latitude': number;
  'Longitude': number;
}

export interface AnalyticsDataExport {
  'ID Animal': string;
  'Date': string;
  'FC Moyenne': number;
  'Température Moyenne': number;
  'Batterie Moyenne': number;
  'Total Pas': number;
  'Vitesse Moyenne': number;
  'Activité Principale': string;
  'Nombre Enregistrements': number;
}

/**
 * Exporter les données de santé en Excel
 */
export const exportHealthDataToExcel = async (
  data: HealthDataExport[],
  filename: string = 'smart-shepherd-health-data.xlsx'
): Promise<void> => {
  try {
    // Créer un nouveau workbook
    const workbook = XLSX.utils.book_new();

    // Créer une feuille pour les données brutes
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Ajuster la largeur des colonnes
    const colWidths = [
      { wch: 15 }, // ID Animal
      { wch: 15 }, // ID Appareil
      { wch: 20 }, // Date/Heure
      { wch: 20 }, // Fréquence Cardiaque
      { wch: 15 }, // Température
      { wch: 12 }, // Batterie
      { wch: 12 }, // Activité
      { wch: 12 }, // Signal
      { wch: 10 }, // Pas
      { wch: 12 }, // Vitesse
      { wch: 10 }, // Cap
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
    ];
    worksheet['!cols'] = colWidths;

    // Ajouter la feuille au workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Données Santé');

    // Créer une feuille de résumé
    const summaryData = createHealthSummary(data);
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Résumé');

    // Télécharger le fichier
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Erreur export Excel:', error);
    throw new Error('Erreur lors de l\'export Excel');
  }
};

/**
 * Exporter les données analytics en Excel
 */
export const exportAnalyticsDataToExcel = async (
  data: AnalyticsDataExport[],
  filename: string = 'smart-shepherd-analytics.xlsx'
): Promise<void> => {
  try {
    const workbook = XLSX.utils.book_new();

    // Feuille principale
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 15 }, // ID Animal
      { wch: 12 }, // Date
      { wch: 12 }, // FC Moyenne
      { wch: 15 }, // Température Moyenne
      { wch: 15 }, // Batterie Moyenne
      { wch: 12 }, // Total Pas
      { wch: 15 }, // Vitesse Moyenne
      { wch: 18 }, // Activité Principale
      { wch: 18 }, // Nombre Enregistrements
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');

    // Feuille par animal
    const byAnimal = groupByAnimal(data);
    Object.entries(byAnimal).forEach(([sheepId, animalData]) => {
      const animalWorksheet = XLSX.utils.json_to_sheet(animalData);
      animalWorksheet['!cols'] = worksheet['!cols'];
      XLSX.utils.book_append_sheet(workbook, animalWorksheet, sheepId);
    });

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Erreur export analytics Excel:', error);
    throw new Error('Erreur lors de l\'export analytics Excel');
  }
};

/**
 * Créer un résumé des données de santé
 */
const createHealthSummary = (data: HealthDataExport[]) => {
  if (data.length === 0) return [];

  const avgHeartRate = data.reduce((sum, d) => sum + d['Fréquence Cardiaque (BPM)'], 0) / data.length;
  const avgTemperature = data.reduce((sum, d) => sum + d['Température (°C)'], 0) / data.length;
  const avgBattery = data.reduce((sum, d) => sum + d['Batterie (%)'], 0) / data.length;

  const uniqueAnimals = new Set(data.map(d => d['ID Animal']));

  return [
    { 'Métrique': 'Total Enregistrements', 'Valeur': data.length },
    { 'Métrique': 'Animaux Uniques', 'Valeur': uniqueAnimals.size },
    { 'Métrique': 'FC Moyenne (BPM)', 'Valeur': avgHeartRate.toFixed(1) },
    { 'Métrique': 'Température Moyenne (°C)', 'Valeur': avgTemperature.toFixed(1) },
    { 'Métrique': 'Batterie Moyenne (%)', 'Valeur': avgBattery.toFixed(1) },
  ];
};

/**
 * Grouper les données par animal
 */
const groupByAnimal = (data: AnalyticsDataExport[]): Record<string, AnalyticsDataExport[]> => {
  return data.reduce((acc, item) => {
    const sheepId = item['ID Animal'];
    if (!acc[sheepId]) {
      acc[sheepId] = [];
    }
    acc[sheepId].push(item);
    return acc;
  }, {} as Record<string, AnalyticsDataExport[]>);
};

/**
 * Télécharger les données de santé depuis l'API
 */
export const fetchHealthDataForExport = async (
  startDate: string,
  endDate: string,
  sheepId?: string
): Promise<HealthDataExport[]> => {
  try {
    const response = await api.get('/reports/export/health-data', {
      params: { startDate, endDate, sheepId }
    });

    return response.data.data;
  } catch (error) {
    console.error('Erreur fetch health data:', error);
    throw error;
  }
};

/**
 * Télécharger les données analytics depuis l'API
 */
export const fetchAnalyticsDataForExport = async (
  startDate: string,
  endDate: string
): Promise<AnalyticsDataExport[]> => {
  try {
    const response = await api.get('/reports/export/analytics-data', {
      params: { startDate, endDate }
    });

    return response.data.data.map((d: any) => ({
      'ID Animal': d._id.sheepId,
      'Date': d._id.date,
      'FC Moyenne': d.avgHeartRate.toFixed(1),
      'Température Moyenne': d.avgTemperature.toFixed(1),
      'Batterie Moyenne': d.avgBattery.toFixed(1),
      'Total Pas': d.totalSteps,
      'Vitesse Moyenne': d.avgSpeed.toFixed(1),
      'Activité Principale': getMostFrequentActivity(d.activities),
      'Nombre Enregistrements': d.count
    }));
  } catch (error) {
    console.error('Erreur fetch analytics data:', error);
    throw error;
  }
};

/**
 * Obtenir l'activité la plus fréquente
 */
const getMostFrequentActivity = (activities: string[]): string => {
  if (!activities || activities.length === 0) return 'N/A';

  const counts = activities.reduce((acc, activity) => {
    acc[activity] = (acc[activity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * Générer et télécharger un rapport PDF
 */
export const downloadPDFReport = async (
  reportType: 'weekly' | 'monthly' | 'veterinary',
  params: any
): Promise<void> => {
  try {
    let url: string;
    let filename: string;

    if (reportType === 'weekly') {
      url = '/reports/weekly';
      filename = `rapport-hebdo-${params.startDate}-${params.endDate}.pdf`;
    } else if (reportType === 'monthly') {
      url = '/reports/monthly';
      filename = `rapport-mensuel-${params.year}-${params.month}.pdf`;
    } else if (reportType === 'veterinary') {
      url = `/reports/veterinary/${params.sheepId}`;
      filename = `rapport-veterinaire-${params.sheepId}-${params.startDate}-${params.endDate}.pdf`;
    } else {
      throw new Error('Type de rapport invalide');
    }

    const response = await api.post(url, params, {
      responseType: 'blob'
    });

    const blob = response.data;
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(urlBlob);
  } catch (error) {
    console.error('Erreur download PDF:', error);
    throw error;
  }
};
