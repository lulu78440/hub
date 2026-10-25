// Pont minimal entre le hub et le Noyau : le hub (orbe) y trouve la seule fonction « poser une question ».
// Rien d'autre du Noyau n'est exposé ; sans Noyau, `poser` reste nul et l'orbe garde ses moteurs d'origine.
export const pont = { poser: null };
