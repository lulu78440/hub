"""Statuts du journal (étape test-statuts) : décisions ligne par ligne pour le journal de main au commit c611939.
Usage : python3 tools/tests/statuts_journal.py <journal de main> <sortie>. Si le journal de main a changé, les numéros de ligne
ne correspondent plus : le script s arrête (assertions) et la table D est à relire avant de le relancer."""
import sys
src, dst = sys.argv[1], sys.argv[2]
V, S, R, N = "Validée par Lucien", "Testée en simulation", "Attend un essai réel", "—"
D = {}
for n in (17, 18, 19, 21, 22, 23): D[n] = (N, "maquette remplacée par la v8")
D[20] = (V, "v4 ★ « géniale », référence de validation")
D[24] = (N, "maquette figée, référence PC")
for n in range(25, 32): D[n] = (N, "mod Abyss abandonné le 25/10, fichiers archivés")
for n in range(37, 43): D[n] = (V, None)
D[43] = (V, "sous-étapes 1.1 à 1.7 validées le 23/10 (« Où on en est »)")
for n in range(77, 85): D[n] = (V, None)
D[85] = (S, None)
D[86] = (V, "cases p2-export et p2-sunday cochées dans le Suivi")
D[87] = (V, "cases p2-drag et p2-week cochées dans le Suivi")
for n in (95, 96, 98, 99, 100, 101, 102, 103, 104): D[n] = (V, None)
D[97] = (R, "lecture réelle des nouvelles adresses à confirmer")
for n in range(116, 122): D[n] = (V, "phase 3 validée le 25/10")
D[129] = (V, "p4-ok validée le 25/10")
D[130] = (N, "remplacée par 7.3.3")
for n in (131, 133, 138, 139, 140): D[n] = (V, None)
D[132] = (S, "testé depuis un fichier local")
D[137] = (S, "testé depuis un fichier local")
D[134] = (V, "briefing enrichi gardé, p4-ok validée le 25/10")
D[135] = (N, "reprise par la Refonte (ergo-plan)")
D[136] = (V, None)
D[146] = (R, None)
D[152] = (V, "case p6-orbe cochée dans le Suivi ; IA locale à essayer sur le PC")
D[153] = (V, "cases p6-ent-vis et p6-ent-ia cochées dans le Suivi")
D[161] = (V, "activé et validé le 24/10 (p2-lock)")
D[162] = (R, None)
D[170] = (V, "case p7-1 cochée dans le Suivi")
D[171] = (R, "micro simulé seulement ; Brave bloque la reconnaissance vocale (p7-voix livrée, non cochée)")
D[172] = (V, "case p7-2 cochée dans le Suivi")
D[180] = (N, "étape de discussion")
D[181] = (N, "étape de discussion")
D[182] = (V, None); D[183] = (V, None)
D[184] = (N, "passation")
D[185] = (N, "note")
for n in (186, 187, 188, 189, 190, 191, 193, 196, 197, 198): D[n] = (V, "étape 4 du Noyau close par Lucien le 25/10 (N19)")
D[192] = (R, None); D[194] = (R, None); D[195] = (R, None)
D[230] = (V, None)
for n in (231, 232, 233, 234): D[n] = (V, "case ergo-plan cochée dans le Suivi")
for n in (235, 236, 237): D[n] = (V, "case ergo-visuel cochée dans le Suivi")
for n in (238, 239): D[n] = (V, "case ergo-fusion cochée dans le Suivi")
D[240] = (S, "navigateur automatisé ; à faire passer au Banc de test")
for n in (273, 274, 275, 277, 278, 279, 280): D[n] = (V, "étape 4 du Noyau close par Lucien le 25/10 (N19) ; essais réels restants dans la feuille de route du labo")
D[276] = (V, "case p4-noyau-fenetre cochée dans le Suivi ; test Android à faire")
D[281] = (V, None); D[282] = (V, None)
D[283] = (S, "essais du labo (essais-perso)")
D[284] = (V, "case ergo-outils cochée dans le Suivi")
D[285] = (R, "aucun test noté ; ajout validé par la Commande, pas encore par Lucien")
D[286] = (V, "case ergo-mobile cochée dans le Suivi ; testé en émulation, vrai téléphone à essayer")
D[287] = (N, "plan, aucun code")
D[288] = (R, "à valider par Lucien sur son PC")
D[289] = (N, "note de la Commande")
D[290] = (R, "à valider par Lucien sur son PC")

lines = open(src, encoding="utf-8").read().split("\n")
assert lines[14].startswith("| Date | Version | Ce qui a été fait |"), lines[14]
assert lines[272].startswith("| 25/10 | N10.0"), lines[272][:40]
assert len(lines) >= 290 and lines[289].startswith("| 25/10 | Plan 3 · p3-applis"), lines[289][:60]
out, done = [], set()
for i, l in enumerate(lines, 1):
    if i == 15: out.append(l + " Statut |"); continue
    if i == 16: out.append(l + " --- |"); continue
    if i == 273:
        out += ["", "## Suite du journal (lignes ajoutées en fin de fichier)", "",
                "Ces lignes étaient collées sous la liste « À trancher plus tard » sans en-tête de tableau ; elles sont reprises ici telles quelles, avec leur statut.", "",
                "| Date | Étape | Ce qui a été fait | Statut |", "| --- | --- | --- | --- |"]
    if i in D:
        st, det = D[i]
        c = l.rstrip().rstrip("|").rstrip().split(" | ")
        c[0] = c[0].lstrip("| ").strip()
        want = 5 if i in (197, 198) else None
        if len(c) == 3 and want == 5:
            c += ["—", ""]
        elif len(c) == 3:
            c += [""]
        old = c[-1].strip()
        if old in ("Livrée", "Faite", "Fait", "Corrigé", "Noté", "Prête") or old.startswith(st) or old == "":
            old = ""
        old = old.replace("Validée par Lucien ", "").strip()
        parts = [p for p in (det, old) if p]
        cell = "**" + st + "**" + (" · " + " ; ".join(parts) if parts else "")
        if st == N: cell = "— · " + " ; ".join(parts)
        c[-1] = cell
        out.append("| " + " | ".join(c) + " |"); done.add(i); continue
    out.append(l)
miss = [i for i, l in enumerate(lines, 1) if l.startswith("| ") and not l.startswith("| ---") and not l.startswith("| Date") and i not in D]
assert not miss, miss
head = out.index("## Où on en est")
leg = ["## Statuts des étapes", "",
       "Chaque ligne d'étape porte un statut (format proposé par le poste Banc de test le 25/10, à valider par Lucien) :", "",
       "- **Validée par Lucien** : ta validation est écrite dans ce journal ou la case est cochée (« done ») dans le Suivi du Hub. Jamais déduite.",
       "- **Testée en simulation** : testée par Claude (navigateur de test, services simulés), pas encore validée par toi.",
       "- **Attend un essai réel** : il manque ce que la simulation ne peut pas fournir (vraie clé, vrai téléphone, vrai PC, vraies connexions).",
       "- **—** : pas une étape (maquette remplacée, note, décision, plan).", "",
       "Quand plusieurs statuts s'appliquent, ta validation l'emporte ; ce qui reste à essayer est écrit après le point médian.", ""]
out = out[:head] + leg + out[head:]
open(dst, "w", encoding="utf-8").write("\n".join(out))
print(len(done), "lignes marquées")
