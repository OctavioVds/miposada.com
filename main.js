// --- IMPORTAR LIBRERÍAS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, onSnapshot, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURACIÓN ---
const firebaseConfig = {
  apiKey: "AIzaSyCwFd_oNfHkUi25GYME0NxuX70cHZT6k6w",
  authDomain: "miposada-98daf.firebaseapp.com",
  projectId: "miposada-98daf",
  storageBucket: "miposada-98daf.firebasestorage.app",
  messagingSenderId: "367576712970",
  appId: "1:367576712970:web:51f77ff6ea7b8d83de1cf3"
};

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

document.getElementById('btnAtras').addEventListener('click', () => {
    // Siempre regresa al home unificado
    irA('home');
    limpiarSala();
});

// --- AUTH & HOME UNIFICADO ---
onAuthStateChanged(auth, (user) => {
    const secInvitado = document.getElementById('seccionInvitado');
    const secAdmin = document.getElementById('seccionAdmin');
    const btnLogout = document.getElementById('btnLogout');

    if (user) {
        usuarioActual = user;
        // MODO ADMIN: Oculta botón login, muestra panel y eventos
        secInvitado.style.display = 'none';
        secAdmin.style.display = 'block';
        btnLogout.style.display = 'block';
        
        activarDashboard(); // Carga los eventos ahí mismo
    } else {
        usuarioActual = null;
        // MODO INVITADO: Muestra botón login, oculta panel
        secInvitado.style.display = 'block';
        secAdmin.style.display = 'none';
        btnLogout.style.display = 'none';
        
        if(unsuscribeDashboard) unsuscribeDashboard();
    }
});

document.getElementById('btnSoyAdmin').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
        // El onAuthStateChanged se encarga del resto
    } catch (e) {
        if(e.code !== 'auth/popup-closed-by-user') notificar("No se pudo iniciar sesión", "error");
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    confirmar("¿Quieres cerrar sesión?", () => {
        signOut(auth);
        // Regresa al estado inicial automáticamente
    });
});

// --- DASHBOARD (MIS EVENTOS) ---
function activarDashboard() {
    if(!usuarioActual) return;
    const lista = document.getElementById('listaMisPosadas');
    lista.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">Cargando eventos...</div>`;
    
    if(unsuscribeDashboard) unsuscribeDashboard();

    const q = query(collection(db, "posadas"), where("creadorEmail", "==", usuarioActual.email));
    
    unsuscribeDashboard = onSnapshot(q, (snapshot) => {
        lista.innerHTML = '';
        if(snapshot.empty) {
            lista.innerHTML = `<div style="text-align:center; padding:30px 20px; color:var(--text-secondary); border:2px dashed var(--border-color); border-radius:var(--radius-md); font-size:0.9rem;">No tienes eventos activos.<br>¡Crea el primero arriba!</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            const estadoClass = data.estado === 'cerrada' ? 'color:var(--success)' : 'color:var(--accent)';
            const estadoTexto = data.estado === 'cerrada' ? 'Finalizado' : 'Activo';

            div.innerHTML = `
                <div>
                    <div style="font-weight:600; font-size:1rem;">${data.nombre}</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px; font-weight:500;">
                        <span style="letter-spacing:1px; font-weight:600;">${data.codigo}</span> • <span style="${estadoClass}">${estadoTexto}</span>
                    </div>
                </div>
                <button class="btn-secondary" style="width:auto; padding:8px 14px; font-size:0.85rem;">Ver</button>
            `;
            div.querySelector('button').onclick = () => entrarLobby(docSnap.id, data, true);
            lista.appendChild(div);
        });
    });
}

// --- CREAR SALA (Modal directo) ---
const modalCrear = document.getElementById('modalCrearPosada');
document.getElementById('btnAbrirModal').addEventListener('click', () => {
    document.getElementById('newNombre').value = "";
    document.getElementById('newFecha').value = "";
    modalCrear.style.display = 'flex';
});

document.getElementById('btnCancelarModal').addEventListener('click', () => modalCrear.style.display = 'none');

document.getElementById('btnConfirmarCrear').addEventListener('click', async () => {
    const nombre = document.getElementById('newNombre').value;
    const fecha = document.getElementById('newFecha').value;
    const max = document.getElementById('newMax').value;

    if(!nombre || !fecha || !max) return notificar("Completa todos los campos", "error");

    const btn = document.getElementById('btnConfirmarCrear');
    btn.disabled = true; btn.innerText = "Creando...";

    try {
        const codigo = Math.random().toString(36).substring(2, 6).toUpperCase();
        await addDoc(collection(db, "posadas"), {
            nombre, fechaTarget: fecha, maxParticipantes: parseInt(max),
            codigo, creadorEmail: usuarioActual.email, estado: 'abierta',
            participantes: [], resultados: {}
        });
        modalCrear.style.display = 'none';
        notificar("¡Evento creado!", "success");
    } catch (e) {
        notificar("Error al crear", "error");
    } finally {
        btn.disabled = false; btn.innerText = "Crear";
    }
});

// --- UNIRSE (INVITADO) ---
document.getElementById('btnIrASala').addEventListener('click', async () => {
    const codigo = document.getElementById('inputCodigoHome').value.trim().toUpperCase();
    if(codigo.length < 3) return notificar("Verifica el código", "error");

    try {
        const q = query(collection(db, "posadas"), where("codigo", "==", codigo));
        const snap = await getDocs(q);

        if(snap.empty) return notificar("Código no encontrado", "error");

        const docSnap = snap.docs[0];
        const data = docSnap.data();

        if(data.participantes.length >= data.maxParticipantes) return notificar("Evento lleno", "error");
        if(data.estado === 'cerrada') return notificar("Sorteo ya realizado", "error");

        salaActualId = docSnap.id;
        document.getElementById('lblNombreSala').innerText = data.nombre;
        irA('registro');

    } catch (e) {
        notificar("Error de conexión", "error");
    }
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value.trim();
    const deseo = document.getElementById('regDeseo').value.trim();
    miNombreEnSala = nombre;

    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const check = await getDoc(salaRef);
        if(check.data().participantes.length >= check.data().maxParticipantes) {
            irA('home');
            return notificar("Evento lleno", "error");
        }

        await updateDoc(salaRef, { participantes: arrayUnion({ nombre, deseo }) });
        entrarLobby(salaActualId, check.data(), false);

    } catch (e) {
        notificar("Error al registrarte", "error");
    }
});

// --- LOBBY LOGICA ---
function entrarLobby(id, data, soyAdmin) {
    salaActualId = id;
    irA('lobby');

    document.getElementById('lobbyNombreSala').innerText = data.nombre;
    document.getElementById('lobbyCodigo').innerText = `CÓDIGO: ${data.codigo}`;
    
    const panelAdmin = document.getElementById('panelAdminControls');
    const msgEspera = document.getElementById('msgEspera');
    const btnSorteo = document.getElementById('btnPreSorteo');

    if(soyAdmin) {
        panelAdmin.style.display = 'block';
        msgEspera.style.display = 'none';
        btnSorteo.style.display = data.estado === 'cerrada' ? 'none' : 'block';
        document.getElementById('adminResultadosList').style.display = data.estado === 'cerrada' ? 'block' : 'none';
        if(data.estado === 'cerrada') renderResultados(data.resultados);
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
        info.participantes.forEach(p => {
            list.innerHTML += `<div>🎅 ${p.nombre}</div>`;
        });

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
            display.innerText = "¡Es hoy! 🎉";
            display.style.color = "var(--accent)";
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
    confirmar("¿Cerrar evento y sortear?", realizarSorteo);
});

async function realizarSorteo() {
    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(salaRef);
        const parts = snap.data().participantes;

        if(parts.length < 2) return notificar("Faltan participantes", "error");

        let givers = [...parts].sort(() => Math.random() - 0.5);
        let asignaciones = {};
        
        for(let i=0; i<givers.length; i++) {
            asignaciones[givers[i].nombre] = givers[(i+1) % givers.length];
        }

        await updateDoc(salaRef, { estado: 'cerrada', resultados: asignaciones });
        notificar("Sorteo realizado", "success");

    } catch (e) {
        notificar("Error al sortear", "error");
    }
}

function renderResultados(res) {
    const div = document.getElementById('listaParejasAdmin');
    div.innerHTML = '';
    Object.keys(res).forEach(k => {
        div.innerHTML += `<div><span style="color:var(--text-secondary)">${k}</span> → <span style="color:var(--accent); font-weight:600;">${res[k].nombre}</span></div>`;
    });
}

function mostrarResultado(destino) {
    limpiarSala();
    irA('resultado');
    document.getElementById('resNombreDestino').innerText = destino.nombre;
    document.getElementById('resDeseoDestino').innerText = destino.deseo;
}