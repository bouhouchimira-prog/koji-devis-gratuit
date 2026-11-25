// Bibliothèque d'ouvrages de DÉMONSTRATION.
//
// Chaque ouvrage donne un temps normatif de main-d'œuvre par unité, en heures.
// Le prix d'une ligne = temps x taux horaire donné par l'artisan.
// Ces temps sont des ordres de grandeur pour tester l'outil : remplacez ce
// fichier par la bibliothèque partagée de Koji avant la mise en ligne.
//
// Champs : id, metier, libelle, unite, heures (par unité), motsCles.

export const OUVRAGES = [
  // Plomberie
  { id: "PLB-001", metier: "plomberie", libelle: "Dépose d'un WC existant", unite: "u", heures: 0.75, motsCles: "wc toilettes cuvette depose retrait" },
  { id: "PLB-002", metier: "plomberie", libelle: "Pose d'un WC au sol", unite: "u", heures: 2, motsCles: "wc toilettes cuvette pose installation sol" },
  { id: "PLB-003", metier: "plomberie", libelle: "Pose d'un WC suspendu avec bâti-support", unite: "u", heures: 4, motsCles: "wc suspendu bati support geberit toilettes" },
  { id: "PLB-004", metier: "plomberie", libelle: "Pose d'un lavabo ou d'une vasque avec robinetterie", unite: "u", heures: 2.5, motsCles: "lavabo vasque meuble salle de bain robinet" },
  { id: "PLB-005", metier: "plomberie", libelle: "Pose d'un mitigeur", unite: "u", heures: 0.75, motsCles: "mitigeur robinet robinetterie remplacement" },
  { id: "PLB-006", metier: "plomberie", libelle: "Pose d'un receveur de douche extra-plat", unite: "u", heures: 4, motsCles: "douche receveur bac extra plat italienne" },
  { id: "PLB-007", metier: "plomberie", libelle: "Pose d'une paroi de douche", unite: "u", heures: 2, motsCles: "douche paroi vitree porte" },
  { id: "PLB-008", metier: "plomberie", libelle: "Pose d'une baignoire", unite: "u", heures: 5, motsCles: "baignoire bain pose" },
  { id: "PLB-009", metier: "plomberie", libelle: "Dépose d'une baignoire", unite: "u", heures: 2, motsCles: "baignoire depose retrait demolition" },
  { id: "PLB-010", metier: "plomberie", libelle: "Pose d'un chauffe-eau électrique jusqu'à 200 L", unite: "u", heures: 4, motsCles: "chauffe eau ballon cumulus eau chaude electrique" },
  { id: "PLB-011", metier: "plomberie", libelle: "Alimentation eau en cuivre ou multicouche", unite: "ml", heures: 0.5, motsCles: "alimentation tuyau cuivre multicouche per canalisation eau" },
  { id: "PLB-012", metier: "plomberie", libelle: "Évacuation en PVC", unite: "ml", heures: 0.4, motsCles: "evacuation pvc vidange ecoulement tuyau" },
  { id: "PLB-013", metier: "plomberie", libelle: "Recherche et réparation de fuite", unite: "u", heures: 1.5, motsCles: "fuite reparation depannage recherche" },
  { id: "PLB-014", metier: "plomberie", libelle: "Pose d'un évier de cuisine avec raccordements", unite: "u", heures: 2.5, motsCles: "evier cuisine raccordement" },
  { id: "PLB-015", metier: "plomberie", libelle: "Pose d'un radiateur à eau", unite: "u", heures: 3, motsCles: "radiateur chauffage central eau" },

  // Électricité
  { id: "ELE-001", metier: "electricite", libelle: "Pose d'une prise de courant 16 A", unite: "u", heures: 0.75, motsCles: "prise courant 16a electrique" },
  { id: "ELE-002", metier: "electricite", libelle: "Pose d'un interrupteur simple allumage", unite: "u", heures: 0.6, motsCles: "interrupteur simple allumage" },
  { id: "ELE-003", metier: "electricite", libelle: "Pose d'un interrupteur va-et-vient", unite: "u", heures: 1, motsCles: "interrupteur va et vient" },
  { id: "ELE-004", metier: "electricite", libelle: "Pose d'un point lumineux (DCL)", unite: "u", heures: 1, motsCles: "point lumineux dcl plafonnier luminaire eclairage" },
  { id: "ELE-005", metier: "electricite", libelle: "Pose d'un spot encastré", unite: "u", heures: 0.5, motsCles: "spot encastre led eclairage" },
  { id: "ELE-006", metier: "electricite", libelle: "Tirage de câble sous gaine", unite: "ml", heures: 0.15, motsCles: "cable gaine tirage fil ligne" },
  { id: "ELE-007", metier: "electricite", libelle: "Remplacement d'un tableau électrique (jusqu'à 3 rangées)", unite: "u", heures: 8, motsCles: "tableau electrique coffret disjoncteur remplacement" },
  { id: "ELE-008", metier: "electricite", libelle: "Pose d'un disjoncteur divisionnaire", unite: "u", heures: 0.5, motsCles: "disjoncteur divisionnaire protection" },
  { id: "ELE-009", metier: "electricite", libelle: "Pose d'un interrupteur différentiel 30 mA", unite: "u", heures: 0.75, motsCles: "differentiel interrupteur 30ma protection" },
  { id: "ELE-010", metier: "electricite", libelle: "Pose d'un radiateur électrique", unite: "u", heures: 1.5, motsCles: "radiateur electrique chauffage convecteur" },
  { id: "ELE-011", metier: "electricite", libelle: "Pose d'une prise RJ45", unite: "u", heures: 0.75, motsCles: "prise rj45 reseau internet ethernet" },
  { id: "ELE-012", metier: "electricite", libelle: "Création d'une ligne dédiée (four, plaque, lave-linge)", unite: "u", heures: 2.5, motsCles: "ligne dediee specialisee four plaque cuisson lave linge circuit" },
  { id: "ELE-013", metier: "electricite", libelle: "Pose d'une VMC simple flux", unite: "u", heures: 5, motsCles: "vmc ventilation simple flux" },
  { id: "ELE-014", metier: "electricite", libelle: "Diagnostic et mise en sécurité", unite: "forfait", heures: 3, motsCles: "diagnostic mise en securite controle depannage" },

  // Peinture
  { id: "PEI-001", metier: "peinture", libelle: "Protection des sols et des meubles", unite: "m²", heures: 0.05, motsCles: "protection bache sol meuble" },
  { id: "PEI-002", metier: "peinture", libelle: "Lessivage des murs", unite: "m²", heures: 0.1, motsCles: "lessivage lessiver nettoyage mur" },
  { id: "PEI-003", metier: "peinture", libelle: "Rebouchage et ponçage des murs", unite: "m²", heures: 0.2, motsCles: "rebouchage enduit poncage preparation trous fissures" },
  { id: "PEI-004", metier: "peinture", libelle: "Impression (sous-couche) murs", unite: "m²", heures: 0.12, motsCles: "impression sous couche primaire mur" },
  { id: "PEI-005", metier: "peinture", libelle: "Peinture murs, deux couches", unite: "m²", heures: 0.25, motsCles: "peinture mur murs deux couches acrylique" },
  { id: "PEI-006", metier: "peinture", libelle: "Peinture plafond, deux couches", unite: "m²", heures: 0.3, motsCles: "peinture plafond deux couches" },
  { id: "PEI-007", metier: "peinture", libelle: "Peinture de boiseries (portes, plinthes)", unite: "m²", heures: 0.45, motsCles: "boiserie porte plinthe bois laque peinture" },
  { id: "PEI-008", metier: "peinture", libelle: "Peinture d'une porte, deux faces", unite: "u", heures: 1.5, motsCles: "porte peinture deux faces" },
  { id: "PEI-009", metier: "peinture", libelle: "Dépose de papier peint", unite: "m²", heures: 0.2, motsCles: "papier peint depose decollage" },
  { id: "PEI-010", metier: "peinture", libelle: "Pose de toile de verre", unite: "m²", heures: 0.3, motsCles: "toile de verre pose revetement" },
  { id: "PEI-011", metier: "peinture", libelle: "Peinture de façade", unite: "m²", heures: 0.35, motsCles: "facade exterieur peinture ravalement" },
  { id: "PEI-012", metier: "peinture", libelle: "Enduit de lissage", unite: "m²", heures: 0.35, motsCles: "enduit lissage ratissage mur" },

  // Carrelage et plâtrerie, utiles pour une salle de bain complète
  { id: "CAR-001", metier: "carrelage", libelle: "Pose de carrelage au sol", unite: "m²", heures: 1, motsCles: "carrelage sol pose carreau" },
  { id: "CAR-002", metier: "carrelage", libelle: "Pose de faïence murale", unite: "m²", heures: 1.2, motsCles: "faience carrelage mural mur credence" },
  { id: "CAR-003", metier: "carrelage", libelle: "Dépose de carrelage", unite: "m²", heures: 0.6, motsCles: "carrelage depose demolition" },
  { id: "CAR-004", metier: "carrelage", libelle: "Ragréage du sol", unite: "m²", heures: 0.3, motsCles: "ragreage sol niveau chape" },
  { id: "PLA-001", metier: "platrerie", libelle: "Cloison en plaques de plâtre sur ossature", unite: "m²", heures: 0.8, motsCles: "cloison placo plaque platre ossature" },
  { id: "PLA-002", metier: "platrerie", libelle: "Faux plafond en plaques de plâtre", unite: "m²", heures: 1, motsCles: "faux plafond placo plaque platre" },
  { id: "GEN-001", metier: "general", libelle: "Évacuation des gravats et nettoyage du chantier", unite: "forfait", heures: 2, motsCles: "gravats evacuation nettoyage dechets chantier" },
];

export const METIERS = ["plomberie", "electricite", "peinture", "carrelage", "platrerie", "general"];
