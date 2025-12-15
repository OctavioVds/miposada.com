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

// --- CONFIGURACIÓN EMAILJS (CONFIRMADAS) ---
const EMAIL_SERVICE_ID = "service_ao73611"; 
const EMAIL_TEMPLATE_ID = "template_dp7jafi"; 
const EMAIL_PUBLIC_KEY = "l-_4LrQW8pN7F7MiK"; 

// Inicializar EmailJS con reporte de estado
try {
    if(window.emailjs) {
        window.emailjs.init(EMAIL_PUBLIC_KEY);
        console.log("EmailJS iniciado correctamente ✅");
    }
} catch (e) { console.error("Error iniciando EmailJS", e); }

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// --- UI HELPERS ---
function notificar(msg) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.innerText = msg;
    container.appendChild(toast);
    
    toast.animate([{ opacity:0, transform:'translateY(-10px)' }, { opacity:1, transform:'translateY(0)' }], { duration: 300 });
    setTimeout(() => {
        toast.animate([{ opacity:1 }, { opacity:0 }], { duration: 300 }).onfinish = () => toast.remove();
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

// --- HISTORIAL ---
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
            btn.className = 'quick-join-card';
            btn.onclick = () => reunirseRapido(codigo, nombre);
            btn.innerHTML = `
                <div>
                    <div style="font-weight:700; color:var(--accent); font-size:1.1rem;">${codigo}</div>
                    <div style="font-size:0.85rem; color:#666">Como: <strong>${nombre}</strong></div>
                </div>
                <div style="color:var(--accent); font-weight:bold;">➜</div>
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
let usuarioActual = null;
let salaActualId = null;
let miNombreEnSala = null;
let unsuscribeLobby = null;
let unsuscribeDashboard = null;
let timerInterval = null;

const vistas = {
    home: document.getElementById('vistaHome'),
    registro: document.getElementById('vistaRegistro'),
    lobby: document.getElementById('vistaLobby'),
    resultado: document.getElementById('vistaResultado')
};

function irA(vista) {
    Object.values(vistas).forEach(v => { if(v) v.style.display = 'none'; });
    if(vistas[vista]) vistas[vista].style.display = 'block';
    
    const btnAtras = document.getElementById('btnAtras');
    const titulo = document.getElementById('tituloPrincipal');
    
    if (vista === 'home') {
        if(btnAtras) btnAtras.style.display = 'none';
        if(titulo) titulo.innerText = "Intercambio";
        verificarHistorial();
    } else {
        if(btnAtras) btnAtras.style.display = 'block';
        if(titulo) {
            if(vista === 'registro') titulo.innerText = "Registro";
            if(vista === 'lobby') titulo.innerText = "Sala de Espera";
            if(vista === 'resultado') titulo.innerText = "¡Sorpresa!";
        }
    }
}

document.getElementById('btnAtras')?.addEventListener('click', () => {
    irA('home');
    if(unsuscribeLobby) unsuscribeLobby();
});

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    const secInvitado = document.getElementById('seccionInvitado');
    const secAdmin = document.getElementById('seccionAdmin');
    const btnLogout = document.getElementById('btnLogout');

    if (user) {
        usuarioActual = user;
        if(secInvitado) secInvitado.style.display = 'none';
        if(secAdmin) secAdmin.style.display = 'block';
        if(btnLogout) btnLogout.style.display = 'block';
        activarDashboard();
    } else {
        usuarioActual = null;
        if(secInvitado) secInvitado.style.display = 'block';
        if(secAdmin) secAdmin.style.display = 'none';
        if(btnLogout) btnLogout.style.display = 'none';
    }
});

document.getElementById('btnSoyAdmin')?.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
});

document.getElementById('btnLogout')?.addEventListener('click', () => {
    confirmar("¿Quieres cerrar sesión?", () => signOut(auth));
});

// --- DASHBOARD ---
function activarDashboard() {
    if(!usuarioActual) return;
    const lista = document.getElementById('listaMisPosadas');
    if(!lista) return;

    lista.innerHTML = `<div style="text-align:center; padding:20px; color:#999">Cargando...</div>`;
    
    if(unsuscribeDashboard) unsuscribeDashboard();
    const q = query(collection(db, "posadas"), where("creadorEmail", "==", usuarioActual.email));
    
    unsuscribeDashboard = onSnapshot(q, (snapshot) => {
        lista.innerHTML = '';
        if(snapshot.empty) {
            lista.innerHTML = `<div style="text-align:center; padding:30px; color:#999; border:2px dashed #EEE; border-radius:16px;">Sin eventos creados.</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = 'clean-card';
            
            const esFinalizado = data.estado === 'cerrada';
            const dotClass = esFinalizado ? 'status-finished' : 'status-dot';
            const estadoTxt = esFinalizado ? 'Finalizado' : 'Activo';

            div.innerHTML = `
                <div>
                    <h3 class="card-title">${data.nombre}</h3>
                    <div class="card-subtitle">
                        <span class="${dotClass}"></span>
                        <span style="font-weight:600; letter-spacing:1px;">${data.codigo}</span>
                        <span>•</span>
                        <span>${estadoTxt}</span>
                    </div>
                </div>
                <div class="action-row">
                    <button class="icon-btn" onclick="irEvento('${docSnap.id}')" title="Ver">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="icon-btn delete" onclick="eliminarEventoExterno('${docSnap.id}')" title="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
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
    confirmar("¿Eliminar evento permanentemente?", async () => {
        try { await deleteDoc(doc(db, "posadas", id)); notificar("Evento eliminado"); } 
        catch (e) { notificar("Error al eliminar"); }
    });
};

document.getElementById('btnEliminarEventoFinal')?.addEventListener('click', () => {
    confirmar("¿Borrar este evento?", async () => {
        try { await deleteDoc(doc(db, "posadas", salaActualId)); notificar("Eliminado", "success"); irA('home'); } 
        catch(e) { notificar("Error", "error"); }
    });
});

// --- CREAR SALA ---
const modalCrear = document.getElementById('modalCrearPosada');
document.getElementById('btnAbrirModal')?.addEventListener('click', () => {
    document.getElementById('newNombre').value = ""; document.getElementById('newFecha').value = "";
    if(modalCrear) modalCrear.style.display = 'flex';
});
document.getElementById('btnCancelarModal')?.addEventListener('click', () => {
    if(modalCrear) modalCrear.style.display = 'none';
});

document.getElementById('btnConfirmarCrear')?.addEventListener('click', async () => {
    const nombre = document.getElementById('newNombre').value;
    const fecha = document.getElementById('newFecha').value;
    const max = document.getElementById('newMax').value;

    if(!nombre || !fecha || !max) return notificar("Faltan datos");

    const btn = document.getElementById('btnConfirmarCrear');
    btn.innerText = "..."; btn.disabled = true;

    try {
        const codigo = Math.random().toString(36).substring(2, 6).toUpperCase();
        await addDoc(collection(db, "posadas"), {
            nombre, fechaTarget: fecha, maxParticipantes: parseInt(max),
            codigo, creadorEmail: usuarioActual.email, estado: 'abierta',
            participantes: [], resultados: {}
        });
        if(modalCrear) modalCrear.style.display = 'none';
        notificar("¡Evento creado!");
    } catch (e) { notificar("Error al crear"); } 
    finally { btn.innerText = "Crear"; btn.disabled = false; }
});

// --- LÓGICA DE UNIRSE ---
document.getElementById('btnIrASala')?.addEventListener('click', () => {
    const codigoInput = document.getElementById('inputCodigoHome');
    if(!codigoInput) return;
    
    const codigo = codigoInput.value.trim().toUpperCase();
    if(codigo.length < 3) return notificar("Código muy corto");
    
    const nombreGuardado = obtenerSesionLocal(codigo);
    if(nombreGuardado) intentarUnirse(codigo, nombreGuardado);
    else intentarUnirse(codigo, null);
});

async function intentarUnirse(codigo, nombreAutenticado) {
    try {
        const q = query(collection(db, "posadas"), where("codigo", "==", codigo));
        const snap = await getDocs(q);

        if(snap.empty) {
            notificar("El evento no existe");
            localStorage.removeItem(`evento_${codigo}`);
            verificarHistorial();
            document.getElementById('inputCodigoHome').value = "";
            return;
        }

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
    } catch (e) { 
        console.error(e);
        notificar("Error de conexión"); 
    }
}

document.getElementById('formRegistro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const deseo = document.getElementById('regDeseo').value.trim();

    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(salaRef);
        const data = snap.data();

        if (data.participantes.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
            notificar("¡Bienvenido de nuevo!");
            guardarSesionLocal(data.codigo, nombre);
            miNombreEnSala = nombre;
            entrarLobby(salaActualId, data, false);
            return;
        }

        if(data.estado === 'cerrada') return notificar("El sorteo ya cerró");
        if(data.participantes.length >= data.maxParticipantes) return notificar("Sala llena");

        await updateDoc(salaRef, { participantes: arrayUnion({ nombre, email, deseo }) });
        guardarSesionLocal(data.codigo, nombre);
        miNombreEnSala = nombre;

        const snapFinal = await getDoc(salaRef);
        const dataFinal = snapFinal.data();
        if(dataFinal.participantes.length === dataFinal.maxParticipantes && dataFinal.estado === 'abierta') {
            notificar("¡Sala llena! Sorteando...");
            realizarSorteo(true);
        }

        entrarLobby(salaActualId, dataFinal, false);

    } catch (e) { notificar("Error al entrar"); }
});

// --- LOBBY Y SORTEO ---
function entrarLobby(id, data, soyAdmin) {
    salaActualId = id;
    irA('lobby');

    document.getElementById('lobbyNombreSala').innerText = data.nombre;
    document.getElementById('lobbyCodigo').innerText = data.codigo;
    
    const panel = document.getElementById('panelAdminControls');
    const msg = document.getElementById('msgEspera');
    
    if(soyAdmin) {
        panel.style.display = 'block';
        msg.style.display = 'none';
        
        const btnSorteo = document.getElementById('btnPreSorteo');
        const resultadosList = document.getElementById('adminResultadosList');
        
        if(data.estado === 'cerrada') {
            btnSorteo.style.display = 'none';
            resultadosList.style.display = 'block';
            renderResultados(data.resultados);
        } else {
            btnSorteo.style.display = 'block';
            resultadosList.style.display = 'none';
        }
    } else {
        panel.style.display = 'none';
        msg.style.display = 'block';
    }

    iniciarTimer(data.fechaTarget);

    if(unsuscribeLobby) unsuscribeLobby();
    unsuscribeLobby = onSnapshot(doc(db, "posadas", id), (docSnap) => {
        if(!docSnap.exists()) return;
        const info = docSnap.data();
        
        document.getElementById('lobbyContador').innerText = `${info.participantes.length}/${info.maxParticipantes}`;
        
        const lista = document.getElementById('listaParticipantes');
        lista.innerHTML = '';
        info.participantes.forEach(p => {
            lista.innerHTML += `<div class="clean-card" style="padding:10px 16px; margin-bottom:8px;">🎅 ${p.nombre}</div>`;
        });

        if(info.estado === 'cerrada' && info.resultados) {
            if(soyAdmin) {
                document.getElementById('btnPreSorteo').style.display = 'none';
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
            display.innerText = "¡Es hoy!"; display.style.color = "var(--accent)";
            clearInterval(timerInterval); return;
        }
        const d = Math.floor(dist / (1000 * 60 * 60 * 24));
        const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
        display.innerText = `${d}d ${h}h ${m}m`;
    }, 1000);
}

document.getElementById('btnPreSorteo')?.addEventListener('click', () => {
    confirmar("¿Forzar sorteo ahora?", () => realizarSorteo(false));
});

// --- LÓGICA DE CORREO REFORZADA ---
async function realizarSorteo(esAutomatico) {
    try {
        const docRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(docRef);
        const parts = snap.data().participantes;

        if(parts.length < 2) {
            if(!esAutomatico) notificar("Faltan participantes");
            return;
        }

        let givers = [...parts].sort(() => Math.random() - 0.5);
        let asignaciones = {};
        
        // Loop para asignar y enviar correos
        for(let i=0; i<givers.length; i++) {
            const giver = givers[i];
            const receiver = givers[(i+1) % givers.length];
            asignaciones[giver.nombre] = receiver;

            // Enviar Correo con LOGGING y retraso ligero
            if(window.emailjs) {
                // Pequeña pausa para no saturar la API gratuita
                await new Promise(r => setTimeout(r, 500)); 
                
                emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, {
                    to_name: giver.nombre,
                    to_email: giver.email,
                    target_name: receiver.nombre,
                    target_wish: receiver.deseo
                })
                .then(() => console.log(`✅ Correo enviado a ${giver.email}`))
                .catch((err) => console.error(`❌ Error enviando a ${giver.email}`, err));
            }
        }

        await updateDoc(docRef, { estado: 'cerrada', resultados: asignaciones });
        if(!esAutomatico) notificar("Sorteo realizado y correos enviados");

    } catch (e) { 
        console.error(e);
        notificar("Error en el sorteo"); 
    }
}

function renderResultados(resultados) {
    const div = document.getElementById('listaParejasAdmin');
    if(div) {
        div.innerHTML = '';
        Object.keys(resultados).forEach(giver => {
            div.innerHTML += `
                <div class="clean-card" style="padding:10px; font-size:0.9rem; margin-bottom:8px;">
                    <span>${giver}</span>
                    <span style="color:var(--accent); font-weight:bold;">➜</span>
                    <strong>${resultados[giver].nombre}</strong>
                </div>
            `;
        });
    }
}

function mostrarResultado(destino) {
    irA('resultado');
    document.getElementById('resNombreDestino').innerText = destino.nombre;
    document.getElementById('resDeseoDestino').innerText = destino.deseo;
}

document.getElementById('btnEliminarEventoFinal')?.addEventListener('click', () => {
    confirmar("¿Eliminar evento permanentemente?", async () => {
        await deleteDoc(doc(db, "posadas", salaActualId));
        irA('home');
    });
});

verificarHistorial();