// Aides DOM communes.
/** Vrai si la cible est le « fond » (la scène), pas un élément d'interface. */
export const onBackground = (t) => !!(t && t.closest && !t.closest(".search, .top, .diag, .desk .btn, .toast, .win, .pic, .ctx, .agband, .agdrawer, button, input, a, label"));
