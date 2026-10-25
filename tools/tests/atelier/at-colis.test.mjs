// Essais du moteur at-colis. Numéros d'exemple publics ou inventés : aucun vrai colis.
import { nettoyer, cleS10, cleUPS, analyser, extraire } from "../../../js/widgets/moteurs/at-colis.js";
import { vrai, egal, fin } from "./_outil.mjs";

egal(nettoyer(" rr 123-456.785 fr "), "RR123456785FR", "nettoyage");
vrai(cleS10("RR123456785FR") && !cleS10("RR123456784FR"), "clé S10 (exemple de la norme)");
vrai(cleUPS("1Z999AA10123456784") && !cleUPS("1Z999AA10123456785"), "clé UPS (numéro d'exemple UPS)");

const lp = analyser("RR123456785FR");
egal([lp.candidats[0].transporteur, lp.candidats[0].confiance, lp.candidats[0].lien], ["La Poste, lettre recommandée", "sure", "https://www.laposte.fr/outils/suivre-vos-envois?code=RR123456785FR"], "lettre recommandée vérifiée");
egal(analyser("ER123456785FR").candidats[0].transporteur, "Chronopost (EMS)", "EMS France = Chronopost");
egal(analyser("CR123456785FR").candidats[0].transporteur, "Colissimo international", "Colissimo international");
const cn = analyser("LR123456785CN");
egal([cn.candidats[0].transporteur, cn.candidats[0].lien], ["China Post", null], "poste étrangère sans lien");
const mal = analyser("RR123456784FR");
egal(mal.candidats[0].controle, "ko", "clé fausse repérée");
vrai(mal.message.includes("mal recopié"), "message : numéro mal recopié");
egal(analyser("6A12345678901").candidats.map((c) => c.transporteur), ["Colissimo (France)"], "Colissimo national");
egal(analyser("1z 999 aa1 012 345 678 4").message, "UPS (numéro vérifié).", "UPS avec espaces et minuscules");
egal(analyser("TBA123456789012").candidats[0].transporteur, "Amazon Logistics", "Amazon");
egal(analyser("JJD0001234567890123456").candidats[0].transporteur, "DHL", "DHL eCommerce");
const douze = analyser("123456789012");
vrai(douze.candidats.every((c) => c.confiance === "possible") && douze.message.startsWith("Plusieurs"), "12 chiffres : ambigu, dit honnêtement");
egal(analyser("ABC").message, "Format inconnu : vérifie le numéro sur le message du vendeur.", "format inconnu");
egal(analyser("").message, "Numéro vide.", "numéro vide");

const mail = "Bonjour, votre colis RR123456785FR est parti. Second envoi : 1Z999AA10123456784. Réf commande 123456789012. Encore RR123456785FR.";
egal(extraire(mail).map((a) => a.numero), ["RR123456785FR", "1Z999AA10123456784"], "extraction dans un texte, sans doublon ni numéro ambigu");
egal(extraire(null), [], "texte vide");
fin("at-colis");
