/* Medicion de conversiones.
 *
 * En un restaurante la conversion no es una compra: nadie paga en el sitio. Lo
 * que hay que contar es quien toca "reservar mesa", quien llama y quien pide
 * cotizacion del salon. Sin eso, pautar en Google Ads es pagar a ciegas: se ve
 * cuanta gente entro, no cuanta reservo.
 *
 * Este archivo hace tres cosas y ninguna necesita una cuenta configurada para
 * funcionar. Cuando se den de alta GA4 y Google Ads, se completan los dos ids
 * de arriba y empieza a reportar solo.
 *
 * 1. CUENTA LOS ACTOS DE INTENCION. Cada enlace con data-evento emite un evento
 *    al dataLayer al tocarlo. Los eventos que importan son de dos clases y
 *    conviene no mezclarlas: "reservar" es ticket bajo y volumen alto,
 *    "cotizar-evento" es ticket alto y volumen bajo. Optimizar la pauta contra
 *    la suma de las dos hace que Google persiga la barata.
 *
 * 2. GUARDA DE DONDE VINO. Los parametros utm de un anuncio se pierden apenas
 *    la persona navega a otra pagina. Se guardan en sessionStorage al llegar y
 *    sobreviven toda la visita.
 *
 * 3. LOS PASA AL WHATSAPP. Esta es la parte que de verdad cierra el circulo. El
 *    salto a WhatsApp es un salto a otra aplicacion: ninguna herramienta de
 *    analitica ve que paso despues. Pero si el mensaje llega con la campania
 *    escrita al final, quien atiende ve en el chat de que anuncio vino cada
 *    pedido, y eso se puede cruzar contra lo que se gasto.
 */

(function () {
  "use strict";

  /* Completar cuando existan las cuentas. Vacios, el archivo no rompe nada:
     los eventos igual quedan en el dataLayer y se ven en la consola. */
  var GA4 = "";          /* G-XXXXXXXXXX */
  var ADS = "";          /* AW-XXXXXXXXX */

  /* Etiqueta de conversion de Google Ads por evento. Una etiqueta por accion,
     no una sola para todo: si "llamar" y "cotizar evento" comparten etiqueta,
     no se puede pujar distinto por cada una. */
  var CONVERSIONES = {
    "cotizar-evento": "",
    "reservar": "",
    "telefono": "",
    "cata": "",
    "formulario": ""
  };

  var GUARDADO = "zuzu.origen";
  var PARAMETROS = ["utm_source", "utm_medium", "utm_campaign", "utm_content",
                    "utm_term", "gclid", "fbclid"];

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function cargarEtiquetas() {
    var ids = [GA4, ADS].filter(Boolean);
    if (!ids.length) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ids[0];
    document.head.appendChild(s);
    gtag("js", new Date());
    ids.forEach(function (id) { gtag("config", id); });
  }

  /* --- de donde vino la visita --------------------------------------- */

  function guardarOrigen() {
    var busqueda = new URLSearchParams(location.search);
    var origen = {};
    PARAMETROS.forEach(function (p) {
      if (busqueda.get(p)) origen[p] = busqueda.get(p);
    });
    if (!Object.keys(origen).length) return;
    try { sessionStorage.setItem(GUARDADO, JSON.stringify(origen)); } catch (e) {}
  }

  function origen() {
    try { return JSON.parse(sessionStorage.getItem(GUARDADO) || "{}"); }
    catch (e) { return {}; }
  }

  function etiquetaDeOrigen() {
    var o = origen();
    if (o.utm_campaign) return o.utm_campaign;
    if (o.gclid) return "google-ads";
    if (o.utm_source) return o.utm_source;
    return "";
  }

  /* --- WhatsApp con la campania adentro ------------------------------ */

  function marcarWhatsApp(enlace) {
    var etiqueta = etiquetaDeOrigen();
    if (!etiqueta) return;
    try {
      var url = new URL(enlace.href);
      var texto = url.searchParams.get("text");
      if (!texto || texto.indexOf("[") !== -1) return;
      url.searchParams.set("text", texto + "\n\n[" + etiqueta + "]");
      enlace.href = url.toString();
    } catch (e) {}
  }

  /* --- eventos -------------------------------------------------------- */

  function familia(nombre) {
    /* "reservar-barra" y "reservar-movil" son la misma accion desde dos
       lugares. Se reportan juntos como conversion y separados como detalle,
       para poder ver cual boton trabaja sin partir la conversion en dos. */
    return nombre.split("-")[0] === "reservar" ? "reservar" : nombre.split("-")[0];
  }

  function reportar(nombre, enlace) {
    var base = familia(nombre);
    var datos = {
      event: "zuzu_" + base,
      accion: nombre,
      pagina: location.pathname,
      destino: enlace ? enlace.href.slice(0, 120) : ""
    };
    Object.assign(datos, origen());
    window.dataLayer.push(datos);

    var etiqueta = CONVERSIONES[base];
    if (ADS && etiqueta) gtag("event", "conversion", { send_to: ADS + "/" + etiqueta });
    if (GA4) gtag("event", "zuzu_" + base, datos);
  }

  /* --- arranque ------------------------------------------------------- */

  guardarOrigen();
  cargarEtiquetas();

  document.querySelectorAll('a[href^="https://wa.me/"]').forEach(marcarWhatsApp);

  /* Delegado en el documento: los enlaces de la carta y de la galeria se
     escriben despues, y un listener por elemento se los perderia. */
  document.addEventListener("click", function (e) {
    var enlace = e.target.closest("a[data-evento], button[data-evento]");
    if (enlace) { reportar(enlace.dataset.evento, enlace); return; }

    var wa = e.target.closest('a[href^="https://wa.me/"]');
    if (wa) reportar("reservar-suelto", wa);

    var tel = e.target.closest('a[href^="tel:"]');
    if (tel) reportar("telefono", tel);
  }, true);

  document.addEventListener("submit", function (e) {
    if (e.target.matches("form")) reportar("formulario", null);
  }, true);
})();
