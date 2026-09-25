// ========== CONFIGURACIÓN FIREBASE ==========
// PROYECTO REAL
const firebaseConfigReal = {
    apiKey: "AIzaSyDz8fzziGrMrj_pWPVwbZ3WPUY9wB1etZ8",
    authDomain: "app-control-grido.firebaseapp.com",
    projectId: "app-control-grido",
    storageBucket: "app-control-grido.firebasestorage.app",
    messagingSenderId: "142344571044",
    appId: "1:142344571044:web:82d27d7599ccf902327e31"
};

// PROYECTO DE PRUEBAS
const firebaseConfigPruebas = {
    apiKey: "AIzaSyC23vUj4hiVHmUxilyV1I2Zo7vzQGKKfDI",
    authDomain: "app-control-grido-pruebas.firebaseapp.com",
    projectId: "app-control-grido-pruebas",
    storageBucket: "app-control-grido-pruebas.firebasestorage.app",
    messagingSenderId: "1099039628873",
    appId: "1:1099039628873:web:f18a6c73bd587ca1c76998"
};

let modoPrueba = false;
let db;
let listenersActivos = [];
let listenersEnVivo = [];

function inicializarFirebase(config, esPrueba) {
    if (firebase.apps.length > 0) {
        listenersActivos.forEach(unsub => { try { unsub(); } catch(e) {} });
        listenersEnVivo.forEach(unsub => { try { unsub(); } catch(e) {} });
        listenersActivos = [];
        listenersEnVivo = [];
        firebase.apps.forEach(app => app.delete());
    }
    firebase.initializeApp(config);
    db = firebase.firestore();
    modoPrueba = esPrueba;
}

inicializarFirebase(firebaseConfigReal, false);

// ========== FORMATO NUMÉRICO ==========
function parsearNumeroArgentino(texto) {
    if (typeof texto === 'number') return texto;
    if (!texto) return 0;
    let str = texto.toString().trim();
    if (str === '' || str === '0') return 0;
    str = str.replace(/\$/g, '').trim();
    const tienePunto = str.includes('.');
    const tieneComa = str.includes(',');
    if (tienePunto && tieneComa) str = str.replace(/\./g, '').replace(',', '.');
    else if (tieneComa && !tienePunto) str = str.replace(',', '.');
    else if (tienePunto && !tieneComa) {
        const puntos = (str.match(/\./g) || []).length;
        if (puntos > 1) str = str.replace(/\./g, '');
        else {
            const partes = str.split('.');
            if (partes[1] && partes[1].length === 3 && partes[0].length <= 3) str = str.replace('.', '');
        }
    }
    const numero = parseFloat(str);
    return isNaN(numero) ? 0 : numero;
}

function formatearNumeroArgentino(numero) {
    if (numero === null || numero === undefined || isNaN(numero)) return '0';
    const num = parseFloat(numero);
    if (Number.isInteger(num)) return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const partes = num.toString().split('.');
    const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimal = partes[1];
    return `${entero},${decimal}`;
}

function formatearMoneda(numero) { return `$${formatearNumeroArgentino(numero)}`; }

// ========== TOAST ==========
function mostrarToast(mensaje, tipo = 'entrada', duracion = 4000) {
    const toast = document.getElementById('toastNotificacion');
    if (!toast) return;
    toast.textContent = mensaje;
    toast.className = 'toast-notificacion mostrar ' + tipo;
    setTimeout(() => { toast.classList.remove('mostrar'); }, duracion);
}

// ========== NOTIFICACIONES ==========
let notificacionesActivas = localStorage.getItem('notificacionesActivas') !== 'false';
let audioContext = null;

function inicializarAudio() {
    if (!audioContext) {
        try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
        catch(e) {}
    }
}

function reproducirSonido(tipo) {
    if (!notificacionesActivas) return;
    inicializarAudio();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    if (tipo === 'urgente') {
        oscillator.frequency.value = 880; oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } else if (tipo === 'pedido') {
        oscillator.frequency.value = 660; oscillator.type = 'triangle';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } else if (tipo === 'alerta') {
        oscillator.frequency.value = 440; oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);
    }
}

function vibrar(patrones) {
    if (!notificacionesActivas) return;
    if ('vibrate' in navigator) navigator.vibrate(patrones);
}

function mostrarNotificacionSistema(titulo, cuerpo, tipo) {
    if (!notificacionesActivas) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        const notif = new Notification(titulo, {
            body: cuerpo,
            icon: tipo === 'urgente' ? '🔴' : tipo === 'pedido' ? '📋' : '💰',
            tag: tipo + Date.now(),
            requireInteraction: tipo === 'urgente'
        });
        setTimeout(() => notif.close(), 8000);
        notif.onclick = function() { window.focus(); notif.close(); };
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') mostrarNotificacionSistema(titulo, cuerpo, tipo);
        });
    }
}

function mostrarBanner(texto, tipo) {
    const banner = document.getElementById('bannerNotificacion');
    const icono = document.getElementById('bannerIcono');
    const textoEl = document.getElementById('bannerTexto');
    banner.className = 'banner-notificacion ' + tipo;
    const iconos = { urgente: '🚨', normal: '🔔', info: '⚠️' };
    icono.textContent = iconos[tipo] || '🔔';
    textoEl.textContent = texto;
    banner.style.display = 'block';
    setTimeout(() => cerrarBanner(), 6000);
}

function cerrarBanner() {
    const banner = document.getElementById('bannerNotificacion');
    banner.classList.add('cerrando');
    setTimeout(() => {
        banner.style.display = 'none';
        banner.classList.remove('cerrando');
    }, 300);
}

function dispararNotificacion(titulo, mensaje, tipo) {
    if (!notificacionesActivas) return;
    const config = {
        urgente: { sonido: 'urgente', vibracion: [200, 100, 200, 100, 200], banner: 'urgente' },
        pedido: { sonido: 'pedido', vibracion: [150], banner: 'normal' },
        alerta: { sonido: 'alerta', vibracion: [300, 150, 300, 150, 300], banner: 'info' }
    };
    const cfg = config[tipo] || config.pedido;
    reproducirSonido(cfg.sonido);
    vibrar(cfg.vibracion);
    mostrarBanner(`${titulo}: ${mensaje}`, cfg.banner);
    mostrarNotificacionSistema(titulo, mensaje, tipo);
}

function toggleNotificaciones() {
    notificacionesActivas = !notificacionesActivas;
    localStorage.setItem('notificacionesActivas', notificacionesActivas);
    const btn = document.getElementById('btnNotificaciones');
    const estado = document.getElementById('estadoNotif');
    if (notificacionesActivas) {
        btn.classList.remove('desactivado');
        estado.textContent = 'ON';
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        alert('✅ Notificaciones activadas');
    } else {
        btn.classList.add('desactivado');
        estado.textContent = 'OFF';
        alert('🔕 Notificaciones desactivadas');
    }
}

function actualizarEstadoBotonNotif() {
    const btn = document.getElementById('btnNotificaciones');
    if (btn) {
        if (notificacionesActivas) {
            btn.classList.remove('desactivado');
            document.getElementById('estadoNotif').textContent = 'ON';
        } else {
            btn.classList.add('desactivado');
            document.getElementById('estadoNotif').textContent = 'OFF';
        }
    }
}

// ========== LISTENERS TIEMPO REAL ==========
let ultimoAvisoConocido = null;
let ultimoPedidoConocido = null;
let ultimoCierreConocido = null;

function iniciarListenersTiempoReal() {
    listenersActivos.forEach(unsub => { try { unsub(); } catch(e) {} });
    listenersActivos = [];
    
    const unsubAvisos = db.collection('avisos').orderBy('fechaCreacion', 'desc').limit(1).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && ultimoAvisoConocido !== null) {
                const aviso = change.doc.data();
                if (aviso.prioridad === 'urgente') {
                    const creador = aviso.creador || '';
                    const actual = empleadoActual ? empleadoActual.nombre : 'Admin';
                    if (creador !== actual) dispararNotificacion('🚨 Aviso Urgente', aviso.titulo, 'urgente');
                }
            }
        });
        if (!snapshot.empty) ultimoAvisoConocido = snapshot.docs[0].id;
        actualizarIndicadorAvisosUrgentes();
    });
    listenersActivos.push(unsubAvisos);
    
    const unsubPedidos = db.collection('camaraPedidos').orderBy('fecha', 'desc').limit(1).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && ultimoPedidoConocido !== null) {
                const pedido = change.doc.data();
                const prod = productos.find(p => p.id === pedido.productoId);
                const nombreProd = prod ? prod.nombre : 'Producto';
                const empleado = pedido.empleado || 'Alguien';
                const actual = empleadoActual ? empleadoActual.nombre : 'Admin';
                if (empleado !== actual) dispararNotificacion('📋 Nuevo Pedido', `${empleado} pidió ${pedido.cantidad} ${nombreProd}`, 'pedido');
            }
        });
        if (!snapshot.empty) ultimoPedidoConocido = snapshot.docs[0].id;
    });
    listenersActivos.push(unsubPedidos);
    
    const unsubCierres = db.collection('cierres').orderBy('timestamp', 'desc').limit(1).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && ultimoCierreConocido !== null) {
                const cierre = change.doc.data();
                if (modoActual === 'admin' && Math.abs(cierre.diferencia || 0) > 0.01) {
                    const difTexto = cierre.diferencia > 0 ? `Sobra ${formatearMoneda(cierre.diferencia)}` : `Falta ${formatearMoneda(Math.abs(cierre.diferencia))}`;
                    dispararNotificacion('💰 Diferencia en Caja', `Turno #${cierre.numero}: ${difTexto}`, 'alerta');
                }
            }
        });
        if (!snapshot.empty) ultimoCierreConocido = snapshot.docs[0].id;
    });
    listenersActivos.push(unsubCierres);
}

// ========== SINCRONIZACIÓN EN VIVO ==========
function iniciarSincronizacionEnVivo() {
    listenersEnVivo.forEach(unsub => { try { unsub(); } catch(e) {} });
    listenersEnVivo = [];
    
    const unsubProductos = db.collection('productos').onSnapshot(snapshot => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva) {
            const tabId = tabActiva.id;
            if (tabId === 'dashboard') cargarDashboard();
            if (tabId === 'conteo') cargarConteo();
            if (tabId === 'camara') cargarCamara();
            if (tabId === 'gestion') cargarGestion();
            
        }
    });
    listenersEnVivo.push(unsubProductos);
    
    const unsubStock = db.collection('config').doc('stock').onSnapshot(doc => {
        stock = doc.exists ? doc.data().data : {};
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && (tabActiva.id === 'dashboard' || tabActiva.id === 'conteo' || tabActiva.id === 'camara' || tabActiva.id === 'gestion')) {
            if (tabActiva.id === 'dashboard') cargarDashboard();
            if (tabActiva.id === 'conteo') cargarConteo();
            if (tabActiva.id === 'camara') cargarCamara();
            if (tabActiva.id === 'gestion') cargarListaProductos();
        }
    });
    listenersEnVivo.push(unsubStock);
    
    const unsubStockCamara = db.collection('config').doc('stockCamara').onSnapshot(doc => {
        stockCamara = doc.exists ? doc.data().data : {};
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'camara') cargarStockCamara();
    });
    listenersEnVivo.push(unsubStockCamara);

    const unsubNotasConteo = db.collection('config').doc('notasConteo').onSnapshot(doc => {
        notasConteo = doc.exists ? (doc.data().data || {}) : {};
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'conteo') cargarConteo();
    });
    listenersEnVivo.push(unsubNotasConteo);

    const unsubNotasPedidos = db.collection('config').doc('notasPedidos').onSnapshot(doc => {
        notasPedidos = doc.exists ? (doc.data().data || {}) : {};
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'gestion' && document.getElementById('formularioPedido')?.style.display !== 'none') renderProductosPedido();
    });
    listenersEnVivo.push(unsubNotasPedidos);
    
    const unsubTareas = db.collection('tareas').onSnapshot(snapshot => {
        tareas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'tareas') cargarTareas();
    });
    listenersEnVivo.push(unsubTareas);
    
    // 🔧 🔑 🔑 🔑 LISTENER CORREGIDO: tareasCompletadas 🔑 🔑 🔑
    const unsubTareasComp = db.collection('config').doc('tareasCompletadas').onSnapshot(doc => {
        tareasCompletadas = doc.exists ? doc.data().data : {};
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'tareas') {
            // 🔑 RECORDAR qué desplegables estaban abiertos
            const estadosAbiertos = {};
            ['apertura', 'durante', 'cierre'].forEach(momento => {
                const el = document.getElementById('momento-' + momento);
                if (el && el.style.display !== 'none') {
                    estadosAbiertos[momento] = true;
                }
            });
            
            cargarTareas();
            
            // 🔑 RESTAURAR los desplegables que estaban abiertos
            Object.keys(estadosAbiertos).forEach(momento => {
                const el = document.getElementById('momento-' + momento);
                const icono = document.getElementById('icon-momento-' + momento);
                if (el) {
                    el.style.display = 'block';
                    if (icono) icono.textContent = '▼';
                }
            });
        }
    });
    listenersEnVivo.push(unsubTareasComp);
    
    const unsubEmpleados = db.collection('empleados').onSnapshot(snapshot => {
        empleados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cargarSelectEmpleados();
    });
    listenersEnVivo.push(unsubEmpleados);
    
    const unsubEventos = db.collection('eventos').onSnapshot(snapshot => {
        eventos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'calendario') cargarCalendario();
    });
    listenersEnVivo.push(unsubEventos);
    
    const unsubPedidosCamara = db.collection('camaraPedidos').onSnapshot(snapshot => {
        pedidosCamara = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'camara') cargarPedidosCamara();
    });
    listenersEnVivo.push(unsubPedidosCamara);
    
    const unsubMovCamara = db.collection('camaraMovimientos').onSnapshot(snapshot => {
        movimientosCamara = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'camara') cargarHistorialCamara();
    });
    listenersEnVivo.push(unsubMovCamara);
    
    const unsubCierres = db.collection('cierres').onSnapshot(snapshot => {
        cierres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva) {
            if (tabActiva.id === 'cierre') cargarCierre();
            if (tabActiva.id === 'cierresAdmin') cargarCierresAdmin();
        }
    });
    listenersEnVivo.push(unsubCierres);
    
    const unsubCajas = db.collection('cajas').onSnapshot(snapshot => {
        cajas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'caja') cargarCaja();
    });
    listenersEnVivo.push(unsubCajas);
    
    const unsubGastos = db.collection('gastos').onSnapshot(snapshot => {
        gastos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'gastos') cargarGastos();
    });
    listenersEnVivo.push(unsubGastos);
    
    const unsubAvisos = db.collection('avisos').onSnapshot(snapshot => {
        avisos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'avisos') cargarAvisos();
        actualizarIndicadorAvisosUrgentes();
    });
    listenersEnVivo.push(unsubAvisos);
    
    const unsubHistorial = db.collection('historialConteos').onSnapshot(snapshot => {
        historialConteos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'historial') cargarHistorial();
    });
    listenersEnVivo.push(unsubHistorial);
    
    const unsubFichajes = db.collection('fichajes').onSnapshot(snapshot => {
        fichajes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'fichaje') cargarFichaje();
    });
    listenersEnVivo.push(unsubFichajes);
    
    const unsubTurnos = db.collection('turnos').onSnapshot(snapshot => {
        turnos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'fichaje') cargarFichaje();
        if (tabActiva && tabActiva.id === 'gestion') cargarTurnos();
    });
    listenersEnVivo.push(unsubTurnos);
    
    // 🎁 NUEVO: listener de consumos
    const unsubConsumos = db.collection('consumos').onSnapshot(snapshot => {
        consumos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tabActiva = document.querySelector('.tab-content.active');
        if (tabActiva && tabActiva.id === 'consumo') {
            cargarMisConsumos();
            if (modoActual === 'admin') cargarConsumoAdmin();
        }
    });
    listenersEnVivo.push(unsubConsumos);
    
    console.log('✅ Sincronización en vivo activada');
}

const PASSWORD_ADMIN = "thor";

const CATEGORIAS = {
    helados: '🍦 Helados', congelados: '❄️ Congelados', insumos: '📋 Insumos',
    cafeteria: '☕ Cafetería', bebidas: '🥤 Bebidas', otros: '📦 Otros'
};

const CATEGORIAS_GASTOS = {
    servicios: '💡 Servicios', alquiler: '🏠 Alquiler', proveedores: '📦 Proveedores',
    insumos: '🧴 Insumos', sueldos: '💼 Sueldos', impuestos: '📄 Impuestos',
    mantenimiento: '🔧 Mantenimiento', marketing: '📢 Marketing', otro: '📌 Otro'
};

const CATEGORIAS_AVISOS = {
    general: '📌 General', promocion: '🎉 Promoción', cambio: '🔄 Cambio', urgente: '⚠️ Urgente'
};

const CATEGORIAS_CAMARA = {
    helados: '🍦 Helados', congelados: '❄️ Congelados', cafeteria: '☕ Cafetería', bebidas: '🥤 Bebidas'
};

const DIAS_NOMBRES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let modoActual = null;
let empleadoActual = null;
let productos = [];
let empleados = [];
let stock = {};
let stockCamara = {};
let notasConteo = {};
let notasPedidos = {};
let pedidoFormData = {};
let tareas = [];
let tareasCompletadas = {};
let eventos = [];
let historialConteos = [];
let pedidosCamara = [];
let movimientosCamara = [];
let cierres = [];
let retirosTemporales = [];
let cajas = [];
let gastos = [];
let avisos = [];
let productosImportar = [];
let fichajes = [];
let turnos = [];
let turnoSeleccionado = null;
let consumos = []; // 🎁 NUEVO
let fotoConsumoBase64 = null; // 🎁 NUEVO

document.addEventListener('DOMContentLoaded', async function() {
    await cargarDatosIniciales();
    await verificarReinicioDiario();
    actualizarFecha();
    cargarSelectEmpleados();
    
    document.getElementById('filtroFinanzasPeriodo').addEventListener('change', function() {
        const inicio = document.getElementById('filtroFechaInicio');
        const fin = document.getElementById('filtroFechaFin');
        if (this.value === 'personalizado') {
            inicio.style.display = 'block';
            fin.style.display = 'block';
        } else {
            inicio.style.display = 'none';
            fin.style.display = 'none';
        }
    });
});

async function cargarDatosIniciales() {
    try {
        const productosSnapshot = await db.collection('productos').get();
        productos = productosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const empleadosSnapshot = await db.collection('empleados').get();
        empleados = empleadosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const stockDoc = await db.collection('config').doc('stock').get();
        stock = stockDoc.exists ? stockDoc.data().data : {};
        const stockCamaraDoc = await db.collection('config').doc('stockCamara').get();
        stockCamara = stockCamaraDoc.exists ? stockCamaraDoc.data().data : {};
        const notasConteoDoc = await db.collection('config').doc('notasConteo').get();
        notasConteo = notasConteoDoc.exists ? (notasConteoDoc.data().data || {}) : {};
        const notasPedidosDoc = await db.collection('config').doc('notasPedidos').get();
        notasPedidos = notasPedidosDoc.exists ? (notasPedidosDoc.data().data || {}) : {};
        const tareasSnapshot = await db.collection('tareas').get();
        tareas = tareasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tareasCompDoc = await db.collection('config').doc('tareasCompletadas').get();
        tareasCompletadas = tareasCompDoc.exists ? tareasCompDoc.data().data : {};
        const eventosSnapshot = await db.collection('eventos').get();
        eventos = eventosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const historialSnapshot = await db.collection('historialConteos').get();
        historialConteos = historialSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pedidosCamaraSnapshot = await db.collection('camaraPedidos').get();
        pedidosCamara = pedidosCamaraSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const movimientosCamaraSnapshot = await db.collection('camaraMovimientos').get();
        movimientosCamara = movimientosCamaraSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cierresSnapshot = await db.collection('cierres').get();
        cierres = cierresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cajasSnapshot = await db.collection('cajas').get();
        cajas = cajasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const gastosSnapshot = await db.collection('gastos').get();
        gastos = gastosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const avisosSnapshot = await db.collection('avisos').get();
        avisos = avisosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const fichajesSnapshot = await db.collection('fichajes').get();
        fichajes = fichajesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const turnosSnapshot = await db.collection('turnos').get();
        turnos = turnosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const consumosSnapshot = await db.collection('consumos').get();
        consumos = consumosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { console.error('Error cargando datos:', error); }
}

async function verificarReinicioDiario() {
    const hoy = new Date().toDateString();
    try {
        const configDoc = await db.collection('config').doc('ultimoDia').get();
        const ultimoDia = configDoc.exists ? configDoc.data().fecha : null;
        if (ultimoDia !== hoy) {
            await db.collection('config').doc('tareasCompletadas').set({ data: {} });
            tareasCompletadas = {};
            await db.collection('config').doc('ultimoDia').set({ fecha: hoy });
            await limpiarHistorialViejo();
        }
    } catch (error) { console.error('Error:', error); }
}

async function limpiarHistorialViejo() {
    try {
        const hoy = new Date();
        await limpiarColeccionPorFecha('historialConteos', 30, 'timestamp');
        await limpiarColeccionPorFecha('camaraMovimientos', 30, 'timestamp');
        const pedidosSnap = await db.collection('camaraPedidos').get();
        const batchPedidos = db.batch();
        let pedidosBorrados = 0;
        pedidosSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.traido && data.fechaTraido) {
                const fechaTraido = new Date(data.fechaTraido);
                const dias = Math.floor((hoy - fechaTraido) / (1000 * 60 * 60 * 24));
                if (dias > 7) { batchPedidos.delete(doc.ref); pedidosBorrados++; }
            }
        });
        if (pedidosBorrados > 0) await batchPedidos.commit();
        await limpiarColeccionPorFecha('cierres', 90, 'timestamp');
        await limpiarColeccionPorFecha('cajas', 90, 'timestamp');
        await limpiarColeccionPorFecha('gastos', 365, 'timestamp');
        // 🎁 NUEVO: limpiar consumos de más de 45 días
        await limpiarColeccionPorFecha('consumos', 45, 'timestamp');
        const avisosSnap = await db.collection('avisos').get();
        const batchAvisos = db.batch();
        let avisosBorrados = 0;
        avisosSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.vencimiento) {
                const fechaVenc = new Date(data.vencimiento);
                const diasVencido = Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24));
                if (diasVencido > 7) { batchAvisos.delete(doc.ref); avisosBorrados++; }
            }
        });
        if (avisosBorrados > 0) await batchAvisos.commit();
    } catch (error) { console.error('Error:', error); }
}

async function limpiarColeccionPorFecha(coleccion, dias, campoFecha) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    const snapshot = await db.collection(coleccion).get();
    const batch = db.batch();
    let contador = 0;
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        let fecha;
        if (data[campoFecha] && data[campoFecha].toDate) fecha = data[campoFecha].toDate();
        else if (data[campoFecha]) fecha = new Date(data[campoFecha]);
        if (fecha && fecha < fechaLimite) { batch.delete(doc.ref); contador++; }
    });
    if (contador > 0) await batch.commit();
}

function cargarSelectEmpleados() {
    const select = document.getElementById('selectEmpleado');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecciona tu nombre --</option>';
    empleados.forEach(emp => { select.innerHTML += `<option value="${emp.id}">${emp.nombre}</option>`; });
}

function mostrarLoginEmpleado() {
    document.getElementById('pantallaLogin').style.display = 'none';
    document.getElementById('pantallaLoginEmpleado').style.display = 'flex';
}

function mostrarLoginAdmin() {
    document.getElementById('pantallaLogin').style.display = 'none';
    document.getElementById('pantallaLoginAdmin').style.display = 'flex';
    const input = document.getElementById('inputPasswordAdmin');
    input.value = '';
    input.type = 'password';
    document.getElementById('iconoOjo').textContent = '👁️';
    setTimeout(() => input.focus(), 100);
}

function toggleVerPassword() {
    const input = document.getElementById('inputPasswordAdmin');
    const icono = document.getElementById('iconoOjo');
    if (input.type === 'password') { input.type = 'text'; icono.textContent = '🙈'; }
    else { input.type = 'password'; icono.textContent = '👁️'; }
    input.focus();
}

function ingresarAdmin() {
    const password = document.getElementById('inputPasswordAdmin').value;
    if (password === PASSWORD_ADMIN) {
        document.getElementById('inputPasswordAdmin').value = '';
        modoActual = 'admin';
        empleadoActual = null;
        mostrarApp();
    } else if (password === '') {
        alert('Ingresá la contraseña');
    } else {
        alert('❌ Contraseña incorrecta');
        document.getElementById('inputPasswordAdmin').value = '';
        document.getElementById('inputPasswordAdmin').focus();
    }
}

function mostrarLoginPrueba() {
    document.getElementById('pantallaLogin').style.display = 'none';
    document.getElementById('pantallaLoginPrueba').style.display = 'flex';
}

function mostrarLoginAdminPrueba() {
    document.getElementById('pantallaLoginPrueba').style.display = 'none';
    document.getElementById('pantallaPasswordPrueba').style.display = 'flex';
    const input = document.getElementById('inputPasswordPrueba');
    input.value = '';
    input.type = 'password';
    document.getElementById('iconoOjoPrueba').textContent = '👁️';
    setTimeout(() => input.focus(), 100);
}

function toggleVerPasswordPrueba() {
    const input = document.getElementById('inputPasswordPrueba');
    const icono = document.getElementById('iconoOjoPrueba');
    if (input.type === 'password') { input.type = 'text'; icono.textContent = '🙈'; }
    else { input.type = 'password'; icono.textContent = '👁️'; }
    input.focus();
}

async function ingresarAdminPrueba() {
    const password = document.getElementById('inputPasswordPrueba').value;
    if (password === PASSWORD_ADMIN) {
        document.getElementById('inputPasswordPrueba').value = '';
        inicializarFirebase(firebaseConfigPruebas, true);
        await cargarDatosIniciales();
        modoActual = 'admin';
        empleadoActual = null;
        mostrarApp();
    } else if (password === '') {
        alert('Ingresá la contraseña');
    } else {
        alert('❌ Contraseña incorrecta');
        document.getElementById('inputPasswordPrueba').value = '';
        document.getElementById('inputPasswordPrueba').focus();
    }
}

function volverAlLoginPrueba() {
    document.getElementById('pantallaPasswordPrueba').style.display = 'none';
    document.getElementById('pantallaLoginPrueba').style.display = 'flex';
    const input = document.getElementById('inputPasswordPrueba');
    if (input) {
        input.value = '';
        input.type = 'password';
        document.getElementById('iconoOjoPrueba').textContent = '👁️';
    }
}

function volverAlLogin() {
    document.getElementById('pantallaLogin').style.display = 'flex';
    document.getElementById('pantallaLoginEmpleado').style.display = 'none';
    document.getElementById('pantallaLoginAdmin').style.display = 'none';
    document.getElementById('pantallaLoginPrueba').style.display = 'none';
    document.getElementById('pantallaPasswordPrueba').style.display = 'none';
    const inputAdmin = document.getElementById('inputPasswordAdmin');
    if (inputAdmin) {
        inputAdmin.value = '';
        inputAdmin.type = 'password';
        document.getElementById('iconoOjo').textContent = '👁️';
    }
    const inputPrueba = document.getElementById('inputPasswordPrueba');
    if (inputPrueba) {
        inputPrueba.value = '';
        inputPrueba.type = 'password';
        document.getElementById('iconoOjoPrueba').textContent = '👁️';
    }
}

function entrarEmpleado() {
    const empleadoId = document.getElementById('selectEmpleado').value;
    if (!empleadoId) { alert('Por favor selecciona tu nombre'); return; }
    const empleado = empleados.find(e => e.id === empleadoId);
    if (!empleado) { alert('Empleado no encontrado'); return; }

    if (empleado.password) {
        const passwordIngresada = prompt(`🔐 Contraseña de ${empleado.nombre}`);
        if (passwordIngresada === null) return;
        if (passwordIngresada !== empleado.password) {
            alert('❌ Contraseña incorrecta');
            return;
        }
    }

    empleadoActual = empleado;
    modoActual = 'empleado';
    mostrarApp();
}

async function entrarPruebaEmpleado() {
    inicializarFirebase(firebaseConfigPruebas, true);
    await cargarDatosIniciales();
    cargarSelectEmpleados();
    if (empleados.length > 0) {
        empleadoActual = empleados[0];
        modoActual = 'empleado';
        mostrarApp();
    } else {
        alert('No hay empleados en el entorno de pruebas.');
        inicializarFirebase(firebaseConfigReal, false);
        await cargarDatosIniciales();
        volverAlLogin();
    }
}

async function salir() {
    modoActual = null;
    empleadoActual = null;
    turnoSeleccionado = null;
    fotoConsumoBase64 = null;
    listenersActivos.forEach(unsub => { try { unsub(); } catch(e) {} });
    listenersEnVivo.forEach(unsub => { try { unsub(); } catch(e) {} });
    listenersActivos = [];
    listenersEnVivo = [];
    ultimoAvisoConocido = null;
    ultimoPedidoConocido = null;
    ultimoCierreConocido = null;
    if (modoPrueba) {
        inicializarFirebase(firebaseConfigReal, false);
        await cargarDatosIniciales();
        cargarSelectEmpleados();
    }
    document.getElementById('pantallaLogin').style.display = 'flex';
    document.getElementById('appPrincipal').style.display = 'none';
}

async function borrarTodoPrueba() {
    if (!modoPrueba) { alert('Solo disponible en modo prueba'); return; }
    if (!confirm('⚠️ ¿BORRAR TODOS los datos del entorno de pruebas?')) return;
    if (!confirm('⚠️ ÚLTIMA CONFIRMACIÓN. ¿Continuar?')) return;
    try {
        const colecciones = ['productos', 'empleados', 'tareas', 'eventos', 'historialConteos', 'camaraPedidos', 'camaraMovimientos', 'cierres', 'cajas', 'gastos', 'avisos', 'fichajes', 'turnos', 'consumos'];
        for (const coleccion of colecciones) {
            const snap = await db.collection(coleccion).get();
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        await db.collection('config').doc('stock').set({ data: {} });
        await db.collection('config').doc('stockCamara').set({ data: {} });
        await db.collection('config').doc('notasConteo').set({ data: {} });
        await db.collection('config').doc('tareasCompletadas').set({ data: {} });
        await db.collection('config').doc('ultimoDia').set({ fecha: '' });
        alert('✅ Datos borrados');
        await cargarDatosIniciales();
        if (modoActual === 'admin') {
            cargarDashboard(); cargarHistorial(); cargarGestion();
            cargarCierresAdmin(); cargarCaja(); cargarGastos(); cargarFinanzas();
        }
        cargarTareas(); cargarCalendario(); cargarAvisos();
    setTimeout(() => actualizarIndicadorAvisosUrgentes(), 300);
        cargarCamara(); cargarCierre(); cargarConteo();
        cargarFichaje(); cargarTurnos(); cargarConsumo();
    } catch (error) { console.error('Error:', error); alert('Error al borrar'); }
}

function mostrarApp() {
    document.getElementById('pantallaLogin').style.display = 'none';
    document.getElementById('pantallaLoginEmpleado').style.display = 'none';
    document.getElementById('pantallaLoginAdmin').style.display = 'none';
    document.getElementById('pantallaLoginPrueba').style.display = 'none';
    document.getElementById('pantallaPasswordPrueba').style.display = 'none';
    document.getElementById('appPrincipal').style.display = 'block';
    const modoTexto = modoActual === 'admin' ? '🔐 Administrador' : `👤 ${empleadoActual ? empleadoActual.nombre : 'Empleado'}`;
    const pruebaTexto = modoPrueba ? ' 🧪' : '';
    document.getElementById('modoActual').textContent = modoTexto + pruebaTexto;
    const header = document.querySelector('.header');
    const btnBorrar = document.getElementById('btnBorrarTodo');
    if (modoPrueba) {
        header.classList.add('header-prueba');
        btnBorrar.style.display = 'block';
    } else {
        header.classList.remove('header-prueba');
        btnBorrar.style.display = 'none';
    }
    configurarNavegacion();
    actualizarFecha();
    actualizarEstadoBotonNotif();
    // Si FCM ya generó el token antes del ingreso, asociarlo ahora al usuario.
    if (window.fcmToken) guardarTokenFCM(window.fcmToken);
    iniciarListenersTiempoReal();
    iniciarSincronizacionEnVivo();
    if (notificacionesActivas && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    cargarTareas(); cargarCalendario(); cargarAvisos();
    cargarCamara(); cargarCierre(); cargarConteo();
    cargarFichaje(); cargarConsumo();
    
    if (modoActual === 'admin') {
        cargarDashboard(); cargarHistorial(); cargarGestion();
        cargarCierresAdmin(); cargarCaja(); cargarGastos(); cargarFinanzas();
        cargarTurnos();
        document.getElementById('botonCrearAviso').style.display = 'block';
        document.getElementById('seccionCajaAdmin').style.display = 'block';
        document.getElementById('fichajeAdmin').style.display = 'block';
        // 🎁 Consumo: mostrar vista admin, ocultar vista empleado
        document.getElementById('consumoVistaAdmin').style.display = 'block';
        document.getElementById('consumoVistaEmpleado').style.display = 'none';
    } else {
        document.getElementById('botonCrearAviso').style.display = 'none';
        document.getElementById('seccionCajaAdmin').style.display = 'none';
        document.getElementById('fichajeAdmin').style.display = 'none';
        // 🎁 Consumo: mostrar vista empleado, ocultar vista admin
        document.getElementById('consumoVistaAdmin').style.display = 'none';
        document.getElementById('consumoVistaEmpleado').style.display = 'block';
    }
}

function configurarNavegacion() {
    const navTabs = document.getElementById('navTabs');
    if (modoActual === 'empleado') {
        navTabs.innerHTML = `
            <div class="nav-categoria abierto">
                <button class="nav-categoria-titulo" type="button" onclick="toggleNavCategoria(this)">
                    <span>🧑‍💼 OPERACIÓN</span><span class="nav-flecha">▼</span>
                </button>
                <div class="nav-categoria-contenido">
                    <button class="nav-btn active" data-tab="tareas">✅ Tareas</button>
                    <button class="nav-btn" data-tab="fichaje">🕐 Fichaje</button>
                    <button class="nav-btn" data-tab="consumo">🎁 Consumo</button>
                    <button class="nav-btn" data-tab="calendario">📅 Calendario</button>
                    <button class="nav-btn" data-tab="avisos">📢 Avisos</button>
                </div>
            </div>
            <div class="nav-categoria">
                <button class="nav-categoria-titulo" type="button" onclick="toggleNavCategoria(this)">
                    <span>📦 STOCK Y CONTROL</span><span class="nav-flecha">▶</span>
                </button>
                <div class="nav-categoria-contenido">
                    <button class="nav-btn" data-tab="camara">🧊 Cámara</button>
                    <button class="nav-btn" data-tab="conteo">📦 Conteo</button>
                </div>
            </div>
            <div class="nav-categoria">
                <button class="nav-categoria-titulo" type="button" onclick="toggleNavCategoria(this)">
                    <span>💰 CAJA</span><span class="nav-flecha">▶</span>
                </button>
                <div class="nav-categoria-contenido">
                    <button class="nav-btn" data-tab="cierre">🧾 Cierre</button>
                    <button class="nav-btn" data-tab="caja">💰 Caja</button>
                </div>
            </div>
        `;
    } else {
        navTabs.innerHTML = `
            <div class="nav-categoria abierto">
                <button class="nav-categoria-titulo" type="button" onclick="toggleNavCategoria(this)">
                    <span>🧑‍💼 OPERACIÓN</span><span class="nav-flecha">▼</span>
                </button>
                <div class="nav-categoria-contenido">
                    <button class="nav-btn active" data-tab="tareas">✅ Tareas</button>
                    <button class="nav-btn" data-tab="fichaje">🕐 Fichaje</button>
                    <button class="nav-btn" data-tab="consumo">🎁 Consumo</button>
                    <button class="nav-btn" data-tab="calendario">📅 Calendario</button>
                    <button class="nav-btn" data-tab="avisos">📢 Avisos</button>
                </div>
            </div>
            <div class="nav-categoria">
                <button class="nav-categoria-titulo" type="button" onclick="toggleNavCategoria(this)">
                    <span>📦 STOCK Y CONTROL</span><span class="nav-flecha">▶</span>
                </button>
                <div class="nav-categoria-contenido">
                    <button class="nav-btn" data-tab="camara">🧊 Cámara</button>
                    <button class="nav-btn" data-tab="conteo">📦 Conteo</button>
                    <button class="nav-btn" data-tab="dashboard">📈 Stock</button>
                    <button class="nav-btn" data-tab="historial">📜 Historial</button>
                </div>
            </div>
            <div class="nav-categoria">
                <button class="nav-categoria-titulo" type="button" onclick="toggleNavCategoria(this)">
                    <span>💰 CAJA Y ADMINISTRACIÓN</span><span class="nav-flecha">▶</span>
                </button>
                <div class="nav-categoria-contenido">
                    <button class="nav-btn" data-tab="cierre">🧾 Cierre</button>
                    <button class="nav-btn" data-tab="caja">💰 Caja</button>
                    <button class="nav-btn" data-tab="gastos">💸 Gastos</button>
                    <button class="nav-btn" data-tab="finanzas">📊 Finanzas</button>
                    <button class="nav-btn" data-tab="cierresAdmin">🧾 Cierres</button>
                    <button class="nav-btn" data-tab="gestion">⚙️ Gestión</button>
                </div>
            </div>
        `;
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() { cambiarTab(this.dataset.tab); });
    });
}

function toggleNavCategoria(boton) {
    const categoria = boton.closest('.nav-categoria');
    if (!categoria) return;
    categoria.classList.toggle('abierto');
    const flecha = boton.querySelector('.nav-flecha');
    if (flecha) flecha.textContent = categoria.classList.contains('abierto') ? '▼' : '▶';
}
function actualizarFecha() {
    const fecha = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = fecha.toLocaleDateString('es-ES', opciones);
}

function cambiarTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    if (tab === 'dashboard') cargarDashboard();
    if (tab === 'historial') cargarHistorial();
    if (tab === 'calendario') cargarCalendario();
    if (tab === 'avisos') cargarAvisos();
    if (tab === 'camara') cargarCamara();
    if (tab === 'cierre') cargarCierre();
    if (tab === 'cierresAdmin') cargarCierresAdmin();
    if (tab === 'caja') cargarCaja();
    if (tab === 'gastos') cargarGastos();
    if (tab === 'finanzas') cargarFinanzas();
    if (tab === 'conteo') actualizarBarraProgreso();
    if (tab === 'fichaje') cargarFichaje();
    if (tab === 'consumo') cargarConsumo();
}

function toggleSeccion(id) {
    const contenido = document.getElementById(id);
    const icono = document.getElementById('icon-' + id);
    if (contenido.style.display === 'none') {
        contenido.style.display = 'block';
        if (icono) icono.textContent = '▼';
    } else {
        contenido.style.display = 'none';
        if (icono) icono.textContent = '▶';
    }
}

function toggleMomento(momento) {
    const contenido = document.getElementById('momento-' + momento);
    const icono = document.getElementById('icon-momento-' + momento);
    if (contenido.style.display === 'none') {
        contenido.style.display = 'block';
        if (icono) icono.textContent = '▼';
    } else {
        contenido.style.display = 'none';
        if (icono) icono.textContent = '▶';
    }
}

function toggleCategoria(categoria) {
    const contenido = document.getElementById('categoria-' + categoria);
    const icono = document.getElementById('icon-categoria-' + categoria);
    if (contenido.style.display === 'none') {
        contenido.style.display = 'block';
        if (icono) icono.textContent = '▼';
    } else {
        contenido.style.display = 'none';
        if (icono) icono.textContent = '▶';
    }
}

// ========== 🎁 CONSUMO DE EMPLEADOS ==========
function cargarConsumo() {
    cargarMisConsumos();
    if (modoActual === 'admin') {
        cargarFiltrosConsumoAdmin();
        cargarConsumoAdmin();
    }
}
// 🎁 Previsualizar foto antes de subir
function previsualizarFoto() {
    const input = document.getElementById('consumoFoto');
    const preview = document.getElementById('fotoPreview');
    if (!input.files || !input.files[0]) {
        preview.innerHTML = '';
        fotoConsumoBase64 = null;
        return;
    }
    
    const file = input.files[0];
    
    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('⚠️ La imagen es muy grande. Máximo 2MB.');
        input.value = '';
        preview.innerHTML = '';
        fotoConsumoBase64 = null;
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Comprimir la imagen
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxSize) {
                    height = height * (maxSize / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = width * (maxSize / height);
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            fotoConsumoBase64 = canvas.toDataURL('image/jpeg', 0.7);
            
            preview.innerHTML = `
                <div class="foto-preview">
                    <img src="${fotoConsumoBase64}" alt="Preview">
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">📷 Foto lista para adjuntar</p>
                </div>
            `;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 🎁 Guardar consumo
async function guardarConsumo() {
    const productoTexto = document.getElementById('consumoProducto').value.trim();
    const cantidad = parseFloat(document.getElementById('consumoCantidad').value);
    const monto = parseFloat(document.getElementById('consumoMonto').value);
    const nota = document.getElementById('consumoNota').value;
    
    if (!productoTexto) { alert('Decinos qué te llevás'); return; }
    if (isNaN(cantidad) || cantidad <= 0) { alert('Ingresá una cantidad válida'); return; }
    if (isNaN(monto) || monto <= 0) { alert('Ingresá un monto válido'); return; }
    
    const ahora = new Date();
    
    try {
        const consumoData = {
            productoNombre: productoTexto,  // 🎁 Ahora es texto libre
            cantidad: cantidad,
            monto: monto,
            nota: nota || '',
            fotoUrl: fotoConsumoBase64 || null,
            empleadoId: empleadoActual ? empleadoActual.id : 'admin',
            empleadoNombre: empleadoActual ? empleadoActual.nombre : 'Admin',
            fecha: ahora.toLocaleDateString('es-ES'),
            hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            timestamp: ahora
        };
        
        await db.collection('consumos').add(consumoData);
        
        // Limpiar formulario
        document.getElementById('consumoProducto').value = '';
        document.getElementById('consumoCantidad').value = '1';
        document.getElementById('consumoMonto').value = '';
        document.getElementById('consumoNota').value = '';
        document.getElementById('consumoFoto').value = '';
        document.getElementById('fotoPreview').innerHTML = '';
        fotoConsumoBase64 = null;
        
        mostrarToast('✅ Consumo registrado', 'entrada', 3000);
        await cargarDatosIniciales();
        cargarConsumo();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar consumo');
    }
}

// 🔒 CADA EMPLEADA SOLO VE SU PROPIO CONSUMO
function cargarMisConsumos() {
    const lista = document.getElementById('listaMisConsumos');
    if (!lista) return;
    
    if (!empleadoActual) {
        lista.innerHTML = '<p class="info-box">Ingresá como empleado para ver tus consumos</p>';
        return;
    }
    
    // 🔒 FILTRO: solo los consumos de ESTA empleada
    const misConsumos = consumos.filter(c => c.empleadoId === empleadoActual.id);
    
    if (misConsumos.length === 0) {
        lista.innerHTML = '<p class="info-box">No registraste consumos todavía</p>';
        return;
    }
    
    // Ordenar por fecha (más reciente primero)
    const consumosOrdenados = misConsumos.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return tb - ta;
    });
    
    // Calcular total personal
    const totalPersonal = consumosOrdenados.reduce((sum, c) => sum + (c.monto || 0), 0);
    
    let html = `
        <div class="total-box" style="margin-bottom: 15px; background: #f3e5f5; border-left-color: #9c27b0;">
            <p><strong>💰 Tu total acumulado:</strong> ${formatearMoneda(totalPersonal)}</p>
            <p><strong>📋 Cantidad de registros:</strong> ${consumosOrdenados.length}</p>
        </div>
    `;
    
    consumosOrdenados.forEach(consumo => {
        const fotoHtml = consumo.fotoUrl ? 
            `<img src="${consumo.fotoUrl}" onclick="verFoto('${consumo.id}')" title="Click para ver en grande">` : '';
        
        html += `
            <div class="consumo-item">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>${consumo.productoNombre}</h4>
                        <p style="font-size: 13px; color: #666;">📅 ${consumo.fecha} - ${consumo.hora}</p>
                        <p><strong>Cantidad:</strong> ${consumo.cantidad}</p>
                        <p class="monto">${formatearMoneda(consumo.monto)}</p>
                        ${consumo.nota ? `<p style="font-style: italic; color: #999; margin-top: 5px;">📝 ${consumo.nota}</p>` : ''}
                    </div>
                    <button class="btn-danger" onclick="eliminarConsumo('${consumo.id}')" style="padding: 5px 10px; font-size: 12px;">❌</button>
                </div>
                ${fotoHtml}
            </div>
        `;
    });
    
    lista.innerHTML = html;
}

// 🎁 Ver foto en modal
function verFoto(consumoId) {
    const consumo = consumos.find(c => c.id === consumoId);
    if (!consumo || !consumo.fotoUrl) return;
    
    const modal = document.getElementById('modalFoto');
    const img = document.getElementById('modalFotoImg');
    img.src = consumo.fotoUrl;
    modal.style.display = 'flex';
}

function cerrarModalFoto() {
    document.getElementById('modalFoto').style.display = 'none';
}

// 🎁 Eliminar consumo
async function eliminarConsumo(id) {
    if (!confirm('¿Eliminar este consumo?')) return;
    try {
        await db.collection('consumos').doc(id).delete();
        await cargarDatosIniciales();
        cargarConsumo();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar');
    }
}

// 🎁 Vista admin: filtros y totales
function cargarFiltrosConsumoAdmin() {
    const select = document.getElementById('filtroConsumoEmpleado');
    if (!select) return;
    select.innerHTML = '<option value="todos">Todos los empleados</option>';
    empleados.forEach(emp => {
        select.innerHTML += `<option value="${emp.id}">${emp.nombre}</option>`;
    });
}

function cargarConsumoAdmin() {
    const lista = document.getElementById('listaTodosConsumos');
    const resumen = document.getElementById('resumenConsumoAdmin');
    if (!lista || !resumen) return;
    
    const filtroEmpleado = document.getElementById('filtroConsumoEmpleado').value;
    const filtroDesde = document.getElementById('filtroConsumoDesde').value;
    const filtroHasta = document.getElementById('filtroConsumoHasta').value;
    
    let consumosFiltrados = consumos;
    
    if (filtroEmpleado !== 'todos') {
        consumosFiltrados = consumosFiltrados.filter(c => c.empleadoId === filtroEmpleado);
    }
    
    if (filtroDesde) {
        const fechaDesde = new Date(filtroDesde);
        consumosFiltrados = consumosFiltrados.filter(c => {
            const partes = c.fecha.split('/');
            const fechaConsumo = new Date(partes[2], partes[1] - 1, partes[0]);
            return fechaConsumo >= fechaDesde;
        });
    }
    
    if (filtroHasta) {
        const fechaHasta = new Date(filtroHasta);
        consumosFiltrados = consumosFiltrados.filter(c => {
            const partes = c.fecha.split('/');
            const fechaConsumo = new Date(partes[2], partes[1] - 1, partes[0]);
            return fechaConsumo <= fechaHasta;
        });
    }
    
    if (consumosFiltrados.length === 0) {
        resumen.innerHTML = '';
        lista.innerHTML = '<p class="info-box">No hay consumos con los filtros seleccionados</p>';
        return;
    }
    
    // Calcular totales
    const totalGeneral = consumosFiltrados.reduce((sum, c) => sum + (c.monto || 0), 0);
    
    // Totales por empleado
    const totalesPorEmpleado = {};
    consumosFiltrados.forEach(c => {
        if (!totalesPorEmpleado[c.empleadoNombre]) {
            totalesPorEmpleado[c.empleadoNombre] = { total: 0, cantidad: 0 };
        }
        totalesPorEmpleado[c.empleadoNombre].total += c.monto || 0;
        totalesPorEmpleado[c.empleadoNombre].cantidad++;
    });
    
    // Resumen
    let resumenHtml = `
        <div class="consumo-resumen-grid">
            <div class="consumo-resumen-card">
                <h4>💰 Total General</h4>
                <div class="stat">${formatearMoneda(totalGeneral)}</div>
            </div>
            <div class="consumo-resumen-card">
                <h4>📋 Registros</h4>
                <div class="stat">${consumosFiltrados.length}</div>
            </div>
            <div class="consumo-resumen-card">
                <h4>👥 Empleados</h4>
                <div class="stat">${Object.keys(totalesPorEmpleado).length}</div>
            </div>
        </div>
        <div class="total-box" style="background: #f3e5f5; border-left-color: #9c27b0;">
            <h4 style="margin-bottom: 10px;">📊 Total por empleado:</h4>
    `;
    
    Object.keys(totalesPorEmpleado).forEach(emp => {
        resumenHtml += `
            <p style="margin: 5px 0;">
                <strong>${emp}:</strong> ${formatearMoneda(totalesPorEmpleado[emp].total)} 
                <span style="color: #999; font-size: 12px;">(${totalesPorEmpleado[emp].cantidad} registros)</span>
            </p>
        `;
    });
    
    resumenHtml += `</div>`;
    resumen.innerHTML = resumenHtml;
    
    // Lista
    const consumosOrdenados = consumosFiltrados.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return tb - ta;
    });
    
    let html = '';
    consumosOrdenados.forEach(consumo => {
        const fotoHtml = consumo.fotoUrl ? 
            `<img src="${consumo.fotoUrl}" onclick="verFoto('${consumo.id}')" title="Click para ver en grande">` : '';
        
        html += `
            <div class="consumo-item">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>${consumo.productoNombre}</h4>
                        <p style="font-size: 13px; color: #666;">📅 ${consumo.fecha} - ${consumo.hora}</p>
                        <p><strong>👤 ${consumo.empleadoNombre}</strong></p>
                        <p><strong>Cantidad:</strong> ${consumo.cantidad}</p>
                        <p class="monto">${formatearMoneda(consumo.monto)}</p>
                        ${consumo.nota ? `<p style="font-style: italic; color: #999; margin-top: 5px;">📝 ${consumo.nota}</p>` : ''}
                    </div>
                    <button class="btn-danger" onclick="eliminarConsumo('${consumo.id}')" style="padding: 5px 10px; font-size: 12px;">❌</button>
                </div>
                ${fotoHtml}
            </div>
        `;
    });
    
    lista.innerHTML = html;
}

// 🎁 Exportar consumos a Excel
function exportarConsumoExcel() {
    const filtroEmpleado = document.getElementById('filtroConsumoEmpleado').value;
    const filtroDesde = document.getElementById('filtroConsumoDesde').value;
    const filtroHasta = document.getElementById('filtroConsumoHasta').value;
    
    let consumosFiltrados = consumos;
    
    if (filtroEmpleado !== 'todos') {
        consumosFiltrados = consumosFiltrados.filter(c => c.empleadoId === filtroEmpleado);
    }
    
    if (filtroDesde) {
        const fechaDesde = new Date(filtroDesde);
        consumosFiltrados = consumosFiltrados.filter(c => {
            const partes = c.fecha.split('/');
            const fechaConsumo = new Date(partes[2], partes[1] - 1, partes[0]);
            return fechaConsumo >= fechaDesde;
        });
    }
    
    if (filtroHasta) {
        const fechaHasta = new Date(filtroHasta);
        consumosFiltrados = consumosFiltrados.filter(c => {
            const partes = c.fecha.split('/');
            const fechaConsumo = new Date(partes[2], partes[1] - 1, partes[0]);
            return fechaConsumo <= fechaHasta;
        });
    }
    
    const datos = [['Empleado', 'Fecha', 'Hora', 'Producto', 'Cantidad', 'Monto', 'Nota', 'Foto']];
    
    consumosFiltrados.forEach(c => {
        datos.push([
            c.empleadoNombre,
            c.fecha,
            c.hora,
            c.productoNombre,
            c.cantidad,
            c.monto,
            c.nota || '',
            c.fotoUrl ? 'Sí' : 'No'
        ]);
    });
    
    const totalGeneral = consumosFiltrados.reduce((sum, c) => sum + (c.monto || 0), 0);
    datos.push([]);
    datos.push(['', '', '', '', 'TOTAL:', totalGeneral, '', '']);
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, 
        { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 8 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Consumos');
    
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    XLSX.writeFile(wb, `consumos-empleados-${fecha}.xlsx`);
    
    mostrarToast('✅ Excel exportado', 'entrada', 3000);
}

// ========== 🕐 FICHAJE ==========
// El fichaje nuevo funciona como una jornada independiente.
// Cada jornada tiene: INICIO TURNO -> INICIO DESCANSO -> FIN DESCANSO -> FIN TURNO.
// Esto permite que varias empleadas marquen sus turnos al mismo tiempo y evita
// emparejar una salida de una jornada con la entrada de otra.
//
// Para el desglose horario se toma como horario nocturno 22:00 a 06:00.
// Es un criterio del sistema y se puede ajustar si el estudio contable usa otro.

function obtenerFechaFichaje(valor) {
    if (!valor) return null;
    if (valor.toDate && typeof valor.toDate === 'function') return valor.toDate();
    if (valor instanceof Date) return valor;
    const fecha = new Date(valor);
    return isNaN(fecha.getTime()) ? null : fecha;
}

function obtenerTimestampFichaje(f) {
    return obtenerFechaFichaje(f && f.timestamp);
}

function obtenerFechaLocalFichaje(fecha) {
    const d = obtenerFechaFichaje(fecha) || new Date();
    return d.toLocaleDateString('es-ES');
}

function generarJornadaId() {
    return `jornada_${empleadoActual.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function obtenerJornadasFichajes(registros) {
    const porJornada = {};
    const legacy = [];

    registros.forEach(r => {
        if (r.jornadaId) {
            if (!porJornada[r.jornadaId]) porJornada[r.jornadaId] = [];
            porJornada[r.jornadaId].push(r);
        } else {
            legacy.push(r);
        }
    });

    const jornadas = Object.values(porJornada).map(regs => {
        regs.sort((a,b) => (obtenerTimestampFichaje(a)?.getTime() || 0) - (obtenerTimestampFichaje(b)?.getTime() || 0));
        const inicio = regs.find(r => r.accion === 'inicioTurno');
        const fin = [...regs].reverse().find(r => r.accion === 'finTurno');
        const descansos = [];
        let inicioDescanso = null;

        regs.forEach(r => {
            if (r.accion === 'inicioDescanso') inicioDescanso = r;
            if (r.accion === 'finDescanso' && inicioDescanso) {
                descansos.push({ inicio: inicioDescanso, fin: r });
                inicioDescanso = null;
            }
        });

        return {
            id: regs[0].jornadaId,
            empleadoId: regs[0].empleadoId,
            empleadoNombre: regs[0].empleadoNombre,
            turnoNombre: regs[0].turnoNombre || inicio?.turnoNombre || '-',
            turnoInicio: regs[0].turnoInicio || inicio?.turnoInicio || '',
            turnoFin: regs[0].turnoFin || inicio?.turnoFin || '',
            registros: regs,
            inicio,
            fin,
            descansos
        };
    });

    // Compatibilidad con los fichajes anteriores: entrada/salida.
    const legacyOrdenados = legacy
        .slice()
        .sort((a,b) => (obtenerTimestampFichaje(a)?.getTime() || 0) - (obtenerTimestampFichaje(b)?.getTime() || 0));

    const legacyPorEmpleado = {};
    legacyOrdenados.forEach(r => {
        const key = r.empleadoId || 'sin-empleado';
        if (!legacyPorEmpleado[key]) legacyPorEmpleado[key] = [];
        legacyPorEmpleado[key].push(r);
    });

    Object.values(legacyPorEmpleado).forEach(regs => {
        let entrada = null;
        regs.forEach(r => {
            if (r.tipo === 'entrada') {
                entrada = r;
            } else if (r.tipo === 'salida' && entrada) {
                jornadas.push({
                    id: r.id ? `legacy_${r.id}` : `legacy_${Math.random()}`,
                    empleadoId: entrada.empleadoId,
                    empleadoNombre: entrada.empleadoNombre,
                    turnoNombre: entrada.turnoNombre || '-',
                    turnoInicio: entrada.turnoInicio || '',
                    turnoFin: entrada.turnoFin || '',
                    registros: [entrada, r],
                    inicio: entrada,
                    fin: r,
                    descansos: []
                });
                entrada = null;
            }
        });
    });

    return jornadas;
}

function calcularIntervaloHorario(inicio, fin) {
    if (!inicio || !fin) return { segundos: 0, diurnos: 0, nocturnos: 0 };
    let a = obtenerTimestampFichaje(inicio);
    let b = obtenerTimestampFichaje(fin);
    if (!a || !b || b <= a) return { segundos: 0, diurnos: 0, nocturnos: 0 };

    const inicioMs = a.getTime();
    const finMs = b.getTime();
    let nocturnos = 0;
    let cursor = new Date(inicioMs);

    while (cursor < b) {
        const siguiente = new Date(cursor);
        siguiente.setHours(cursor.getHours() + 1, 0, 0, 0);
        const tramoFin = siguiente < b ? siguiente : b;
        const hora = cursor.getHours();
        const esNocturno = hora >= 22 || hora < 6;
        const segundos = Math.max(0, (tramoFin.getTime() - cursor.getTime()) / 1000);
        if (esNocturno) nocturnos += segundos;
        cursor = tramoFin;
    }

    const segundos = Math.max(0, (finMs - inicioMs) / 1000);
    return {
        segundos,
        nocturnos,
        diurnos: Math.max(0, segundos - nocturnos)
    };
}

function calcularJornada(jornada) {
    if (!jornada.inicio) return { segundos: 0, diurnos: 0, nocturnos: 0, completa: false };
    const fin = jornada.fin;
    if (!fin) return { segundos: 0, diurnos: 0, nocturnos: 0, completa: false };

    let total = calcularIntervaloHorario(jornada.inicio, fin);
    jornada.descansos.forEach(d => {
        if (d.inicio && d.fin) {
            const descanso = calcularIntervaloHorario(d.inicio, d.fin);
            total.segundos = Math.max(0, total.segundos - descanso.segundos);
            total.diurnos = Math.max(0, total.diurnos - descanso.diurnos);
            total.nocturnos = Math.max(0, total.nocturnos - descanso.nocturnos);
        }
    });
    return { ...total, completa: true };
}

function obtenerJornadaActivaEmpleado(empleadoId) {
    const jornadas = obtenerJornadasFichajes(fichajes.filter(f => f.empleadoId === empleadoId));
    return jornadas
        .filter(j => j.inicio && !j.fin)
        .sort((a,b) => (obtenerTimestampFichaje(b.inicio)?.getTime() || 0) - (obtenerTimestampFichaje(a.inicio)?.getTime() || 0))[0] || null;
}

function formatearHorasSegundos(segundos) {
    const totalMinutos = Math.max(0, Math.floor((segundos || 0) / 60));
    return `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}m`;
}

function cargarFichaje() {
    const contenedor = document.getElementById('fichajeContenido');
    if (!contenedor) return;
    if (!empleadoActual && modoActual !== 'admin') {
        contenedor.innerHTML = '<p class="info-box">Ingresá como empleado para fichar</p>';
        return;
    }

    const ahora = new Date();
    const hoy = obtenerFechaLocalFichaje(ahora);
    const diaSemana = ahora.getDay();
    const turnosHoy = turnos.filter(t => {
        if (!t.dias || t.dias.length === 0) return true;
        return t.dias.includes(diaSemana);
    });

    if (modoActual === 'admin') {
        const fichajesHoy = fichajes.filter(f => f.fecha === hoy);
        let html = `
            <div class="fichaje-card">
                <h3>📊 Resumen del día - ${hoy}</h3>
                <p style="margin: 10px 0;">Total de registros hoy: <strong>${fichajesHoy.length}</strong></p>
                <p>Inicios de turno: <strong>${fichajesHoy.filter(f => f.accion === 'inicioTurno' || f.tipo === 'entrada').length}</strong></p>
                <p>Finalizaciones: <strong>${fichajesHoy.filter(f => f.accion === 'finTurno' || f.tipo === 'salida').length}</strong></p>
            </div>
            <div class="fichaje-card">
                <h3>👥 Registros de HOY</h3>
        `;
        if (fichajesHoy.length === 0) {
            html += '<p class="info-box">No hay registros hoy</p>';
        } else {
            html += `<table class="fichaje-tabla"><thead><tr><th>Empleado</th><th>Marca</th><th>Hora</th><th>Turno</th></tr></thead><tbody>`;
            fichajesHoy.slice().sort((a,b) => (obtenerTimestampFichaje(b)?.getTime() || 0) - (obtenerTimestampFichaje(a)?.getTime() || 0)).forEach(f => {
                const accion = f.accion || (f.tipo === 'entrada' ? 'inicioTurno' : 'finTurno');
                const etiquetas = {
                    inicioTurno: ['🟢', 'INICIO TURNO', 'fichaje-entrada'],
                    inicioDescanso: ['🟡', 'INICIO DESCANSO', 'fichaje-descanso'],
                    finDescanso: ['🔵', 'FIN DESCANSO', 'fichaje-descanso'],
                    finTurno: ['🔴', 'FIN TURNO', 'fichaje-salida']
                };
                const [icono, texto, clase] = etiquetas[accion] || ['⚪', accion.toUpperCase(), ''];
                html += `<tr><td><strong>${f.empleadoNombre}</strong></td><td class="${clase}">${icono} ${texto}</td><td>${f.hora}</td><td>${f.turnoNombre || '-'}</td></tr>`;
            });
            html += `</tbody></table>`;
        }
        html += `</div>`;
        contenedor.innerHTML = html;
        cargarFiltrosFichajeAdmin();
        return;
    }

    const empleadoId = empleadoActual.id;
    const registrosEmpleado = fichajes.filter(f => f.empleadoId === empleadoId);
    const jornadaActiva = obtenerJornadaActivaEmpleado(empleadoId);
    const ultimaJornada = obtenerJornadasFichajes(registrosEmpleado)
        .filter(j => j.inicio)
        .sort((a,b) => (obtenerTimestampFichaje(b.inicio)?.getTime() || 0) - (obtenerTimestampFichaje(a.inicio)?.getTime() || 0))[0];

    let html = `<div class="fichaje-card">
        <div class="fichaje-saludo">👋 ¡Hola, ${empleadoActual.nombre}!</div>
        <p style="margin: 10px 0; color: #666;">📅 ${hoy} - 🕐 ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>`;

    if (turnosHoy.length === 0) {
        html += '<p class="info-box" style="background: #ffebee; border-left-color: #ff4757; color: #c62828;">No hay turnos configurados para hoy.</p>';
    } else {
        html += `<label style="font-weight: bold; display: block; margin: 15px 0 10px 0;">Seleccioná el turno que vas a realizar:</label>`;
        turnosHoy.forEach(t => {
            html += `<button class="btn-turno" id="btn-turno-${t.id}" onclick="seleccionarTurno('${t.id}')">
                <span>${t.nombre}</span>
                <span class="turno-horario-badge">${t.inicio} - ${t.fin}</span>
            </button>`;
        });

        if (!jornadaActiva) {
            html += `<div class="fichaje-estado" id="estadoFichaje">⚪ Seleccioná un turno y comenzá tu jornada</div>
                <button class="btn-fichaje btn-entrada" id="btnFichajePrincipal" onclick="marcarFichaje('inicioTurno')" disabled style="opacity: 0.5;">▶️ INICIAR TURNO</button>`;
        } else {
            const tieneDescansoActivo = jornadaActiva.registros.some(r => r.accion === 'inicioDescanso') &&
                !jornadaActiva.registros.some(r => r.accion === 'finDescanso' &&
                    (obtenerTimestampFichaje(r)?.getTime() || 0) > (obtenerTimestampFichaje(jornadaActiva.registros.find(x => x.accion === 'inicioDescanso'))?.getTime() || 0));

            const inicioHora = jornadaActiva.inicio.hora;
            html += `<div class="fichaje-turno-info">🟢 Turno iniciado a las <strong>${inicioHora}</strong> · ${jornadaActiva.turnoNombre || ''}</div>`;
            if (tieneDescansoActivo) {
                html += `<button class="btn-fichaje btn-descanso" onclick="marcarFichaje('finDescanso')">▶️ FINALIZAR DESCANSO</button>`;
            } else {
                html += `<button class="btn-fichaje btn-descanso" onclick="marcarFichaje('inicioDescanso')">☕ INICIAR DESCANSO</button>
                    <button class="btn-fichaje btn-salida" onclick="marcarFichaje('finTurno')">⏹️ TERMINAR TURNO</button>`;
            }
        }
    }
    html += `</div>`;

    contenedor.innerHTML = html;
}

function seleccionarTurno(turnoId) {
    turnoSeleccionado = turnos.find(t => t.id === turnoId);
    document.querySelectorAll('.btn-turno').forEach(btn => btn.classList.remove('seleccionado'));
    const btnSeleccionado = document.getElementById(`btn-turno-${turnoId}`);
    if (btnSeleccionado) btnSeleccionado.classList.add('seleccionado');
    const btnFichaje = document.getElementById('btnFichajePrincipal');
    if (btnFichaje) { btnFichaje.disabled = false; btnFichaje.style.opacity = '1'; }
    const estado = document.getElementById('estadoFichaje');
    if (estado && turnoSeleccionado) {
        estado.innerHTML = `✅ Turno seleccionado: <strong>${turnoSeleccionado.nombre}</strong> (${turnoSeleccionado.inicio} - ${turnoSeleccionado.fin})`;
        estado.className = 'fichaje-turno-info';
    }
}

async function marcarFichaje(accion) {
    if (!empleadoActual) { alert('Debés estar logueado'); return; }

    const ahora = new Date();
    let jornada = obtenerJornadaActivaEmpleado(empleadoActual.id);

    if (accion === 'inicioTurno') {
        if (jornada) {
            alert('⚠️ Ya tenés un turno iniciado. Primero terminá ese turno.');
            return;
        }
        if (!turnoSeleccionado) {
            alert('Seleccioná el turno primero.');
            return;
        }
    } else if (!jornada) {
        alert('No hay un turno activo para realizar esta marca.');
        return;
    }

    if (accion === 'inicioDescanso') {
        const ultimoInicio = jornada.registros.filter(r => r.accion === 'inicioDescanso').sort((a,b) => (obtenerTimestampFichaje(b)?.getTime()||0) - (obtenerTimestampFichaje(a)?.getTime()||0))[0];
        const ultimoFin = jornada.registros.filter(r => r.accion === 'finDescanso').sort((a,b) => (obtenerTimestampFichaje(b)?.getTime()||0) - (obtenerTimestampFichaje(a)?.getTime()||0))[0];
        if (ultimoInicio && (!ultimoFin || obtenerTimestampFichaje(ultimoInicio) > obtenerTimestampFichaje(ultimoFin))) {
            alert('⚠️ Ya tenés un descanso iniciado. Primero finalizalo.');
            return;
        }
    }

    if (accion === 'finDescanso') {
        const ultimoInicio = jornada.registros.filter(r => r.accion === 'inicioDescanso').sort((a,b) => (obtenerTimestampFichaje(b)?.getTime()||0) - (obtenerTimestampFichaje(a)?.getTime()||0))[0];
        const ultimoFin = jornada.registros.filter(r => r.accion === 'finDescanso').sort((a,b) => (obtenerTimestampFichaje(b)?.getTime()||0) - (obtenerTimestampFichaje(a)?.getTime()||0))[0];
        if (!ultimoInicio || (ultimoFin && obtenerTimestampFichaje(ultimoFin) > obtenerTimestampFichaje(ultimoInicio))) {
            alert('No hay un descanso activo para finalizar.');
            return;
        }
    }

    const jornadaId = accion === 'inicioTurno' ? generarJornadaId() : jornada.id;
    const turnoInfo = accion === 'inicioTurno' ? turnoSeleccionado : {
        id: jornada.inicio.turno || '',
        nombre: jornada.turnoNombre || 'Sin turno',
        inicio: jornada.turnoInicio || '',
        fin: jornada.turnoFin || ''
    };

    try {
        await db.collection('fichajes').add({
            empleadoId: empleadoActual.id,
            empleadoNombre: empleadoActual.nombre,
            accion,
            tipo: accion === 'inicioTurno' ? 'entrada' : accion === 'finTurno' ? 'salida' : 'marca',
            jornadaId,
            fecha: ahora.toLocaleDateString('es-ES'),
            hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timestamp: ahora,
            turno: turnoInfo?.id || '',
            turnoNombre: turnoInfo?.nombre || 'Sin turno',
            turnoInicio: turnoInfo?.inicio || '',
            turnoFin: turnoInfo?.fin || ''
        });

        const mensajes = {
            inicioTurno: `▶️ Turno iniciado a las ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
            inicioDescanso: `☕ Descanso iniciado a las ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
            finDescanso: `▶️ Descanso finalizado a las ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
            finTurno: `⏹️ Turno terminado a las ${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
        };
        mostrarToast(mensajes[accion] || '✅ Marca registrada', accion === 'finTurno' ? 'salida' : 'entrada', 4000);
        await cargarDatosIniciales();
        cargarFichaje();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar la marca.');
    }
}

function obtenerRangoFichajeAdmin() {
    const mes = document.getElementById('filtroFichajeMes')?.value;
    let desde = document.getElementById('filtroFichajeFechaDesde')?.value;
    let hasta = document.getElementById('filtroFichajeFechaHasta')?.value;

    if (mes) {
        desde = `${mes}-01`;
        const [y,m] = mes.split('-').map(Number);
        hasta = new Date(y, m, 0).toISOString().slice(0,10);
    }
    return { desde, hasta };
}

function filtrarFichajesPorRango(registros) {
    const { desde, hasta } = obtenerRangoFichajeAdmin();
    if (!desde && !hasta) return registros;

    const desdeMs = desde ? new Date(`${desde}T00:00:00`).getTime() : -Infinity;
    const hastaMs = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : Infinity;

    return registros.filter(f => {
        const d = obtenerTimestampFichaje(f);
        const ms = d ? d.getTime() : 0;
        return ms >= desdeMs && ms <= hastaMs;
    });
}

function cargarFiltrosFichajeAdmin() {
    const select = document.getElementById('filtroFichajeEmpleado');
    if (!select) return;
    const valorActual = select.value || 'todos';
    select.innerHTML = '<option value="todos">Todos los empleados</option>';
    empleados.forEach(emp => { select.innerHTML += `<option value="${emp.id}">${emp.nombre}</option>`; });
    select.value = empleados.some(e => e.id === valorActual) ? valorActual : 'todos';
    cargarFichajeAdmin();
}

function construirResumenMensualFichaje(fichajesFiltrados) {
    const jornadas = obtenerJornadasFichajes(fichajesFiltrados);
    const porEmpleado = {};

    jornadas.forEach(j => {
        const calculo = calcularJornada(j);
        if (!calculo.completa) return;
        if (!porEmpleado[j.empleadoId]) {
            porEmpleado[j.empleadoId] = {
                empleadoId: j.empleadoId,
                empleadoNombre: j.empleadoNombre,
                diurnas: 0,
                nocturnas: 0,
                total: 0
            };
        }
        porEmpleado[j.empleadoId].diurnas += calculo.diurnas;
        porEmpleado[j.empleadoId].nocturnas += calculo.nocturnos;
        porEmpleado[j.empleadoId].total += calculo.segundos;
    });

    return Object.values(porEmpleado).sort((a,b) => a.empleadoNombre.localeCompare(b.empleadoNombre));
}

function cargarFichajeAdmin() {
    const mesEl = document.getElementById('filtroFichajeMes');
    if (mesEl && !mesEl.value) {
        const ahora = new Date();
        mesEl.value = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    }
    const contenedor = document.getElementById('fichajeHistorialContenido');
    if (!contenedor) return;

    const filtroEmpleado = document.getElementById('filtroFichajeEmpleado')?.value || 'todos';
    let fichajesFiltrados = filtrarFichajesPorRango(fichajes);
    if (filtroEmpleado !== 'todos') fichajesFiltrados = fichajesFiltrados.filter(f => f.empleadoId === filtroEmpleado);

    if (fichajesFiltrados.length === 0) {
        contenedor.innerHTML = '<p class="info-box">No hay registros para el período seleccionado.</p>';
        return;
    }

    const resumenMensual = construirResumenMensualFichaje(fichajesFiltrados);
    let html = `
        <div class="fichaje-resumen-mensual">
            <h3>🧾 Resumen de horas del período</h3>
            <p style="color:#666;margin-top:4px;">Las horas se calculan por jornada y se descuentan los descansos registrados.</p>
            <div style="overflow-x:auto;">
                <table class="fichaje-tabla">
                    <thead><tr><th>Empleado</th><th>Diurnas</th><th>Nocturnas</th><th>Total</th></tr></thead>
                    <tbody>`;

    resumenMensual.forEach(d => {
        html += `<tr>
            <td><strong>${d.empleadoNombre}</strong></td>
            <td>${formatearHorasSegundos(d.diurnas)}</td>
            <td>${formatearHorasSegundos(d.nocturnas)}</td>
            <td><strong>${formatearHorasSegundos(d.total)}</strong></td>
        </tr>`;
    });
    html += `</tbody></table></div></div>`;

    const jornadas = obtenerJornadasFichajes(fichajesFiltrados)
        .filter(j => j.inicio)
        .sort((a,b) => (obtenerTimestampFichaje(b.inicio)?.getTime() || 0) - (obtenerTimestampFichaje(a.inicio)?.getTime() || 0));

    html += `<div class="fichaje-resumen-mensual" style="margin-top:15px;">
        <h3>📋 Detalle de jornadas</h3>
        <div style="overflow-x:auto;">
        <table class="fichaje-tabla"><thead><tr><th>Empleado</th><th>Fecha</th><th>Turno</th><th>Marcas</th><th>Horas</th></tr></thead><tbody>`;

    jornadas.forEach(j => {
        const total = calcularJornada(j);
        const marcas = j.registros.map(r => {
            const iconos = {inicioTurno:'▶️', inicioDescanso:'☕', finDescanso:'▶️', finTurno:'⏹️'};
            return `${iconos[r.accion] || '⚪'} ${r.hora}`;
        }).join(' · ');
        const fecha = j.inicio?.fecha || obtenerFechaLocalFichaje(j.inicio?.timestamp);
        html += `<tr>
            <td><strong>${j.empleadoNombre}</strong></td>
            <td>${fecha}</td>
            <td>${j.turnoNombre || '-'}</td>
            <td style="font-size:12px;">${marcas}</td>
            <td><strong>${total.completa ? formatearHorasSegundos(total.segundos) : '⏳ En curso'}</strong></td>
        </tr>`;
    });
    html += `</tbody></table></div></div>`;
    contenedor.innerHTML = html;
}

function exportarFichajeExcel() {
    const filtroEmpleado = document.getElementById('filtroFichajeEmpleado')?.value || 'todos';
    let fichajesFiltrados = filtrarFichajesPorRango(fichajes);
    if (filtroEmpleado !== 'todos') fichajesFiltrados = fichajesFiltrados.filter(f => f.empleadoId === filtroEmpleado);

    const jornadas = obtenerJornadasFichajes(fichajesFiltrados).filter(j => j.inicio);
    const datos = [['Empleado', 'Fecha', 'Turno', 'Inicio', 'Fin', 'Horas Diurnas', 'Horas Nocturnas', 'Horas Totales']];

    jornadas.sort((a,b) => (obtenerTimestampFichaje(a.inicio)?.getTime() || 0) - (obtenerTimestampFichaje(b.inicio)?.getTime() || 0));
    jornadas.forEach(j => {
        const total = calcularJornada(j);
        const inicio = j.inicio?.hora || '';
        const fin = j.fin?.hora || '';
        datos.push([
            j.empleadoNombre, j.inicio?.fecha || '', j.turnoNombre || '',
            inicio, fin,
            formatearHorasSegundos(total.diurnas),
            formatearHorasSegundos(total.nocturnas),
            formatearHorasSegundos(total.segundos)
        ]);
    });

    const resumen = construirResumenMensualFichaje(fichajesFiltrados);
    datos.push([]);
    datos.push(['RESUMEN POR EMPLEADA', '', '', '', '', 'DIURNAS', 'NOCTURNAS', 'TOTAL']);
    resumen.forEach(d => datos.push([
        d.empleadoNombre, '', '', '', '',
        formatearHorasSegundos(d.diurnas),
        formatearHorasSegundos(d.nocturnas),
        formatearHorasSegundos(d.total)
    ]));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!cols'] = [{wch:20},{wch:12},{wch:25},{wch:12},{wch:12},{wch:15},{wch:15},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws, 'Fichajes');
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\\//g, '-');
    XLSX.writeFile(wb, `fichajes-${fecha}.xlsx`);
    mostrarToast('✅ Excel de horas exportado', 'entrada', 3000);
}

// ========== ⏰ TURNOS ==========
function cargarTurnos() {
    const lista = document.getElementById('listaTurnos');
    if (!lista) return;
    if (turnos.length === 0) {
        lista.innerHTML = '<p class="info-box">No hay turnos configurados.</p>';
        return;
    }
    let html = '';
    turnos.forEach(t => {
        const diasBadges = (t.dias || []).map(d => `<span class="turno-dia-badge activo">${DIAS_NOMBRES[d]}</span>`).join('');
        html += `
            <div class="turno-card">
                <h4>${t.nombre}</h4>
                <div class="turno-horario">${t.inicio} - ${t.fin}</div>
                <div class="turno-dias">${diasBadges || '<span style="color: #999;">Todos los días</span>'}</div>
                <div class="actions">
                    <button class="btn-primary" onclick="editarTurno('${t.id}')" style="padding: 8px 16px; font-size: 14px;">✏️ Editar</button>
                    <button class="btn-danger" onclick="eliminarTurno('${t.id}')">❌ Eliminar</button>
                </div>
            </div>
        `;
    });
    lista.innerHTML = html;
}

function mostrarFormularioTurno(turnoId = null) {
    document.getElementById('formularioTurno').style.display = 'block';
    document.getElementById('turnoIdEditar').value = turnoId || '';
    if (turnoId) {
        const turno = turnos.find(t => t.id === turnoId);
        if (turno) {
            document.getElementById('tituloFormTurno').textContent = 'Editar Turno';
            document.getElementById('turnoNombre').value = turno.nombre;
            document.getElementById('turnoInicio').value = turno.inicio;
            document.getElementById('turnoFin').value = turno.fin;
            document.querySelectorAll('.turno-dia').forEach(cb => {
                cb.checked = (turno.dias || []).includes(parseInt(cb.value));
            });
        }
    } else {
        document.getElementById('tituloFormTurno').textContent = 'Nuevo Turno';
        document.getElementById('turnoNombre').value = '';
        document.getElementById('turnoInicio').value = '';
        document.getElementById('turnoFin').value = '';
        document.querySelectorAll('.turno-dia').forEach(cb => cb.checked = false);
    }
}

function ocultarFormularioTurno() { document.getElementById('formularioTurno').style.display = 'none'; }

async function guardarTurno() {
    const idEditar = document.getElementById('turnoIdEditar').value;
    const nombre = document.getElementById('turnoNombre').value;
    const inicio = document.getElementById('turnoInicio').value;
    const fin = document.getElementById('turnoFin').value;
    if (!nombre || !inicio || !fin) { alert('Completá nombre, inicio y fin'); return; }
    const dias = [];
    document.querySelectorAll('.turno-dia:checked').forEach(cb => { dias.push(parseInt(cb.value)); });
    try {
        if (idEditar) {
            await db.collection('turnos').doc(idEditar).update({ nombre, inicio, fin, dias });
            alert('✅ Turno actualizado');
        } else {
            await db.collection('turnos').add({ nombre, inicio, fin, dias });
            alert('✅ Turno creado');
        }
        ocultarFormularioTurno();
        const turnosSnap = await db.collection('turnos').get();
        turnos = turnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cargarTurnos();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar turno');
    }
}

function editarTurno(id) { mostrarFormularioTurno(id); }

async function eliminarTurno(id) {
    if (!confirm('¿Eliminar este turno?')) return;
    try {
        await db.collection('turnos').doc(id).delete();
        const turnosSnap = await db.collection('turnos').get();
        turnos = turnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cargarTurnos();
        alert('✅ Turno eliminado');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar turno');
    }
}

// ========== AVISOS ==========
// 🔴 Avisos urgentes pendientes de lectura
function obtenerAvisosUrgentesPendientes() {
    if (modoActual !== 'empleado' || !empleadoActual) return [];
    const hoy = new Date();
    return avisos.filter(a => {
        const activo = !a.vencimiento || new Date(a.vencimiento) >= hoy;
        const urgente = a.prioridad === 'urgente';
        const noLeido = !(a.vistos || []).includes(empleadoActual.id);
        return activo && urgente && noLeido;
    });
}

function actualizarIndicadorAvisosUrgentes() {
    if (modoActual !== 'empleado' || !empleadoActual) return;
    const pendientes = obtenerAvisosUrgentesPendientes();
    let indicador = document.getElementById('indicadorAvisosUrgentes');
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicadorAvisosUrgentes';
        indicador.style.cssText = 'position:fixed;right:16px;bottom:18px;z-index:9998;background:#ff4757;color:white;padding:12px 16px;border-radius:14px;font-weight:800;box-shadow:0 5px 18px rgba(0,0,0,.25);cursor:pointer;';
        indicador.onclick = () => {
            const botonAvisos = document.querySelector('.nav-btn[data-tab="avisos"]');
            if (botonAvisos) botonAvisos.click();
        };
        document.body.appendChild(indicador);
    }
    if (pendientes.length > 0) {
        indicador.innerHTML = '🚨 ' + pendientes.length + (pendientes.length === 1 ? ' AVISO URGENTE PENDIENTE' : ' AVISOS URGENTES PENDIENTES');
        indicador.style.display = 'block';
    } else {
        indicador.style.display = 'none';
    }
}

function formatearFechaAviso(fecha) {
    if (!fecha) return 'Fecha pendiente';
    if (fecha.toDate) return fecha.toDate().toLocaleDateString('es-UY');
    if (fecha instanceof Date) return fecha.toLocaleDateString('es-UY');
    return String(fecha);
}

function fechaAvisoParaOrdenar(fecha) {
    if (!fecha) return 0;
    if (fecha.toDate) return fecha.toDate().getTime();
    if (fecha instanceof Date) return fecha.getTime();
    const texto = String(fecha);
    const partes = texto.split('/');
    if (partes.length === 3) return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0])).getTime();
    const tiempo = Date.parse(texto);
    return isNaN(tiempo) ? 0 : tiempo;
}


function cargarAvisos() {
    const lista = document.getElementById('listaAvisos');
    if (!lista) return;
    const filtroCategoria = document.getElementById('filtroAvisoCategoria').value;
    const filtroPrioridad = document.getElementById('filtroAvisoPrioridad').value;
    const filtroEstado = document.getElementById('filtroAvisoEstado').value;
    const hoy = new Date();
    let avisosFiltrados = avisos;
    if (filtroCategoria !== 'todas') avisosFiltrados = avisosFiltrados.filter(a => a.categoria === filtroCategoria);
    if (filtroPrioridad !== 'todas') avisosFiltrados = avisosFiltrados.filter(a => a.prioridad === filtroPrioridad);
    if (filtroEstado === 'activos') avisosFiltrados = avisosFiltrados.filter(a => !a.vencimiento || new Date(a.vencimiento) >= hoy);
    else if (filtroEstado === 'vencidos') avisosFiltrados = avisosFiltrados.filter(a => a.vencimiento && new Date(a.vencimiento) < hoy);
    const prioridadOrden = { urgente: 0, normal: 1, informativo: 2 };
    avisosFiltrados = avisosFiltrados.sort((a, b) => {
        const pa = prioridadOrden[a.prioridad] || 1;
        const pb = prioridadOrden[b.prioridad] || 1;
        if (pa !== pb) return pa - pb;
        return fechaAvisoParaOrdenar(b.fechaCreacion) - fechaAvisoParaOrdenar(a.fechaCreacion);
    });
    if (avisosFiltrados.length === 0) { lista.innerHTML = '<p class="info-box">No hay avisos</p>'; return; }
    let html = '';
    if (filtroEstado === 'todos') {
        const activos = avisosFiltrados.filter(a => !a.vencimiento || new Date(a.vencimiento) >= hoy);
        const vencidos = avisosFiltrados.filter(a => a.vencimiento && new Date(a.vencimiento) < hoy);
        if (activos.length > 0) {
            html += `<div class="categoria-grupo">
                <div class="categoria-header" onclick="toggleCategoria('avisos-activos')" style="background: #e8f5e9; color: #2e7d32;">
                    <span>🔔 Avisos Activos <span class="categoria-contador" style="background: #2ed573;">${activos.length}</span></span>
                    <span id="icon-categoria-avisos-activos">▼</span>
                </div>
                <div class="categoria-contenido" id="categoria-avisos-activos">${activos.map(a => generarAvisoHTML(a, hoy)).join('')}</div></div>`;
        }
        if (vencidos.length > 0) {
            html += `<div class="categoria-grupo">
                <div class="categoria-header" onclick="toggleCategoria('avisos-vencidos')" style="background: #ffebee; color: #c62828;">
                    <span>📜 Avisos Vencidos <span class="categoria-contador" style="background: #ff4757;">${vencidos.length}</span></span>
                    <span id="icon-categoria-avisos-vencidos">▶</span>
                </div>
                <div class="categoria-contenido" id="categoria-avisos-vencidos" style="display:none;">${vencidos.map(a => generarAvisoHTML(a, hoy)).join('')}</div></div>`;
        }
    } else {
        html = avisosFiltrados.map(a => generarAvisoHTML(a, hoy)).join('');
    }
    lista.innerHTML = html;
    actualizarIndicadorAvisosUrgentes();
}

function generarAvisoHTML(aviso, hoy) {
    const esVencido = aviso.vencimiento && new Date(aviso.vencimiento) < hoy;
    const claseVencido = esVencido ? 'vencido' : '';
    const clasePrioridad = `prioridad-${aviso.prioridad}`;
    const categoriaTexto = CATEGORIAS_AVISOS[aviso.categoria] || aviso.categoria;
    const prioridadTexto = { urgente: '🔴 Urgente', normal: '🔵 Normal', informativo: '🟢 Informativo' }[aviso.prioridad];
    const totalEmpleados = empleados.length;
    const vistosCount = aviso.vistos ? aviso.vistos.length : 0;
    let yaLeido = false;
    if (modoActual === 'empleado' && empleadoActual && aviso.vistos) yaLeido = aviso.vistos.includes(empleadoActual.id);
    return `
        <div class="aviso-item ${clasePrioridad} ${claseVencido}">
            <div class="aviso-header">
                <h3>${aviso.titulo}</h3>
                ${esVencido ? '<span class="aviso-expirado">VENCIDO</span>' : ''}
            </div>
            <div class="aviso-badges">
                <span class="aviso-badge categoria-${aviso.categoria}">${categoriaTexto}</span>
                <span class="aviso-badge prioridad-${aviso.prioridad}">${prioridadTexto}</span>
            </div>
            <div class="aviso-meta">
                <span>📅 ${formatearFechaAviso(aviso.fechaCreacion)}</span>
                ${aviso.vencimiento ? `<span>⏰ Vence: ${aviso.vencimiento}</span>` : ''}
                <span>✍️ ${aviso.creador}</span>
            </div>
            <div class="aviso-contenido">${aviso.contenido}</div>
            <div class="aviso-footer">
                <div class="aviso-vistos">👁️ Visto por: <strong>${vistosCount}/${totalEmpleados}</strong></div>
                ${modoActual === 'empleado' && !yaLeido && !esVencido ? 
                    `<button class="aviso-sin-leer" onclick="marcarAvisoLeido('${aviso.id}')">✅ Marcar leído</button>` : 
                    (yaLeido ? '<span style="color: #2ed573; font-weight: bold;">✓ Leído</span>' : '')
                }
                ${modoActual === 'admin' ? `<div class="aviso-actions"><button class="btn-danger" onclick="eliminarAviso('${aviso.id}')">🗑️ Eliminar</button></div>` : ''}
            </div>
        </div>
    `;
}

function mostrarFormularioAviso() { document.getElementById('formularioAviso').style.display = 'block'; }
function ocultarFormularioAviso() {
    document.getElementById('formularioAviso').style.display = 'none';
    document.getElementById('avisoTitulo').value = '';
    document.getElementById('avisoCategoria').value = 'general';
    document.getElementById('avisoPrioridad').value = 'normal';
    document.getElementById('avisoContenido').value = '';
    document.getElementById('avisoVencimiento').value = '';
}
async function guardarAviso() {
    const titulo = document.getElementById('avisoTitulo').value;
    const categoria = document.getElementById('avisoCategoria').value;
    const prioridad = document.getElementById('avisoPrioridad').value;
    const contenido = document.getElementById('avisoContenido').value;
    const vencimiento = document.getElementById('avisoVencimiento').value;
    if (!titulo || !contenido) { alert('Completá título y contenido'); return; }
    try {
        await db.collection('avisos').add({
            titulo, categoria, prioridad, contenido,
            vencimiento: vencimiento || null,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
            creador: empleadoActual ? empleadoActual.nombre : 'Admin',
            vistos: []
        });
        ocultarFormularioAviso();
        await cargarDatosIniciales();
        cargarAvisos();
        alert('✅ Aviso publicado');
    } catch (error) { console.error('Error:', error); }
}
async function marcarAvisoLeido(avisoId) {
    if (!empleadoActual) return;
    try {
        const avisoRef = db.collection('avisos').doc(avisoId);
        const avisoDoc = await avisoRef.get();
        const aviso = avisoDoc.data();
        if (!aviso.vistos) aviso.vistos = [];
        if (!aviso.vistos.includes(empleadoActual.id)) {
            aviso.vistos.push(empleadoActual.id);
            await avisoRef.update({ vistos: aviso.vistos });
        }
        await cargarDatosIniciales();
        cargarAvisos();
        actualizarIndicadorAvisosUrgentes();
    } catch (error) { console.error('Error:', error); }
}
async function eliminarAviso(avisoId) {
    if (confirm('¿Eliminar este aviso?')) {
        try {
            await db.collection('avisos').doc(avisoId).delete();
            await cargarDatosIniciales();
            cargarAvisos();
        } catch (error) { console.error('Error:', error); }
    }
}

// ========== TAREAS ==========
function cargarTareas() {
    const contenedor = document.getElementById('contenedorTareas');
    const hoy = new Date().toDateString();
    const tareasApertura = tareas.filter(t => t.momento === 'apertura');
    const tareasDurante = tareas.filter(t => t.momento === 'durante');
    const tareasCierre = tareas.filter(t => t.momento === 'cierre');
    let html = '';
    if (tareasApertura.length > 0) html += generarGrupoMomento('apertura', '🌅 Apertura', tareasApertura, hoy);
    if (tareasDurante.length > 0) html += generarGrupoMomento('durante', '🔄 Durante el turno', tareasDurante, hoy);
    if (tareasCierre.length > 0) html += generarGrupoMomento('cierre', '🌙 Cierre', tareasCierre, hoy);
    if (tareas.length === 0) html = '<p class="info-box">No hay tareas</p>';
    contenedor.innerHTML = html;
}

function generarGrupoMomento(momento, titulo, listaTareas, hoy) {
    const completadas = listaTareas.filter(t => {
        const clave = `${hoy}-${t.id}-${empleadoActual ? empleadoActual.id : 'admin'}`;
        return tareasCompletadas[clave];
    }).length;
    let html = `
        <div class="momento-grupo">
            <div class="momento-header" onclick="toggleMomento('${momento}')">
                <h3>${titulo} <span class="momento-contador">${completadas}/${listaTareas.length}</span></h3>
                <span id="icon-momento-${momento}">▶</span>
            </div>
            <div class="momento-contenido" id="momento-${momento}" style="display:none;">
    `;
    listaTareas.forEach(tarea => {
        const clave = `${hoy}-${tarea.id}-${empleadoActual ? empleadoActual.id : 'admin'}`;
        const completada = tareasCompletadas[clave];
        const claseCompletada = completada ? 'completada' : '';
        const textoCompletada = completada ? `✅ ${completada.empleado} - ${completada.hora}` : '';
        html += `
            <div class="tarea-item ${claseCompletada}">
                <input type="checkbox" class="tarea-checkbox" ${completada ? 'checked' : ''} onchange="toggleTarea('${tarea.id}')">
                <div class="tarea-info">
                    <h4>${tarea.titulo}</h4>
                    ${textoCompletada ? `<p>${textoCompletada}</p>` : ''}
                </div>
            </div>
        `;
    });
    html += `</div></div>`;
    return html;
}

async function toggleTarea(tareaId) {
    const hoy = new Date().toDateString();
    const clave = `${hoy}-${tareaId}-${empleadoActual ? empleadoActual.id : 'admin'}`;
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (tareasCompletadas[clave]) delete tareasCompletadas[clave];
    else tareasCompletadas[clave] = { empleado: empleadoActual ? empleadoActual.nombre : 'Admin', hora: ahora, fecha: hoy };
    try {
        await db.collection('config').doc('tareasCompletadas').set({ data: tareasCompletadas });
        // El listener en vivo se encarga de actualizar el DOM preservando el estado
    } catch (error) { console.error('Error:', error); }
}

// ========== CALENDARIO ==========
function cargarCalendario() {
    const contenedor = document.getElementById('contenedorCalendario');
    const avisosEl = document.getElementById('avisosCalendario');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const filtroTipo = document.getElementById('filtroEventoTipo').value;
    const filtroPeriodo = document.getElementById('filtroEventoPeriodo').value;
    let fechaLimite = new Date();
    if (filtroPeriodo === 'semana') fechaLimite.setDate(hoy.getDate() + 7);
    else if (filtroPeriodo === 'mes' || filtroPeriodo === 'proximos') fechaLimite.setDate(hoy.getDate() + 30);
    else if (filtroPeriodo === 'todos') fechaLimite = null;
    let eventosFiltrados = eventos;
    if (filtroTipo !== 'todos') eventosFiltrados = eventosFiltrados.filter(e => e.tipo === filtroTipo);
    if (filtroPeriodo !== 'todos') {
        eventosFiltrados = eventosFiltrados.filter(e => {
            const fecha = new Date(e.fecha);
            fecha.setHours(0, 0, 0, 0);
            return fecha >= hoy && (!fechaLimite || fecha <= fechaLimite);
        });
    }
    let avisosHtml = '';
    eventos.forEach(evento => {
        const fechaEvento = new Date(evento.fecha);
        fechaEvento.setHours(0, 0, 0, 0);
        const diferenciaDias = Math.floor((fechaEvento - hoy) / (1000 * 60 * 60 * 24));
        if (diferenciaDias >= 0 && diferenciaDias <= 3) {
            let textoAviso = '';
            if (diferenciaDias === 0) textoAviso = '⚠️ HOY';
            else if (diferenciaDias === 1) textoAviso = '⚠️ MAÑANA';
            else textoAviso = `⚠️ En ${diferenciaDias} días`;
            avisosHtml += `<p>${textoAviso}: ${evento.titulo}</p>`;
        }
    });
    avisosEl.innerHTML = avisosHtml ? `<div class="avisos-destacados"><h4>🔔 Próximos eventos</h4>${avisosHtml}</div>` : '';
    if (eventosFiltrados.length === 0) {
        contenedor.innerHTML = '<p class="info-box">No hay eventos</p>';
        document.getElementById('botonCrearEvento').style.display = modoActual === 'admin' ? 'block' : 'none';
        return;
    }
    const eventosPorTipo = { pedido: [], recepcion: [], conteo: [], otro: [] };
    eventosFiltrados.forEach(evento => {
        const tipo = evento.tipo || 'otro';
        if (eventosPorTipo[tipo]) eventosPorTipo[tipo].push(evento);
        else eventosPorTipo.otro.push(evento);
    });
    Object.keys(eventosPorTipo).forEach(tipo => {
        eventosPorTipo[tipo].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    });
    const nombresTipo = { pedido: '📦 Días de Pedido', recepcion: '🚚 Recepciones', conteo: '🔢 Conteos', otro: '📌 Otros' };
    let html = '';
    Object.keys(eventosPorTipo).forEach(tipo => {
        if (eventosPorTipo[tipo].length > 0) {
            html += `
                <div class="categoria-grupo">
                    <div class="categoria-header" onclick="toggleCategoria('evento-${tipo}')">
                        <span>${nombresTipo[tipo]} <span class="categoria-contador">${eventosPorTipo[tipo].length}</span></span>
                        <span id="icon-categoria-evento-${tipo}">▶</span>
                    </div>
                    <div class="categoria-contenido" id="categoria-evento-${tipo}" style="display:none;">
            `;
            eventosPorTipo[tipo].forEach(evento => {
                const fechaEvento = new Date(evento.fecha);
                fechaEvento.setHours(0, 0, 0, 0);
                const fechaFormateada = fechaEvento.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                const iconoTipo = { pedido: '📦', recepcion: '🚚', conteo: '🔢', otro: '📌' };
                html += `
                    <div class="evento-item tipo-${evento.tipo}">
                        <h4>${iconoTipo[evento.tipo] || '📌'} ${evento.titulo}</h4>
                        <p>📅 ${fechaFormateada}</p>
                        ${evento.descripcion ? `<p>${evento.descripcion}</p>` : ''}
                        ${modoActual === 'admin' ? `<div class="actions"><button class="btn-danger" onclick="eliminarEvento('${evento.id}')">Eliminar</button></div>` : ''}
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    });
    contenedor.innerHTML = html;
    document.getElementById('botonCrearEvento').style.display = modoActual === 'admin' ? 'block' : 'none';
}

function mostrarFormularioEvento() { document.getElementById('formularioEvento').style.display = 'block'; }
function ocultarFormularioEvento() {
    document.getElementById('formularioEvento').style.display = 'none';
    document.getElementById('eventoTitulo').value = '';
    document.getElementById('eventoFecha').value = '';
    document.getElementById('eventoDescripcion').value = '';
}
async function guardarEvento() {
    const titulo = document.getElementById('eventoTitulo').value;
    const fecha = document.getElementById('eventoFecha').value;
    const tipo = document.getElementById('eventoTipo').value;
    const descripcion = document.getElementById('eventoDescripcion').value;
    if (!titulo || !fecha) { alert('Completa título y fecha'); return; }
    try {
        await db.collection('eventos').add({ titulo, fecha, tipo, descripcion });
        ocultarFormularioEvento();
        await cargarDatosIniciales();
        cargarCalendario();
    } catch (error) { console.error('Error:', error); }
}
async function eliminarEvento(id) {
    if (confirm('¿Eliminar este evento?')) {
        try {
            await db.collection('eventos').doc(id).delete();
            await cargarDatosIniciales();
            cargarCalendario();
        } catch (error) { console.error('Error:', error); }
    }
}

// ========== CÁMARA DE FRÍO ==========
function cargarCamara() {
    cargarPedidosCamara(); cargarSelectsCamara();
    cargarHistorialCamara(); cargarStockCamara();
}

function cargarSelectsCamara() {
    function llenarSelect(selectId, productosFiltrados) {
        const select = document.getElementById(selectId);
        if (!select) return;
        let html = '<option value="">-- Selecciona un producto --</option>';
        Object.keys(CATEGORIAS).forEach(cat => {
            const productosDeCategoria = productosFiltrados.filter(p => (p.categoria || 'otros') === cat);
            if (productosDeCategoria.length > 0) {
                html += `<optgroup label="${CATEGORIAS[cat]} (${productosDeCategoria.length})">`;
                productosDeCategoria.forEach(prod => { html += `<option value="${prod.id}">${prod.nombre}</option>`; });
                html += `</optgroup>`;
            }
        });
        select.innerHTML = html;
    }
    llenarSelect('movimientoProducto', productos);
    llenarSelect('pedidoCamaraProducto', productos);
}

function filtrarProductosCamara(tipo) {
    const buscadorId = tipo === 'movimiento' ? 'buscadorMovimiento' : 'buscadorPedidoCamara';
    const selectId = tipo === 'movimiento' ? 'movimientoProducto' : 'pedidoCamaraProducto';
    const buscador = document.getElementById(buscadorId);
    const select = document.getElementById(selectId);
    if (!buscador || !select) return;
    const busqueda = buscador.value.toLowerCase();
    const productosFiltrados = productos.filter(prod => prod.nombre.toLowerCase().includes(busqueda));
    const productosPorCategoria = {};
    Object.keys(CATEGORIAS).forEach(cat => { productosPorCategoria[cat] = []; });
    productosFiltrados.forEach(prod => {
        const categoria = prod.categoria || 'otros';
        if (!productosPorCategoria[categoria]) productosPorCategoria[categoria] = [];
        productosPorCategoria[categoria].push(prod);
    });
    let html = '<option value="">-- Selecciona un producto --</option>';
    Object.keys(CATEGORIAS).forEach(cat => {
        const productosDeCategoria = productosPorCategoria[cat];
        if (productosDeCategoria.length > 0) {
            html += `<optgroup label="${CATEGORIAS[cat]} (${productosDeCategoria.length})">`;
            productosDeCategoria.forEach(prod => { html += `<option value="${prod.id}">${prod.nombre}</option>`; });
            html += `</optgroup>`;
        }
    });
    select.innerHTML = html;
}

function cargarPedidosCamara() {
    const lista = document.getElementById('listaPedidosCamara');
    if (!lista) return;
    if (pedidosCamara.length === 0) { lista.innerHTML = '<p class="info-box">No hay pedidos</p>'; return; }
    const pedidosPendientes = pedidosCamara.filter(p => !p.traido).sort((a, b) => parsearFechaPedido(b.fecha) - parsearFechaPedido(a.fecha));
    const pedidosTraidos = pedidosCamara.filter(p => p.traido).sort((a, b) => parsearFechaPedido(b.fechaTraido) - parsearFechaPedido(a.fechaTraido)).slice(0, 10);
    let html = '';
    if (pedidosPendientes.length > 0) {
        html += '<h4 style="margin: 15px 0 10px 0;">⏳ Pendientes</h4>';
        pedidosPendientes.forEach(pedido => {
            const prod = productos.find(p => p.id === pedido.productoId);
            html += `
                <div class="pedido-camara-item">
                    <h4>${prod ? prod.nombre : 'Producto eliminado'}</h4>
                    <p><strong>Cantidad:</strong> ${pedido.cantidad}</p>
                    ${pedido.nota ? `<p><strong>Nota:</strong> ${pedido.nota}</p>` : ''}
                    <p><strong>Agregado:</strong> ${pedido.empleado} - ${pedido.fecha}</p>
                    <div class="actions">
                        <button class="btn-success" onclick="marcarPedidoTraido('${pedido.id}')">✅ Marcar traído</button>
                        <button class="btn-danger" onclick="eliminarPedidoCamara('${pedido.id}')">Eliminar</button>
                    </div>
                </div>
            `;
        });
    }
    if (pedidosTraidos.length > 0) {
        html += '<h4 style="margin: 15px 0 10px 0;">✅ Traídos (últimos 10)</h4>';
        pedidosTraidos.forEach(pedido => {
            const prod = productos.find(p => p.id === pedido.productoId);
            html += `
                <div class="pedido-camara-item traido">
                    <h4>${prod ? prod.nombre : 'Producto eliminado'}</h4>
                    <p><strong>Cantidad:</strong> ${pedido.cantidad}</p>
                    ${pedido.nota ? `<p><strong>Nota:</strong> ${pedido.nota}</p>` : ''}
                    <p><strong>Traído:</strong> ${pedido.traidoPor} - ${pedido.fechaTraido}</p>
                </div>
            `;
        });
    }
    lista.innerHTML = html;
}

function parsearFechaPedido(fechaStr) {
    if (!fechaStr) return new Date(0);
    try {
        const partes = fechaStr.split(' ');
        if (partes.length >= 2) {
            const [d, m, y] = partes[0].split('/');
            const [h, min, s] = partes[1].split(':');
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h) || 0, parseInt(min) || 0, parseInt(s) || 0);
        }
        return new Date(fechaStr);
    } catch(e) { return new Date(0); }
}

function ocultarFormularioPedido() {
    const formulario = document.getElementById('formularioPedido');
    if (formulario) formulario.style.display = 'none';

    const buscador = document.getElementById('buscarProductoPedido');
    if (buscador) buscador.value = '';

    const lista = document.getElementById('listaProductosPedido');
    if (lista) lista.innerHTML = '';

    pedidoFormData = {};
}

function mostrarFormularioPedidoCamara() { document.getElementById('formularioPedidoCamara').style.display = 'block'; }
function ocultarFormularioPedidoCamara() {
    document.getElementById('formularioPedidoCamara').style.display = 'none';
    document.getElementById('buscadorPedidoCamara').value = '';
    document.getElementById('pedidoCamaraProducto').value = '';
    document.getElementById('pedidoCamaraCantidad').value = '';
    document.getElementById('pedidoCamaraNota').value = '';
    cargarSelectsCamara();
}
async function guardarPedidoCamara() {
    const productoId = document.getElementById('pedidoCamaraProducto').value;
    const cantidad = parseFloat(document.getElementById('pedidoCamaraCantidad').value);
    const nota = document.getElementById('pedidoCamaraNota').value;
    if (!productoId || isNaN(cantidad) || cantidad <= 0) { alert('Seleccioná producto y cantidad'); return; }
    try {
        await db.collection('camaraPedidos').add({
            productoId, cantidad, nota: nota || '',
            empleado: empleadoActual ? empleadoActual.nombre : 'Admin',
            fecha: new Date().toLocaleString('es-ES'), traido: false
        });
        ocultarFormularioPedidoCamara();
        await cargarDatosIniciales();
        cargarPedidosCamara();
    } catch (error) { console.error('Error:', error); }
}

async function marcarPedidoTraido(id) {
    try {
        const pedidoDoc = await db.collection('camaraPedidos').doc(id).get();
        const pedido = pedidoDoc.data();
        await db.collection('camaraPedidos').doc(id).update({
            traido: true,
            traidoPor: empleadoActual ? empleadoActual.nombre : 'Admin',
            fechaTraido: new Date().toLocaleString('es-ES')
        });
        const cantidad = pedido.cantidad || 0;
        const productoId = pedido.productoId;
        if (productoId && cantidad > 0) {
            const stockActual = stockCamara[productoId] || 0;
            const nuevoStock = Math.max(0, stockActual - cantidad);
            stockCamara[productoId] = nuevoStock;
            await db.collection('config').doc('stockCamara').set({ data: stockCamara });
            const prod = productos.find(p => p.id === productoId);
            await db.collection('camaraMovimientos').add({
                tipo: 'salida',
                productoId: productoId,
                cantidad: cantidad,
                nota: `Retiro por pedido: ${prod ? prod.nombre : productoId}`,
                empleado: empleadoActual ? empleadoActual.nombre : 'Admin',
                fecha: new Date().toLocaleString('es-ES'),
                timestamp: new Date(),
                origen: 'pedido_camara'
            });
        }
        await cargarDatosIniciales();
        cargarPedidosCamara();
        mostrarToast('✅ Pedido marcado y stock actualizado', 'entrada', 3000);
    } catch (error) { 
        console.error('Error:', error); 
        alert('Error al marcar pedido');
    }
}

async function eliminarPedidoCamara(id) {
    if (confirm('¿Eliminar este pedido?')) {
        try {
            await db.collection('camaraPedidos').doc(id).delete();
            await cargarDatosIniciales();
            cargarPedidosCamara();
        } catch (error) { console.error('Error:', error); }
    }
}
async function guardarMovimientoCamara() {
    const tipo = document.getElementById('movimientoTipo').value;
    const productoId = document.getElementById('movimientoProducto').value;
    const cantidad = parseFloat(document.getElementById('movimientoCantidad').value);
    const nota = document.getElementById('movimientoNota').value;
    if (!productoId || isNaN(cantidad) || cantidad <= 0) { alert('Seleccioná producto y cantidad'); return; }
    try {
        await db.collection('camaraMovimientos').add({
            tipo, productoId, cantidad, nota: nota || '',
            empleado: empleadoActual ? empleadoActual.nombre : 'Admin',
            fecha: new Date().toLocaleString('es-ES'), timestamp: new Date()
        });
        if (tipo === 'entrada') stockCamara[productoId] = (stockCamara[productoId] || 0) + cantidad;
        else stockCamara[productoId] = Math.max(0, (stockCamara[productoId] || 0) - cantidad);
        await db.collection('config').doc('stockCamara').set({ data: stockCamara });
        document.getElementById('buscadorMovimiento').value = '';
        document.getElementById('movimientoProducto').value = '';
        document.getElementById('movimientoCantidad').value = '';
        document.getElementById('movimientoNota').value = '';
        await cargarDatosIniciales();
        cargarCamara();
        alert('✅ Movimiento registrado');
    } catch (error) { console.error('Error:', error); }
}

function cargarStockCamara() {
    const lista = document.getElementById('listaStockCamara');
    if (!lista) return;
    const productosEnCamara = productos.filter(prod => {
        const stockActual = stockCamara[prod.id] || 0;
        const categoria = prod.categoria || 'otros';
        return stockActual > 0 && CATEGORIAS_CAMARA[categoria];
    });
    if (productosEnCamara.length === 0) {
        lista.innerHTML = '<p class="info-box">No hay productos en la cámara</p>';
        return;
    }
    const productosPorCategoria = {};
    Object.keys(CATEGORIAS_CAMARA).forEach(cat => { productosPorCategoria[cat] = []; });
    productosEnCamara.forEach(prod => {
        const categoria = prod.categoria || 'otros';
        if (productosPorCategoria[categoria]) productosPorCategoria[categoria].push(prod);
    });
    let html = '';
    let totalProductos = 0;
    Object.keys(CATEGORIAS_CAMARA).forEach(cat => {
        if (productosPorCategoria[cat] && productosPorCategoria[cat].length > 0) {
            totalProductos += productosPorCategoria[cat].length;
            html += `
                <div class="categoria-grupo">
                    <div class="categoria-header" onclick="toggleCategoria('camara-${cat}')">
                        <span>${CATEGORIAS_CAMARA[cat]} <span class="categoria-contador">${productosPorCategoria[cat].length}</span></span>
                        <span id="icon-categoria-camara-${cat}">▶</span>
                    </div>
                    <div class="categoria-contenido" id="categoria-camara-${cat}" style="display:none;">
            `;
            productosPorCategoria[cat].forEach(prod => {
                const cantidad = stockCamara[prod.id] || 0;
                const unidad = prod.unidad || 'unidades';
                html += `
                    <div class="stock-camara-item" data-nombre="${prod.nombre.toLowerCase().replace(/"/g, '&quot;')}">
                        <div>
                            <h4>${prod.nombre}</h4>
                            <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Unidad: ${unidad}</p>
                        </div>
                        <div class="cantidad">${cantidad}</div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    });
    lista.innerHTML = `<div class="total-box" style="margin-bottom: 15px;"><p><strong>📦 Total:</strong> ${totalProductos}</p></div>` + html;
}

function filtrarStockCamara() {
    const input = document.getElementById('buscarStockCamara');
    const termino = (input?.value || '').trim().toLowerCase();
    const grupos = document.querySelectorAll('#listaStockCamara .categoria-grupo');
    grupos.forEach(grupo => {
        const items = grupo.querySelectorAll('.stock-camara-item');
        let visibles = 0;
        items.forEach(item => {
            const nombre = item.dataset.nombre || '';
            const coincide = !termino || nombre.includes(termino);
            item.style.display = coincide ? '' : 'none';
            if (coincide) visibles++;
        });
        grupo.style.display = visibles > 0 ? '' : 'none';
    });
    const totalBox = document.querySelector('#listaStockCamara .total-box');
    if (totalBox) {
        const visibles = document.querySelectorAll('#listaStockCamara .stock-camara-item:not([style*="display: none"])').length;
        totalBox.innerHTML = '<p><strong>📦 Mostrando:</strong> ' + visibles + '</p>';
    }
}

function cargarHistorialCamara() {
    const lista = document.getElementById('listaHistorialCamara');
    if (!lista) return;
    if (movimientosCamara.length === 0) { lista.innerHTML = '<p class="info-box">No hay movimientos</p>'; return; }
    const movimientosOrdenados = movimientosCamara.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return tb - ta;
    });
    let html = '';
    movimientosOrdenados.slice(0, 30).forEach(mov => {
        const prod = productos.find(p => p.id === mov.productoId);
        const clase = mov.tipo === 'entrada' ? 'entrada' : 'salida';
        const icono = mov.tipo === 'entrada' ? '📥' : '📤';
        const origen = mov.origen === 'pedido_camara' ? ' (por pedido)' : '';
        html += `
            <div class="movimiento-item ${clase}">
                <h4>${icono} ${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}: ${prod ? prod.nombre : 'Producto eliminado'}${origen}</h4>
                <p><strong>Cantidad:</strong> ${mov.cantidad}</p>
                ${mov.nota ? `<p><strong>Nota:</strong> ${mov.nota}</p>` : ''}
                <p><strong>Registrado:</strong> ${mov.empleado} - ${mov.fecha}</p>
            </div>
        `;
    });
    lista.innerHTML = html;
}

// ========== CIERRE DE TURNO ==========
function cargarCierre() {
    cargarMisCierres();
    retirosTemporales = [];
    renderizarRetiros();
}
function calcularTotalCierre() {
    const efectivo = parseFloat(document.getElementById('cierreEfectivo').value) || 0;
    const credito = parseFloat(document.getElementById('cierreCredito').value) || 0;
    const debito = parseFloat(document.getElementById('cierreDebito').value) || 0;
    const total = efectivo + credito + debito;
    document.getElementById('cierreTotal').textContent = formatearMoneda(total);
    calcularDiferenciaCierre();
}
function calcularDiferenciaCierre() {
    if (modoActual === 'empleado') {
        const difBox = document.getElementById('cierreDiferenciaBox');
        difBox.className = 'total-box neutro';
        document.getElementById('cierreDiferencia').textContent = '🔒 Solo visible para admin';
        return;
    }
    const efectivo = parseFloat(document.getElementById('cierreEfectivo').value) || 0;
    const conteo = parseFloat(document.getElementById('cierreConteo').value) || 0;
    const diferencia = conteo - efectivo;
    const difElement = document.getElementById('cierreDiferencia');
    const difBox = document.getElementById('cierreDiferenciaBox');
    difElement.textContent = formatearMoneda(diferencia);
    difBox.className = 'total-box';
    if (diferencia > 0) { difBox.classList.add('positivo'); difElement.textContent = `+${formatearMoneda(diferencia)} (Sobra)`; }
    else if (diferencia < 0) { difBox.classList.add('negativo'); difElement.textContent = `-${formatearMoneda(Math.abs(diferencia))} (Falta)`; }
    else { difBox.classList.add('neutro'); difElement.textContent = '$0 (Cuadra perfecto)'; }
}
function agregarRetiro() { retirosTemporales.push({ monto: '', motivo: '', destino: '' }); renderizarRetiros(); }
function eliminarRetiro(index) { retirosTemporales.splice(index, 1); renderizarRetiros(); }
function actualizarRetiro(index, campo, valor) { retirosTemporales[index][campo] = valor; }
function renderizarRetiros() {
    const lista = document.getElementById('listaRetiros');
    if (retirosTemporales.length === 0) {
        lista.innerHTML = '<p style="color: #999; font-style: italic; text-align: center; padding: 10px;">No hay retiros</p>';
        return;
    }
    let html = '';
    retirosTemporales.forEach((retiro, index) => {
        html += `
            <div class="retiros-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Retiro #${index + 1}</strong>
                    <button class="btn-danger" onclick="eliminarRetiro(${index})">❌</button>
                </div>
                <label>Monto:</label>
                <input type="number" placeholder="$" step="0.01" min="0" value="${retiro.monto}" onchange="actualizarRetiro(${index}, 'monto', this.value)">
                <label>Motivo:</label>
                <input type="text" placeholder="Ej: Pago luz" value="${retiro.motivo}" onchange="actualizarRetiro(${index}, 'motivo', this.value)">
                <label>Destino:</label>
                <select onchange="actualizarRetiro(${index}, 'destino', this.value)">
                    <option value="">Seleccionar...</option>
                    <option value="caja-fuerte" ${retiro.destino === 'caja-fuerte' ? 'selected' : ''}>💰 Caja fuerte</option>
                    <option value="banco" ${retiro.destino === 'banco' ? 'selected' : ''}>🏦 Banco</option>
                    <option value="pago-proveedor" ${retiro.destino === 'pago-proveedor' ? 'selected' : ''}>📄 Pago proveedor</option>
                    <option value="gasto" ${retiro.destino === 'gasto' ? 'selected' : ''}>💸 Gasto</option>
                    <option value="otro" ${retiro.destino === 'otro' ? 'selected' : ''}>📌 Otro</option>
                </select>
            </div>
        `;
    });
    lista.innerHTML = html;
}
async function guardarCierre() {
    const numero = document.getElementById('cierreNumero').value;
    const efectivo = parseFloat(document.getElementById('cierreEfectivo').value) || 0;
    const credito = parseFloat(document.getElementById('cierreCredito').value) || 0;
    const debito = parseFloat(document.getElementById('cierreDebito').value) || 0;
    const conteo = parseFloat(document.getElementById('cierreConteo').value) || 0;
    const notas = document.getElementById('cierreNotas').value;
    if (!numero) { alert('Ingresá el número de turno'); return; }
    if (efectivo === 0 && credito === 0 && debito === 0) {
        if (!confirm('No ingresaste ventas. ¿Guardar igual?')) return;
    }
    const totalVentas = efectivo + credito + debito;
    const diferencia = conteo - efectivo;
    const retirosValidos = retirosTemporales.filter(r => r.monto && parseFloat(r.monto) > 0);
    try {
        await db.collection('cierres').add({
            numero, empleadoId: empleadoActual ? empleadoActual.id : 'admin',
            empleadoNombre: empleadoActual ? empleadoActual.nombre : 'Admin',
            fecha: new Date().toLocaleDateString('es-ES'),
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(), efectivo, credito, debito, totalVentas, conteo, diferencia,
            retiros: retirosValidos, totalRetiros: retirosValidos.reduce((sum, r) => sum + parseFloat(r.monto), 0),
            notas: notas || ''
        });
        document.getElementById('cierreNumero').value = '';
        document.getElementById('cierreEfectivo').value = '';
        document.getElementById('cierreCredito').value = '';
        document.getElementById('cierreDebito').value = '';
        document.getElementById('cierreConteo').value = '';
        document.getElementById('cierreNotas').value = '';
        retirosTemporales = [];
        renderizarRetiros();
        document.getElementById('cierreTotal').textContent = '$0';
        document.getElementById('cierreDiferencia').textContent = '🔒 Solo visible para admin';
        document.getElementById('cierreDiferenciaBox').className = 'total-box neutro';
        await cargarDatosIniciales();
        cargarMisCierres();
        alert('✅ Cierre guardado');
    } catch (error) { console.error('Error:', error); alert('Error al guardar'); }
}
function cargarMisCierres() {
    const lista = document.getElementById('listaMisCierres');
    if (!lista) return;
    let misCierres = cierres;
    if (modoActual === 'empleado' && empleadoActual) misCierres = cierres.filter(c => c.empleadoId === empleadoActual.id);
    if (misCierres.length === 0) { lista.innerHTML = '<p class="info-box">No hay cierres</p>'; return; }
    const cierresOrdenados = misCierres.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return tb - ta;
    });
    let html = '';
    cierresOrdenados.slice(0, 10).forEach(cierre => { html += generarCierreItem(cierre); });
    lista.innerHTML = html;
}
function generarCierreItem(cierre) {
    const difClase = cierre.diferencia > 0 ? 'positivo' : cierre.diferencia < 0 ? 'negativo' : 'neutro';
    const difTexto = cierre.diferencia > 0 ? `+${formatearMoneda(cierre.diferencia)} (Sobra)` :
                     cierre.diferencia < 0 ? `-${formatearMoneda(Math.abs(cierre.diferencia))} (Falta)` : '$0 (Cuadra)';
    let retirosHtml = '';
    if (cierre.retiros && cierre.retiros.length > 0) {
        const destinos = { 'caja-fuerte': '💰 Caja fuerte', 'banco': '🏦 Banco', 'pago-proveedor': '📄 Pago proveedor', 'gasto': '💸 Gasto', 'otro': '📌 Otro' };
        retirosHtml = `
            <div class="retiros-lista">
                <h5>💸 Retiros (${cierre.retiros.length})</h5>
                ${cierre.retiros.map(r => `<p><strong>${formatearMoneda(parseFloat(r.monto))}</strong> - ${r.motivo} → ${destinos[r.destino] || r.destino}</p>`).join('')}
                <p style="margin-top: 8px;"><strong>Total: ${formatearMoneda(cierre.totalRetiros)}</strong></p>
            </div>
        `;
    }
    return `
        <div class="cierre-item">
            <h4>🧾 Turno #${cierre.numero} - ${cierre.empleadoNombre}</h4>
            <p style="color: #666; font-size: 13px;">📅 ${cierre.fecha} a las ${cierre.hora}</p>
            <div class="detalle">
                <p>💵 Efectivo: <strong>${formatearMoneda(cierre.efectivo)}</strong></p>
                <p>💳 Crédito: <strong>${formatearMoneda(cierre.credito)}</strong></p>
                <p>💳 Débito: <strong>${formatearMoneda(cierre.debito)}</strong></p>
                <p>📊 Conteo: <strong>${formatearMoneda(cierre.conteo)}</strong></p>
            </div>
            <div class="totales">
                <p><strong>💰 Total ventas:</strong> ${formatearMoneda(cierre.totalVentas)}</p>
                <p><strong>📊 Diferencia:</strong> <span class="${difClase}">${difTexto}</span></p>
            </div>
            ${retirosHtml}
            ${cierre.notas ? `<p style="margin-top: 10px; font-style: italic; color: #666;">📝 ${cierre.notas}</p>` : ''}
        </div>
    `;
}
function cargarCierresAdmin() { cargarDashboardCierres(); cargarTodosCierres(); }
function cargarDashboardCierres() {
    const dashboard = document.getElementById('dashboardCierres');
    if (!dashboard) return;
    if (cierres.length === 0) { dashboard.innerHTML = '<p class="info-box">No hay cierres</p>'; return; }
    const hoy = new Date().toLocaleDateString('es-ES');
    const cierresHoy = cierres.filter(c => c.fecha === hoy);
    const totalVentas = cierres.reduce((sum, c) => sum + c.totalVentas, 0);
    const totalEfectivo = cierres.reduce((sum, c) => sum + c.efectivo, 0);
    const totalCredito = cierres.reduce((sum, c) => sum + c.credito, 0);
    const totalDebito = cierres.reduce((sum, c) => sum + c.debito, 0);
    const totalRetiros = cierres.reduce((sum, c) => sum + (c.totalRetiros || 0), 0);
    const diferenciasPositivas = cierres.filter(c => c.diferencia > 0);
    const diferenciasNegativas = cierres.filter(c => c.diferencia < 0);
    dashboard.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"><h3>📅 Cierres Hoy</h3><p class="stat-number">${cierresHoy.length}</p></div>
            <div class="card" style="background: linear-gradient(135deg, #2ed573 0%, #1e9e54 100%);"><h3>💰 Total Ventas</h3><p class="stat-number">${formatearMoneda(totalVentas)}</p></div>
            <div class="card" style="background: linear-gradient(135deg, #ffa502 0%, #ff6348 100%);"><h3>💵 Efectivo</h3><p class="stat-number">${formatearMoneda(totalEfectivo)}</p></div>
            <div class="card" style="background: linear-gradient(135deg, #3742fa 0%, #2f3542 100%);"><h3>💳 Tarjetas</h3><p class="stat-number">${formatearMoneda(totalCredito + totalDebito)}</p></div>
            <div class="card" style="background: linear-gradient(135deg, #ff4757 0%, #c44569 100%);"><h3>💸 Retiros</h3><p class="stat-number">${formatearMoneda(totalRetiros)}</p></div>
            <div class="card" style="background: linear-gradient(135deg, #747d8c 0%, #2f3542 100%);"><h3>📊 Diferencias</h3><p style="font-size: 14px;">✅ ${diferenciasPositivas.length}<br>❌ ${diferenciasNegativas.length}</p></div>
        </div>
    `;
}
function cargarTodosCierres() {
    const lista = document.getElementById('listaTodosCierres');
    if (!lista) return;
    if (cierres.length === 0) { lista.innerHTML = '<p class="info-box">No hay cierres</p>'; return; }
    const cierresOrdenados = cierres.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return tb - ta;
    });
    let html = '';
    cierresOrdenados.forEach(cierre => { html += generarCierreItem(cierre); });
    lista.innerHTML = html;
}

// ========== CONTROL DE CAJA ==========
function cargarCaja() { cargarResumenCajaHoy(); cargarHistorialCajas(); }
function cargarResumenCajaHoy() {
    const contenedor = document.getElementById('resumenCajaHoy');
    if (!contenedor) return;
    const hoy = new Date().toLocaleDateString('es-ES');
    const cajaHoy = cajas.find(c => c.fecha === hoy);
    const cierresHoy = cierres.filter(c => c.fecha === hoy);
    const gastosHoy = gastos.filter(g => g.fecha === hoy);
    const cajaInicial = cajaHoy ? cajaHoy.montoInicial : 0;
    const ventasEfectivo = cierresHoy.reduce((sum, c) => sum + c.efectivo, 0);
    const ventasCredito = cierresHoy.reduce((sum, c) => sum + c.credito, 0);
    const ventasDebito = cierresHoy.reduce((sum, c) => sum + c.debito, 0);
    const retirosCierres = cierresHoy.reduce((sum, c) => sum + (c.totalRetiros || 0), 0);
    const gastosEfectivo = gastosHoy.filter(g => g.pago === 'efectivo').reduce((sum, g) => sum + g.monto, 0);
    const totalSalidas = retirosCierres + gastosEfectivo;
    const cajaEsperada = cajaInicial + ventasEfectivo - totalSalidas;
    contenedor.innerHTML = `
        <div class="caja-resumen">
            <h4>💰 Resumen del DÍA - ${hoy}</h4>
            <div class="fila"><span>Caja inicial:</span><strong>${formatearMoneda(cajaInicial)}</strong></div>
            <div class="fila"><span>💵 Ventas efectivo:</span><strong>+${formatearMoneda(ventasEfectivo)}</strong></div>
            <div class="fila"><span>💳 Crédito:</span><strong>${formatearMoneda(ventasCredito)}</strong></div>
            <div class="fila"><span>💳 Débito:</span><strong>${formatearMoneda(ventasDebito)}</strong></div>
            <div class="fila"><span>💸 Retiros:</span><strong>-${formatearMoneda(retirosCierres)}</strong></div>
            <div class="fila"><span>💸 Gastos efectivo:</span><strong>-${formatearMoneda(gastosEfectivo)}</strong></div>
            <div class="fila"><span>💰 Caja esperada:</span><strong>${formatearMoneda(cajaEsperada)}</strong></div>
        </div>
        ${!cajaHoy ? '<p class="info-box">⚠️ No hay caja inicial</p>' : ''}
    `;
}
async function guardarCajaInicial() {
    const monto = parseFloat(document.getElementById('cajaInicialMonto').value);
    const notas = document.getElementById('cajaInicialNotas').value;
    if (isNaN(monto) || monto < 0) { alert('Monto válido'); return; }
    const hoy = new Date().toLocaleDateString('es-ES');
    const existe = cajas.find(c => c.fecha === hoy);
    if (existe && !confirm('¿Reemplazar caja inicial de hoy?')) return;
    try {
        if (existe) await db.collection('cajas').doc(existe.id).update({ montoInicial: monto, notas });
        else await db.collection('cajas').add({
            fecha: hoy, montoInicial: monto, notas: notas || '',
            timestamp: new Date(), registradaPor: empleadoActual ? empleadoActual.nombre : 'Admin'
        });
        document.getElementById('cajaInicialMonto').value = '';
        document.getElementById('cajaInicialNotas').value = '';
        await cargarDatosIniciales();
        cargarCaja();
        alert('✅ Caja inicial guardada');
    } catch (error) { console.error('Error:', error); }
}
function calcularCierreCaja() {
    const contenedor = document.getElementById('resumenCierreCaja');
    if (!contenedor) return;
    const efectivoFisico = parsearNumeroArgentino(document.getElementById('cajaFinalEfectivo').value) || 0;
    if (modoActual === 'empleado') { contenedor.innerHTML = ''; return; }
    const hoy = new Date().toLocaleDateString('es-ES');
    const cajaHoy = cajas.find(c => c.fecha === hoy);
    const cierresHoy = cierres.filter(c => c.fecha === hoy);
    const cajaInicial = cajaHoy ? cajaHoy.montoInicial : 0;
    const ventasEfectivo = cierresHoy.reduce((sum, c) => sum + c.efectivo, 0);
    const retirosCierres = cierresHoy.reduce((sum, c) => sum + (c.totalRetiros || 0), 0);
    const gastosHoy = gastos.filter(g => g.fecha === hoy && g.pago === 'efectivo');
    const gastosEfectivo = gastosHoy.reduce((sum, g) => sum + g.monto, 0);
    const cajaEsperada = cajaInicial + ventasEfectivo - retirosCierres - gastosEfectivo;
    const diferencia = efectivoFisico - cajaEsperada;
    const difClase = diferencia === 0 ? 'neutro' : diferencia > 0 ? 'positivo' : 'negativo';
    const difTexto = diferencia === 0 ? '✅ Cuadra perfecto' : diferencia > 0 ? `+${formatearMoneda(diferencia)} (Sobra)` : `-${formatearMoneda(Math.abs(diferencia))} (Falta)`;
    contenedor.innerHTML = `
        <div class="total-box ${difClase}" style="margin-top: 15px;">
            <p><strong>Caja esperada:</strong> ${formatearMoneda(cajaEsperada)}</p>
            <p><strong>Efectivo físico:</strong> ${formatearMoneda(efectivoFisico)}</p>
            <p><strong>Diferencia:</strong> ${difTexto}</p>
        </div>
    `;
}
async function guardarCierreCaja() {
    const efectivoFisico = parseFloat(document.getElementById('cajaFinalEfectivo').value);
    const motivo = document.getElementById('cajaMotivoDiferencia').value;
    if (isNaN(efectivoFisico)) { alert('Ingresá el efectivo'); return; }
    const hoy = new Date().toLocaleDateString('es-ES');
    const cajaHoy = cajas.find(c => c.fecha === hoy);
    const cierresHoy = cierres.filter(c => c.fecha === hoy);
    const cajaInicial = cajaHoy ? cajaHoy.montoInicial : 0;
    const ventasEfectivo = cierresHoy.reduce((sum, c) => sum + c.efectivo, 0);
    const retirosCierres = cierresHoy.reduce((sum, c) => sum + (c.totalRetiros || 0), 0);
    const gastosHoy = gastos.filter(g => g.fecha === hoy && g.pago === 'efectivo');
    const gastosEfectivo = gastosHoy.reduce((sum, g) => sum + g.monto, 0);
    const cajaEsperada = cajaInicial + ventasEfectivo - retirosCierres - gastosEfectivo;
    const diferencia = efectivoFisico - cajaEsperada;
    try {
        if (cajaHoy) {
            await db.collection('cajas').doc(cajaHoy.id).update({
                cierre: { efectivoFisico, cajaEsperada, diferencia, motivo: motivo || '', hora: new Date().toLocaleTimeString('es-ES'), cerradoPor: empleadoActual ? empleadoActual.nombre : 'Admin' }
            });
        } else {
            await db.collection('cajas').add({
                fecha: hoy, montoInicial: 0, notas: '', timestamp: new Date(), registradaPor: 'Sin registro',
                cierre: { efectivoFisico, cajaEsperada, diferencia, motivo: motivo || '', hora: new Date().toLocaleTimeString('es-ES'), cerradoPor: empleadoActual ? empleadoActual.nombre : 'Admin' }
            });
        }
        document.getElementById('cajaFinalEfectivo').value = '';
        document.getElementById('cajaMotivoDiferencia').value = '';
        document.getElementById('resumenCierreCaja').innerHTML = '';
        await cargarDatosIniciales();
        cargarCaja();
        alert('✅ Caja cerrada');
    } catch (error) { console.error('Error:', error); }
}
function cargarHistorialCajas() {
    const lista = document.getElementById('listaHistorialCaja');
    if (!lista) return;
    if (cajas.length === 0) { lista.innerHTML = '<p class="info-box">No hay registros</p>'; return; }
    const cajasOrdenadas = cajas.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return tb - ta;
    });
    let html = '';
    cajasOrdenadas.slice(0, 15).forEach(caja => {
        const difClase = !caja.cierre ? '' : caja.cierre.diferencia === 0 ? 'positivo' : caja.cierre.diferencia > 0 ? 'neutro' : 'negativo';
        html += `
            <div class="caja-item">
                <h4>📅 ${caja.fecha}</h4>
                <div class="detalle">
                    <p>💵 Caja inicial: <strong>${formatearMoneda(caja.montoInicial)}</strong></p>
                    ${caja.cierre ? `<p>💰 Efectivo final: <strong>${formatearMoneda(caja.cierre.efectivoFisico)}</strong></p>` : ''}
                    ${caja.cierre ? `<p>📊 Esperada: <strong>${formatearMoneda(caja.cierre.cajaEsperada)}</strong></p>` : ''}
                    ${caja.cierre ? `<p class="${difClase}"><strong>Diferencia: ${formatearMoneda(caja.cierre.diferencia)}</strong></p>` : '<p style="color: #ffa502;">⚠️ Sin cerrar</p>'}
                </div>
                ${caja.cierre && caja.cierre.motivo ? `<p style="margin-top: 10px; font-style: italic; color: #666;">📝 ${caja.cierre.motivo}</p>` : ''}
                ${caja.cierre ? `<p style="font-size: 12px; color: #999; margin-top: 5px;">Por ${caja.cierre.cerradoPor} a las ${caja.cierre.hora}</p>` : ''}
            </div>
        `;
    });
    lista.innerHTML = html;
}

// ========== GASTOS ==========
function cargarGastos() {
    cargarListaGastos(); cargarFiltroMeses();
    document.getElementById('gastoFecha').value = new Date().toISOString().split('T')[0];
}
function cargarFiltroMeses() {
    const select = document.getElementById('filtroGastoMes');
    const meses = [...new Set(gastos.map(g => g.fecha.substring(0, 7)))].sort().reverse();
    select.innerHTML = '<option value="todos">Todos los meses</option>';
    meses.forEach(mes => {
        const [año, m] = mes.split('-');
        const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        select.innerHTML += `<option value="${mes}">${nombresMeses[parseInt(m) - 1]} ${año}</option>`;
    });
}
function cargarListaGastos() {
    const lista = document.getElementById('listaGastos');
    if (!lista) return;
    const filtroMes = document.getElementById('filtroGastoMes').value;
    const filtroCategoria = document.getElementById('filtroGastoCategoria').value;
    let gastosFiltrados = gastos;
    if (filtroMes !== 'todos') gastosFiltrados = gastosFiltrados.filter(g => g.fecha.startsWith(filtroMes));
    if (filtroCategoria !== 'todas') gastosFiltrados = gastosFiltrados.filter(g => g.categoria === filtroCategoria);
    if (gastosFiltrados.length === 0) { lista.innerHTML = '<p class="info-box">No hay gastos</p>'; return; }
    const gastosOrdenados = gastosFiltrados.sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(a.fecha);
        const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(b.fecha);
        return tb - ta;
    });
    const total = gastosOrdenados.reduce((sum, g) => sum + g.monto, 0);
    let html = `<div class="total-box"><strong>Total: ${formatearMoneda(total)}</strong></div>`;
    gastosOrdenados.forEach(gasto => {
        const pagos = { 'efectivo': '💵 Efectivo', 'transferencia': '🏦 Transferencia', 'tarjeta-credito': '💳 Crédito', 'tarjeta-debito': '💳 Débito', 'cheque': '📄 Cheque' };
        html += `
            <div class="gasto-item">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <span class="categoria-tag">${CATEGORIAS_GASTOS[gasto.categoria] || gasto.categoria}</span>
                        <span style="font-size: 12px; color: #999;">${gasto.fecha}</span>
                    </div>
                    <button class="btn-danger" onclick="eliminarGasto('${gasto.id}')">❌</button>
                </div>
                <h4>${gasto.descripcion || 'Sin descripción'}</h4>
                <p class="monto">${formatearMoneda(gasto.monto)}</p>
                <p style="font-size: 13px; color: #666;">💳 ${pagos[gasto.pago] || gasto.pago}</p>
            </div>
        `;
    });
    lista.innerHTML = html;
}
async function guardarGasto() {
    const categoria = document.getElementById('gastoCategoria').value;
    const fecha = document.getElementById('gastoFecha').value;
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    const descripcion = document.getElementById('gastoDescripcion').value;
    const pago = document.getElementById('gastoPago').value;
    if (!fecha || isNaN(monto) || monto <= 0) { alert('Completá fecha y monto'); return; }
    try {
        await db.collection('gastos').add({
            categoria, fecha, monto, descripcion: descripcion || '', pago,
            registradoPor: empleadoActual ? empleadoActual.nombre : 'Admin',
            timestamp: new Date()
        });
        document.getElementById('gastoMonto').value = '';
        document.getElementById('gastoDescripcion').value = '';
        await cargarDatosIniciales();
        cargarGastos();
        alert('✅ Gasto registrado');
    } catch (error) { console.error('Error:', error); }
}
async function eliminarGasto(id) {
    if (confirm('¿Eliminar este gasto?')) {
        try {
            await db.collection('gastos').doc(id).delete();
            await cargarDatosIniciales();
            cargarGastos();
        } catch (error) { console.error('Error:', error); }
    }
}

// ========== FINANZAS ==========
function cargarFinanzas() {
    const periodo = document.getElementById('filtroFinanzasPeriodo').value;
    let fechaInicio, fechaFin;
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (periodo === 'dia') { fechaInicio = new Date(); fechaInicio.setHours(0, 0, 0, 0); fechaFin = hoy; }
    else if (periodo === 'semana') { fechaInicio = new Date(); fechaInicio.setDate(hoy.getDate() - 7); fechaInicio.setHours(0, 0, 0, 0); fechaFin = hoy; }
    else if (periodo === 'mes') { fechaInicio = new Date(); fechaInicio.setDate(1); fechaInicio.setHours(0, 0, 0, 0); fechaFin = hoy; }
    else {
        const inicioStr = document.getElementById('filtroFechaInicio').value;
        const finStr = document.getElementById('filtroFechaFin').value;
        if (!inicioStr || !finStr) {
            document.getElementById('finanzasIngresos').textContent = '$0';
            document.getElementById('finanzasGastos').textContent = '$0';
            document.getElementById('finanzasGanancia').textContent = '$0';
            return;
        }
        fechaInicio = new Date(inicioStr); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(finStr); fechaFin.setHours(23, 59, 59, 999);
    }
    const cierresPeriodo = cierres.filter(c => { const f = new Date(c.timestamp); return f >= fechaInicio && f <= fechaFin; });
    const gastosPeriodo = gastos.filter(g => { const f = new Date(g.fecha); return f >= fechaInicio && f <= fechaFin; });
    const totalIngresos = cierresPeriodo.reduce((sum, c) => sum + c.totalVentas, 0);
    const totalGastos = gastosPeriodo.reduce((sum, g) => sum + g.monto, 0);
    const ganancia = totalIngresos - totalGastos;
    const totalEfectivo = cierresPeriodo.reduce((sum, c) => sum + c.efectivo, 0);
    const totalCredito = cierresPeriodo.reduce((sum, c) => sum + c.credito, 0);
    const totalDebito = cierresPeriodo.reduce((sum, c) => sum + c.debito, 0);
    document.getElementById('finanzasIngresos').textContent = formatearMoneda(totalIngresos);
    document.getElementById('finanzasIngresosDetalle').textContent = `${cierresPeriodo.length} cierres`;
    document.getElementById('finanzasGastos').textContent = formatearMoneda(totalGastos);
    document.getElementById('finanzasGastosDetalle').textContent = `${gastosPeriodo.length} gastos`;
    document.getElementById('finanzasGanancia').textContent = formatearMoneda(ganancia);
    document.getElementById('finanzasGananciaDetalle').textContent = ganancia >= 0 ? '📈 Positiva' : '📉 Negativa';
    const maxIngreso = Math.max(totalEfectivo, totalCredito, totalDebito, 1);
    document.getElementById('desgloseIngresos').innerHTML = `
        <div class="desglose-item"><span>💵 Efectivo</span><div class="barra"><div class="barra-relleno" style="width: ${(totalEfectivo / maxIngreso) * 100}%"></div></div><strong>${formatearMoneda(totalEfectivo)}</strong></div>
        <div class="desglose-item"><span>💳 Crédito</span><div class="barra"><div class="barra-relleno" style="width: ${(totalCredito / maxIngreso) * 100}%"></div></div><strong>${formatearMoneda(totalCredito)}</strong></div>
        <div class="desglose-item"><span>💳 Débito</span><div class="barra"><div class="barra-relleno" style="width: ${(totalDebito / maxIngreso) * 100}%"></div></div><strong>${formatearMoneda(totalDebito)}</strong></div>
    `;
    const gastosPorCategoria = {};
    gastosPeriodo.forEach(g => {
        if (!gastosPorCategoria[g.categoria]) gastosPorCategoria[g.categoria] = 0;
        gastosPorCategoria[g.categoria] += g.monto;
    });
    const maxGasto = Math.max(...Object.values(gastosPorCategoria), 1);
    let gastosHtml = '';
    Object.keys(gastosPorCategoria).sort((a, b) => gastosPorCategoria[b] - gastosPorCategoria[a]).forEach(cat => {
        gastosHtml += `
            <div class="desglose-item">
                <span>${CATEGORIAS_GASTOS[cat] || cat}</span>
                <div class="barra"><div class="barra-relleno" style="width: ${(gastosPorCategoria[cat] / maxGasto) * 100}%; background: linear-gradient(135deg, #ff4757 0%, #c44569 100%);"></div></div>
                <strong>${formatearMoneda(gastosPorCategoria[cat])}</strong>
            </div>
        `;
    });
    document.getElementById('desgloseGastos').innerHTML = gastosHtml || '<p class="info-box">No hay gastos</p>';
    cargarReporteDescuentos();
    cargarProductosRentables();
}
function cargarReporteDescuentos() {
    const totalDescuentos = productos.reduce((sum, prod) => {
        const descuento = prod.descuento || 0;
        const stockActual = stock[prod.id] || 0;
        return sum + (descuento * stockActual);
    }, 0);
    const productosConDescuento = productos.filter(p => p.descuento && p.descuento > 0);
    let contenedor = document.getElementById('reporteDescuentos');
    if (!contenedor) {
        const seccionDesgloseGastos = document.getElementById('seccionDesgloseGastos');
        if (!seccionDesgloseGastos) return;
        const nuevaSeccion = document.createElement('div');
        nuevaSeccion.className = 'seccion-colapsable';
        nuevaSeccion.innerHTML = `
            <div class="seccion-header" onclick="toggleSeccion('seccionReporteDescuentos')">
                <h3>🏷️ Reporte de Descuentos</h3>
                <span class="toggle-icon" id="icon-seccionReporteDescuentos">▶</span>
            </div>
            <div class="seccion-contenido" id="seccionReporteDescuentos" style="display:none;">
                <div id="reporteDescuentos"></div>
            </div>
        `;
        seccionDesgloseGastos.parentNode.insertBefore(nuevaSeccion, seccionDesgloseGastos.nextSibling);
        contenedor = document.getElementById('reporteDescuentos');
    }
    if (productosConDescuento.length === 0) {
        contenedor.innerHTML = '<p class="info-box">No hay descuentos activos</p>';
        return;
    }
    let html = `
        <div class="total-box" style="background: #fff3cd; border-left-color: #ffc107;">
            <p><strong>🏷️ Total descuentos:</strong> ${formatearMoneda(totalDescuentos)}</p>
            <p><strong>📦 Productos:</strong> ${productosConDescuento.length}</p>
        </div>
    `;
    html += '<h4 style="margin: 15px 0 10px 0;">Detalle:</h4>';
    productosConDescuento.forEach(prod => {
        const precioFinal = (prod.precio || 0) - prod.descuento;
        html += `
            <div class="desglose-item">
                <span style="flex: 1;">${prod.nombre}</span>
                <span style="margin-right: 15px; color: #ff4757;">-${formatearMoneda(prod.descuento)}/u</span>
                <strong style="color: #2ed573;">Final: ${formatearMoneda(precioFinal)}</strong>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}
function cargarProductosRentables() {
    const contenedor = document.getElementById('productosRentables');
    if (!contenedor) return;
    const productosConMargen = productos
        .filter(p => p.costo && p.precio && p.costo > 0 && p.precio > 0)
        .map(p => ({
            nombre: p.nombre, costo: p.costo, precio: p.precio,
            margen: p.precio - p.costo,
            porcentaje: ((p.precio - p.costo) / p.precio) * 100
        }))
        .sort((a, b) => b.margen - a.margen)
        .slice(0, 10);
    if (productosConMargen.length === 0) {
        contenedor.innerHTML = '<p class="info-box">Agregá costo y precio en ⚙️ Gestión</p>';
        return;
    }
    let html = '';
    productosConMargen.forEach((p, i) => {
        html += `
            <div class="producto-rentable">
                <div class="ranking">#${i + 1}</div>
                <div class="info">
                    <h4>${p.nombre}</h4>
                    <p style="font-size: 12px; color: #666;">Costo: ${formatearMoneda(p.costo)} | Venta: ${formatearMoneda(p.precio)}</p>
                </div>
                <div style="text-align: right;">
                    <div class="ganancia">+${formatearMoneda(p.margen)}</div>
                    <div style="font-size: 12px; color: #666;">${p.porcentaje.toFixed(0)}%</div>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

// ========== EXPORTAR ==========
function exportarFinanzasPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const periodo = document.getElementById('filtroFinanzasPeriodo').value;
    const fecha = new Date().toLocaleDateString('es-ES');
    doc.setFontSize(18);
    doc.text('Reporte Financiero', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado: ${fecha} - Período: ${periodo}`, 14, 28);
    const datos = obtenerDatosFinanzas();
    doc.setFontSize(12);
    doc.text('RESUMEN', 14, 45);
    doc.setFontSize(10);
    doc.text(`Ingresos: $${datos.totalIngresos.toFixed(2)}`, 14, 55);
    doc.text(`Gastos: $${datos.totalGastos.toFixed(2)}`, 14, 62);
    doc.text(`Ganancia: $${datos.ganancia.toFixed(2)}`, 14, 69);
    doc.save(`reporte-financiero-${fecha.replace(/\//g, '-')}.pdf`);
}
function exportarFinanzasExcel() {
    const datos = obtenerDatosFinanzas();
    const wb = XLSX.utils.book_new();
    const resumenData = [
        ['Reporte Financiero'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
        [],
        ['RESUMEN'],
        ['Ingresos', datos.totalIngresos],
        ['Gastos', datos.totalGastos],
        ['Ganancia', datos.ganancia]
    ];
    const ws = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    XLSX.writeFile(wb, `reporte-financiero-${fecha}.xlsx`);
}
function obtenerDatosFinanzas() {
    const periodo = document.getElementById('filtroFinanzasPeriodo').value;
    let fechaInicio, fechaFin;
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (periodo === 'dia') { fechaInicio = new Date(); fechaInicio.setHours(0, 0, 0, 0); fechaFin = hoy; }
    else if (periodo === 'semana') { fechaInicio = new Date(); fechaInicio.setDate(hoy.getDate() - 7); fechaInicio.setHours(0, 0, 0, 0); fechaFin = hoy; }
    else if (periodo === 'mes') { fechaInicio = new Date(); fechaInicio.setDate(1); fechaInicio.setHours(0, 0, 0, 0); fechaFin = hoy; }
    else {
        const inicioStr = document.getElementById('filtroFechaInicio').value;
        const finStr = document.getElementById('filtroFechaFin').value;
        fechaInicio = new Date(inicioStr); fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(finStr); fechaFin.setHours(23, 59, 59, 999);
    }
    const cierresPeriodo = cierres.filter(c => { const f = new Date(c.timestamp); return f >= fechaInicio && f <= fechaFin; });
    const gastosPeriodo = gastos.filter(g => { const f = new Date(g.fecha); return f >= fechaInicio && f <= fechaFin; });
    const gastosPorCategoria = {};
    gastosPeriodo.forEach(g => {
        if (!gastosPorCategoria[g.categoria]) gastosPorCategoria[g.categoria] = 0;
        gastosPorCategoria[g.categoria] += g.monto;
    });
    return {
        totalIngresos: cierresPeriodo.reduce((sum, c) => sum + c.totalVentas, 0),
        totalGastos: gastosPeriodo.reduce((sum, g) => sum + g.monto, 0),
        ganancia: cierresPeriodo.reduce((sum, c) => sum + c.totalVentas, 0) - gastosPeriodo.reduce((sum, g) => sum + g.monto, 0),
        totalEfectivo: cierresPeriodo.reduce((sum, c) => sum + c.efectivo, 0),
        totalCredito: cierresPeriodo.reduce((sum, c) => sum + c.credito, 0),
        totalDebito: cierresPeriodo.reduce((sum, c) => sum + c.debito, 0),
        gastosPorCategoria, cierres: cierresPeriodo, gastos: gastosPeriodo
    };
}

// ========== CONTEO ==========
function cargarConteo() {
    const contenedor = document.getElementById('contenedorConteo');
    if (productos.length === 0) { 
        contenedor.innerHTML = '<p class="info-box">No hay productos</p>'; 
        actualizarBarraProgreso();
        return; 
    }
    let html = '';
    const productosPorCategoria = {};
    Object.keys(CATEGORIAS).forEach(cat => { productosPorCategoria[cat] = []; });
    productos.forEach(prod => {
        const categoria = prod.categoria || 'otros';
        if (!productosPorCategoria[categoria]) productosPorCategoria[categoria] = [];
        productosPorCategoria[categoria].push(prod);
    });
    Object.keys(CATEGORIAS).forEach(cat => {
        if (productosPorCategoria[cat].length > 0) {
            html += `
                <div class="categoria-grupo">
                    <div class="categoria-header" onclick="toggleCategoria('${cat}')">
                        <span>${CATEGORIAS[cat]} <span class="categoria-contador">${productosPorCategoria[cat].length}</span></span>
                        <span id="icon-categoria-${cat}">▶</span>
                    </div>
                    <div class="categoria-contenido" id="categoria-${cat}" style="display:none;">
            `;
            productosPorCategoria[cat].forEach(prod => {
                const stockActual = stock[prod.id] || 0;
                html += `
                    <div class="conteo-item sin-revisar" id="conteo-item-${prod.id}" data-nombre="${prod.nombre.toLowerCase()}">
                        <div class="conteo-item-header">
                            <input type="checkbox" class="checkbox-revisado" id="check-${prod.id}" onchange="toggleRevisado('${prod.id}')" title="Marcar como revisado">
                            <div class="conteo-info">
                                <h4>${prod.nombre}</h4>
                                <p class="stock-actual">Stock actual: ${stockActual}</p>
                            </div>
                            <span class="badge-estado sin-revisar" id="badge-${prod.id}">Sin revisar</span>
                        </div>
                        <div class="conteo-item-inputs">
                            <input type="number" class="conteo-input" id="conteo-${prod.id}" placeholder="${stockActual}" min="0" step="0.01"
                                   oninput="onCambioCantidad('${prod.id}', ${stockActual})">
                            <div style="display:flex;gap:8px;align-items:center;width:100%;">
                                <input type="text" class="nota-conteo" id="nota-${prod.id}" value="${String(notasConteo[prod.id] || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" placeholder="📝 Nota permanente (ej: 1 cerrada + 1 abierta mitad)" maxlength="200" style="flex:1;">
                                <button type="button" class="btn-danger" onclick="borrarNotaConteo('${prod.id}')" title="Borrar nota" style="padding:8px 10px;">🗑️</button>
                            </div>
                            ${notasConteo[prod.id] ? `<p style="width:100%;margin:4px 0 0;color:#666;font-size:12px;">📌 Nota guardada: ${String(notasConteo[prod.id]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    });
    contenedor.innerHTML = html;
    actualizarBarraProgreso();
}

function onCambioCantidad(prodId, stockActual) {
    const input = document.getElementById(`conteo-${prodId}`);
    const valor = input.value.trim();
    const item = document.getElementById(`conteo-item-${prodId}`);
    const badge = document.getElementById(`badge-${prodId}`);
    const checkbox = document.getElementById(`check-${prodId}`);
    if (valor !== '' && parseFloat(valor) !== stockActual) {
        item.classList.remove('sin-revisar');
        item.classList.add('revisado');
        badge.classList.remove('sin-revisar');
        badge.classList.add('revisado');
        badge.textContent = '✅ Modificado';
        input.classList.add('modificado');
        checkbox.checked = true;
    } else if (valor === '' || parseFloat(valor) === stockActual) {
        if (checkbox.checked) {
            item.classList.remove('sin-revisar');
            item.classList.add('revisado');
            badge.classList.remove('sin-revisar');
            badge.classList.add('revisado');
            badge.textContent = '✅ Revisado';
        } else {
            item.classList.remove('revisado');
            item.classList.add('sin-revisar');
            badge.classList.remove('revisado');
            badge.classList.add('sin-revisar');
            badge.textContent = 'Sin revisar';
        }
        input.classList.remove('modificado');
    }
    actualizarBarraProgreso();
}

function toggleRevisado(prodId) {
    const checkbox = document.getElementById(`check-${prodId}`);
    const item = document.getElementById(`conteo-item-${prodId}`);
    const badge = document.getElementById(`badge-${prodId}`);
    const input = document.getElementById(`conteo-${prodId}`);
    const stockActual = stock[prodId] || 0;
    const valor = input.value.trim();
    if (checkbox.checked) {
        item.classList.remove('sin-revisar');
        item.classList.add('revisado');
        badge.classList.remove('sin-revisar');
        badge.classList.add('revisado');
        if (valor !== '' && parseFloat(valor) !== stockActual) badge.textContent = '✅ Modificado';
        else badge.textContent = '✅ Revisado';
    } else {
        item.classList.remove('revisado');
        item.classList.add('sin-revisar');
        badge.classList.remove('revisado');
        badge.classList.add('sin-revisar');
        badge.textContent = 'Sin revisar';
    }
    actualizarBarraProgreso();
}

function marcarTodosRevisados() {
    productos.forEach(prod => {
        const checkbox = document.getElementById(`check-${prod.id}`);
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            toggleRevisado(prod.id);
        }
    });
}

function desmarcarTodos() {
    if (!confirm('¿Reiniciar todas las marcas?')) return;
    productos.forEach(prod => {
        const checkbox = document.getElementById(`check-${prod.id}`);
        const input = document.getElementById(`conteo-${prod.id}`);
        const nota = document.getElementById(`nota-${prod.id}`);
        if (checkbox) {
            checkbox.checked = false;
            toggleRevisado(prod.id);
        }
        if (input) { input.value = ''; input.classList.remove('modificado'); }
        if (nota) nota.value = '';
    });
}

function actualizarBarraProgreso() {
    const total = productos.length;
    if (total === 0) return;
    let revisados = 0;
    productos.forEach(prod => {
        const checkbox = document.getElementById(`check-${prod.id}`);
        if (checkbox && checkbox.checked) revisados++;
    });
    const porcentaje = Math.round((revisados / total) * 100);
    const texto = document.getElementById('progresoTexto');
    const porcentajeEl = document.getElementById('progresoPorcentaje');
    const relleno = document.getElementById('progresoRelleno');
    const aviso = document.getElementById('avisoSinRevisar');
    if (texto) texto.textContent = `${revisados} de ${total} revisados`;
    if (porcentajeEl) porcentajeEl.textContent = `${porcentaje}%`;
    if (relleno) {
        relleno.style.width = `${porcentaje}%`;
        if (porcentaje === 100) relleno.classList.remove('incompleto');
        else relleno.classList.add('incompleto');
    }
    if (aviso) {
        const sinRevisar = total - revisados;
        if (sinRevisar > 0) {
            aviso.style.display = 'block';
            aviso.innerHTML = `⚠️ <strong>${sinRevisar} producto(s) sin revisar.</strong> Mantendrán su stock actual.`;
        } else {
            aviso.style.display = 'none';
        }
    }
}

async function guardarConteo() {
    const conteo = {};
    const notasActualizadas = { ...notasConteo };
    let productosModificados = 0;
    let productosRevisados = 0;
    let productosSinRevisar = 0;
    let productosNoRevisados = [];

    productos.forEach(prod => {
        const input = document.getElementById(`conteo-${prod.id}`);
        const nota = document.getElementById(`nota-${prod.id}`);
        const checkbox = document.getElementById(`check-${prod.id}`);
        if (!input || !checkbox) return;

        const valor = input.value.trim();
        const notaValor = nota ? nota.value.trim() : '';
        const stockActual = stock[prod.id] || 0;
        const revisado = checkbox.checked;

        if (revisado) {
            productosRevisados++;

            if (valor !== '' && !isNaN(parseFloat(valor))) {
                const nuevoValor = parseFloat(valor);
                if (nuevoValor !== stockActual) {
                    conteo[prod.id] = nuevoValor;
                    productosModificados++;
                }
            }

            if (notaValor !== '') notasActualizadas[prod.id] = notaValor;
            else if (Object.prototype.hasOwnProperty.call(notasActualizadas, prod.id)) delete notasActualizadas[prod.id];
        } else {
            productosSinRevisar++;
            productosNoRevisados.push(prod.nombre);
        }
    });

    if (productosRevisados === 0) {
        alert('⚠️ No marcaste ningún producto como revisado.');
        return;
    }

    if (productosSinRevisar > 0) {
        const confirmar = confirm(
            `⚠️ Hay ${productosSinRevisar} producto(s) sin revisar.\\n\\n` +
            `${productosNoRevisados.slice(0, 5).join('\\n')}` +
            `${productosNoRevisados.length > 5 ? '\\n...' : ''}\\n\\n` +
            `Estos productos MANTENDRÁN su stock actual.\\n\\n¿Guardar igual?`
        );
        if (!confirmar) return;
    }

    const notasCambiaron = JSON.stringify(notasActualizadas) !== JSON.stringify(notasConteo);
    if (productosModificados === 0 && !notasCambiaron) {
        const confirmar = confirm(`ℹ️ Revisaste ${productosRevisados} producto(s) pero no cambió el stock ni las notas.\\n\\n¿Guardar igual?`);
        if (!confirmar) return;
    }

    try {
        await db.collection('historialConteos').add({
            fecha: new Date().toLocaleString('es-ES'),
            timestamp: new Date(),
            empleado: empleadoActual ? empleadoActual.nombre : 'Admin',
            conteo: conteo,
            notas: Object.fromEntries(Object.keys(notasActualizadas).map(id => [id, notasActualizadas[id]])),
            parcial: true,
            productosRevisados,
            productosModificados,
            productosSinRevisar
        });

        Object.keys(conteo).forEach(prodId => { stock[prodId] = conteo[prodId]; });
        notasConteo = notasActualizadas;

        await db.collection('config').doc('stock').set({ data: stock });
        await db.collection('config').doc('notasConteo').set({ data: notasConteo });

        let mensaje = '✅ Conteo guardado\n\n';
        mensaje += `📊 Revisados: ${productosRevisados}\n`;
        mensaje += `✏️ Modificados: ${productosModificados}\n`;
        mensaje += `⚠️ Sin revisar: ${productosSinRevisar}\n`;
        mensaje += `📝 Notas permanentes activas: ${Object.keys(notasConteo).length}`;
        alert(mensaje);

        await cargarDatosIniciales();
        cargarConteo();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar');
    }
}

function borrarNotaConteo(prodId) {
    const input = document.getElementById(`nota-${prodId}`);
    if (!input) return;
    if (!confirm('¿Borrar la nota permanente de este producto?')) return;
    input.value = '';
    mostrarToast('🗑️ Nota marcada para borrar. Guardá el conteo para confirmar.', 'alerta', 3500);
}

function filtrarConteo() {
    const busqueda = document.getElementById('buscarProductoConteo').value.toLowerCase();
    const items = document.querySelectorAll('#contenedorConteo .conteo-item');
    items.forEach(item => {
        const nombre = item.dataset.nombre;
        item.style.display = nombre.includes(busqueda) ? 'block' : 'none';
    });
}

// ========== DASHBOARD ==========
function cargarDashboard() {
    const dashboardStock = document.getElementById('dashboardStock');
    const dashboardVendido = document.getElementById('dashboardVendido');
    const dashboardTareas = document.getElementById('dashboardTareas');
    const productosPorCategoria = {};
    Object.keys(CATEGORIAS).forEach(cat => { productosPorCategoria[cat] = []; });
    productos.forEach(prod => {
        const categoria = prod.categoria || 'otros';
        if (!productosPorCategoria[categoria]) productosPorCategoria[categoria] = [];
        productosPorCategoria[categoria].push(prod);
    });
    let stockHtml = '';
    Object.keys(CATEGORIAS).forEach(cat => {
        if (productosPorCategoria[cat].length > 0) {
            stockHtml += `
                <div class="categoria-grupo" style="margin: 10px 0;">
                    <div class="categoria-header" onclick="toggleCategoria('dash-stock-${cat}')" style="background: rgba(255,255,255,0.2); color: white;">
                        <span>${CATEGORIAS[cat]} <span class="categoria-contador">${productosPorCategoria[cat].length}</span></span>
                        <span id="icon-categoria-dash-stock-${cat}" style="color: white;">▶</span>
                    </div>
                    <div class="categoria-contenido" id="categoria-dash-stock-${cat}" style="display:none; background: rgba(255,255,255,0.1);">
            `;
            productosPorCategoria[cat].forEach(prod => {
                const cantidad = stock[prod.id] || 0;
                stockHtml += `<p class="dash-prod-item" data-nombre="${prod.nombre.toLowerCase()}" style="margin: 5px 0; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><strong>${prod.nombre}:</strong> ${cantidad} unidades</p>`;
            });
            stockHtml += `</div></div>`;
        }
    });
    dashboardStock.innerHTML = stockHtml || '<p>Sin productos</p>';
    let vendidoHtml = '';
    if (historialConteos.length >= 2) {
        const conteosOrdenados = historialConteos.sort((a, b) => {
            const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
            const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
            return tb - ta;
        });
        const ultimo = conteosOrdenados[0].conteo;
        const anterior = conteosOrdenados[1].conteo;
        const vendidosPorCategoria = {};
        Object.keys(CATEGORIAS).forEach(cat => { vendidosPorCategoria[cat] = []; });
        productos.forEach(prod => {
            const actual = ultimo[prod.id] || 0;
            const previo = anterior[prod.id] || 0;
            const vendido = previo - actual;
            const categoria = prod.categoria || 'otros';
            vendidosPorCategoria[categoria].push({ nombre: prod.nombre, vendido });
        });
        Object.keys(CATEGORIAS).forEach(cat => {
            const productosCategoria = vendidosPorCategoria[cat].filter(p => p.vendido !== 0);
            if (productosCategoria.length > 0) {
                vendidoHtml += `
                    <div class="categoria-grupo" style="margin: 10px 0;">
                        <div class="categoria-header" onclick="toggleCategoria('dash-vend-${cat}')" style="background: rgba(255,255,255,0.2); color: white;">
                            <span>${CATEGORIAS[cat]} <span class="categoria-contador">${productosCategoria.length}</span></span>
                            <span id="icon-categoria-dash-vend-${cat}" style="color: white;">▶</span>
                        </div>
                        <div class="categoria-contenido" id="categoria-dash-vend-${cat}" style="display:none; background: rgba(255,255,255,0.1);">
                `;
                productosCategoria.forEach(item => {
                    const icono = item.vendido > 0 ? '🟢' : item.vendido === 0 ? '🟡' : '🔵';
                    const texto = item.vendido > 0 ? `${item.vendido} vendidos` : item.vendido === 0 ? '0 vendidos' : `${Math.abs(item.vendido)} agregados`;
                    vendidoHtml += `<p class="dash-prod-item" data-nombre="${item.nombre.toLowerCase()}" style="margin: 5px 0; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><strong>${item.nombre}:</strong> ${texto} ${icono}</p>`;
                });
                vendidoHtml += `</div></div>`;
            }
        });
        if (vendidoHtml === '') vendidoHtml = '<p>No hay diferencias</p>';
    } else {
        vendidoHtml = '<p>Se necesitan al menos 2 conteos</p>';
    }
    dashboardVendido.innerHTML = vendidoHtml;
    const hoy = new Date().toDateString();
    const tareasHoy = Object.keys(tareasCompletadas).filter(clave => clave.startsWith(hoy));
    dashboardTareas.innerHTML = `<p><strong>Completadas:</strong> ${tareasHoy.length} / ${tareas.length}</p><p><strong>Pendientes:</strong> ${tareas.length - tareasHoy.length}</p>`;
}
function filtrarDashboard() {
    const busqueda = document.getElementById('buscarProductoDashboard').value.toLowerCase();
    const items = document.querySelectorAll('.dash-prod-item');
    items.forEach(item => {
        const nombre = item.dataset.nombre;
        item.style.display = nombre.includes(busqueda) ? 'block' : 'none';
    });
    const categorias = document.querySelectorAll('[id^="categoria-dash-"]');
    const iconos = document.querySelectorAll('[id^="icon-categoria-dash-"]');
    if (busqueda !== '') {
        categorias.forEach(cat => { cat.style.display = 'block'; });
        iconos.forEach(icono => { icono.textContent = '▼'; });
    }
}

// ========== HISTORIAL ==========
function cargarHistorial() {
    const historialConteosDiv = document.getElementById('historialConteos');
    const historialTareasDiv = document.getElementById('historialTareas');
    if (historialConteos.length === 0) historialConteosDiv.innerHTML = '<p class="info-box">No hay conteos</p>';
    else {
        let html = '';
        const conteosOrdenados = historialConteos.sort((a, b) => {
            const ta = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
            const tb = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
            return tb - ta;
        });
        conteosOrdenados.slice(0, 15).forEach(registro => {
            const esParcial = registro.parcial ? ' (parcial)' : '';
            const infoExtra = registro.productosRevisados ? ` | ${registro.productosRevisados} revisados, ${registro.productosModificados || 0} modificados` : '';
            html += `<div class="historial-item"><strong>${registro.fecha}</strong> - ${registro.empleado}${esParcial}${infoExtra}<br>`;
            Object.keys(registro.conteo).forEach(prodId => {
                const prod = productos.find(p => p.id === prodId);
                if (prod) {
                    const nota = registro.notas && registro.notas[prodId] ? ` (Nota: ${registro.notas[prodId]})` : '';
                    html += `${prod.nombre}: ${registro.conteo[prodId]}${nota} | `;
                }
            });
            html += '</div>';
        });
        historialConteosDiv.innerHTML = html;
    }
    const tareasHoy = Object.keys(tareasCompletadas).filter(clave => clave.startsWith(new Date().toDateString()));
    if (tareasHoy.length === 0) historialTareasDiv.innerHTML = '<p class="info-box">No hay tareas hoy</p>';
    else {
        let html = '';
        tareasHoy.forEach(clave => {
            const datos = tareasCompletadas[clave];
            const tareaId = clave.split('-')[1];
            const tarea = tareas.find(t => t.id === tareaId);
            if (tarea) html += `<div class="historial-item"><strong>${tarea.titulo}</strong> - ${datos.empleado} a las ${datos.hora}</div>`;
        });
        historialTareasDiv.innerHTML = html;
    }
}

// ========== GESTIÓN ==========
function cargarGestion() { 
    cargarListaProductos(); 
    cargarListaEmpleados(); 
    cargarListaTareas(); 
    cargarEstadoHistoriales();
    cargarTurnos();
}
function mostrarFormularioProducto() {
    document.getElementById('prodIdEditar').value = '';
    document.getElementById('prodNombre').value = '';
    document.getElementById('prodCategoria').value = 'helados';
    document.getElementById('prodCosto').value = '';
    document.getElementById('prodPrecio').value = '';
    document.getElementById('prodDescuento').value = '';
    document.getElementById('btnGuardarProducto').textContent = 'Guardar';
    document.getElementById('formularioProducto').style.display = 'block';
}
function editarProducto(id) {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    document.getElementById('prodIdEditar').value = prod.id;
    document.getElementById('prodNombre').value = prod.nombre;
    document.getElementById('prodCategoria').value = prod.categoria || 'otros';
    document.getElementById('prodCosto').value = prod.costo || '';
    document.getElementById('prodPrecio').value = prod.precio || '';
    document.getElementById('prodDescuento').value = prod.descuento || '';
    document.getElementById('btnGuardarProducto').textContent = '💾 Actualizar';
    document.getElementById('formularioProducto').style.display = 'block';
    document.getElementById('formularioProducto').scrollIntoView({ behavior: 'smooth' });
}
function ocultarFormularioProducto() {
    document.getElementById('formularioProducto').style.display = 'none';
    document.getElementById('prodIdEditar').value = '';
    document.getElementById('prodNombre').value = '';
    document.getElementById('prodCategoria').value = 'helados';
    document.getElementById('prodCosto').value = '';
    document.getElementById('prodPrecio').value = '';
    document.getElementById('prodDescuento').value = '';
    document.getElementById('btnGuardarProducto').textContent = 'Guardar';
}
async function guardarProducto() {
    const idEditar = document.getElementById('prodIdEditar').value;
    const nombre = document.getElementById('prodNombre').value;
    const categoria = document.getElementById('prodCategoria').value;
    const costo = parseFloat(document.getElementById('prodCosto').value) || 0;
    const precio = parseFloat(document.getElementById('prodPrecio').value) || 0;
    const descuento = parseFloat(document.getElementById('prodDescuento').value) || 0;
    if (!nombre) { alert('Ingresa un nombre'); return; }
    try {
        if (idEditar) {
            await db.collection('productos').doc(idEditar).update({ nombre, categoria, costo, precio, descuento });
            alert('✅ Actualizado');
        } else {
            await db.collection('productos').add({ nombre, categoria, costo, precio, descuento });
            alert('✅ Creado');
        }
        ocultarFormularioProducto();
        await cargarDatosIniciales();
        cargarListaProductos();
        cargarConteo();
    } catch (error) { console.error('Error:', error); alert('Error'); }
}
function cargarListaProductos() {
    const lista = document.getElementById('listaProductos');
    if (!lista) return;
    if (productos.length === 0) { lista.innerHTML = '<p class="info-box">No hay productos</p>'; return; }
    const productosPorCategoria = {};
    Object.keys(CATEGORIAS).forEach(cat => { productosPorCategoria[cat] = []; });
    productos.forEach(prod => {
        const categoria = prod.categoria || 'otros';
        if (!productosPorCategoria[categoria]) productosPorCategoria[categoria] = [];
        productosPorCategoria[categoria].push(prod);
    });
    let html = '';
    Object.keys(CATEGORIAS).forEach(cat => {
        if (productosPorCategoria[cat].length > 0) {
            html += `
                <div class="categoria-grupo">
                    <div class="categoria-header" onclick="toggleCategoria('gestion-${cat}')">
                        <span>${CATEGORIAS[cat]} <span class="categoria-contador">${productosPorCategoria[cat].length}</span></span>
                        <span id="icon-categoria-gestion-${cat}">▶</span>
                    </div>
                    <div class="categoria-contenido" id="categoria-gestion-${cat}" style="display:none;">
            `;
            productosPorCategoria[cat].forEach(prod => {
                const margen = (prod.precio && prod.costo) ? prod.precio - prod.costo : null;
                const descuento = prod.descuento || 0;
                const precioFinal = (prod.precio || 0) - descuento;
                const stockActual = stock[prod.id] || 0;
                html += `
                    <div class="list-item" data-nombre="${prod.nombre.toLowerCase()}">
                        <h4>${prod.nombre}</h4>
                        <p>💰 Costo: ${formatearMoneda(prod.costo || 0)} | 💵 Precio: ${formatearMoneda(prod.precio || 0)}${descuento > 0 ? ` | 🏷️ Desc: ${formatearMoneda(descuento)}` : ''}${descuento > 0 ? ` | 🎯 Final: ${formatearMoneda(precioFinal)}` : ''}${margen !== null ? ` | 📈 Margen: ${formatearMoneda(margen)}` : ''}</p>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                            <span style="font-weight: bold;">📦 Stock:</span>
                            <input type="number" id="stock-ajuste-${prod.id}" value="${stockActual}" min="0" step="0.01" style="width: 80px; padding: 8px; border: 2px solid #ddd; border-radius: 5px; text-align: center; font-size: 16px;">
                            <button class="btn-success" onclick="ajustarStock('${prod.id}')" style="padding: 8px 12px; font-size: 13px;">✅ Guardar</button>
                        </div>
                        <div class="actions" style="margin-top: 10px;">
                            <button class="btn-primary" onclick="editarProducto('${prod.id}')" style="padding: 8px 16px; font-size: 14px;">✏️ Editar</button>
                            <button class="btn-danger" onclick="eliminarProducto('${prod.id}')">Eliminar</button>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    });
    lista.innerHTML = html;
}
async function ajustarStock(prodId) {
    const input = document.getElementById(`stock-ajuste-${prodId}`);
    const nuevoStock = parseFloat(input.value);
    if (isNaN(nuevoStock) || nuevoStock < 0) { alert('Cantidad válida'); return; }
    const prod = productos.find(p => p.id === prodId);
    const stockAnterior = stock[prodId] || 0;
    if (nuevoStock === stockAnterior) { alert('No cambió'); return; }
    try {
        stock[prodId] = nuevoStock;
        await db.collection('config').doc('stock').set({ data: stock });
        await db.collection('historialConteos').add({
            fecha: new Date().toLocaleString('es-ES'),
            timestamp: new Date(),
            empleado: empleadoActual ? empleadoActual.nombre : 'Admin',
            conteo: { [prodId]: nuevoStock },
            tipo: 'ajuste_manual',
            nota: `Ajuste: ${prod ? prod.nombre : prodId} de ${stockAnterior} a ${nuevoStock}`
        });
        alert(`✅ Stock actualizado\nAnterior: ${stockAnterior}\nNuevo: ${nuevoStock}`);
        await cargarDatosIniciales();
        cargarListaProductos();
    } catch (error) { console.error('Error:', error); alert('Error'); }
}
function filtrarProductos() {
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const items = document.querySelectorAll('#listaProductos .list-item');
    items.forEach(item => {
        const nombre = item.dataset.nombre;
        item.style.display = nombre.includes(busqueda) ? 'block' : 'none';
    });
}
async function eliminarProducto(id) {
    if (confirm('¿Eliminar este producto?')) {
        try {
            await db.collection('productos').doc(id).delete();
            delete stock[id]; delete stockCamara[id];
            await db.collection('config').doc('stock').set({ data: stock });
            await db.collection('config').doc('stockCamara').set({ data: stockCamara });
            await cargarDatosIniciales();
            cargarListaProductos(); cargarConteo();
        } catch (error) { console.error('Error:', error); }
    }
}
function mostrarFormularioEmpleado() { document.getElementById('formularioEmpleado').style.display = 'block'; }
function ocultarFormularioEmpleado() { document.getElementById('formularioEmpleado').style.display = 'none'; document.getElementById('empNombre').value = ''; document.getElementById('empPassword').value = ''; }
async function guardarEmpleado() {
    const nombre = document.getElementById('empNombre').value.trim();
    const password = document.getElementById('empPassword').value;
    if (!nombre) { alert('Ingresa un nombre'); return; }
    try {
        await db.collection('empleados').add({ nombre, password: password || '' });
        ocultarFormularioEmpleado();
        await cargarDatosIniciales();
        cargarListaEmpleados(); cargarSelectEmpleados();
    } catch (error) { console.error('Error:', error); }
}
function toggleVerPasswordEmpleado(idInput = 'empPassword', idIcono = 'iconoOjoEmpleado') {
    const input = document.getElementById(idInput);
    const icono = document.getElementById(idIcono);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icono) icono.textContent = input.type === 'password' ? '👁️' : '🙈';
}
function cargarListaEmpleados() {
    const lista = document.getElementById('listaEmpleados');
    if (!lista) return;
    let html = '';
    empleados.forEach(emp => {
        const tienePassword = !!emp.password;
        html += `<div class="list-item" data-nombre="${emp.nombre.toLowerCase()}">
            <h4>${emp.nombre}</h4>
            <p style="margin:5px 0;color:#666;">${tienePassword ? '🔐 Tiene contraseña' : '🔓 Sin contraseña'}</p>
            <div class="actions">
                <button class="btn-secondary" onclick="editarPasswordEmpleado('${emp.id}')">🔐 Contraseña</button>
                <button class="btn-danger" onclick="eliminarPasswordEmpleado('${emp.id}')">🗑️ Quitar contraseña</button>
                <button class="btn-danger" onclick="eliminarEmpleado('${emp.id}')">Eliminar empleado</button>
            </div>
        </div>`;
    });
    lista.innerHTML = html || '<p class="info-box">No hay empleados</p>';
}
async function editarPasswordEmpleado(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
    const nueva = prompt(`🔐 Nueva contraseña para ${emp.nombre}\\n\\nDejá vacío si querés quitarla.`, emp.password || '');
    if (nueva === null) return;
    try {
        await db.collection('empleados').doc(id).update({ password: nueva });
        await cargarDatosIniciales();
        cargarListaEmpleados();
        cargarSelectEmpleados();
        alert(nueva ? '✅ Contraseña actualizada' : '🔓 Contraseña eliminada');
    } catch (error) {
        console.error('Error:', error);
        alert('No se pudo actualizar la contraseña');
    }
}
async function eliminarPasswordEmpleado(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp || !emp.password) {
        alert('Este empleado no tiene contraseña.');
        return;
    }
    if (!confirm(`¿Querés quitar la contraseña de ${emp.nombre}?\\n\\nPodrá ingresar sin contraseña.`)) return;
    try {
        await db.collection('empleados').doc(id).update({ password: '' });
        await cargarDatosIniciales();
        cargarListaEmpleados();
        cargarSelectEmpleados();
        alert('🔓 Contraseña eliminada');
    } catch (error) {
        console.error('Error:', error);
        alert('No se pudo eliminar la contraseña');
    }
}
function filtrarEmpleados() {
    const busqueda = document.getElementById('buscarEmpleado').value.toLowerCase();
    const items = document.querySelectorAll('#listaEmpleados .list-item');
    items.forEach(item => { item.style.display = item.dataset.nombre.includes(busqueda) ? 'block' : 'none'; });
}
async function eliminarEmpleado(id) {
    if (confirm('¿Eliminar este empleado?')) {
        try {
            await db.collection('empleados').doc(id).delete();
            await cargarDatosIniciales();
            cargarListaEmpleados(); cargarSelectEmpleados();
        } catch (error) { console.error('Error:', error); }
    }
}
function mostrarFormularioTarea() { document.getElementById('formularioTarea').style.display = 'block'; }
function ocultarFormularioTarea() { document.getElementById('formularioTarea').style.display = 'none'; document.getElementById('tareaTitulo').value = ''; }
async function guardarTarea() {
    const titulo = document.getElementById('tareaTitulo').value;
    const momento = document.getElementById('tareaMomento').value;
    if (!titulo) { alert('Ingresa un título'); return; }
    try {
        await db.collection('tareas').add({ titulo, momento });
        ocultarFormularioTarea();
        await cargarDatosIniciales();
        cargarListaTareas(); cargarTareas();
    } catch (error) { console.error('Error:', error); }
}
function cargarListaTareas() {
    const lista = document.getElementById('listaTareas');
    if (!lista) return;
    if (tareas.length === 0) { lista.innerHTML = '<p class="info-box">No hay tareas</p>'; return; }
    let html = '';
    tareas.forEach(tarea => {
        const momentoTexto = { apertura: '🌅 Apertura', durante: '🔄 Durante', cierre: '🌙 Cierre' };
        html += `<div class="list-item" data-nombre="${tarea.titulo.toLowerCase()}"><h4>${tarea.titulo}</h4><p>${momentoTexto[tarea.momento]}</p><div class="actions"><button class="btn-danger" onclick="eliminarTarea('${tarea.id}')">Eliminar</button></div></div>`;
    });
    lista.innerHTML = html;
}
function filtrarTareas() {
    const busqueda = document.getElementById('buscarTarea').value.toLowerCase();
    const items = document.querySelectorAll('#listaTareas .list-item');
    items.forEach(item => { item.style.display = item.dataset.nombre.includes(busqueda) ? 'block' : 'none'; });
}
async function eliminarTarea(id) {
    if (confirm('¿Eliminar esta tarea?')) {
        try {
            await db.collection('tareas').doc(id).delete();
            await cargarDatosIniciales();
            cargarListaTareas(); cargarTareas();
        } catch (error) { console.error('Error:', error); }
    }
}
function mostrarFormularioPedido() {
    const contenedor = document.getElementById('productosPedido');
    pedidoFormData = {};
    if (productos.length === 0) {
        contenedor.innerHTML = '<p>No hay productos</p>';
        document.getElementById('formularioPedido').style.display = 'block';
        return;
    }
    contenedor.innerHTML = '<input type="text" id="buscarProductoPedido" placeholder="🔎 Buscar producto..." oninput="filtrarProductosPedido()" style="width:100%;margin-bottom:12px;"><div id="listaProductosPedido"></div>';
    renderProductosPedido();
    document.getElementById('formularioPedido').style.display = 'block';
}

function capturarDatosPedidoForm() {
    const lista = document.getElementById('listaProductosPedido');
    if (!lista) return;
    lista.querySelectorAll('input[id^="pedido-"]').forEach(input => {
        const id = input.id.replace('pedido-', '');
        if (!pedidoFormData[id]) pedidoFormData[id] = {};
        pedidoFormData[id].cantidad = input.value;
    });
    lista.querySelectorAll('input[id^="nota-pedido-"]').forEach(input => {
        const id = input.id.replace('nota-pedido-', '');
        if (!pedidoFormData[id]) pedidoFormData[id] = {};
        pedidoFormData[id].nota = input.value;
    });
}

function actualizarCantidadPedido(prodId, valor) {
    if (!pedidoFormData[prodId]) pedidoFormData[prodId] = {};
    pedidoFormData[prodId].cantidad = valor;
}

function actualizarNotaPedido(prodId, valor) {
    if (!pedidoFormData[prodId]) pedidoFormData[prodId] = {};
    pedidoFormData[prodId].nota = valor;
}

function renderProductosPedido() {
    const lista = document.getElementById('listaProductosPedido');
    if (!lista) return;

    capturarDatosPedidoForm();

    if (!productos.length) {
        lista.innerHTML = '<p class="info-box">No hay productos.</p>';
        return;
    }

    lista.innerHTML = productos.map(prod => {
        const estado = pedidoFormData[prod.id] || {};
        const cantidad = estado.cantidad ?? '';
        const nota = estado.nota ?? String(notasPedidos[prod.id] || '');
        const notaEsc = String(nota).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const cantidadEsc = String(cantidad).replace(/"/g,'&quot;');
        const nombreEsc = String(prod.nombre).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        return '<div class="producto-pedido item-producto-pedido" data-nombre="' + nombreEsc.toLowerCase() + '" style="margin-bottom:10px;">' +
            '<div class="producto-pedido-info"><label><strong>' + nombreEsc + '</strong></label></div>' +
            '<div class="producto-pedido-campos">' +
            '<input type="number" id="pedido-' + prod.id + '" value="' + cantidadEsc + '" placeholder="0" min="0" step="0.01" oninput="actualizarCantidadPedido(\'' + prod.id + '\', this.value)">' +
            '<input type="text" id="nota-pedido-' + prod.id + '" value="' + notaEsc + '" placeholder="📝 Nota permanente / referencia" maxlength="200" oninput="actualizarNotaPedido(\'' + prod.id + '\', this.value)">' +
            '</div>' +
            '<div class="producto-pedido-nota-guardada">' + (nota ? '📌 Nota guardada: ' + notaEsc : '') + '</div>' +
            '</div>';
    }).join('');

    filtrarProductosPedido();
}

function filtrarProductosPedido() {
    const buscador = document.getElementById('buscarProductoPedido');
    const termino = (buscador?.value || '').toLowerCase().trim();
    const items = document.querySelectorAll('#listaProductosPedido .item-producto-pedido');
    let encontrados = 0;

    items.forEach(item => {
        const nombre = item.dataset.nombre || '';
        const coincide = !termino || nombre.includes(termino);
        item.style.display = coincide ? 'block' : 'none';
        if (coincide) encontrados++;
    });

    let mensaje = document.getElementById('mensajeSinResultadosPedido');
    if (!mensaje) {
        mensaje = document.createElement('p');
        mensaje.id = 'mensajeSinResultadosPedido';
        mensaje.className = 'info-box';
        const lista = document.getElementById('listaProductosPedido');
        if (lista) lista.appendChild(mensaje);
    }

    if (mensaje) {
        mensaje.textContent = 'No se encontraron productos.';
        mensaje.style.display = encontrados === 0 ? 'block' : 'none';
    }
}
async function guardarPedido() {
    try {
        capturarDatosPedidoForm();

        const notasActualizadas = { ...notasPedidos };
        let productosCargados = 0;

        productos.forEach(prod => {
            const estado = pedidoFormData[prod.id] || {};
            const valor = parseFloat(estado.cantidad);
            const notaValor = String(estado.nota ?? '').trim();

            if (!isNaN(valor) && valor > 0) {
                stock[prod.id] = (stock[prod.id] || 0) + valor;
                productosCargados++;
            }

            if (notaValor !== '') notasActualizadas[prod.id] = notaValor;
            else if (Object.prototype.hasOwnProperty.call(notasActualizadas, prod.id)) delete notasActualizadas[prod.id];
        });

        const notasCambiaron = JSON.stringify(notasActualizadas) !== JSON.stringify(notasPedidos);
        if (productosCargados === 0 && !notasCambiaron) {
            alert('⚠️ No ingresaste cantidades ni modificaste notas.');
            return;
        }

        notasPedidos = notasActualizadas;
        await db.collection('config').doc('stock').set({ data: stock });
        await db.collection('config').doc('notasPedidos').set({ data: notasPedidos });

        alert('✅ Pedido cargado\n📦 Productos ingresados: ' + productosCargados + '\n📝 Notas permanentes activas: ' + Object.keys(notasPedidos).length);
        pedidoFormData = {};
        ocultarFormularioPedido();
        cargarDashboard();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar el pedido');
    }
}

// ========== HISTORIALES ==========
async function cargarEstadoHistoriales() {
    const contenedor = document.getElementById('estadoHistoriales');
    if (!contenedor) return;
    try {
        const conteosSnap = await db.collection('historialConteos').get();
        const movCamaraSnap = await db.collection('camaraMovimientos').get();
        const pedidosCamaraSnap = await db.collection('camaraPedidos').get();
        const cierresSnap = await db.collection('cierres').get();
        const cajasSnap = await db.collection('cajas').get();
        const gastosSnap = await db.collection('gastos').get();
        const avisosSnap = await db.collection('avisos').get();
        const fichajesSnap = await db.collection('fichajes').get();
        const turnosSnap = await db.collection('turnos').get();
        const consumosSnap = await db.collection('consumos').get();
        const pedidosTraidos = pedidosCamaraSnap.docs.filter(d => d.data().traido).length;
        const pedidosPendientes = pedidosCamaraSnap.docs.filter(d => !d.data().traido).length;
        const avisosVencidos = avisosSnap.docs.filter(d => d.data().vencimiento && new Date(d.data().vencimiento) < new Date()).length;
        contenedor.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-bottom: 20px;">
                <div class="list-item" style="margin: 0;"><h4>📦 Conteos</h4><p><strong>${conteosSnap.size}</strong> registros</p></div>
                <div class="list-item" style="margin: 0;"><h4>🧊 Mov. cámara</h4><p><strong>${movCamaraSnap.size}</strong> registros</p></div>
                <div class="list-item" style="margin: 0;"><h4>📋 Pedidos cámara</h4><p><strong>${pedidosPendientes}</strong> pend. | <strong>${pedidosTraidos}</strong> traídos</p></div>
                <div class="list-item" style="margin: 0;"><h4>🧾 Cierres</h4><p><strong>${cierresSnap.size}</strong> registros</p></div>
                <div class="list-item" style="margin: 0;"><h4>💰 Cajas</h4><p><strong>${cajasSnap.size}</strong> registros</p></div>
                <div class="list-item" style="margin: 0;"><h4>💸 Gastos</h4><p><strong>${gastosSnap.size}</strong> registros</p></div>
                <div class="list-item" style="margin: 0;"><h4>📢 Avisos</h4><p><strong>${avisosSnap.size}</strong> | <strong style="color: #ff4757;">${avisosVencidos}</strong> vencidos</p></div>
                <div class="list-item" style="margin: 0;"><h4>🕐 Fichajes</h4><p><strong>${fichajesSnap.size}</strong> registros</p></div>
                <div class="list-item" style="margin: 0;"><h4>⏰ Turnos</h4><p><strong>${turnosSnap.size}</strong> configurados</p></div>
                <div class="list-item" style="margin: 0;"><h4>🎁 Consumos</h4><p><strong>${consumosSnap.size}</strong> registros</p></div>
            </div>
        `;
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p class="info-box">Error</p>';
    }
}
async function limpiarHistorialManual(coleccion, dias) {
    if (!confirm(`¿Borrar registros de ${coleccion} de más de ${dias} días?`)) return;
    try {
        await limpiarColeccionPorFecha(coleccion, dias, 'timestamp');
        alert('✅ Limpieza completada');
        await cargarDatosIniciales();
        cargarEstadoHistoriales();
    } catch (error) { console.error('Error:', error); alert('Error'); }
}
async function limpiarPedidosCamaraTraidos() {
    if (!confirm('¿Borrar TODOS los pedidos traídos?')) return;
    try {
        const pedidosSnap = await db.collection('camaraPedidos').get();
        const batch = db.batch();
        let contador = 0;
        pedidosSnap.docs.forEach(doc => {
            if (doc.data().traido) { batch.delete(doc.ref); contador++; }
        });
        if (contador > 0) {
            await batch.commit();
            alert(`✅ ${contador} pedidos borrados`);
        } else {
            alert('No hay pedidos para borrar');
        }
        await cargarDatosIniciales();
        cargarEstadoHistoriales();
    } catch (error) { console.error('Error:', error); alert('Error'); }
}

// ========== EXCEL ==========
function descargarPlantillaExcel() {
    const wb = XLSX.utils.book_new();
    const datos = [
        ['Concepto', 'Cantidad', 'Unidad', 'Precio Unitario', 'Descuento', 'Total'],
        ['Helado Dulce de Leche', '10', 'cajas', '800', '0', '8000'],
        ['Helado Crema', '8', 'cajas', '1.500,72', '50', '11.955,76'],
        ['Empanadas de Carne', '20', 'bolsas', '300', '0', '6000']
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla-productos.xlsx');
}
function procesarExcel(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', raw: true, cellText: true });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const range = XLSX.utils.decode_range(sheet['!ref']);
            const headers = {};
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
                const cell = sheet[cellAddress];
                if (cell) {
                    const headerText = (cell.w || cell.v || '').toString().trim().toLowerCase();
                    headers[col] = headerText;
                }
            }
            let colConcepto = -1, colCantidad = -1, colUnidad = -1;
            let colPrecio = -1, colDescuento = -1, colTotal = -1;
            Object.keys(headers).forEach(col => {
                const h = headers[col];
                if (h.includes('concepto') || h.includes('nombre') || h.includes('producto')) colConcepto = parseInt(col);
                else if (h.includes('cantidad') || h.includes('stock')) colCantidad = parseInt(col);
                else if (h.includes('unidad') || h.includes('u.m')) colUnidad = parseInt(col);
                else if (h.includes('precio') || h.includes('costo')) colPrecio = parseInt(col);
                else if (h.includes('descuento')) colDescuento = parseInt(col);
                else if (h.includes('total')) colTotal = parseInt(col);
            });
            if (colConcepto === -1) { alert('No se encontró la columna "Concepto"'); return; }
            productosImportar = [];
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
                function leerCeldaTexto(col) {
                    if (col === -1) return '';
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                    const cell = sheet[cellAddress];
                    if (!cell) return '';
                    return (cell.w || cell.v || '').toString().trim();
                }
                function leerCeldaNumero(col) {
                    const texto = leerCeldaTexto(col);
                    return parsearNumeroArgentino(texto);
                }
                const concepto = leerCeldaTexto(colConcepto);
                if (concepto === '') continue;
                const cantidad = leerCeldaNumero(colCantidad);
                const unidad = leerCeldaTexto(colUnidad) || 'unidades';
                const precioUnitario = leerCeldaNumero(colPrecio);
                const descuento = leerCeldaNumero(colDescuento);
                const total = leerCeldaNumero(colTotal);
                const existe = productos.find(p => p.nombre.toLowerCase() === concepto.toLowerCase());
                productosImportar.push({
                    index: row, nombre: concepto, cantidad, unidad,
                    precioUnitario, descuento, total,
                    categoria: 'otros', duplicado: !!existe, seleccionado: !existe
                });
            }
            if (productosImportar.length === 0) { alert('No se encontraron productos'); return; }
            mostrarVistaPrevia();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al leer: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(archivo);
    event.target.value = '';
}
function mostrarVistaPrevia() {
    const contenedor = document.getElementById('vistaPreviaImportacion');
    const tabla = document.getElementById('tablaPrevia');
    const total = productosImportar.length;
    const nuevos = productosImportar.filter(p => !p.duplicado).length;
    const duplicados = productosImportar.filter(p => p.duplicado).length;
    const totalDescuentos = productosImportar.reduce((sum, p) => sum + (p.descuento || 0) * p.cantidad, 0);
    let html = `
        <div class="resumen-importacion">
            <span class="resumen-total">📊 Total: ${total}</span>
            <span class="resumen-nuevos">✅ Nuevos: ${nuevos}</span>
            <span class="resumen-duplicados">⚠️ Duplicados: ${duplicados}</span>
            <span class="resumen-descuentos">🏷️ Descuentos: ${formatearMoneda(totalDescuentos)}</span>
        </div>
        <div style="overflow-x: auto;">
        <table class="tabla-previa">
            <thead>
                <tr>
                    <th><input type="checkbox" checked onchange="toggleTodosImportar(this)"></th>
                    <th>Nombre</th><th>Cantidad</th><th>Unidad</th>
                    <th>Precio Unit.</th><th>Descuento</th><th>Total</th>
                    <th>Categoría</th><th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;
    productosImportar.forEach((prod, i) => {
        const claseDuplicado = prod.duplicado ? 'duplicado' : '';
        const checked = prod.seleccionado ? 'checked' : '';
        const descuentoTexto = prod.descuento > 0 ? formatearMoneda(prod.descuento) : '-';
        html += `
            <tr class="${claseDuplicado}">
                <td><input type="checkbox" ${checked} onchange="toggleImportar(${i}, this)"></td>
                <td><strong>${prod.nombre}</strong></td>
                <td>${formatearNumeroArgentino(prod.cantidad)}</td>
                <td>${prod.unidad}</td>
                <td>${formatearMoneda(prod.precioUnitario)}</td>
                <td style="color: ${prod.descuento > 0 ? '#ff4757' : '#999'}; font-weight: ${prod.descuento > 0 ? 'bold' : 'normal'};">${descuentoTexto}</td>
                <td>${formatearMoneda(prod.total)}</td>
                <td>
                    <select onchange="cambiarCategoriaImportar(${i}, this.value)">
                        <option value="helados" ${prod.categoria === 'helados' ? 'selected' : ''}>🍦 Helados</option>
                        <option value="congelados" ${prod.categoria === 'congelados' ? 'selected' : ''}>❄️ Congelados</option>
                        <option value="insumos" ${prod.categoria === 'insumos' ? 'selected' : ''}>📋 Insumos</option>
                        <option value="cafeteria" ${prod.categoria === 'cafeteria' ? 'selected' : ''}>☕ Cafetería</option>
                        <option value="bebidas" ${prod.categoria === 'bebidas' ? 'selected' : ''}>🥤 Bebidas</option>
                        <option value="otros" ${prod.categoria === 'otros' ? 'selected' : ''}>📦 Otros</option>
                    </select>
                </td>
                <td>${prod.duplicado ? '⚠️ Ya existe' : '✅ Nuevo'}</td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    tabla.innerHTML = html;
    contenedor.style.display = 'block';
}
function toggleTodosImportar(checkbox) {
    productosImportar.forEach((prod, i) => { prod.seleccionado = checkbox.checked; });
    mostrarVistaPrevia();
}
function toggleImportar(index, checkbox) { productosImportar[index].seleccionado = checkbox.checked; }
function cambiarCategoriaImportar(index, valor) { productosImportar[index].categoria = valor; }
function cancelarImportacion() {
    document.getElementById('vistaPreviaImportacion').style.display = 'none';
    productosImportar = [];
}
async function confirmarImportacion() {
    const seleccionados = productosImportar.filter(p => p.seleccionado);
    if (seleccionados.length === 0) { alert('No seleccionaste ninguno'); return; }
    if (!confirm(`¿Cargar ${seleccionados.length} productos?`)) return;
    let cargados = 0;
    let errores = 0;
    try {
        for (const prod of seleccionados) {
            try {
                const existente = productos.find(p => p.nombre.toLowerCase() === prod.nombre.toLowerCase());
                if (existente) {
                    await db.collection('productos').doc(existente.id).update({
                        cantidad: prod.cantidad, unidad: prod.unidad,
                        costo: prod.precioUnitario, precio: prod.precioUnitario,
                        descuento: prod.descuento || 0, categoria: prod.categoria
                    });
                    stock[existente.id] = prod.cantidad;
                } else {
                    const docRef = await db.collection('productos').add({
                        nombre: prod.nombre, cantidad: prod.cantidad, unidad: prod.unidad,
                        costo: prod.precioUnitario, precio: prod.precioUnitario,
                        descuento: prod.descuento || 0, categoria: prod.categoria
                    });
                    stock[docRef.id] = prod.cantidad;
                }
                cargados++;
            } catch (error) {
                console.error('Error:', prod.nombre, error);
                errores++;
            }
        }
        await db.collection('config').doc('stock').set({ data: stock });
        cancelarImportacion();
        await cargarDatosIniciales();
        cargarListaProductos();
        cargarConteo();
        alert(`✅ Cargados: ${cargados}\nErrores: ${errores}`);
    } catch (error) {
        console.error('Error:', error);
        alert('Error. Se cargaron ' + cargados);
    }
}

// ========== RESPALDO ==========
async function exportarDatos() {
    try {
        const backup = { 
            fecha: new Date().toLocaleString('es-ES'), 
            version: '4.4', 
            productos: [], empleados: [], stock: {}, stockCamara: {}, notasConteo: {}, 
            tareas: [], tareasCompletadas: {}, eventos: [], 
            historialConteos: [], pedidosCamara: [], movimientosCamara: [], 
            cierres: [], cajas: [], gastos: [], avisos: [], 
            fichajes: [], turnos: [], consumos: [] 
        };
        const productosSnap = await db.collection('productos').get(); backup.productos = productosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const empleadosSnap = await db.collection('empleados').get(); backup.empleados = empleadosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const stockDoc = await db.collection('config').doc('stock').get(); backup.stock = stockDoc.exists ? stockDoc.data().data : {};
        const stockCamaraDoc = await db.collection('config').doc('stockCamara').get(); backup.stockCamara = stockCamaraDoc.exists ? stockCamaraDoc.data().data : {};
        const tareasSnap = await db.collection('tareas').get(); backup.tareas = tareasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tareasCompDoc = await db.collection('config').doc('tareasCompletadas').get(); backup.tareasCompletadas = tareasCompDoc.exists ? tareasCompDoc.data().data : {};
        const eventosSnap = await db.collection('eventos').get(); backup.eventos = eventosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const historialSnap = await db.collection('historialConteos').get(); backup.historialConteos = historialSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pedidosSnap = await db.collection('camaraPedidos').get(); backup.pedidosCamara = pedidosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const movimientosSnap = await db.collection('camaraMovimientos').get(); backup.movimientosCamara = movimientosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cierresSnap = await db.collection('cierres').get(); backup.cierres = cierresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cajasSnap = await db.collection('cajas').get(); backup.cajas = cajasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const gastosSnap = await db.collection('gastos').get(); backup.gastos = gastosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const avisosSnap = await db.collection('avisos').get(); backup.avisos = avisosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const fichajesSnap = await db.collection('fichajes').get(); backup.fichajes = fichajesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const turnosSnap = await db.collection('turnos').get(); backup.turnos = turnosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const consumosSnap = await db.collection('consumos').get(); backup.consumos = consumosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-comercio-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('✅ Backup descargado');
    } catch (error) { console.error('Error:', error); alert('Error'); }
}
async function importarDatos() {
    const archivo = document.getElementById('archivoImportar').files[0];
    if (!archivo) { alert('Seleccioná un archivo'); return; }
    if (!confirm('⚠️ ¿REEMPLAZAR todos los datos?')) return;
    try {
        const texto = await archivo.text();
        const backup = JSON.parse(texto);
        const colecciones = ['productos', 'empleados', 'tareas', 'eventos', 'historialConteos', 'camaraPedidos', 'camaraMovimientos', 'cierres', 'cajas', 'gastos', 'avisos', 'fichajes', 'turnos', 'consumos'];
        for (const coleccion of colecciones) {
            const snap = await db.collection(coleccion).get();
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        for (const prod of backup.productos) { const { id, ...data } = prod; await db.collection('productos').doc(id).set(data); }
        for (const emp of backup.empleados) { const { id, ...data } = emp; await db.collection('empleados').doc(id).set(data); }
        for (const tarea of backup.tareas) { const { id, ...data } = tarea; await db.collection('tareas').doc(id).set(data); }
        for (const evento of backup.eventos) { const { id, ...data } = evento; await db.collection('eventos').doc(id).set(data); }
        for (const conteo of backup.historialConteos) { const { id, ...data } = conteo; await db.collection('historialConteos').doc(id).set(data); }
        for (const pedido of backup.pedidosCamara) { const { id, ...data } = pedido; await db.collection('camaraPedidos').doc(id).set(data); }
        for (const mov of backup.movimientosCamara) { const { id, ...data } = mov; await db.collection('camaraMovimientos').doc(id).set(data); }
        if (backup.cierres) for (const cierre of backup.cierres) { const { id, ...data } = cierre; await db.collection('cierres').doc(id).set(data); }
        if (backup.cajas) for (const caja of backup.cajas) { const { id, ...data } = caja; await db.collection('cajas').doc(id).set(data); }
        if (backup.gastos) for (const gasto of backup.gastos) { const { id, ...data } = gasto; await db.collection('gastos').doc(id).set(data); }
        if (backup.avisos) for (const aviso of backup.avisos) { const { id, ...data } = aviso; await db.collection('avisos').doc(id).set(data); }
        if (backup.fichajes) for (const fichaje of backup.fichajes) { const { id, ...data } = fichaje; await db.collection('fichajes').doc(id).set(data); }
        if (backup.turnos) for (const turno of backup.turnos) { const { id, ...data } = turno; await db.collection('turnos').doc(id).set(data); }
        if (backup.consumos) for (const consumo of backup.consumos) { const { id, ...data } = consumo; await db.collection('consumos').doc(id).set(data); }
        await db.collection('config').doc('stock').set({ data: backup.stock || {} });
        await db.collection('config').doc('stockCamara').set({ data: backup.stockCamara || {} });
        await db.collection('config').doc('notasConteo').set({ data: backup.notasConteo || {} });
        await db.collection('config').doc('tareasCompletadas').set({ data: backup.tareasCompletadas || {} });
        alert('✅ Restaurado. Recargando...');
        location.reload();
    } catch (error) { console.error('Error:', error); alert('Error al importar'); }
}

// ========== FIREBASE CLOUD MESSAGING (FCM) ==========
async function guardarTokenFCM(token) {
    if (!token || !db) return;
    
    const esAdmin = modoActual === 'admin';
    const empleadoId = esAdmin ? 'admin' : (empleadoActual ? empleadoActual.id : null);
    const empleadoNombre = esAdmin ? 'Administrador' : (empleadoActual ? empleadoActual.nombre : null);
    
    if (!empleadoId) return;
    
    try {
        await db.collection('tokensFCM').doc(token).set({
            token: token,
            empleadoId: empleadoId,
            empleadoNombre: empleadoNombre,
            modo: esAdmin ? 'admin' : 'empleado',
            modoPrueba: modoPrueba,
            actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✅ Token FCM guardado para:', empleadoNombre);
    } catch (error) {
        console.error('❌ No se pudo guardar el token FCM:', error);
    }
}

window.addEventListener('fcm-token-ready', event => {
    guardarTokenFCM(event.detail?.token);
});
