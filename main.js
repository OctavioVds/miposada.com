// --- IMPORTAR LIBRERÍAS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, onSnapshot, getDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCwFd_oNfHkUi25GYME0NxuX70cHZT6k6w",
  authDomain: "miposada-98daf.firebaseapp.com",
  projectId: "miposada-98daf",
  storageBucket: "miposada-98daf.firebasestorage.app",
  messagingSenderId: "367576712970",
  appId: "1:367576712970:web:51f77ff6ea7b8d83de1cf3"
};

// --- CONFIGURACIÓN EMAILJS (TUS CLAVES REALES) ---
const EMAIL_SERVICE_ID = "service_ao73611"; 
const EMAIL_TEMPLATE_ID = "template_dp7jafi"; 
const EMAIL_PUBLIC_KEY = "l-_4LrQW8pN7F7MiK"; 

// Inicializar EmailJS
if(window.emailjs) {
    window.emailjs.init(EMAIL_PUBLIC_KEY);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// --- UI HELPERS ---
function notificar(msg, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = msg;
    container.appendChild(toast);
    
    toast.animate([
        { opacity: 0, transform: 'translateY(-20px)' },
        { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });

    setTimeout(() => {
        const anim = toast.animate([
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-20px)' }
        ], { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        anim.onfinish = () => toast.remove();
    }, 3000);
}

function confirmar(mensaje, accionSi) {
    const modal = document.getElementById('modalConfirmacion');
    document.getElementById('txtConfirmacion').innerText = mensaje;
    modal.style.display = 'flex';

    const btnSi = document.getElementById('btnSiConfirm');
    const btnNo = document.getElementById('btnNoConfirm');
    const nuevoSi = btnSi.cloneNode(true);
    const nuevoNo = btnNo.cloneNode(true);
    
    btnSi.parentNode.replaceChild(nuevoSi, btnSi);
    btnNo.parentNode.replaceChild(nuevoNo, btnNo);

    nuevoSi.addEventListener('click', () => { modal.style.display = 'none'; accionSi(); });
    nuevoNo.addEventListener('click', () => { modal.style.display = 'none'; });
}

// --- GESTIÓN DE MEMORIA LOCAL ---
function guardarSesionLocal(codigo, nombre) {
    localStorage.setItem(`evento_${codigo}`, nombre);
    verificarHistorial();
}

function obtenerSesionLocal(codigo) {
    return localStorage.getItem(`evento_${codigo}`);
}

function verificarHistorial() {
    const container = document.getElementById('quickJoinContainer');
    const lista = document.getElementById('listaEventosGuardados');
    if(!container || !lista) return;

    lista.innerHTML = '';
    let hayEventos = false;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('evento_')) {
            hayEventos = true;
            const codigo = key.split('_')[1];
            const nombre = localStorage.getItem(key);
            
            const btn = document.createElement('div');
            btn.innerHTML = `
                <div style="cursor:pointer; width:100%; display:flex; justify-content:space-between; align-items:center;" onclick="reunirseRapido('${codigo}', '${nombre}')">
                    <span>Reingresar a <strong>${codigo}</strong> como <strong>${nombre}</strong></span>
                    <span style="color:var(--accent)">➔</span>
                </div>
            `;
            lista.appendChild(btn);
        }
    }
    
    container.style.display = hayEventos ? 'block' : 'none';
}

window.reunirseRapido = async (codigo, nombre) => {
    document.getElementById('inputCodigoHome').value = codigo;
    await intentarUnirse(codigo, nombre); 
};

// --- VARIABLES ---
const vistas = {
    home: document.getElementById('vistaHome'),
    registro: document.getElementById('vistaRegistro'),
    lobby: document.getElementById('vistaLobby'),
    resultado: document.getElementById('vistaResultado')
};

let usuarioActual = null;
let salaActualId = null;
let miNombreEnSala = null;
let unsuscribeLobby = null;
let unsuscribeDashboard = null;
let timerInterval = null;

// --- NAVEGACIÓN ---
function irA(vistaNombre) {
    Object.values(vistas).forEach(v => v.style.display = 'none');
    vistas[vistaNombre].style.display = 'block';

    const btnAtras = document.getElementById('btnAtras');
    const titulo = document.getElementById('tituloPrincipal');

    if (vistaNombre === 'home') {
        btnAtras.style.display = 'none';
        titulo.innerText = "Intercambio";
        limpiarSala();
        verificarHistorial();
    } else {
        btnAtras.style.display = 'flex';
        if(vistaNombre === 'registro') titulo.innerText = "Registro";
        if(vistaNombre === 'lobby') titulo.innerText = "Sala de Espera";
        if(vistaNombre === 'resultado') titulo.innerText = "Resultado";
    }
}

function limpiarSala() {
    salaActualId = null;
    miNombreEnSala = null;
    if(unsuscribeLobby) unsuscribeLobby();
    if(timerInterval) clearInterval(timerInterval);
}

document.getElementById('btnAtras').addEventListener('click', () => { irA('home'); });

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    const secInvitado = document.getElementById('seccionInvitado');
    const secAdmin = document.getElementById('seccionAdmin');
    const btnLogout = document.getElementById('btnLogout');

    if (user) {
        usuarioActual = user;
        secInvitado.style.display = 'none';
        secAdmin.style.display = 'block';
        btnLogout.style.display = 'block';
        activarDashboard(); 
    } else {
        usuarioActual = null;
        secInvitado.style.display = 'block';
        secAdmin.style.display = 'none';
        btnLogout.style.display = 'none';
        if(unsuscribeDashboard) unsuscribeDashboard();
    }
});

document.getElementById('btnSoyAdmin').addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch (e) {}
});

document.getElementById('btnLogout').addEventListener('click', () => {
    confirmar("¿Cerrar sesión?", () => { signOut(auth); });
});

// --- DASHBOARD ---
function activarDashboard() {
    if(!usuarioActual) return;
    const lista = document.getElementById('listaMisPosadas');
    lista.innerHTML = `<div style="text-align:center; padding:30px;">Cargando...</div>`;
    
    if(unsuscribeDashboard) unsuscribeDashboard();
    const q = query(collection(db, "posadas"), where("creadorEmail", "==", usuarioActual.email));
    
    unsuscribeDashboard = onSnapshot(q, (snapshot) => {
        lista.innerHTML = '';
        if(snapshot.empty) {
            lista.innerHTML = `<div style="text-align:center; padding:30px; border:1px dashed #CCC; border-radius:12px;">No tienes eventos.</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            const esFinalizado = data.estado === 'cerrada';
            const estadoStyle = esFinalizado ? 'color:var(--success)' : 'color:var(--accent)';
            const estadoTxt = esFinalizado ? 'Finalizado' : 'Activo';

            div.innerHTML = `
                <div style="flex-grow:1;">
                    <div style="font-weight:600; font-size:1rem;">${data.nombre}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                        ${data.codigo} • <span style="${estadoStyle}; font-weight:700;">${estadoTxt}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    <button class="btn-secondary" style="padding:8px 14px; font-size:0.8rem;" onclick="irEvento('${docSnap.id}')">Ver</button>
                    <button class="btn-trash" title="Eliminar" onclick="eliminarEventoExterno('${docSnap.id}')">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                   </button>
                </div>
            `;
            lista.appendChild(div);
        });
    });
}

window.irEvento = (id) => {
    getDoc(doc(db, "posadas", id)).then(snap => {
        if(snap.exists()) entrarLobby(id, snap.data(), true);
    });
};

window.eliminarEventoExterno = (id) => {
    confirmar("¿Eliminar este evento?", async () => {
        try { await deleteDoc(doc(db, "posadas", id)); notificar("Eliminado", "success"); } 
        catch (e) { notificar("Error", "error"); }
    });
};

document.getElementById('btnEliminarEventoFinal').addEventListener('click', () => {
    confirmar("¿Borrar este evento?", async () => {
        try { await deleteDoc(doc(db, "posadas", salaActualId)); notificar("Eliminado", "success"); irA('home'); } 
        catch(e) { notificar("Error", "error"); }
    });
});

// --- CREAR SALA ---
const modalCrear = document.getElementById('modalCrearPosada');
document.getElementById('btnAbrirModal').addEventListener('click', () => {
    document.getElementById('newNombre').value = ""; document.getElementById('newFecha').value = "";
    modalCrear.style.display = 'flex';
});
document.getElementById('btnCancelarModal').addEventListener('click', () => modalCrear.style.display = 'none');

document.getElementById('btnConfirmarCrear').addEventListener('click', async () => {
    const nombre = document.getElementById('newNombre').value;
    const fecha = document.getElementById('newFecha').value;
    const max = document.getElementById('newMax').value;

    if(!nombre || !fecha || !max) return notificar("Faltan datos", "error");

    const btn = document.getElementById('btnConfirmarCrear');
    btn.disabled = true; btn.innerText = "...";

    try {
        const codigo = Math.random().toString(36).substring(2, 6).toUpperCase();
        await addDoc(collection(db, "posadas"), {
            nombre, fechaTarget: fecha, maxParticipantes: parseInt(max),
            codigo, creadorEmail: usuarioActual.email, estado: 'abierta',
            participantes: [], resultados: {}
        });
        modalCrear.style.display = 'none';
        notificar("Evento creado", "success");
    } catch (e) { notificar("Error", "error"); } 
    finally { btn.disabled = false; btn.innerText = "Crear"; }
});

// --- UNIRSE ---
document.getElementById('btnIrASala').addEventListener('click', () => {
    const codigo = document.getElementById('inputCodigoHome').value.trim().toUpperCase();
    if(codigo.length < 3) return notificar("Código inválido", "error");
    
    const nombreGuardado = obtenerSesionLocal(codigo);
    if(nombreGuardado) {
        intentarUnirse(codigo, nombreGuardado); 
    } else {
        intentarUnirse(codigo, null); 
    }
});

async function intentarUnirse(codigo, nombreAutenticado) {
    try {
        const q = query(collection(db, "posadas"), where("codigo", "==", codigo));
        const snap = await getDocs(q);

        if(snap.empty) return notificar("Código no existe", "error");

        const docSnap = snap.docs[0];
        const data = docSnap.data();

        salaActualId = docSnap.id;
        document.getElementById('lblNombreSala').innerText = data.nombre;

        if(nombreAutenticado) {
            miNombreEnSala = nombreAutenticado;
            entrarLobby(salaActualId, data, false);
        } else {
            irA('registro');
        }

    } catch (e) { notificar("Error de conexión", "error"); }
}

// --- REGISTRO Y AUTO-SORTEO ---
document.getElementById('formRegistro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const deseo = document.getElementById('regDeseo').value.trim();

    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snapAntes = await getDoc(salaRef);
        const data = snapAntes.data();

        const existe = data.participantes.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        if (existe) {
            guardarSesionLocal(data.codigo, nombre);
            miNombreEnSala = nombre;
            entrarLobby(salaActualId, data, false);
            notificar("Sesión recuperada", "success");
            return;
        }

        if(data.estado === 'cerrada') return notificar("El sorteo ya cerró", "error");
        if(data.participantes.length >= data.maxParticipantes) return notificar("Sala llena", "error");

        await updateDoc(salaRef, { 
            participantes: arrayUnion({ nombre, email, deseo }) 
        });
        
        guardarSesionLocal(data.codigo, nombre);
        miNombreEnSala = nombre;

        const snapDespues = await getDoc(salaRef);
        const dataFinal = snapDespues.data();
        
        if(dataFinal.participantes.length === dataFinal.maxParticipantes && dataFinal.estado === 'abierta') {
            notificar("¡Sala llena! Iniciando sorteo automático...", "info");
            realizarSorteo(true); 
        }

        entrarLobby(salaActualId, dataFinal, false);

    } catch (e) {
        console.error(e);
        notificar("Error al registrar", "error");
    }
});

// --- LOBBY ---
function entrarLobby(id, data, soyAdmin) {
    salaActualId = id;
    irA('lobby');

    document.getElementById('lobbyNombreSala').innerText = data.nombre;
    document.getElementById('lobbyCodigo').innerText = `CÓDIGO: ${data.codigo}`;
    
    const panelAdmin = document.getElementById('panelAdminControls');
    const msgEspera = document.getElementById('msgEspera');
    const btnSorteo = document.getElementById('btnPreSorteo');
    const btnEliminar = document.getElementById('btnEliminarEventoFinal');

    if(soyAdmin) {
        panelAdmin.style.display = 'block';
        msgEspera.style.display = 'none';
        btnEliminar.style.display = 'block';

        if(data.estado === 'cerrada') {
            btnSorteo.style.display = 'none';
            document.getElementById('adminResultadosList').style.display = 'block';
            renderResultados(data.resultados);
        } else {
            btnSorteo.style.display = 'block';
            document.getElementById('adminResultadosList').style.display = 'none';
        }
    } else {
        panelAdmin.style.display = 'none';
        msgEspera.style.display = 'block';
    }

    iniciarTimer(data.fechaTarget);

    if(unsuscribeLobby) unsuscribeLobby();
    unsuscribeLobby = onSnapshot(doc(db, "posadas", id), (docSnap) => {
        if(!docSnap.exists()) return;
        const info = docSnap.data();
        
        document.getElementById('lobbyContador').innerText = `${info.participantes.length}/${info.maxParticipantes}`;
        const list = document.getElementById('listaParticipantes');
        list.innerHTML = '';
        info.participantes.forEach(p => list.innerHTML += `<div>🎅 ${p.nombre}</div>`);

        if(info.estado === 'cerrada' && info.resultados) {
            if(soyAdmin) {
                btnSorteo.style.display = 'none';
                document.getElementById('adminResultadosList').style.display = 'block';
                renderResultados(info.resultados);
            } else if(miNombreEnSala && info.resultados[miNombreEnSala]) {
                mostrarResultado(info.resultados[miNombreEnSala]);
            }
        }
    });
}

function iniciarTimer(fecha) {
    if(timerInterval) clearInterval(timerInterval);
    const display = document.getElementById('timerDisplay');
    const target = new Date(fecha).getTime();

    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const dist = target - now;
        if (dist < 0) {
            clearInterval(timerInterval);
            display.innerText = "¡Es hoy! 🎄"; display.style.color = "var(--accent)";
            return;
        }
        const d = Math.floor(dist / (1000 * 60 * 60 * 24));
        const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
        display.innerText = `${d}d ${h}h ${m}m`;
    }, 1000);
}

// --- SORTEO ---
document.getElementById('btnPreSorteo').addEventListener('click', () => {
    confirmar("¿Forzar sorteo manual ahora?", () => realizarSorteo(false));
});

async function realizarSorteo(esAutomatico = false) {
    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(salaRef);
        const parts = snap.data().participantes;

        if(parts.length < 2) {
            if(!esAutomatico) notificar("Se necesitan mínimo 2 personas", "error");
            return;
        }

        let givers = [...parts].sort(() => Math.random() - 0.5);
        let asignaciones = {};
        
        // Ejecutar sorteo y enviar correos
        for(let i=0; i<givers.length; i++) {
            const quienDa = givers[i];
            const quienRecibe = givers[(i+1) % givers.length];
            asignaciones[quienDa.nombre] = quienRecibe;

            // ENVIAR CORREO REAL CON TUS CLAVES
            if(window.emailjs) {
                emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {
                    to_name: quienDa.nombre,
                    to_email: quienDa.email,
                    target_name: quienRecibe.nombre,
                    target_wish: quienRecibe.deseo
                });
            }
        }

        await updateDoc(salaRef, { estado: 'cerrada', resultados: asignaciones });
        if(!esAutomatico) notificar("Sorteo realizado y correos enviados.", "success");

    } catch (e) {
        console.error(e);
        notificar("Error en el sorteo", "error");
    }
}

function renderResultados(res) {
    const div = document.getElementById('listaParejasAdmin');
    div.innerHTML = '';
    Object.keys(res).forEach(k => {
        div.innerHTML += `<div><span>${k}</span> → <span style="color:var(--accent); font-weight:700;">${res[k].nombre}</span></div>`;
    });
}

function mostrarResultado(destino) {
    limpiarSala();
    irA('resultado');
    document.getElementById('resNombreDestino').innerText = destino.nombre;
    document.getElementById('resDeseoDestino').innerText = destino.deseo;
}

// Iniciar historial al cargar
verificarHistorial();