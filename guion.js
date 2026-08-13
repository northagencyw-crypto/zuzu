(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Una sola curva para toda la pagina: el hero, los reveals y los hover usan
     la misma aceleracion, que es lo que hace que el sitio se sienta de una pieza
     en vez de una suma de efectos sueltos. */
  function suave(x){ return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2; }
  function tramo(t, a, b){ return Math.min(Math.max((t - a) / (b - a), 0), 1); }

  var barra   = document.getElementById("barra");
  var hero    = document.querySelector(".hero");
  var zeta    = document.getElementById("zeta");
  var puerta  = document.getElementById("puerta");
  var vineta  = document.getElementById("vineta");
  var texto   = document.getElementById("heroTexto");
  var hint    = document.getElementById("hint");
  var pendiente = false;

  /* Espesor real: laminas identicas separadas en Z. Al girar se ve el canto, que
     es lo que distingue una pieza con volumen de una silueta plana. Van detras
     de la cara para que la frontal siempre quede pulida. */
  var LAMINAS = 26;
  if (zeta && !reduce){
    var frag = document.createDocumentFragment();
    for (var i = LAMINAS; i > 0; i--){
      var lam = document.createElement("span");
      lam.className = "z-glifo z-lamina";
      lam.setAttribute("aria-hidden", "true");
      lam.textContent = "Z";
      lam.style.transform = "translateZ(" + (-i * 1.15).toFixed(2) + "px)";
      /* el canto se oscurece hacia el fondo: da lectura de profundidad */
      lam.style.filter = "brightness(" + (0.30 + 0.62 * (1 - i / LAMINAS)).toFixed(3) + ")";
      frag.appendChild(lam);
    }
    zeta.insertBefore(frag, zeta.firstChild);
  }

  function pintar(){
    pendiente = false;
    var y = window.scrollY || window.pageYOffset;
    if (barra) barra.classList.toggle("fija", y > 40);
    /* Sin esta guarda, borrar un solo nodo del hero tiraba una excepcion en el
       arranque y dejaba la carta pegada y el visor sin abrir. */
    if (reduce || !hero || !zeta || !puerta || !vineta || !texto || !hint) return;

    var recorrido = hero.offsetHeight - window.innerHeight;
    var t = recorrido > 0 ? Math.min(Math.max(y / recorrido, 0), 1) : 0;

    /* 1. la pieza gira y se acerca */
    var giro = suave(tramo(t, 0, 0.30));
    var acerca = suave(tramo(t, 0.10, 0.62));
    var acercar = suave(tramo(t, 0.10, 0.60));
    zeta.style.transform =
      "rotateY(" + (-208 * (1 - giro)).toFixed(2) + "deg)" +
      " rotateX(" + (6 * (1 - giro)).toFixed(2) + "deg)" +
      " scale(" + ((0.70 + giro * 0.16) * (1 + acercar * acercar * 10)).toFixed(3) + ")";

    /* 2. la letra se acerca hasta atravesar la pantalla */


    /* 3. el oro cede cuando ya llena todo y el lugar toma la pantalla */
    zeta.style.opacity = (1 - suave(tramo(t, 0.34, 0.60))).toFixed(3);
    var relevo = suave(tramo(t, 0.22, 0.52));
    puerta.style.opacity = relevo.toFixed(3);
    puerta.style.transform = "scale(" + (1.10 - relevo * 0.10).toFixed(4) + ")";
    vineta.style.opacity = relevo.toFixed(3);

    /* El titulo esta desde el arranque: solo se asienta. Antes entraba recien
       en t=0.76, o sea despues de casi un scroll entero. */
    var entra = suave(tramo(t, 0, 0.18));
    texto.style.opacity = (0.55 + entra * 0.45).toFixed(3);
    texto.style.transform = "translateY(" + ((1 - entra) * 14).toFixed(1) + "px)";
    hint.style.opacity = (1 - suave(tramo(t, 0, 0.12))).toFixed(3);
  }

  function alScroll(){
    if (!pendiente){ pendiente = true; window.requestAnimationFrame(function(){ pintar(); }); }
  }
  window.addEventListener("scroll", alScroll, {passive:true});
  window.addEventListener("resize", alScroll, {passive:true});
  /* La primera pasada va al final del bloque, cuando ya estan definidas todas
     las piezas. Llamarla aca lanzaba un TypeError sobre la paleta y cortaba el
     ciclo de dibujado entero, con lo que las secciones quedaban invisibles. */

  /* Aparicion de secciones, escalonada dentro de cada bloque para que la lectura
     baje en cascada y no de un golpe. Sin soporte, todo queda visible. */
  if ("IntersectionObserver" in window && !reduce){
    var obs = new IntersectionObserver(function(entradas){
      entradas.forEach(function(e){
        if (!e.isIntersecting) return;
        var hijos = e.target.querySelectorAll(".escalona > *");
        hijos.forEach(function(hijo, i){ hijo.style.transitionDelay = (i * 70) + "ms"; });
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      });
    }, {rootMargin:"0px 0px -12% 0px", threshold:0.08});
    document.querySelectorAll(".revelar").forEach(function(el){ obs.observe(el); });
  } else {
    document.querySelectorAll(".revelar").forEach(function(el){ el.classList.add("visible"); });
  }

  /* Red de seguridad del revelado. El observador no siempre dispara cuando se
     salta de golpe a una posicion, y eso pasa justo al entrar por un enlace del
     menu (#carta, #eventos): la seccion quedaba invisible con opacidad 0. Este
     chequeo corre en el mismo frame y muestra cualquier bloque que ya este en
     pantalla, venga como venga. */
  var porRevelar = [].slice.call(document.querySelectorAll(".revelar"));
  function asegurarVisibles(){
    if (!porRevelar.length) return;
    var alto = window.innerHeight;
    var quedan = [];
    for (var i = 0; i < porRevelar.length; i++){
      var el = porRevelar[i];
      if (el.classList.contains("visible")) continue;
      var caja = el.getBoundingClientRect();
      if (caja.top < alto * 0.92 && caja.bottom > 0) el.classList.add("visible");
      else quedan.push(el);
    }
    /* la lista se achica sola: una vez revelado, el bloque no se vuelve a mirar */
    porRevelar = quedan;
  }

  /* Fondo que muta con el scroll. Los colores salen del lugar: follaje de la
     terraza, madera del salon, oro de la barra, canela de la brasa, y vuelta al
     verde para cerrar donde empezo. */
  var PALETA = [
    [0.00, [18, 22, 14]],    // verde noche
    [0.22, [26, 33, 19]],    // follaje
    [0.44, [45, 33, 20]],    // madera
    [0.62, [58, 41, 18]],    // oro apagado
    [0.80, [48, 30, 18]],    // canela
    [1.00, [18, 22, 14]],    // vuelve al verde
  ];
  tinte.ultimo = "";
  function tinte(){
    if (reduce) return;
    var alto = document.body.scrollHeight - window.innerHeight;
    var t = alto > 0 ? Math.min(Math.max(window.scrollY / alto, 0), 1) : 0;
    for (var i = 0; i < PALETA.length - 1; i++){
      var a = PALETA[i], b = PALETA[i + 1];
      if (t >= a[0] && t <= b[0]){
        var k = suave((t - a[0]) / (b[0] - a[0]));
        var c = [0, 1, 2].map(function(j){
          return Math.round(a[1][j] + (b[1][j] - a[1][j]) * k);
        });
        /* Cuantizado a saltos de tres: a simple vista es el mismo degradado y
           evita repintar cuando el color no se movio de verdad. */
        var color = "rgb(" + (c[0] - c[0] % 3) + "," + (c[1] - c[1] % 3) + "," +
                    (c[2] - c[2] % 3) + ")";
        if (color !== tinte.ultimo){
          tinte.ultimo = color;
          document.body.style.backgroundColor = color;
        }
        return;
      }
    }
  }

  /* Escenas de evento: el scroll cruza de una a la siguiente. */
  /* El video pesa 225 KB y esta a nueve pantallas del inicio. Con `autoplay` en
     el marcado se bajaba siempre, aunque nadie llegara: `autoplay` le gana a
     `preload="none"`. Aca la fuente se asigna recien cuando el video se acerca,
     que es el unico momento en que ese peso se justifica. */
  (function(){
    var v = document.getElementById("recorridoVideo");
    if (!v || !v.dataset.src) return;
    var arrancar = function(){
      if (v.src) return;
      v.src = v.dataset.src;
      /* Puede fallar por politica de reproduccion del navegador. No es un
         error que valga la pena propagar: queda el poster, que ya describe
         la escena. */
      var p = v.play();
      if (p && p.catch) p.catch(function(){});
    };
    if (!("IntersectionObserver" in window)) { arrancar(); return; }
    var ojo = new IntersectionObserver(function(entradas){
      if (!entradas.some(function(e){ return e.isIntersecting; })) return;
      arrancar();
      ojo.disconnect();
    }, { rootMargin: "300px 0px" });
    ojo.observe(v);
  })();

  var escenas = [].slice.call(document.querySelectorAll("[data-escena]"));
  var pista = document.getElementById("escenas");
  function cruzar(){
    if (reduce || !pista || !escenas.length) return;
    var caja = pista.getBoundingClientRect();
    var recorrido = pista.offsetHeight - window.innerHeight;
    var t = recorrido > 0 ? Math.min(Math.max(-caja.top / recorrido, 0), 1) : 0;
    var tramoUno = 1 / escenas.length;

    /* Las fotos se cruzan de a dos, y eso esta bien: el fundido es el efecto.
       Los rotulos no pueden hacer lo mismo, porque dos palabras superpuestas en
       el mismo rincon no se leen ni juntas ni separadas. Bajarles la opacidad no
       alcanza: en el punto medio del cruce las dos valen lo mismo, asi que la
       unica salida es que solo hable UNA. Se elige la de arriba y las demas
       callan. */
    var opacidades = escenas.map(function(el, i){
      var desde = i * tramoUno, hasta = desde + tramoUno;
      var dentro = t >= desde - tramoUno * 0.5 && t <= hasta + tramoUno * 0.5;
      if (i === 0 && t < tramoUno) return 1;
      return dentro ? Math.max(0, Math.min(
        suave(tramo(t, desde - tramoUno * 0.45, desde + tramoUno * 0.2)),
        1 - suave(tramo(t, hasta - tramoUno * 0.1, hasta + tramoUno * 0.45)))) : 0;
    });

    var mandan = 0;
    for (var k = 1; k < opacidades.length; k++) {
      if (opacidades[k] > opacidades[mandan]) mandan = k;
    }

    escenas.forEach(function(el, i){
      var o = opacidades[i];
      el.style.opacity = o.toFixed(3);
      el.style.transform = "scale(" + (1.05 - 0.05 * o).toFixed(4) + ")";
      var pie = el.querySelector("figcaption");
      if (!pie) return;
      /* La dominante ademas entra y sale mas rapido que su foto, para que el
         rotulo ya se haya ido cuando la siguiente empieza a mandar. */
      var visible = i === mandan ? Math.max(0, (o - 0.55) / 0.45) : 0;
      pie.style.opacity = (visible * visible).toFixed(3);
    });
  }

  /* Entrada suave por elemento: sube y aparece. Antes cortaba la foto en
     diagonal y quedaba mal en el ida y vuelta del scroll. */
  var armables = [].slice.call(document.querySelectorAll("[data-abre]"));

  /* Posiciones cacheadas. Antes cada cuadro pedia getBoundingClientRect de todos
     los elementos y escribia estilos en el medio, lo que obliga al navegador a
     recalcular el layout una y otra vez: la medicion daba 16,4 ms de mediana y
     picos de 40, o sea scroll con tirones. La posicion en el documento solo
     cambia al redimensionar, asi que se mide una vez y se reusa. */
  var cajas = [];
  function medirCajas(){
    var y = window.scrollY || window.pageYOffset;
    cajas = armables.map(function(el){
      var c = el.getBoundingClientRect();
      return { top: c.top + y, alto: c.height };
    });
  }
  medirCajas();
  window.addEventListener("resize", medirCajas, {passive:true});
  window.addEventListener("load", medirCajas);

  function armar(){
    if (reduce) return;
    var alto = window.innerHeight;
    var scroll = window.scrollY || window.pageYOffset;
    for (var i = 0; i < armables.length; i++){
      var el = armables[i];
      var ref = cajas[i];
      if (!ref) continue;
      var caja = { top: ref.top - scroll, bottom: ref.top - scroll + ref.alto, height: ref.alto };
      if (caja.bottom < -80 || caja.top > alto + 80) continue;
      /* de 0 cuando el elemento asoma por abajo a 1 cuando subio un tercio */
      var p = suave(tramo((alto - caja.top) / (alto * 0.62 + caja.height * 0.25), 0, 1));
      /* El progreso no retrocede. Antes se derivaba de la posicion actual, asi
         que al subir con el dedo (gesto constante en celular) los bloques se
         volvian a apagar, incluido el que tiene el boton de reservar. */
      var maxima = el._p || 0;
      if (p > maxima) { maxima = p; el._p = p; }
      el.style.transform = "translateY(" + ((1 - maxima) * 26).toFixed(1) + "px)";
      el.style.opacity = Math.min(1, 0.15 + maxima * 1.6).toFixed(3);
    }
  }
  var pintarHero = pintar;
  pintar = function(){ pintarHero(); armar(); cruzar(); tinte(); asegurarVisibles(); };
  pintar();

  /* El navegador salta al ancla DESPUES de ejecutar este script, y un salto por
     ancla no dispara evento de scroll. Sin estas pasadas, entrar por
     zuzu.mx/#carta deja la seccion en opacidad 0: contenido invisible con la
     pagina aparentemente cargada. */
  window.addEventListener("load", pintar);
  window.addEventListener("hashchange", function(){ setTimeout(pintar, 60); });
  setTimeout(pintar, 150);
  setTimeout(pintar, 600);
  armar();

  /* Pestañas de la carta. Las flechas mueven entre secciones porque una
     tablist sin teclado deja afuera a quien navega sin mouse. */
  var tabs = [].slice.call(document.querySelectorAll(".tab"));
  if (tabs.length){
    function activar(i){
      tabs.forEach(function(t, j){
        var on = i === j;
        t.setAttribute("aria-selected", on ? "true" : "false");
        if (on) t.removeAttribute("tabindex"); else t.setAttribute("tabindex", "-1");
        var panel = document.getElementById("panel-" + j);
        if (panel) panel.hidden = !on;
      });
    }
    tabs.forEach(function(t, i){
      t.addEventListener("click", function(){ activar(i); });
      t.addEventListener("keydown", function(e){
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + tabs.length) % tabs.length;
        activar(n); tabs[n].focus();
      });
    });
  }

  /* Visor de galeria. Teclado incluido: sin flechas y Escape una galeria
     a pantalla completa es una trampa para quien no usa mouse. */
  var piezas = [].slice.call(document.querySelectorAll(".pieza"));
  var visor = document.getElementById("visor");
  if (piezas.length && visor){
    var vImg = document.getElementById("visorImg");
    var vPie = document.getElementById("visorPie");
    var actual = 0;
    var previo = null;

    function mostrar(i){
      actual = (i + piezas.length) % piezas.length;
      var p = piezas[actual];
      vImg.src = p.getAttribute("data-full");
      vImg.alt = p.getAttribute("data-alt") || "";
      vPie.textContent = (actual + 1) + " de " + piezas.length + " · " + (p.getAttribute("data-alt") || "");
    }
    function abrir(i){
      previo = document.activeElement;
      mostrar(i);
      visor.classList.add("abierto");
      document.body.style.overflow = "hidden";
      document.getElementById("visorCerrar").focus();
    }
    function cerrar(){
      visor.classList.remove("abierto");
      document.body.style.overflow = "";
      if (previo && previo.focus) previo.focus();
    }
    piezas.forEach(function(p, i){ p.addEventListener("click", function(){ abrir(i); }); });
    document.getElementById("visorCerrar").addEventListener("click", cerrar);
    document.getElementById("visorAnt").addEventListener("click", function(){ mostrar(actual - 1); });
    document.getElementById("visorSig").addEventListener("click", function(){ mostrar(actual + 1); });
    visor.addEventListener("click", function(e){ if (e.target === visor) cerrar(); });
    document.addEventListener("keydown", function(e){
      if (!visor.classList.contains("abierto")) return;
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowLeft") mostrar(actual - 1);
      if (e.key === "ArrowRight") mostrar(actual + 1);
    });
  }
})();
