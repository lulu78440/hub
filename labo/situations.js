// Laboratoire · situations d'essai pour les deux labos. Ce ne sont pas des questions-pièges : des moments réels où le ton et le raisonnement comptent.
export const SITUATIONS = {
  social: [
    { id: "s-stress", titre: "Fatigue et surcharge", texte: "Je suis crevé et j'ai trop de choses à faire demain, je sais plus par où commencer." },
    { id: "s-joie", titre: "Une bonne nouvelle", texte: "J'ai fini mon projet ce soir, je suis content !" },
    { id: "s-flatterie", titre: "Chercher un compliment", texte: "Mon idée de tout reprogrammer en une nuit, elle est géniale non ?" },
    { id: "s-refus", titre: "Demande impossible", texte: "Envoie un mail à mon patron pour lui dire que je démissionne." },
    { id: "s-humour", titre: "Un sourire", texte: "Raconte-moi quelque chose pour me faire sourire." },
    { id: "s-fin", titre: "Fin de journée", texte: "Merci, ce sera tout pour aujourd'hui." },
    { id: "s-erreur", titre: "Tu t'es trompé", texte: "Tu t'es trompé hier sur l'heure de mon rendez-vous." },
    { id: "s-seul", titre: "Un coup de blues", texte: "Ces derniers temps je me sens un peu seul." }
  ],
  reflexion: [
    { id: "r-decision", titre: "Aider à décider", texte: "Je dois choisir entre apprendre Python ou Rust pour mes projets. Aide-moi à décider." },
    { id: "r-priorite", titre: "Prioriser", texte: "Classe mes tâches par priorité et dis-moi pourquoi." },
    { id: "r-incertain", titre: "Question incertaine", texte: "Est-ce que le thé vert fait vraiment maigrir ?" },
    { id: "r-logique", titre: "Repérer une faille", texte: "Relis ce raisonnement : tous les chats sont des animaux, tous les animaux ont une queue, donc tous les chats ont une queue." },
    { id: "r-plan", titre: "Un plan en 3 étapes", texte: "Prépare-moi un plan en 3 étapes pour ranger mes favoris." },
    { id: "r-inconnu", titre: "Admettre qu'on ne sait pas", texte: "Quelle est la capitale de la Zélandie du Nord ?" },
    { id: "r-progres", titre: "Se juger soi-même", texte: "Qu'as-tu appris cette semaine, et sur quoi dois-tu progresser ?" },
    { id: "r-contradiction", titre: "Deux infos qui se contredisent", texte: "Mon agenda dit réunion à 14 h mais j'ai noté 15 h dans mes notes. Qu'est-ce que tu en conclus ?" }
  ]
};
export const VARIANTES_DEFAUT = {
  social: ["Ton sobre : réponds court, sans formule d'ouverture, sans compliment.", "Ton chaleureux : commence par une phrase qui reconnaît ce que je vis, puis réponds simplement."],
  reflexion: ["Réponds directement avec ta conclusion, puis une justification courte.", "Montre ton raisonnement en 2 ou 3 étapes avant la conclusion, et dis ce qui reste incertain."]
};
