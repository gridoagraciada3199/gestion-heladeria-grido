// Correcciones específicas para el guardado de cierres.
// Se carga después de app.js y reemplaza la función original.
let guardandoCierre = false;

async function guardarCierre() {
    if (guardandoCierre) return;

    const numeroEl = document.getElementById('cierreNumero');
    const efectivoEl = document.getElementById('cierreConteo');
    const creditoEl = document.getElementById('cierreCredito');
    const debitoEl = document.getElementById('cierreDebito');
    const notasEl = document.getElementById('cierreNotas');
    const boton = document.querySelector('button[onclick="guardarCierre()"]');

    const numero = numeroEl ? numeroEl.value.trim() : '';
    const efectivoFisico = parseFloat(efectivoEl?.value) || 0;
    const credito = parseFloat(creditoEl?.value) || 0;
    const debito = parseFloat(debitoEl?.value) || 0;
    const notas = notasEl?.value || '';

    if (!numero) {
        alert('Ingresá el número de turno');
        return;
    }

    if (efectivoFisico === 0 && credito === 0 && debito === 0) {
        if (!confirm('No ingresaste importes. ¿Guardar igual?')) return;
    }

    guardandoCierre = true;
    if (boton) {
        boton.disabled = true;
        boton.dataset.textoOriginal = boton.textContent;
        boton.textContent = '⏳ Guardando...';
        boton.style.opacity = '0.7';
        boton.style.cursor = 'wait';
    }

    const empleadoId = empleadoActual ? empleadoActual.id : 'admin';
    const empleadoNombre = empleadoActual ? empleadoActual.nombre : 'Admin';
    const diaOperativo = obtenerDiaOperativo();
    const totalRegistrado = efectivoFisico + credito + debito;
    const retirosValidos = retirosTemporales.filter(r => r.monto && parseFloat(r.monto) > 0);
    const totalRetiros = retirosValidos.reduce((sum, r) => sum + parseFloat(r.monto), 0);

    try {
        // Busca cierres del día y verifica empleado + número de turno.
        // La consulta usa un solo campo para evitar depender de índices compuestos.
        const cierresDelDia = await db.collection('cierres')
            .where('diaOperativo', '==', diaOperativo)
            .get();

        const yaExiste = cierresDelDia.docs.some(doc => {
            const cierre = doc.data();
            return String(cierre.empleadoId || '') === String(empleadoId) &&
                   String(cierre.numero || '').trim() === numero;
        });

        if (yaExiste) {
            alert('⚠️ Este turno ya tiene un cierre registrado.');
            return;
        }

        await db.collection('cierres').add({
            numero,
            empleadoId,
            empleadoNombre,
            fecha: diaOperativo,
            diaOperativo,
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(),
            efectivo: efectivoFisico,
            efectivoFisico,
            credito,
            debito,
            totalRegistrado,
            totalVentas: 0,
            conteo: efectivoFisico,
            diferencia: 0,
            retiros: retirosValidos,
            totalRetiros,
            notas: notas || ''
        });
    } catch (error) {
        console.error('Error al guardar cierre:', error);
        alert('Error al guardar el cierre. No se confirmó el guardado. Revisá tu conexión antes de volver a intentarlo.');
        return;
    } finally {
        guardandoCierre = false;
        if (boton) {
            boton.disabled = false;
            boton.textContent = boton.dataset.textoOriginal || '💾 Guardar Cierre';
            boton.style.opacity = '';
            boton.style.cursor = '';
        }
    }

    // Desde acá el guardado ya fue confirmado. Un fallo al actualizar la pantalla
    // no debe mostrarse como si el cierre no se hubiera guardado.
    if (numeroEl) numeroEl.value = '';
    if (creditoEl) creditoEl.value = '';
    if (debitoEl) debitoEl.value = '';
    if (efectivoEl) efectivoEl.value = '';
    if (notasEl) notasEl.value = '';
    retirosTemporales = [];
    renderizarRetiros();

    const totalEl = document.getElementById('cierreTotal');
    if (totalEl) totalEl.textContent = '$0';
    const diferenciaBox = document.getElementById('cierreDiferenciaBox');
    if (diferenciaBox) diferenciaBox.className = 'total-box neutro';

    try {
        await cargarDatosIniciales();
        cargarMisCierres();
    } catch (error) {
        console.error('El cierre se guardó, pero no se pudo actualizar la pantalla:', error);
    }

    alert('✅ Cierre guardado');
}
