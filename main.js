// --- IMPORTAR LIBRERÍAS DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion, onSnapshot, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// CONFIGURACIÓN (TUS CLAVES)
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

// --- UTILIDAD: MENSAJES BONITOS (TOASTS) ---
function mostrarNotificacion(mensaje, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- UTILIDAD: CONFIRMACIÓN BONITA (SIN ALERTAS FEAS) ---
function confirmarAccion(mensaje, accionSi, accionNo = null) {
    const modal = document.getElementById('modalConfirmacion');
    const txt = document.getElementById('txtConfirmacion');
    const btnSi = document.getElementById('btnSiConfirm');
    const btnNo = document.getElementById('btnNoConfirm');

    txt.innerText = mensaje;
    modal.style.display = 'flex';

    // Limpiar eventos anteriores (clonar nodo)
    const nuevoSi = btnSi.cloneNode(true);
    const nuevoNo = btnNo.cloneNode(true);
    btnSi.parentNode.replaceChild(nuevoSi, btnSi);
    btnNo.parentNode.replaceChild(nuevoNo, btnNo);

    nuevoSi.addEventListener('click', () => {
        modal.style.display = 'none';
        accionSi();
    });

    nuevoNo.addEventListener('click', () => {
        modal.style.display = 'none';
        if(accionNo) accionNo();
    });
}

// --- VARIABLES ---
const vHome = document.getElementById('vistaHome');
const vAdmin = document.getElementById('vistaAdminDashboard');
const vRegistro = document.getElementById('vistaRegistro');
const vLobby = document.getElementById('vistaLobby');
const vResultado = document.getElementById('vistaResultado');
const allVistas = [vHome, vAdmin, vRegistro, vLobby, vResultado];

const modalCrear = document.getElementById('modalCrearPosada');
let usuarioActual = null;
let salaActualId = null;
let miNombreEnSala = null;
let unsuscribeLobby = null;
let unsuscribeDashboard = null; // Para el dashboard en tiempo real
let timerInterval = null; // Para la cuenta regresiva

// --- NAVEGACIÓN ---
function mostrarVista(vista) {
    allVistas.forEach(v => v.style.display = 'none');
    vista.style.display = 'block';
}

// --- AUTH & DASHBOARD ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioActual = user;
        document.getElementById('adminNombre').innerText = user.displayName;
        document.getElementById('btnLogout').style.display = 'inline-block';
    } else {
        usuarioActual = null;
        document.getElementById('btnLogout').style.display = 'none';
        if(unsuscribeDashboard) unsuscribeDashboard(); // Dejar de escuchar si salgo
        mostrarVista(vHome);
    }
});

document.getElementById('btnSoyAdmin').addEventListener('click', async () => {
    if (usuarioActual) {
        mostrarVista(vAdmin);
        activarDashboardRealTime(); // Activar escucha en vivo
    } else {
        try {
            await signInWithPopup(auth, provider);
            mostrarVista(vAdmin);
            activarDashboardRealTime(); // Activar escucha en vivo tras login
            mostrarNotificacion("¡Bienvenido Organizador! ", "success");
        } catch (error) {
            if(error.code !== 'auth/popup-closed-by-user') {
                mostrarNotificacion("Error al iniciar sesión.", "error");
            }
        }
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth);
    if(unsuscribeDashboard) unsuscribeDashboard();
    mostrarNotificacion("Sesión cerrada", "info");
});

// DASHBOARD EN TIEMPO REAL (UPDATE INSTANTÁNEO)
function activarDashboardRealTime() {
    if(!usuarioActual) return;
    const lista = document.getElementById('listaMisPosadas');
    
    // Spinner inicial
    lista.innerHTML = `<div style="text-align:center; padding:20px;">⏳<p style="color:#94a3b8;">Cargando...</p></div>`;

    if(unsuscribeDashboard) unsuscribeDashboard(); // Limpiar anterior

    const q = query(collection(db, "posadas"), where("creadorEmail", "==", usuarioActual.email));
    
    unsuscribeDashboard = onSnapshot(q, (snapshot) => {
        lista.innerHTML = '';
        
        if(snapshot.empty) {
            lista.innerHTML = `
                <div style="text-align:center; padding: 30px 10px; border: 2px dashed #334155; border-radius: 12px; opacity: 0.7;">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">📭</div>
                    <p style="color:#e2e8f0; margin: 0; font-weight:bold;">Nada por aquí</p>
                    <p style="color:#94a3b8; font-size: 0.85rem; margin-top:5px;">Crea tu primera posada arriba.</p>
                </div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style.cssText = "background: #1e293b; padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;";
            
            // Estado visual
            const estadoBadge = data.estado === 'cerrada' 
                ? '<span style="color:#10b981; font-size:0.7rem; border:1px solid #10b981; padding:2px 4px; border-radius:4px;">REALIZADA</span>' 
                : '<span style="color:#facc15; font-size:0.7rem;">ABIERTA</span>';

            div.innerHTML = `
                <div>
                    <div style="color:#fff; font-weight:bold; font-size: 1rem;">${data.nombre} ${estadoBadge}</div>
                    <div style="color:#94a3b8; font-size:0.75rem; margin-top:4px;">
                        CÓDIGO: <span style="color:#facc15; font-weight:bold;">${data.codigo}</span>
                    </div>
                </div>
                <button class="btn-secondary" style="width:auto; padding:8px 16px; font-size:0.8rem; height: fit-content;">Ver</button>
            `;
            div.querySelector('button').onclick = () => entrarAlLobby(docSnap.id, data, true);
            lista.appendChild(div);
        });
    });
}

// --- CREAR POSADA (CON FECHA) ---
document.getElementById('btnAbrirModal').addEventListener('click', () => {
    document.getElementById('newNombre').value = ""; 
    document.getElementById('newFecha').value = ""; 
    modalCrear.style.display = 'flex'; 
});

document.getElementById('btnCancelarModal').addEventListener('click', () => {
    modalCrear.style.display = 'none';
});

document.getElementById('btnConfirmarCrear').addEventListener('click', async () => {
    const nombre = document.getElementById('newNombre').value;
    const fecha = document.getElementById('newFecha').value;
    const max = document.getElementById('newMax').value;
    
    if(!nombre || !max || !fecha) return mostrarNotificacion("Llena todos los datos, incluida la fecha", "error");

    const btn = document.getElementById('btnConfirmarCrear');
    btn.disabled = true; 
    btn.innerText = "...";

    try {
        const codigo = Math.random().toString(36).substring(2, 6).toUpperCase();
        await addDoc(collection(db, "posadas"), {
            nombre: nombre,
            fechaTarget: fecha, // Guardamos la fecha
            maxParticipantes: parseInt(max),
            codigo: codigo,
            creadorEmail: usuarioActual.email,
            estado: 'abierta',
            participantes: [],
            resultados: {}
        });
        
        modalCrear.style.display = 'none';
        mostrarNotificacion(`¡Sala creada!`, "success");
        // No necesitamos llamar a cargarMisPosadas() manual, el onSnapshot lo hará solo.
        
    } catch (e) {
        mostrarNotificacion("Error al crear. Intenta de nuevo.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Crear Sala";
    }
});


// --- UNIRSE A SALA ---

document.getElementById('btnIrASala').addEventListener('click', async () => {
    const codigo = document.getElementById('inputCodigoHome').value.trim().toUpperCase();
    if(codigo.length < 3) return mostrarNotificacion("Código inválido", "error");

    try {
        const q = query(collection(db, "posadas"), where("codigo", "==", codigo));
        const snap = await getDocs(q);

        if(snap.empty) return mostrarNotificacion("Ese código no existe", "error");

        const docSnap = snap.docs[0];
        const data = docSnap.data();

        // VALIDACIÓN DE CAPACIDAD (SEGURIDAD)
        if(data.participantes.length >= data.maxParticipantes) {
            mostrarNotificacion("🚫 Sala llena. Ya no caben más.", "error");
            return;
        }

        if(data.estado === 'cerrada') {
            mostrarNotificacion("🔒 El sorteo ya se realizó.", "error");
        } else {
            salaActualId = docSnap.id;
            document.getElementById('lblNombreSala').innerText = data.nombre;
            mostrarVista(vRegistro);
        }
    } catch (e) {
        mostrarNotificacion("Error de conexión", "error");
    }
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value.trim();
    const deseo = document.getElementById('regDeseo').value.trim();
    miNombreEnSala = nombre;

    try {
        const salaRef = doc(db, "posadas", salaActualId);
        
        // DOBLE CHECK DE SEGURIDAD ANTES DE ENTRAR
        const checkSnap = await getDoc(salaRef);
        const checkData = checkSnap.data();
        
        if(checkData.participantes.length >= checkData.maxParticipantes) {
            mostrarNotificacion("⛔ Mala suerte, se llenó justo ahora.", "error");
            mostrarVista(vHome);
            return;
        }

        // SI HAY LUGAR, ENTRAR
        await updateDoc(salaRef, {
            participantes: arrayUnion({ nombre, deseo })
        });
        
        entrarAlLobby(salaActualId, checkData, false);

    } catch (e) {
        mostrarNotificacion("Error al registrarte", "error");
    }
});

document.getElementById('btnVolverHome').addEventListener('click', () => {
    if(unsuscribeDashboard) unsuscribeDashboard();
    mostrarVista(vHome);
});


// --- LOBBY Y LOGICA PRINCIPAL ---

function entrarAlLobby(id, data, soyAdmin) {
    salaActualId = id;
    mostrarVista(vLobby);
    
    document.getElementById('lobbyNombreSala').innerText = data.nombre;
    document.getElementById('lobbyCodigo').innerText = `CÓDIGO: ${data.codigo}`;
    
    const panelAdmin = document.getElementById('panelAdminControls');
    const msgEspera = document.getElementById('msgEspera');
    const btnPreSorteo = document.getElementById('btnPreSorteo');
    const resultList = document.getElementById('adminResultadosList');

    // Configurar interfaz Admin/Invitado
    if(soyAdmin) {
        panelAdmin.style.display = 'block';
        msgEspera.style.display = 'none';
        
        // Lógica de Estado Cerrado/Abierto
        if(data.estado === 'cerrada') {
            btnPreSorteo.style.display = 'none'; // Ya no se puede sortear
            resultList.style.display = 'block'; // Mostrar resultados
            renderResultadosAdmin(data.resultados);
        } else {
            btnPreSorteo.style.display = 'block';
            resultList.style.display = 'none';
            document.getElementById('listaParejasAdmin').innerHTML = '';
        }

    } else {
        panelAdmin.style.display = 'none';
        msgEspera.style.display = 'block';
    }

    // INICIAR CUENTA REGRESIVA
    iniciarCuentaRegresiva(data.fechaTarget);

    // ESCUCHAR CAMBIOS (REAL-TIME)
    if(unsuscribeLobby) unsuscribeLobby();
    
    unsuscribeLobby = onSnapshot(doc(db, "posadas", id), (docSnap) => {
        if(!docSnap.exists()) return;
        const info = docSnap.data();

        document.getElementById('lobbyContador').innerText = `${info.participantes.length}/${info.maxParticipantes}`;

        const listaDiv = document.getElementById('listaParticipantes');
        listaDiv.innerHTML = '';
        info.participantes.forEach(p => {
            const pDiv = document.createElement('div');
            pDiv.innerHTML = `<span style="color:#94a3b8;">🎅</span> <span style="color:#e2e8f0;">${p.nombre}</span>`;
            pDiv.style.padding = "6px 0";
            pDiv.style.borderBottom = "1px solid #1e293b";
            listaDiv.appendChild(pDiv);
        });

        // SI YA SE CERRÓ
        if(info.estado === 'cerrada' && info.resultados) {
            if(soyAdmin) {
                btnPreSorteo.style.display = 'none'; // Bloquear botón
                resultList.style.display = 'block';
                renderResultadosAdmin(info.resultados);
            } else if (miNombreEnSala) {
                // Si soy invitado, mostrar mi resultado
                const destino = info.resultados[miNombreEnSala];
                if(destino) mostrarResultadoIndividual(destino);
            }
        }
    });
}

// --- TIMER CUENTA REGRESIVA ---
function iniciarCuentaRegresiva(fechaTarget) {
    if(timerInterval) clearInterval(timerInterval);
    const display = document.getElementById('timerDisplay');
    
    if(!fechaTarget) {
        display.innerText = "Sin fecha";
        return;
    }

    const targetDate = new Date(fechaTarget).getTime();

    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            display.innerText = "¡ES HOY! 🎄";
            display.style.color = "#facc15";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        display.innerText = `${days}d ${hours}h ${minutes}m`;
    }, 1000);
}

// --- SORTEO (LÓGICA SEGURA) ---
document.getElementById('btnPreSorteo').addEventListener('click', () => {
    // Usamos nuestro MODAL BONITO en lugar de confirm()
    confirmarAccion(
        "¿Cerrar sala y sortear ahora? (No se podrá deshacer)", 
        realizarSorteo // Si dice que sí, ejecutamos esto
    );
});

async function realizarSorteo() {
    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(salaRef);
        const parts = snap.data().participantes;

        if(parts.length < 2) return mostrarNotificacion("Mínimo 2 personas requeridas", "error");

        let asignaciones = {};
        let givers = [...parts];
        let receivers = [...parts];
        
        // Algoritmo simple de derangement (evitar que te toques a ti mismo)
        // Para simplificar y evitar loops infinitos en JS simple:
        givers.sort(() => Math.random() - 0.5);
        
        for(let i=0; i < givers.length; i++) {
            const quienDa = givers[i];
            const quienRecibe = givers[(i + 1) % givers.length]; // Cadena circular
            asignaciones[quienDa.nombre] = quienRecibe;
        }

        await updateDoc(salaRef, { 
            estado: 'cerrada',  // BLOQUEA LA SALA
            resultados: asignaciones 
        });
        
        mostrarNotificacion("¡Sorteo realizado con éxito! 🎁", "success");

    } catch (e) {
        console.error(e);
        mostrarNotificacion("Error en el sorteo", "error");
    }
}

function renderResultadosAdmin(resultados) {
    const div = document.getElementById('listaParejasAdmin');
    div.innerHTML = '';
    
    // Convertir objeto a array para mostrar
    Object.keys(resultados).forEach(origen => {
        const destino = resultados[origen];
        const p = document.createElement('div');
        p.style.padding = "4px 0";
        p.style.borderBottom = "1px solid #334155";
        p.innerHTML = `<strong style="color:#94a3b8;">${origen}</strong> ➔ <span style="color:#facc15;">${destino.nombre}</span>`;
        div.appendChild(p);
    });
}

function mostrarResultadoIndividual(destino) {
    if(unsuscribeLobby) unsuscribeLobby();
    if(timerInterval) clearInterval(timerInterval); // Detener timer
    mostrarVista(vResultado);
    document.getElementById('resNombreDestino').innerText = destino.nombre;
    document.getElementById('resDeseoDestino').innerText = destino.deseo;
}