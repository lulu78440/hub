// Localisation de l'appareil (météo automatique). Le navigateur demande l'autorisation la première fois.
export function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error("indisponible")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),   // ~100 m : assez pour la météo, plus discret
      (e) => rej(new Error(e.code === 1 ? "refusée" : "introuvable")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60e3 });
  });
}
