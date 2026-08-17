document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const form = document.getElementById('form-actividad');
    
    // Elementos del Modal
    const modal = document.getElementById('modal-ingresos');
    const btnIngresos = document.getElementById('btn-ingresos');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    
    const montoSemanaEl = document.getElementById('monto-semana');
    const montoMesEl = document.getElementById('monto-mes');
    const montoTotalEl = document.getElementById('monto-total');
    const labelMesEl = document.getElementById('label-mes');
    const listaMesesEl = document.getElementById('lista-meses');

    let actividadesCargadas = [];

    // Auto-completar Fecha Fin al cambiar Fecha Inicio
    const fechaInicioInput = document.getElementById('fechaInicio');
    if (fechaInicioInput) {
        fechaInicioInput.addEventListener('change', function() {
            const fechaFinInput = document.getElementById('fechaFin');
            if (fechaFinInput && !fechaFinInput.value) {
                fechaFinInput.value = this.value;
            }
        });
    }

    // Inicializar FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: ''
        },
        events: fetchActividades,
        eventClick: function(info) {
            if (confirm(`¿Deseas eliminar este registro: "${info.event.title}"?`)) {
                eliminarActividad(info.event.id);
            }
        }
    });

    calendar.render();

    // Cargar actividades desde la API
    async function fetchActividades(fetchInfo, successCallback, failureCallback) {
        try {
            const response = await fetch('/api/actividades');
            
            // Redirigir al login si expira la sesión
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            const data = await response.json();
            actividadesCargadas = data;

            const eventos = data.map(act => {
                const horaIniStr = act.horaInicio ? ` (${act.horaInicio}` : '';
                const horaFinStr = act.horaFin ? `-${act.horaFin})` : (horaIniStr ? ')' : '');
                
                let fechaFinAjustada = act.fechaFin || act.fecha;
                if (act.fechaFin && act.fechaFin !== act.fecha) {
                    const d = new Date(act.fechaFin + 'T00:00:00');
                    d.setDate(d.getDate() + 1);
                    fechaFinAjustada = d.toISOString().split('T')[0];
                }

                return {
                    id: act.id,
                    title: `S/ ${act.monto.toFixed(2)}${horaIniStr}${horaFinStr}`,
                    start: act.fecha,
                    end: fechaFinAjustada,
                    backgroundColor: '#27ae60',
                    borderColor: '#27ae60'
                };
            });

            successCallback(eventos);
        } catch (error) {
            console.error('Error al cargar actividades:', error);
            if (failureCallback) failureCallback(error);
        }
    }

    // Registrar nueva actividad
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            
            const fechaInicioVal = document.getElementById('fechaInicio').value;
            const fechaFinVal = document.getElementById('fechaFin').value || fechaInicioVal;

            const nuevaActividad = {
                fecha: fechaInicioVal,
                fechaFin: fechaFinVal,
                horaInicio: document.getElementById('horaInicio').value,
                horaFin: document.getElementById('horaFin').value,
                monto: document.getElementById('monto').value,
                descripcion: document.getElementById('descripcion').value
            };

            const response = await fetch('/api/actividades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevaActividad)
            });

            if (response.ok) {
                form.reset();
                calendar.refetchEvents();
            } else {
                alert('Error al guardar el registro');
            }
        });
    }

    // Eliminar actividad
    async function eliminarActividad(id) {
        const response = await fetch(`/api/actividades/${id}`, { method: 'DELETE' });
        if (response.ok) {
            calendar.refetchEvents();
        } else {
            alert('No se pudo eliminar el registro.');
        }
    }

    // Evento de clic en el botón para mostrar Ingresos
    if (btnIngresos && modal) {
        btnIngresos.addEventListener('click', function() {
            const hoy = new Date();
            const currentDate = calendar.getDate();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();

            let totalSemana = 0;
            let totalMes = 0;
            let totalGeneral = 0;
            const ingresosPorMes = {};

            const haceSieteDias = new Date();
            haceSieteDias.setDate(hoy.getDate() - 7);
            haceSieteDias.setHours(0, 0, 0, 0);

            actividadesCargadas.forEach(act => {
                const fechaAct = new Date(act.fecha + 'T00:00:00');
                const monto = parseFloat(act.monto) || 0;

                totalGeneral += monto;

                if (fechaAct >= haceSieteDias && fechaAct <= hoy) {
                    totalSemana += monto;
                }

                if (fechaAct.getMonth() === currentMonth && fechaAct.getFullYear() === currentYear) {
                    totalMes += monto;
                }

                const keyMes = act.fecha.substring(0, 7);
                ingresosPorMes[keyMes] = (ingresosPorMes[keyMes] || 0) + monto;
            });

            const nombreMes = currentDate.toLocaleString('es', { month: 'long' });
            if (labelMesEl) {
                labelMesEl.textContent = `Mes: ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}`;
            }

            if (montoSemanaEl) montoSemanaEl.textContent = `S/ ${totalSemana.toFixed(2)}`;
            if (montoMesEl) montoMesEl.textContent = `S/ ${totalMes.toFixed(2)}`;
            if (montoTotalEl) montoTotalEl.textContent = `S/ ${totalGeneral.toFixed(2)}`;

            if (listaMesesEl) {
                listaMesesEl.innerHTML = '';
                const mesesOrdenados = Object.keys(ingresosPorMes).sort().reverse();

                if (mesesOrdenados.length === 0) {
                    listaMesesEl.innerHTML = '<p style="font-size: 0.85rem; color: #666; text-align: center;">No hay ingresos registrados.</p>';
                } else {
                    mesesOrdenados.forEach(key => {
                        const [year, month] = key.split('-');
                        const fechaObj = new Date(year, parseInt(month) - 1, 1);
                        const nombreMesAnio = fechaObj.toLocaleString('es', { month: 'long', year: 'numeric' });
                        const nombreFormateado = nombreMesAnio.charAt(0).toUpperCase() + nombreMesAnio.slice(1);

                        const item = document.createElement('div');
                        item.className = 'item-mes';
                        item.innerHTML = `
                            <span>${nombreFormateado}</span>
                            <strong>S/ ${ingresosPorMes[key].toFixed(2)}</strong>
                        `;
                        listaMesesEl.appendChild(item);
                    });
                }
            }

            modal.style.display = 'flex';
        });
    }

    // Cerrar modal
    if (btnCerrarModal) {
        btnCerrarModal.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Cierre de Sesión (Logout)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async function() {
            try {
                const res = await fetch('/api/logout', { method: 'POST' });
                if (res.ok) {
                    window.location.href = '/login.html';
                }
            } catch (err) {
                console.error('Error al cerrar sesión:', err);
            }
        });
    }
});