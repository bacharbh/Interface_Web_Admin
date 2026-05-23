# Smart Shepherd - Entity Relationship Diagram

## MongoDB Collections ERD

```mermaid
erDiagram
    %% Collections Principales
    User {
        ObjectId _id PK
        string username UK
        string email UK
        string password
        string role
        boolean isActive
        date createdAt
        date lastLogin
    }

    Sheep {
        ObjectId _id PK
        string sheepId UK
        string breed
        integer age
        float weight
        string gender
        string healthStatus
        ObjectId deviceId FK
        object location
        boolean isActive
        date createdAt
        date updatedAt
        ObjectId createdBy FK
    }

    Device {
        ObjectId _id PK
        string deviceId UK
        string deviceType
        string model
        string firmwareVersion
        float batteryLevel
        string signalStrength
        boolean isActive
        date lastSeen
        date createdAt
        ObjectId assignedToSheep FK
    }

    TelemetryData {
        ObjectId _id PK
        ObjectId deviceId FK
        object location
        integer battery
        float temperature
        integer heartRate
        string activity
        integer signalStrength
        integer steps
        date timestamp
        date createdAt
    }

    Geofence {
        ObjectId _id PK
        string name
        string description
        array coords
        string color
        boolean isActive
        date createdAt
        date updatedAt
        ObjectId createdBy FK
    }

    Alert {
        ObjectId _id PK
        ObjectId sheepId FK
        ObjectId deviceId FK
        ObjectId geofenceId FK
        string alertType
        string severity
        string title
        string message
        boolean isActive
        date createdAt
        date resolvedAt
        ObjectId resolvedBy FK
    }

    Notification {
        ObjectId _id PK
        ObjectId userId FK
        ObjectId alertId FK
        ObjectId sheepId FK
        string type
        string title
        string message
        string severity
        boolean isRead
        date createdAt
        date readAt
    }

    MedicalRecord {
        ObjectId _id PK
        ObjectId sheepId FK
        string recordType
        string description
        string veterinarian
        date date
        string notes
        array medications
        date createdAt
        ObjectId createdBy FK
    }

    %% Relations avec Cardinalités
    User ||--o{ Sheep : "crée"
    User ||--o{ Geofence : "crée"
    User ||--o{ MedicalRecord : "crée"
    User ||--o{ Notification : "reçoit"
    User ||--o{ Alert : "résout"
    
    Sheep ||--|| Device : "possède"
    Sheep ||--o{ TelemetryData : "génère"
    Sheep ||--o{ Alert : "déclenche"
    Sheep ||--o{ MedicalRecord : "a"
    Sheep ||--o{ Notification : "concerne"
    
    Device ||--o{ TelemetryData : "envoie"
    Device ||--o{ Alert : "génère"
    
    Geofence ||--o{ Alert : "surveille"
    
    Alert ||--o{ Notification : "génère"
    
    %% Relations détaillées avec descriptions
    RELATIONSHIP_USER_SHEEP : User "1" -- "0..*" Sheep : "crée_gère"
    RELATIONSHIP_USER_GEOFENCE : User "1" -- "0..*" Geofence : "définit"
    RELATIONSHIP_USER_MEDICAL : User "1" -- "0..*" MedicalRecord : "enregistre"
    RELATIONSHIP_USER_NOTIFICATION : User "1" -- "0..*" Notification : "reçoit"
    RELATIONSHIP_USER_ALERT : User "1" -- "0..*" Alert : "résout"
    
    RELATIONSHIP_SHEEP_DEVICE : Sheep "1" -- "1" Device : "équipe"
    RELATIONSHIP_SHEEP_TELEMETRY : Sheep "1" -- "0..*" TelemetryData : "produit"
    RELATIONSHIP_SHEEP_ALERT : Sheep "1" -- "0..*" Alert : "déclenche"
    RELATIONSHIP_SHEEP_MEDICAL : Sheep "1" -- "0..*" MedicalRecord : "possède"
    RELATIONSHIP_SHEEP_NOTIFICATION : Sheep "1" -- "0..*" Notification : "sujet"
    
    RELATIONSHIP_DEVICE_TELEMETRY : Device "1" -- "0..*" TelemetryData : "transmet"
    RELATIONSHIP_DEVICE_ALERT : Device "1" -- "0..*" Alert : "signale"
    
    RELATIONSHIP_GEOFENCE_ALERT : Geofence "1" -- "0..*" Alert : "contrôle"
    
    RELATIONSHIP_ALERT_NOTIFICATION : Alert "1" -- "0..*" Notification : "crée"
```

## Détail des Collections

### User
- **Rôle**: Gestion des comptes utilisateurs et permissions
- **Champs clés**: `_id`, `username`, `email`, `role`
- **Relations**: Crée des animaux, géofences, enregistrements médicaux

### Sheep  
- **Rôle**: Information sur les animaux du troupeau
- **Champs clés**: `_id`, `sheepId`, `deviceId`, `healthStatus`
- **Relations**: Possède un device, génère des données télémétriques

### Device
- **Rôle**: Appareils IoT (colliers) attachés aux animaux
- **Champs clés**: `_id`, `deviceId`, `batteryLevel`, `lastSeen`
- **Relations**: Assigné à un sheep, envoie des données télémétriques

### TelemetryData
- **Rôle**: Données temps réel des capteurs IoT
- **Champs clés**: `_id`, `deviceId`, `timestamp`, `location`
- **Relations**: Provenant d'un device spécifique

### Geofence
- **Rôle**: Zones géographiques de monitoring
- **Champs clés**: `_id`, `name`, `coords`, `isActive`
- **Relations**: Surveillées pour détecter les violations

### Alert
- **Rôle**: Événements système nécessitant une attention
- **Champs clés**: `_id`, `alertType`, `severity`, `isActive`
- **Relations**: Peuvent concerner sheep, device, ou geofence

### Notification
- **Rôle**: Messages envoyés aux utilisateurs
- **Champs clés**: `_id`, `userId`, `isRead`, `severity`
- **Relations**: Liées aux utilisateurs et aux alertes

### MedicalRecord
- **Rôle**: Historique médical des animaux
- **Champs clés**: `_id`, `sheepId`, `recordType`, `date`
- **Relations**: Appartenant à un sheep spécifique

## Flux de Données

1. **Device** envoie **TelemetryData** en continu
2. **TelemetryData** peut déclencher des **Alert** (batterie faible, hors zone, etc.)
3. **Alert** génère des **Notification** pour les **User**
4. **Sheep** possède un **Device** et a des **MedicalRecord**
5. **User** crée des **Geofence** pour surveiller les **Sheep**
6. Les violations de **Geofence** créent des **Alert**

## Index Recommandés

```javascript
// User collection
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })

// Sheep collection  
db.sheep.createIndex({ "sheepId": 1 }, { unique: true })
db.sheep.createIndex({ "deviceId": 1 })
db.sheep.createIndex({ "healthStatus": 1 })

// Device collection
db.devices.createIndex({ "deviceId": 1 }, { unique: true })
db.devices.createIndex({ "assignedToSheep": 1 })
db.devices.createIndex({ "lastSeen": 1 })

// TelemetryData collection
db.telemetry.createIndex({ "deviceId": 1, "timestamp": -1 })
db.telemetry.createIndex({ "timestamp": -1 })
db.telemetry.createIndex({ "location": "2dsphere" })

// Geofence collection
db.geofences.createIndex({ "coords": "2dsphere" })
db.geofences.createIndex({ "isActive": 1 })

// Alert collection
db.alerts.createIndex({ "sheepId": 1, "createdAt": -1 })
db.alerts.createIndex({ "deviceId": 1, "createdAt": -1 })
db.alerts.createIndex({ "isActive": 1, "severity": 1 })

// Notification collection
db.notifications.createIndex({ "userId": 1, "createdAt": -1 })
db.notifications.createIndex({ "isRead": 1, "severity": 1 })

// MedicalRecord collection
db.medicalRecords.createIndex({ "sheepId": 1, "date": -1 })
db.medicalRecords.createIndex({ "recordType": 1 })
```

## Contraintes et Validation

- **Sheep.deviceId** doit être unique et référencer **Device._id**
- **Device.assignedToSheep** peut être null (device non assigné)
- **Alert.isActive** passe à false quand résolu
- **Notification.isRead** par défaut false
- **TelemetryData.timestamp** obligatoire pour ordre chronologique
- **Geofence.coords** doit être un polygone valide (min 3 points)
