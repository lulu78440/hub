// Noyau · programme de connaissances. Chaque domaine a des sous-thèmes ; une fiche validée par Lucien qui traite d'un sous-thème le fait avancer.
// Le pourcentage affiché est le taux de couverture de CE programme (fixé ici, public et modifiable), pas une mesure du savoir total sur le sujet.
// Format d'un sous-thème : « titre | mots-clés de reconnaissance | requête de recherche ».
const D = (id, nom, symbole, couleur, domainesSources, lignes) => ({
  id, nom, symbole, couleur, sources: domainesSources,
  sousThemes: lignes.map((l, i) => { const [titre, mots, requete] = l.split("|").map((x) => x.trim()); return { id: id + "." + (i + 1), titre, mots: mots.split(/\s+/).filter(Boolean), requete: requete || titre }; })
});

export const PROGRAMME = [
  D("droit", "Droit français", "⚖", "#9b72ff", ["general", "france"], [
    "Constitution et institutions|constitution république président parlement assemblée sénat conseil constitutionnel|Constitution de la Ve République",
    "Droit civil|code civil contrat propriété famille mariage succession obligation|droit civil français",
    "Droit pénal|code pénal infraction crime délit contravention peine procédure pénale|droit pénal français",
    "Droit du travail|contrat de travail licenciement salarié employeur code du travail congés prud'hommes|droit du travail en France",
    "Droit de la consommation|consommateur rétractation garantie légale litige vente à distance|droit de la consommation en France",
    "Droit du logement|bail locataire propriétaire loyer location copropriété expulsion|bail d'habitation en France",
    "Protection des données|rgpd cnil données personnelles consentement vie privée|RGPD",
    "Justice et recours|tribunal juridiction appel cassation avocat huissier recours|organisation judiciaire française"]),
  D("histoire", "Histoire", "⌛", "#ffb347", ["general", "culture"], [
    "Antiquité|rome grèce égypte empire antique gaulois César|histoire de l'Antiquité",
    "Moyen Âge|médiéval féodalité croisades chevalier cathédrale charlemagne|Moyen Âge en France",
    "Renaissance et Temps modernes|renaissance réforme louis xiv absolutisme découvertes|Renaissance",
    "Révolution française|révolution 1789 bastille terreur napoléon république|Révolution française",
    "XIXe siècle|industrialisation second empire commune colonisation 1848|France au XIXe siècle",
    "Première Guerre mondiale|1914 1918 tranchées verdun armistice poilus|Première Guerre mondiale",
    "Seconde Guerre mondiale|1939 1945 résistance occupation vichy libération shoah|Seconde Guerre mondiale",
    "Monde contemporain|guerre froide décolonisation union européenne mondialisation 1989|histoire contemporaine"]),
  D("sciences", "Sciences", "⚛", "#3fe6ff", ["general", "science"], [
    "Physique|force énergie gravitation relativité quantique mécanique onde|physique fondamentale",
    "Chimie|atome molécule réaction élément tableau périodique acide|chimie générale",
    "Biologie|cellule adn évolution gène organisme espèce|biologie",
    "Géologie et climat|climat tectonique volcan roche atmosphère réchauffement|climatologie",
    "Énergie|électricité nucléaire solaire éolien pétrole batterie|énergie",
    "Méthode scientifique|hypothèse expérience reproductibilité preuve statistique biais|méthode scientifique",
    "Technologies|ingénierie robot capteur matériau semi-conducteur|technologie",
    "Neurosciences|cerveau neurone mémoire cognition sommeil apprentissage|neurosciences"]),
  D("maths", "Mathématiques", "∑", "#4fe3a8", ["general", "science"], [
    "Arithmétique|nombre premier division fraction pourcentage proportion|arithmétique",
    "Algèbre|équation polynôme matrice vecteur groupe linéaire|algèbre",
    "Géométrie|triangle cercle angle théorème pythagore volume|géométrie",
    "Analyse|fonction dérivée intégrale limite suite série|analyse mathématique",
    "Probabilités|probabilité hasard espérance loi bayes aléatoire|probabilités",
    "Statistiques|moyenne médiane écart-type échantillon corrélation|statistique",
    "Logique|raisonnement démonstration paradoxe ensemble récurrence|logique mathématique"]),
  D("sante", "Santé", "✚", "#ff4d6a", ["general", "sante"], [
    "Nutrition|aliment vitamine protéine glucide calories régime équilibre|nutrition",
    "Sommeil|sommeil insomnie rythme circadien mélatonine repos|sommeil",
    "Activité physique|sport exercice musculation endurance étirement marche|activité physique",
    "Santé mentale|stress anxiété dépression émotion méditation thérapie|santé mentale",
    "Prévention|vaccin dépistage hygiène tabac alcool prévention|prévention santé",
    "Premiers secours|secours urgence réanimation brûlure plaie massage cardiaque|premiers secours",
    "Système de santé français|sécurité sociale mutuelle médecin traitant remboursement ordonnance|système de santé en France"]),
  D("cuisine", "Cuisine", "♨", "#ff8a3d", ["general", "cuisine"], [
    "Techniques de base|cuisson saisir mijoter rôtir émincer technique|techniques de cuisine",
    "Cuisine française|bœuf bourguignon ratatouille sauce béchamel terroir|cuisine française",
    "Pâtisserie|pâte gâteau levure crème farine sucre|pâtisserie",
    "Pain et fermentation|levain pain fermentation boulangerie yaourt|boulangerie",
    "Cuisines du monde|italienne japonaise indienne mexicaine épices|cuisine du monde",
    "Conservation et sécurité|conservation frigo bactérie date péremption congélation|conservation des aliments",
    "Boissons|thé café vin infusion cocktail eau|boissons"]),
  D("code", "Programmation", "⌨", "#3fe6ff", ["code", "general"], [
    "JavaScript|javascript promesse async fonction objet tableau navigateur|JavaScript",
    "Web (HTML et CSS)|html css flexbox grid accessibilité responsive|HTML CSS",
    "Python|python script bibliothèque pip liste dictionnaire|Python (langage)",
    "Algorithmes|tri complexité récursivité graphe structure de données|algorithmique",
    "Git et versions|git commit branche fusion dépôt github|Git",
    "Bases de données|sql table requête index nosql base de données|base de données",
    "Sécurité informatique|chiffrement mot de passe vulnérabilité xss injection authentification|sécurité informatique",
    "Réseaux et web|http dns tcp serveur api navigateur certificat|protocole HTTP"]),
  D("ia", "Intelligence artificielle", "✦", "#9b72ff", ["science", "code", "general"], [
    "Apprentissage automatique|apprentissage automatique modèle entraînement données régression classification|apprentissage automatique",
    "Réseaux de neurones|réseau de neurones couche rétropropagation gradient deep learning|réseau de neurones artificiel",
    "Modèles de langage|llm transformer langage prompt jeton génératif|grand modèle de langage",
    "Éthique de l'IA|biais éthique transparence responsabilité régulation ia act|éthique de l'intelligence artificielle",
    "Vision par ordinateur|image reconnaissance détection caméra segmentation|vision par ordinateur",
    "Agents et outils|agent outil planification autonomie raisonnement|agent intelligent",
    "Histoire de l'IA|turing dartmouth hiver de l'ia deep blue alphago|histoire de l'intelligence artificielle"]),
  D("espace", "Espace", "☄", "#9b72ff", ["espace", "general"], [
    "Système solaire|planète soleil lune mars jupiter saturne astéroïde|Système solaire",
    "Étoiles et galaxies|étoile galaxie nébuleuse supernova voie lactée|étoile",
    "Cosmologie|big bang univers expansion matière noire trou noir|cosmologie",
    "Exploration spatiale|fusée apollo station spatiale iss mission satellite|exploration spatiale",
    "Lanceurs et industrie|spacex ariane lanceur réutilisable starship|lanceur spatial",
    "Observation du ciel|télescope constellation éclipse observation astronomie|astronomie d'observation",
    "Exoplanètes et vie|exoplanète habitable seti astrobiologie|exoplanète"]),
  D("nature", "Nature et vivant", "❀", "#4fe3a8", ["nature", "general"], [
    "Animaux|mammifère oiseau insecte reptile espèce animal|zoologie",
    "Plantes|plante arbre fleur photosynthèse jardin botanique|botanique",
    "Écosystèmes|écosystème forêt océan biodiversité chaîne alimentaire|écosystème",
    "Espèces menacées|extinction conservation iucn espèce menacée|espèce menacée",
    "Océans|océan mer corail marée poisson plancton|océan",
    "Jardinage|potager semis compost culture sol arrosage|jardinage",
    "Météo|météo nuage pluie vent anticyclone orage|météorologie"]),
  D("geo", "Géographie", "◍", "#3fe6ff", ["lieux", "general", "voyage"], [
    "France|région département préfecture paris territoire outre-mer|géographie de la France",
    "Europe|pays capitale union européenne schengen frontière|géographie de l'Europe",
    "Monde|continent pays population océan désert montagne|géographie mondiale",
    "Cartes et repérage|carte latitude longitude échelle gps projection|cartographie",
    "Villes et territoires|ville urbanisation métropole banlieue|géographie urbaine",
    "Voyager|voyage visa passeport transport itinéraire|conseils de voyage",
    "Climats et zones|climat tropical tempéré polaire aride mousson|climat"]),
  D("economie", "Économie et finances", "€", "#ffb347", ["general", "france"], [
    "Bases de l'économie|inflation pib offre demande croissance chômage|économie",
    "Budget personnel|budget épargne dépense revenu reste à vivre|gestion de budget",
    "Épargne et placements|livret assurance-vie actions etf intérêts placement|épargne en France",
    "Impôts|impôt revenu tva déclaration tranche fiscalité|impôt sur le revenu en France",
    "Crédit et dettes|crédit prêt taux endettement surendettement|crédit à la consommation",
    "Retraite|retraite cotisation pension trimestre âge de départ|retraite en France",
    "Entreprise|entreprise auto-entrepreneur société statut création|création d'entreprise en France"]),
  D("philo", "Philosophie", "☯", "#9b72ff", ["general", "livres"], [
    "Antiquité|socrate platon aristote stoïcisme épicure|philosophie antique",
    "Raison et connaissance|descartes kant empirisme rationalisme doute connaissance|théorie de la connaissance",
    "Morale et éthique|morale éthique devoir utilitarisme vertu justice|éthique",
    "Politique|état liberté pouvoir contrat social démocratie|philosophie politique",
    "Existence|existentialisme sartre absurde camus liberté sens|existentialisme",
    "Esprit et conscience|conscience esprit corps libre arbitre identité|philosophie de l'esprit"]),
  D("culture", "Arts et culture", "✎", "#ff8ad8", ["culture", "livres", "general"], [
    "Littérature française|roman poésie hugo molière auteur littérature|littérature française",
    "Peinture|peinture impressionnisme musée toile peintre mouvement|histoire de la peinture",
    "Cinéma|film réalisateur cinéma festival scénario nouvelle vague|histoire du cinéma",
    "Architecture|architecture cathédrale gothique bâtiment urbanisme|architecture",
    "Mythologies|mythe dieu légende mythologie héros|mythologie",
    "Jeux vidéo|jeu vidéo console studio gameplay indépendant|histoire du jeu vidéo"]),
  D("langues", "Langues", "Ⓐ", "#4fe3a8", ["langue", "general"], [
    "Grammaire française|grammaire conjugaison accord subjonctif participe|grammaire française",
    "Orthographe|orthographe homophone accent ponctuation|orthographe",
    "Anglais|anglais english vocabulaire verbe irrégulier prononciation|apprendre l'anglais",
    "Étymologie|étymologie origine mot latin racine|étymologie",
    "Expression écrite|rédaction style registre lettre argumentation|expression écrite",
    "Traduction|traduction langue faux-amis interprète|traduction"]),
  D("musique", "Musique", "♪", "#ff8ad8", ["culture", "general"], [
    "Théorie musicale|gamme accord rythme note tonalité solfège|théorie de la musique",
    "Histoire de la musique|baroque classique romantique jazz rock chanson|histoire de la musique",
    "Instruments|piano guitare violon batterie instrument|instrument de musique",
    "Musique et technologie|synthétiseur enregistrement mixage numérique midi|musique assistée par ordinateur"])
];

export const DOMAINES_SAVOIR = new Map(PROGRAMME.map((d) => [d.id, d]));
export const SOUS_THEMES = new Map(PROGRAMME.flatMap((d) => d.sousThemes.map((s) => [s.id, { ...s, domaine: d.id }])));
export const TOTAL_SOUS_THEMES = SOUS_THEMES.size;
