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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// --- UI HELPERS ---
function notificar(msg, duracion=3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, duracion);
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
    localStorage.setItem('evento_' + codigo, nombre);
    verificarHistorial();
}

function obtenerSesionLocal(codigo) {
    return localStorage.getItem('evento_' + codigo);
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
    const input = document.getElementById('inputCodigoHome');
    if(input) input.value = codigo;
    await intentarUnirse(codigo, nombre); 
};

// --- NAVEGACIÓN ---
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
    
    if (vista === 'home') {
        if(btnAtras) btnAtras.style.display = 'none';
        verificarHistorial();
    } else {
        if(btnAtras) btnAtras.style.display = 'block';
    }
}

document.getElementById('btnAtras')?.addEventListener('click', () => {
    irA('home');
    if(unsuscribeLobby) unsuscribeLobby();
});

// --- AUTH ---
let usuarioActual = null;
let salaActualId = null;
let miNombreEnSala = null;
let unsuscribeLobby = null;
let unsuscribeDashboard = null;
let timerInterval = null;

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

// --- DASHBOARD ADMIN ---
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
            const estadoTxt = esFinalizado ? 'Finalizado' : 'Activo';

            div.innerHTML = `
                <div>
                    <h3 class="card-title">${data.nombre}</h3>
                    <div class="card-subtitle">
                        <span class="${esFinalizado ? 'status-finished' : 'status-dot'}"></span>
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

// --- CREAR SALA ---
const modalCrear = document.getElementById('modalCrearPosada');
document.getElementById('btnAbrirModal')?.addEventListener('click', () => {
    document.getElementById('newNombre').value = "";
    const fechaInput = document.getElementById('newFecha');
    fechaInput.value = "";
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    fechaInput.min = now.toISOString().slice(0, 16);

    if(modalCrear) modalCrear.style.display = 'flex';
});

document.getElementById('btnCancelarModal')?.addEventListener('click', () => {
    if(modalCrear) modalCrear.style.display = 'none';
});

document.getElementById('btnConfirmarCrear')?.addEventListener('click', async () => {
    const nombre = document.getElementById('newNombre').value.trim();
    const fecha = document.getElementById('newFecha').value;
    const max = document.getElementById('newMax').value;
    const btn = document.getElementById('btnConfirmarCrear');

    if(!nombre || !fecha || !max) return notificar("Faltan datos");

    btn.innerText = "Creando..."; btn.disabled = true;

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

// --- UNIRSE ---
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
    const btnUnirse = document.getElementById('btnIrASala');
    const txtOriginal = btnUnirse.innerText;
    btnUnirse.innerText = "..."; btnUnirse.disabled = true;

    try {
        const q = query(collection(db, "posadas"), where("codigo", "==", codigo));
        const snap = await getDocs(q);

        if(snap.empty) {
            notificar("El evento no existe");
            localStorage.removeItem('evento_' + codigo);
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
    } finally {
        btnUnirse.innerText = txtOriginal; btnUnirse.disabled = false;
    }
}

document.getElementById('formRegistro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitRegistro');
    
    const nombre = document.getElementById('regNombre').value.trim();
    const deseo = document.getElementById('regDeseo').value.trim();

    if(nombre.length < 3) return notificar("Nombre muy corto");

    btn.innerText = "Entrando..."; btn.disabled = true;

    try {
        const salaRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(salaRef);
        const data = snap.data();

        const existe = data.participantes.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        
        if (existe) {
            notificar("¡Te encontramos! Entrando...");
            guardarSesionLocal(data.codigo, nombre);
            miNombreEnSala = nombre;
            entrarLobby(salaActualId, data, false);
            return;
        }

        if(data.estado === 'cerrada') return notificar("El sorteo ya cerró");
        if(data.participantes.length >= data.maxParticipantes) return notificar("Sala llena");

        await updateDoc(salaRef, { participantes: arrayUnion({ nombre, deseo }) });
        
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
    finally { btn.innerText = "Confirmar y Entrar"; btn.disabled = false; }
});

// --- LOBBY (CON FUNCIONES DE ADMIN) ---
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
            mostrarBotonCompartir(data.codigo);
        } else {
            btnSorteo.style.display = 'block';
            resultadosList.style.display = 'none';
            ocultarBotonCompartir();
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
        
        // --- RENDERIZADO DE LA LISTA DE PARTICIPANTES ---
        info.participantes.forEach(p => {
            let botonKick = '';
            
            // Si soy Admin y el evento NO ha cerrado, muestro botón de expulsar
            if(soyAdmin && info.estado !== 'cerrada') {
                botonKick = `<button class="btn-kick" onclick="expulsarParticipante('${p.nombre}')" title="Expulsar">×</button>`;
            }

            lista.innerHTML += `
                <div class="participant-row">
                    <span style="font-weight:500;">🎅 ${p.nombre}</span>
                    ${botonKick}
                </div>
            `;
        });

        if(info.estado === 'cerrada' && info.resultados) {
            if(soyAdmin) {
                document.getElementById('btnPreSorteo').style.display = 'none';
                document.getElementById('adminResultadosList').style.display = 'block';
                renderResultados(info.resultados);
                mostrarBotonCompartir(info.codigo);
            } else if(miNombreEnSala && info.resultados[miNombreEnSala]) {
                mostrarResultado(info.resultados[miNombreEnSala]);
            }
        }
    });
}

// --- FUNCIÓN PARA EXPULSAR PARTICIPANTE ---
window.expulsarParticipante = (nombreAExpulsar) => {
    confirmar(`¿Sacar a ${nombreAExpulsar} del evento?`, async () => {
        try {
            const docRef = doc(db, "posadas", salaActualId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;

            const datos = snap.data();
            
            // Filtramos la lista para quitar al usuario
            const nuevaLista = datos.participantes.filter(p => p.nombre !== nombreAExpulsar);

            await updateDoc(docRef, { participantes: nuevaLista });
            notificar(`${nombreAExpulsar} ha sido eliminado.`);
        } catch (e) {
            console.error(e);
            notificar("Error al eliminar usuario");
        }
    });
};

function iniciarTimer(fecha) {
    if(timerInterval) clearInterval(timerInterval);
    const display = document.getElementById('timerDisplay');
    
    if(!fecha) { display.innerText = "Sin fecha"; return; }

    const target = new Date(fecha).getTime();

    const actualizar = () => {
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
    };

    actualizar();
    timerInterval = setInterval(actualizar, 1000);
}

function mostrarBotonCompartir(codigo) {
    const container = document.getElementById('panelAdminControls');
    let btn = document.getElementById('btnShareWhatsapp');
    
    if(!btn) {
        btn = document.createElement('button');
        btn.id = 'btnShareWhatsapp';
        btn.className = 'btn-primary';
        btn.style.backgroundColor = '#25D366';
        btn.style.marginTop = '20px';
        btn.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Invitar / Anunciar
            </div>
        `;
        
        btn.onclick = () => {
            const url = window.location.href.split('?')[0]; 
            const mensaje = `🎁 *¡Ya está el Intercambio!* 🎄\n\nEntra aquí para ver quién te tocó:\n${url}\n\nCódigo de sala: *${codigo}*`;
            
            navigator.clipboard.writeText(mensaje).then(() => {
                notificar("¡Texto copiado! Pégalo en WhatsApp 📲");
                window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
            });
        };
        
        container.insertBefore(btn, container.lastElementChild);
    }
}

function ocultarBotonCompartir() {
    const btn = document.getElementById('btnShareWhatsapp');
    if(btn) btn.remove();
}

const btnPreSorteo = document.getElementById('btnPreSorteo');
if(btnPreSorteo) {
    btnPreSorteo.addEventListener('click', () => {
        confirmar("¿Forzar sorteo ahora?", () => realizarSorteo(false));
    });
}

// --- SORTEO SIMPLE (SIN CORREOS) ---
async function realizarSorteo(esAutomatico) {
    const btn = document.getElementById('btnPreSorteo');
    if(btn) { btn.innerText = "Sorteando..."; btn.disabled = true; }

    try {
        const docRef = doc(db, "posadas", salaActualId);
        const snap = await getDoc(docRef);
        const parts = snap.data().participantes;

        if(parts.length < 2) {
            if(!esAutomatico) notificar("Se necesitan mínimo 2 personas");
            if(btn) { btn.innerText = "Forzar Sorteo"; btn.disabled = false; }
            return;
        }

        let givers = [...parts].sort(() => Math.random() - 0.5);
        let asignaciones = {};
        
        for(let i=0; i<givers.length; i++) {
            const giver = givers[i];
            const receiver = givers[(i+1) % givers.length];
            asignaciones[giver.nombre] = receiver;
        }

        await updateDoc(docRef, { estado: 'cerrada', resultados: asignaciones });
        
        if(!esAutomatico) {
            notificar("¡Sorteo Listo!", 5000);
            mostrarBotonCompartir(snap.data().codigo);
        }

    } catch (e) { 
        notificar("Error en el sorteo"); 
        if(btn) { btn.innerText = "Forzar Sorteo"; btn.disabled = false; }
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

    // EFECTO CONFETI (Si está cargado)
    if (window.confetti) {
        var end = Date.now() + 3000;
        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#D4AF37', '#bb0000', '#ffffff']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#D4AF37', '#bb0000', '#ffffff']
            });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }
}

const btnEliminar = document.getElementById('btnEliminarEventoFinal');
if(btnEliminar) {
    btnEliminar.addEventListener('click', () => {
        confirmar("¿Eliminar evento permanentemente?", async () => {
            await deleteDoc(doc(db, "posadas", salaActualId));
            irA('home');
        });
    });
}

verificarHistorial();