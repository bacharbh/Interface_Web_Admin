/**
 * Smart Shepherd - Report Generator Service
 * Service de génération de rapports PDF avec PDFKit
 */

import PDFDocument from 'pdfkit';
import TelemetryData from '../models/TelemetryData.js';
import Sheep from '../models/Sheep.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

class ReportGenerator {
  /**
   * Générer un rapport hebdomadaire en PDF
   */
  async generateWeeklyReport(startDate, endDate) {
    return this.renderPdf(async (doc) => {
      this.addHeader(doc, 'Rapport Hebdomadaire - Smart Shepherd', startDate, endDate);
      await this.addSummarySection(doc, startDate, endDate);
      await this.addHealthOverview(doc, startDate, endDate);
      await this.addActivityAnalysis(doc, startDate, endDate);
      await this.addAlertsSection(doc, startDate, endDate);
      doc.on('pageAdded', () => this.addFooter(doc));
    });
  }

  /**
   * Générer un rapport mensuel en PDF
   */
  async generateMonthlyReport(year, month) {
    return this.renderPdf(async (doc) => {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      this.addHeader(doc, `Rapport Mensuel - ${format(startDate, 'MMMM yyyy', { locale: fr })}`, startDate, endDate);
      await this.addSummarySection(doc, startDate, endDate);
      await this.addHealthOverview(doc, startDate, endDate);
      await this.addActivityAnalysis(doc, startDate, endDate);
      await this.addAlertsSection(doc, startDate, endDate);
      await this.addTrendsSection(doc, startDate, endDate);
      doc.on('pageAdded', () => this.addFooter(doc));
    });
  }

  /**
   * Générer un rapport vétérinaire par animal
   */
  async generateVeterinaryReport(sheepId, startDate, endDate) {
    return this.renderPdf(async (doc) => {
      const sheep = await Sheep.findOne({ sheepId });
      if (!sheep) {
        throw new Error('Animal non trouvé');
      }

      const telemetryData = await TelemetryData.find({
        sheepId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });

      this.addHeader(doc, `Rapport Vétérinaire - ${sheep.sheepId}`, startDate, endDate);
      this.addAnimalInfo(doc, sheep);
      this.addHealthData(doc, telemetryData);
      this.addAnimalAlerts(doc, telemetryData);
      this.addVeterinaryRecommendations(doc, telemetryData);
      doc.on('pageAdded', () => this.addFooter(doc));
    });
  }

  async renderPdf(buildDocument) {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        await buildDocument(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Ajouter l'en-tête du document
   */
  addHeader(doc, title, startDate, endDate) {
    // Logo et titre
    doc.fontSize(24).fillColor('#16a34a').text('🐑 Smart Shepherd', 50, 50, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor('#1f2937').text(title, 50, null, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#6b7280').text(
      `Période: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`,
      50,
      null,
      { align: 'center' }
    );
    doc.moveDown();

    // Ligne de séparation
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
  }

  /**
   * Ajouter le pied de page
   */
  addFooter(doc) {
    doc.fontSize(8).fillColor('#9ca3af').text(
      `Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Smart Shepherd IoT System`,
      50,
      doc.page.height - 30,
      { align: 'center' }
    );
  }

  /**
   * Ajouter la section résumé
   */
  async addSummarySection(doc, startDate, endDate) {
    doc.fontSize(14).fillColor('#1f2937').text('📊 Résumé Général', 50, doc.y + 10);
    doc.moveDown(0.5);

    const totalSheep = await Sheep.countDocuments({ isActive: true });
    const telemetryCount = await TelemetryData.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate }
    });

    const summaryData = [
      ['Métrique', 'Valeur'],
      ['Total Animaux Actifs', totalSheep.toString()],
      ['Enregistrements Télémétrie', telemetryCount.toString()],
      ['Période', `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`]
    ];

    this.addTable(doc, summaryData);
    doc.moveDown();
  }

  /**
   * Ajouter la section santé
   */
  async addHealthOverview(doc, startDate, endDate) {
    doc.fontSize(14).fillColor('#1f2937').text('❤️ Aperçu Santé', 50, doc.y + 10);
    doc.moveDown(0.5);

    const healthData = await TelemetryData.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$sheepId',
          avgHeartRate: { $avg: '$heartRate' },
          avgTemperature: { $avg: '$temperature' },
          avgBattery: { $avg: '$battery' },
          minHeartRate: { $min: '$heartRate' },
          maxHeartRate: { $max: '$heartRate' },
          minTemperature: { $min: '$temperature' },
          maxTemperature: { $max: '$temperature' }
        }
      }
    ]);

    if (healthData.length > 0) {
      const avgHeartRate = healthData.reduce((sum, d) => sum + d.avgHeartRate, 0) / healthData.length;
      const avgTemperature = healthData.reduce((sum, d) => sum + d.avgTemperature, 0) / healthData.length;
      const avgBattery = healthData.reduce((sum, d) => sum + d.avgBattery, 0) / healthData.length;

      const healthTable = [
        ['Métrique Santé', 'Moyenne', 'Min', 'Max'],
        ['Fréquence Cardiaque (BPM)', avgHeartRate.toFixed(1), '-', '-'],
        ['Température (°C)', avgTemperature.toFixed(1), '-', '-'],
        ['Batterie (%)', avgBattery.toFixed(1), '-', '-']
      ];

      this.addTable(doc, healthTable);
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('Aucune donnée de santé disponible pour cette période.');
    }

    doc.moveDown();
  }

  /**
   * Ajouter la section activité
   */
  async addActivityAnalysis(doc, startDate, endDate) {
    doc.fontSize(14).fillColor('#1f2937').text('🏃 Analyse d\'Activité', 50, doc.y + 10);
    doc.moveDown(0.5);

    const activityData = await TelemetryData.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$activity',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    if (activityData.length > 0) {
      const activityTable = [
        ['Activité', 'Nombre d\'enregistrements', 'Pourcentage'],
        ...activityData.map(d => [
          d._id || 'Inconnu',
          d.count.toString(),
          `${((d.count / activityData.reduce((sum, x) => sum + x.count, 0)) * 100).toFixed(1)}%`
        ])
      ];

      this.addTable(doc, activityTable);
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('Aucune donnée d\'activité disponible pour cette période.');
    }

    doc.moveDown();
  }

  /**
   * Ajouter la section alertes
   */
  async addAlertsSection(doc, startDate, endDate) {
    doc.fontSize(14).fillColor('#1f2937').text('🚨 Alertes et Anomalies', 50, doc.y + 10);
    doc.moveDown(0.5);

    // Anomalies de fréquence cardiaque
    const highHeartRate = await TelemetryData.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      heartRate: { $gt: 120 }
    });

    const lowHeartRate = await TelemetryData.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      heartRate: { $lt: 60 }
    });

    // Anomalies de température
    const highTemp = await TelemetryData.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      temperature: { $gt: 40.5 }
    });

    const lowTemp = await TelemetryData.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      temperature: { $lt: 38.0 }
    });

    // Batterie faible
    const lowBattery = await TelemetryData.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
      battery: { $lt: 20 }
    });

    const alertsTable = [
      ['Type d\'Alerte', 'Nombre d\'occurrences'],
      ['Fréquence cardiaque élevée (>120 BPM)', highHeartRate.toString()],
      ['Fréquence cardiaque basse (<60 BPM)', lowHeartRate.toString()],
      ['Température élevée (>40.5°C)', highTemp.toString()],
      ['Température basse (<38.0°C)', lowTemp.toString()],
      ['Batterie faible (<20%)', lowBattery.toString()]
    ];

    this.addTable(doc, alertsTable);
    doc.moveDown();
  }

  /**
   * Ajouter la section tendances (rapport mensuel)
   */
  async addTrendsSection(doc, startDate, endDate) {
    doc.fontSize(14).fillColor('#1f2937').text('📈 Tendances Mensuelles', 50, doc.y + 10);
    doc.moveDown(0.5);

    const weeklyData = await TelemetryData.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            week: { $week: '$timestamp' }
          },
          avgHeartRate: { $avg: '$heartRate' },
          avgTemperature: { $avg: '$temperature' },
          avgBattery: { $avg: '$battery' }
        }
      },
      {
        $sort: { '_id.week': 1 }
      }
    ]);

    if (weeklyData.length > 0) {
      const trendsTable = [
        ['Semaine', 'FC Moyenne', 'Température Moyenne', 'Batterie Moyenne'],
        ...weeklyData.map(d => [
          `Semaine ${d._id.week}`,
          d.avgHeartRate.toFixed(1),
          d.avgTemperature.toFixed(1),
          d.avgBattery.toFixed(1)
        ])
      ];

      this.addTable(doc, trendsTable);
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('Données de tendances insuffisantes.');
    }

    doc.moveDown();
  }

  /**
   * Ajouter les informations de l'animal
   */
  addAnimalInfo(doc, sheep) {
    doc.fontSize(14).fillColor('#1f2937').text('🐑 Informations de l\'Animal', 50, doc.y + 10);
    doc.moveDown(0.5);

    const animalInfo = [
      ['Champ', 'Valeur'],
      ['ID Animal', sheep.sheepId],
      ['Race', sheep.breed],
      ['Âge', `${sheep.age} ans`],
      ['Poids', `${sheep.weight} kg`],
      ['Sexe', sheep.gender],
      ['Statut de Santé', sheep.healthStatus],
      ['ID Appareil', sheep.deviceId || 'N/A'],
      ['Dernière Vue', format(sheep.lastSeen, 'dd/MM/yyyy HH:mm')]
    ];

    this.addTable(doc, animalInfo);
    doc.moveDown();
  }

  /**
   * Ajouter les données de santé de l'animal
   */
  addHealthData(doc, telemetryData) {
    doc.fontSize(14).fillColor('#1f2937').text('❤️ Données de Santé', 50, doc.y + 10);
    doc.moveDown(0.5);

    if (telemetryData.length > 0) {
      const avgHeartRate = telemetryData.reduce((sum, d) => sum + (d.heartRate || 0), 0) / telemetryData.length;
      const avgTemperature = telemetryData.reduce((sum, d) => sum + (d.temperature || 0), 0) / telemetryData.length;
      const avgBattery = telemetryData.reduce((sum, d) => sum + (d.battery || 0), 0) / telemetryData.length;

      const healthTable = [
        ['Métrique', 'Moyenne', 'Min', 'Max'],
        ['Fréquence Cardiaque (BPM)', avgHeartRate.toFixed(1),
          Math.min(...telemetryData.map(d => d.heartRate || 0)).toFixed(1),
          Math.max(...telemetryData.map(d => d.heartRate || 0)).toFixed(1)],
        ['Température (°C)', avgTemperature.toFixed(1),
          Math.min(...telemetryData.map(d => d.temperature || 0)).toFixed(1),
          Math.max(...telemetryData.map(d => d.temperature || 0)).toFixed(1)],
        ['Batterie (%)', avgBattery.toFixed(1),
          Math.min(...telemetryData.map(d => d.battery || 0)).toFixed(1),
          Math.max(...telemetryData.map(d => d.battery || 0)).toFixed(1)]
      ];

      this.addTable(doc, healthTable);
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('Aucune donnée de santé disponible.');
    }

    doc.moveDown();
  }

  /**
   * Ajouter les alertes de l'animal
   */
  addAnimalAlerts(doc, telemetryData) {
    doc.fontSize(14).fillColor('#1f2937').text('🚨 Alertes et Anomalies', 50, doc.y + 10);
    doc.moveDown(0.5);

    const alerts = [];

    telemetryData.forEach(d => {
      if (d.heartRate > 120) alerts.push({ type: 'FC élevée', value: d.heartRate, date: d.timestamp });
      if (d.heartRate < 60) alerts.push({ type: 'FC basse', value: d.heartRate, date: d.timestamp });
      if (d.temperature > 40.5) alerts.push({ type: 'Température élevée', value: d.temperature, date: d.timestamp });
      if (d.temperature < 38.0) alerts.push({ type: 'Température basse', value: d.temperature, date: d.timestamp });
      if (d.battery < 20) alerts.push({ type: 'Batterie faible', value: d.battery, date: d.timestamp });
    });

    if (alerts.length > 0) {
      const alertsTable = [
        ['Type', 'Valeur', 'Date'],
        ...alerts.slice(0, 20).map(a => [
          a.type,
          a.value.toFixed(1),
          format(new Date(a.date), 'dd/MM/yyyy HH:mm')
        ])
      ];

      this.addTable(doc, alertsTable);
    } else {
      doc.fontSize(10).fillColor('#16a34a').text('✓ Aucune alerte détectée.');
    }

    doc.moveDown();
  }

  /**
   * Ajouter les recommandations vétérinaires
   */
  addVeterinaryRecommendations(doc, telemetryData) {
    doc.fontSize(14).fillColor('#1f2937').text('💡 Recommandations Vétérinaires', 50, doc.y + 10);
    doc.moveDown(0.5);

    const recommendations = [];

    const avgHeartRate = telemetryData.reduce((sum, d) => sum + (d.heartRate || 0), 0) / telemetryData.length;
    const avgTemperature = telemetryData.reduce((sum, d) => sum + (d.temperature || 0), 0) / telemetryData.length;

    if (avgHeartRate > 100) {
      recommendations.push('Surveillance accrue de la fréquence cardiaque - examen vétérinaire recommandé');
    } else if (avgHeartRate < 70) {
      recommendations.push('Fréquence cardiaque basse - vérifier l\'état général de l\'animal');
    }

    if (avgTemperature > 39.5) {
      recommendations.push('Température élevée - possible infection - consultation vétérinaire urgente');
    } else if (avgTemperature < 38.0) {
      recommendations.push('Température basse - vérifier l\'hypothermie');
    }

    if (recommendations.length === 0) {
      recommendations.push('Aucune recommandation particulière - surveillance normale');
    }

    recommendations.forEach(rec => {
      doc.fontSize(10).fillColor('#1f2937').text(`• ${rec}`, 50, doc.y + 5);
    });

    doc.moveDown();
  }

  /**
   * Ajouter un tableau au document
   */
  addTable(doc, data) {
    const tableTop = doc.y;
    const rowHeight = 25;
    const colWidths = [200, 100, 100, 100];

    // En-tête du tableau
    doc.fontSize(10).fillColor('#16a34a');
    data[0].forEach((header, i) => {
      doc.text(header, 50 + (i > 0 ? colWidths.slice(0, i).reduce((a, b) => a + b, 0) : 0), tableTop, {
        width: colWidths[i] || 100,
        align: 'left'
      });
    });

    // Lignes de données
    doc.fillColor('#374151');
    for (let i = 1; i < data.length; i++) {
      const y = tableTop + (i * rowHeight);
      data[i].forEach((cell, j) => {
        doc.text(cell, 50 + (j > 0 ? colWidths.slice(0, j).reduce((a, b) => a + b, 0) : 0), y, {
          width: colWidths[j] || 100,
          align: 'left'
        });
      });
    }

    // Ligne de séparation sous le tableau
    doc.strokeColor('#e5e7eb').lineWidth(0.5);
    doc.moveTo(50, tableTop + (data.length * rowHeight))
      .lineTo(545, tableTop + (data.length * rowHeight))
      .stroke();

    doc.y = tableTop + (data.length * rowHeight) + 10;
  }
}

export default new ReportGenerator();
