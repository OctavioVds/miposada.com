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
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function confirmar(mensaje, accionSi) {
    const modal = document.getElementById('modalConfirmacion');
    document.getElementById('txtConfirmacion').innerText = mensaje;
    modal.style.display = 'flex';

    // Clonar para limpiar eventos previos
    const btnSi = document.getElementById('btnSiConfirm');
    const btnNo = document.getElementById('btnNoConfirm');
    const nuevoSi = btnSi.cloneNode(true);
    const nuevoNo = btnNo.cloneNode(true);
    
    btnSi.parentNode.replaceChild(nuevoSi, btnSi);
    btnNo.parentNode.replaceChild(nuevoNo, btnNo);

    nuevoSi.addEventListener('click', () => { modal.style.display = 'none'; accionSi(); });
    nuevoNo.addEventListener('click', () => { modal.style.display = 'none'; });
}

// --- VARIABLES DE ESTADO ---
const vistas = {
    home: document.getElementById('vistaHome'),
    admin: document.getElementById('vistaAdminDashboard'),
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

    // Lógica del botón ATRÁS
    const btnAtras = document.getElementById('btnAtras');
    if (vistaNombre === 'home') {
        btnAtras.style.display = 'none';
        limpiarSala();
    } else {
        btnAtras.style.display = 'flex';
    }
}

function limpiarSala() {
    salaActualId = null;
    miNombreEnSala = null;
    if(unsuscribeLobby) unsuscribeLobby();
    if(timerInterval) clearInterval(timerInterval);
}

// --- BOTÓN ATRÁS (LÓGICA INTELIGENTE) ---
document.getElementById('btnAtras').addEventListener('click', () => {
    // Si estoy en lobby o registro, vuelvo al Home (o Admin si soy admin)
    if (vistas.lobby.style.display === 'block' || vistas.registro.style.display === 'block' || vistas.resultado.style.display === 'block') {
        if(usuarioActual && document.getElementById('panelAdminControls').style.display === 'block') {
             // Si soy admin viendo una sala, vuelvo al dashboard
             irA('admin');
             activarDashboard();
        } else {
            // Si soy usuario normal o admin en otra vista, vuelvo al home
             irA('home');
             if(usuarioActual) irA('admin'); // Preferencia: Si está logueado, al dashboard
        }
    } else if (vistas.admin.style.display === 'block') {
        // Si estoy en dashboard admin, ir atrás es ir al home (o salir?)
        // Dejémoslo que vaya al home simple.
        irA('home');
    }
    limpiarSala();
});


// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioActual = user;
        document.getElementById('adminNombre').innerText = user.displayName.split(' ')[0]; // Solo primer nombre
        document.getElementById('btnLogout').style.display = 'block';
    } else {
        usuarioActual = null;
        document.getElementById('btnLogout').style.display = 'none';
        if(unsuscribeDashboard) unsuscribeDashboard();
        irA('home');
    }
});

document.getElementById('btnSoyAdmin').addEventListener('click', async () => {
    if (usuarioActual) {
        activarDashboard();
        irA('admin');
    } else {
        try {
            await signInWithPopup(auth, provider);
            activarDashboard();
            irA('admin');
        } catch (e) {
            if(e.code !== 'auth/popup-closed-by-user') notificar("Error de acceso", "error");
        }
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth);
    irA('home');
});

// --- DASHBOARD ADMIN ---
function activarDashboard() {
    if(!usuarioActual) return;
    const lista = document.getElementById('listaMisPosadas');
    lista.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Cargando...</div>`;
    
    if(unsuscribeDashboard) unsuscribeDashboard();

    const q = query(collection(db, "posadas"), where("creadorEmail", "==", usuarioActual.email));
    
    unsuscribeDashboard = onSnapshot(q, (snapshot) => {
        lista.innerHTML = '';
        if(snapshot.empty) {
            lista.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">No tienes eventos activos</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:15px; background:var(--bg-dark); border-radius:12px; margin-bottom:10px; border:1px solid var(--border);";
            
            const estado = data.estado === 'cerrada' ? 'Finalizado' : 'Activo';
            const colorEstado = data.estado === 'cerrada' ? '#10b981' : '#fbbf24';

            div.innerHTML = `
                <div>
                    <div style="font-weight:600; font-size:0.95rem;">${data.nombre}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                        ${data.codigo} • <span style="color:${colorEstado}">${estado}</span>
                    </div>
                </div>
                <button class="btn-secondary" style="width:auto; padding:8px 16px; font-size:0.8rem;">Ver</button>
            `;
            div.querySelector('button').onclick = () => entrarLobby(docSnap.id, data, true);
            lista.appendChild(div);
        });
    });
}

// --- CREAR SALA ---
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
    btn.disabled = true; btn.innerText = "...";

    try {
        const codigo = Math.random().toString(36).substring(2, 6).toUpperCase();
        await addDoc(collection(db, "posadas"), {
            nombre, fechaTarget: fecha, maxParticipantes: parseInt(max),
            codigo, creadorEmail: usuarioActual.email, estado: 'abierta',
            participantes: [], resultados: {}
        });
        modalCrear.style.display = 'none';
        notificar("Evento creado correctamente", "success");
    } catch (e) {
        notificar("Error al crear", "error");
    } finally {
        btn.disabled = false; btn.innerText = "Crear";
    }
});

// --- UNIRSE (INVITADO) ---
document.getElementById('btnIrASala').addEventListener('click', async () => {
    const codigo = document.getElementById('inputCodigoHome').value.trim().toUpperCase();
    if(codigo.length < 3) return notificar("Código inválido", "error");

    try {
        const q = query(collection(db, "posadas"), where("codigo", "==", codigo));
        const snap = await getDocs(q);

        if(snap.empty) return notificar("No encontramos ese evento", "error");

        const docSnap = snap.docs[0];
        const data = docSnap.data();

        if(data.participantes.length >= data.maxParticipantes) return notificar("El evento está lleno", "error");
        if(data.estado === 'cerrada') return notificar("Este evento ya finalizó", "error");

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
        
        // Verificación final de cupo
        const check = await getDoc(salaRef);
        if(check.data().participantes.length >= check.data().maxParticipantes) {
            irA('home');
            return notificar("Se acaba de llenar", "error");
        }

        await updateDoc(salaRef, { participantes: arrayUnion({ nombre, deseo }) });
        entrarLobby(salaActualId, check.data(), false);

    } catch (e) {
        notificar("No pudimos registrarte", "error");
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
            list.innerHTML += `<div>${p.nombre}</div>`;
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
            display.innerText = "¡Es hoy!";
            display.style.color = "#fbbf24";
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
    confirmar("¿Realizar el sorteo ahora?", realizarSorteo);
});

async function realizarSorteo() {
    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(salaRef);
        const parts = snap.data().participantes;

        if(parts.length < 2) return notificar("Se necesitan más participantes", "error");

        let givers = [...parts].sort(() => Math.random() - 0.5);
        let asignaciones = {};
        
        for(let i=0; i<givers.length; i++) {
            asignaciones[givers[i].nombre] = givers[(i+1) % givers.length];
        }

        await updateDoc(salaRef, { estado: 'cerrada', resultados: asignaciones });
        notificar("Sorteo completado", "success");

    } catch (e) {
        notificar("Error al sortear", "error");
    }
}

function renderResultados(res) {
    const div = document.getElementById('listaParejasAdmin');
    div.innerHTML = '';
    Object.keys(res).forEach(k => {
        div.innerHTML += `<div style="font-size:0.85rem; border-bottom:1px solid #334155; padding:4px;">${k} → <span style="color:#fbbf24">${res[k].nombre}</span></div>`;
    });
}

function mostrarResultado(destino) {
    limpiarSala(); // Detener listeners
    irA('resultado');
    document.getElementById('resNombreDestino').innerText = destino.nombre;
    document.getElementById('resDeseoDestino').innerText = destino.deseo;
}