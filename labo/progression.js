// Laboratoire · onglets « Progression » (vision réelle : santé du banc, feuille de route, métriques, bilan de la semaine)
// et « Idées & état » (boîte à idées, demande pour Claude, export / import de l'état du labo).
import { h, courbe, barre, telecharger, copier, quand, garnir } from "./ui-labo.js";
import { avancement, PLAN_TEST } from "./feuille-de-route.js";

const NOM_STATUT = { fait: "fait", en_cours: "en cours", prochain: "prochain", attend: "attend toi" };

export function rendreProgression(c, ctx) {
  const { etat } = ctx; c.textContent = ""; garnir(c);
  const t = etat.tendanceBanc(), av = avancement(etat), m = etat.resumeMetriques(50);
  let carte = null; try { carte = ctx.noyau().savoir.carte(); } catch (e) { /* savoir absent */ }
  const bilan = etat.bilanSemaine({ carte });

  // 1. Santé
  c.append(h("h3", {}, "Santé du Noyau"));
  if (!t) c.append(h("p", { class: "dim" }, "Aucune mesure pour l'instant. Lance le banc d'essai : la santé est le pourcentage de scénarios réussis (ceux qui ont besoin d'un vrai moteur ne comptent pas)."));
  else {
    const hist = etat.banc().filter((b) => b.ok + b.ko > 0).map((b) => Math.round(b.ok / (b.ok + b.ko) * 100));
    c.append(h("div", { class: "lab-sante" }, h("b", { class: t.regression ? "lab-bas" : "lab-haut" }, t.taux + " %"), h("span", { class: "dim" }, ` ${t.dernier.ok} réussis, ${t.dernier.ko} ratés, ${t.dernier.sautes} sautés · ${quand(t.dernier.quand)}${t.dernier.reel ? " · avec Gemini réel" : ""}`)),
      h("div", { class: "lab-ligne" }, courbe(hist.slice(-30), { titre: "Santé du banc au fil des lancements" }), h("small", { class: "dim" }, hist.length + " lancement(s) enregistré(s)")),
      t.regression ? h("p", { class: "avert" }, "Régression : plus d'échecs que la fois d'avant" + (t.nouveauxEchecs.length ? " (nouveaux : " + t.nouveauxEchecs.join(", ") + ")." : ".")) : null,
      t.dernier.echecs.length ? h("p", { class: "lab-bas" }, "Échecs : " + t.dernier.echecs.join(", ")) : null);
  }
  c.append(h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: () => ctx.allerOnglet("banc") }, "Aller au banc d'essai")));

  // 1 bis. Plan de test
  const faits = etat.tests();
  c.append(h("h3", {}, `Plan de test de cette version · ${PLAN_TEST.filter(([id]) => faits[id]).length}/${PLAN_TEST.length}`),
    PLAN_TEST.map(([id, texte]) => h("label", { class: "lab-test" }, h("input", { type: "checkbox", checked: faits[id] ? "" : null, onchange: (e) => { etat.cocherTest(id, e.currentTarget.checked); rendreProgression(c, ctx); } }), " " + texte)));

  // 2. Feuille de route
  c.append(h("h3", {}, `Feuille de route · ${av.pct} %`), h("p", { class: "dim" }, "Le pourcentage est le nombre d'étapes faites sur le total ; une étape mesurée ne passe à « faite » que quand la mesure réelle atteint sa cible."));
  av.chantiers.forEach((ch) => c.append(h("details", {}, h("summary", {}, `${ch.nom} · ${ch.pct} %`, " ", barre(ch.pct / 100)),
    ch.etapes.map((e) => h("div", { class: "lab-etape" }, h("span", { class: "lab-st " + e.s }, NOM_STATUT[e.s] || e.s), h("span", {}, e.t, e.mesure ? h("small", { class: "dim" }, ` (${Math.min(e.valeur || 0, e.cible)}/${e.cible})`) : null, e.n ? h("small", { class: "dim" }, " · " + e.n) : null))))));
  if (av.suivantes.length) c.append(h("h4", {}, "Prochaines étapes"), h("ul", { class: "lab-liste" }, av.suivantes.map((e) => h("li", {}, `${e.t} `, h("small", { class: "dim" }, "· " + e.chantier)))));
  if (av.attendent.length) c.append(h("h4", {}, "Ce qui attend Lucien"), h("ul", { class: "lab-liste" }, av.attendent.map((e) => h("li", {}, e.t + " ", h("small", { class: "dim" }, e.n ? "· " + e.n : "")))));

  // 3. Savoir (bac à sable)
  if (carte) c.append(h("h3", {}, "Savoir"), h("p", { class: "dim" }, `Dans le bac à sable du labo : ${carte.global} % du programme (${carte.couverts}/${carte.total} sous-thèmes). Le vrai pourcentage de ton Noyau est dans la fenêtre Savoir du hub.`));

  // 4. Métriques
  c.append(h("h3", {}, "Métriques des réponses"));
  if (!m) c.append(h("p", { class: "dim" }, "Aucune réponse mesurée : parle au Noyau pour remplir cette section."));
  else c.append(h("ul", { class: "lab-liste" },
    h("li", {}, `${m.n} dernières réponses`), h("li", {}, `Latence médiane (hors réflexes) : ${m.latenceMediane} ms`), h("li", {}, `Requêtes par réponse : ${String(m.requetesMoy).replace(".", ",")}`),
    h("li", {}, `Réponses réflexes sans requête : ${m.pctReflexe} %`), h("li", {}, `Longueur moyenne : ${m.longueurMoy} caractères`), h("li", {}, `Réponses finissant par une question : ${m.pctFinQuestion} % · répétitions : ${m.nRepetitions}`), m.pctHauteAvecSource != null ? h("li", {}, `Confiance « haute » appuyée par une source : ${m.pctHauteAvecSource} %`) : null),
    h("div", { class: "lab-ligne" }, courbe(m.ms.slice(-30), { min: 0, max: Math.max(...m.ms, 1), couleur: "#9b72ff", titre: "Latence des dernières réponses" }), h("small", { class: "dim" }, "latence des dernières réponses")));

  // 5. Bilan de la semaine
  c.append(h("h3", {}, "Bilan des 7 derniers jours"),
    h("p", { class: "dim" }, `${bilan.runs} lancement(s) du banc · ${bilan.regressions} régression(s) · ${bilan.notes} note(s) · ${bilan.ab} comparaison(s) A/B · ${bilan.idees} idée(s)`),
    bilan.suggestions.length ? h("ul", { class: "lab-liste" }, bilan.suggestions.map((s) => h("li", {}, s))) : h("p", { class: "lab-haut" }, "Rien à signaler : tout ce qui est mesuré va bien."));
}

export function rendreIdees(c, ctx) {
  const { etat } = ctx; c.textContent = ""; garnir(c);
  const type = h("select", { class: "lab-champ", "aria-label": "Type d'idée" }, [["social", "Social (ton, relation)"], ["reflexion", "Réflexion (raisonnement)"], ["technique", "Technique (hub, outils)"], ["defaut", "Défaut constaté"]].map(([v, n]) => h("option", { value: v }, n)));
  const texte = h("textarea", { class: "lab-champ", rows: "3", maxlength: "500", placeholder: "Une amélioration à faire, ou un défaut constaté (500 caractères)", "aria-label": "Texte de l'idée" }), msg = h("span", { class: "dim" });
  const liste = h("div");
  const contexte = () => { const t = etat.tendanceBanc(), ms = etat.moyennes("social"), mr = etat.moyennes("reflexion"); const f = (o) => Object.values(o).filter((x) => x.moyenne != null).map((x) => `${x.nom} ${x.moyenne}/5`).join(", ") || "pas de notes"; return `Santé du banc : ${t ? t.taux + " %" : "non mesurée"}. Labo social : ${f(ms)}. Labo réflexion : ${f(mr)}.`; };
  function rendreListe() {
    liste.textContent = ""; const l = etat.idees().slice().reverse();
    if (!l.length) liste.append(h("p", { class: "dim" }, "Aucune idée notée. Écris-en une : elle apparaîtra aussi dans les suggestions du bilan."));
    l.forEach((i) => {
      const sel = h("select", { class: "lab-champ lab-court", "aria-label": "Statut" }, ["ouverte", "demandee", "faite", "abandonnee"].map((s) => h("option", { value: s }, { ouverte: "ouverte", demandee: "demandée à Claude", faite: "faite", abandonnee: "abandonnée" }[s]))); sel.value = i.statut; sel.addEventListener("change", () => { etat.changerIdee(i.id, sel.value); });
      const zone = h("div");
      liste.append(h("article", { class: "lab-idee" }, h("div", {}, h("b", {}, i.type), h("small", { class: "dim" }, " · " + quand(i.quand))), h("p", {}, i.texte),
        h("div", { class: "lab-ligne" }, sel, h("button", { class: "lab-btn", type: "button", onclick: async (e) => { const ok = await copier(`Demande pour Claude (idée du laboratoire du Noyau)\nType : ${i.type}\nIdée : ${i.texte}\nContexte : ${contexte()}\nRègles : le Noyau ne modifie jamais son code ; branche noyau ; je valide avant toute fusion.`, zone); etat.changerIdee(i.id, "demandee"); sel.value = "demandee"; e.currentTarget.textContent = ok ? "Copié" : "À copier ci-dessous"; } }, "Copier comme demande pour Claude")), zone));
    });
  }
  c.append(h("h3", {}, "Boîte à idées"), h("p", { class: "dim" }, "Note ici ce que tu veux améliorer. Rien n'est appliqué tout seul : tu copies la demande et tu la donnes à Claude."), type, texte,
    h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: () => { try { etat.ajouterIdee({ type: type.value, texte: texte.value }); texte.value = ""; msg.textContent = "Idée ajoutée."; rendreListe(); ctx.surChangement && ctx.surChangement(); } catch (e) { msg.textContent = "Écris d'abord l'idée."; } } }, "Ajouter l'idée"), msg), liste);
  rendreListe();

  const fich = h("input", { type: "file", accept: ".json,application/json", hidden: true }), info = h("p", { class: "dim" });
  fich.addEventListener("change", async () => { const f = fich.files && fich.files[0]; fich.value = ""; if (!f) return; try { const r = etat.importer(JSON.parse(await f.text())); info.textContent = `Importé : ${r.banc} lancement(s), ${r.notes} note(s), ${r.metriques} métrique(s), ${r.ab} comparaison(s), ${r.idees} idée(s). Rien n'a été effacé.`; rendreListe(); ctx.surChangement && ctx.surChangement(); } catch (e) { info.textContent = "Import impossible : " + e.message; } });
  c.append(h("h3", {}, "État du laboratoire"), h("p", { class: "dim" }, etat.persistant ? "L'état (historique du banc, notes, comparaisons, idées) est gardé dans ce navigateur. Exporte-le de temps en temps pour ne rien perdre." : "Ce navigateur bloque le stockage : l'état ne survit pas à la fermeture de la page. Exporte-le avant de partir."),
    h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: () => telecharger("noyau-labo-etat-" + new Date().toISOString().slice(0, 10) + ".json", etat.exporter()) }, "Exporter l'état"), h("button", { class: "lab-btn", type: "button", onclick: () => fich.click() }, "Importer un état"), fich), info,
    h("p", { class: "dim" }, "L'export ne contient aucune clé ni donnée du vrai hub : seulement tes mesures et tes notes."));
}
