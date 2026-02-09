// 1. ESTADO GLOBAL DE LA LIQUIDACIÓN
let estadoLiquidacion = {
    fechaIngreso: null,
    fechaEgreso: null,
    mejorSueldo: 0,
    antiguedad: { años: 0, meses: 0, dias: 0 },
    añosParaCalculo: 0,
    huboPreaviso: false,
    res: {}
};

let pasoActual = 0;
const pasos = ['fecha_ingreso', 'fecha_egreso', 'sueldo_bruto', 'preaviso'];

// 2. MOTOR DE CÁLCULO TÉCNICO
function calcularAntiguedadExacta(inicio, fin) {
    let fechaInicio = new Date(inicio + "T00:00:00"); // Forzamos hora local para evitar desfasajes
    let fechaFin = new Date(fin + "T00:00:00");

    let años = fechaFin.getFullYear() - fechaInicio.getFullYear();
    let meses = fechaFin.getMonth() - fechaInicio.getMonth();
    let dias = fechaFin.getDate() - fechaInicio.getDate();

    if (dias < 0) {
        meses--;
        let ultimoDiaMesAnterior = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    if (meses < 0) {
        años--;
        meses += 12;
    }

    // Art. 245: Fracción mayor a 3 meses = año completo
    let añosCalculo = (meses > 3 || (meses === 3 && dias > 0)) ? años + 1 : años;
    
    // Caso especial: menos de un año pero más de 3 meses
    if (años === 0 && (meses > 3 || (meses === 3 && dias > 0))) añosCalculo = 1;

    return { años, meses, dias, añosCalculo };
}

function calcularRubrosMensuales(fechaEgreso, mejorSueldo, antiguedad) {
    const fecha = new Date(fechaEgreso + "T00:00:00");
    const diaDespido = fecha.getDate();
    const ultimoDiaMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
    
    // 1. Días Trabajados: Base 30 para estandarizar el valor diario
    const valorDia = mejorSueldo / 30;
    const diasTrabajados = parseFloat((diaDespido * valorDia).toFixed(2));

    // 2. Validación Art. 233: No procede en período de prueba (3 meses)
    const esPeriodoPrueba = (antiguedad.años === 0 && antiguedad.meses < 3);
    
    let integracionMes = 0;
    let sacIntegracion = 0;

    // 3. Cálculo de Integración: Solo si no es último día y no es período de prueba
    if (diaDespido < ultimoDiaMes && !esPeriodoPrueba) {
        // La integración es el resto exacto para completar el sueldo bruto
        integracionMes = parseFloat((mejorSueldo - diasTrabajados).toFixed(2));
        sacIntegracion = parseFloat((integracionMes / 12).toFixed(2));
    }

    return { 
        diasTrabajados, 
        integracionMes, 
        sacIntegracion 
    };
}

function calcularProporcionales(fechaIngreso, fechaEgreso, mejorSueldo, antiguedadAnios) {
    const fin = new Date(fechaEgreso + "T00:00:00");
    
    // SAC Proporcional
    const inicioSemestre = fin.getMonth() < 6 
        ? new Date(fin.getFullYear(), 0, 1) 
        : new Date(fin.getFullYear(), 6, 1);
    const diasSemestre = Math.floor((fin - inicioSemestre) / (1000 * 60 * 60 * 24)) + 1;
    const sacProporcional = (mejorSueldo / 2) * (diasSemestre / 182.5);

    // Vacaciones (Art. 155: se divide por 25)
    let diasDerecho = 14;
    if (antiguedadAnios >= 5) diasDerecho = 21;
    if (antiguedadAnios >= 10) diasDerecho = 28;
    if (antiguedadAnios >= 20) diasDerecho = 35;

    const inicioAnio = new Date(fin.getFullYear(), 0, 1);
    const diasTrabajadosAnio = Math.floor((fin - inicioAnio) / (1000 * 60 * 60 * 24)) + 1;
    const valorVacaciones = (mejorSueldo / 25) * ((diasDerecho * diasTrabajadosAnio) / 365);

    return { sacProporcional, valorVacaciones, sacVacaciones: valorVacaciones / 12 };
}

// 3. ORQUESTADOR DE RESULTADOS
function calcularResultados() {
    const s = estadoLiquidacion.mejorSueldo;
    const a = estadoLiquidacion.antiguedad;
    const fEgreso = estadoLiquidacion.fechaEgreso;
    
    // 1. Antigüedad Art. 245 [cite: 63]
    let total245 = s * estadoLiquidacion.añosParaCalculo;

    // 2. Preaviso: Según Art. 231 [cite: 11]
    let totalPreaviso = 0;
    if (!estadoLiquidacion.huboPreaviso) {
        let mesesPreaviso = 0;
        if (a.años === 0 && a.meses < 3) {
            mesesPreaviso = 0.5; // 15 días en período de prueba [cite: 10]
        } else if (a.años < 5) {
            mesesPreaviso = 1;   // 1 mes hasta 5 años [cite: 11]
        } else {
            mesesPreaviso = 2;   // 2 meses más de 5 años [cite: 11]
        }
        totalPreaviso = s * mesesPreaviso;
    }

    // 3. Rubros del Mes (Art. 233) usando la nueva función analizada 
    const rubrosMes = calcularRubrosMensuales(fEgreso, s, a);

    // 4. Proporcionales (SAC y Vacaciones)
    const prop = calcularProporcionales(estadoLiquidacion.fechaIngreso, fEgreso, s, a.años);

    // 5. Consolidación Final con Redondeo de Precisión
    estadoLiquidacion.res = {
        indem245: total245,
        sustitutivaPreaviso: totalPreaviso,
        sacPreaviso: totalPreaviso / 12,
        diasTrabajados: rubrosMes.diasTrabajados,
        integracionMes: rubrosMes.integracionMes,
        sacIntegracion: rubrosMes.sacIntegracion,
        sacProporcional: prop.sacProporcional,
        vacaciones: prop.valorVacaciones,
        sacVacaciones: prop.sacVacaciones
    };

    mostrarInformeLaboral();
}

// 4. FLUJO DEL WIZARD (UI Y SWITCH)
function handleAnswer() {
    const idPregunta = pasos[pasoActual];
    const inputDate = document.getElementById('input-date');
    const valorDate = document.getElementById('input-date').value;
    const valorSueldo = document.getElementById('input-sueldo')?.value;

    switch (idPregunta) {
        case 'fecha_ingreso':
            if (valorDate) {
                estadoLiquidacion.fechaIngreso = valorDate;
                pasoActual++;
                preguntarFechaEgreso();
            }
            break;

        case 'fecha_egreso':
            if (valorDate) {
                estadoLiquidacion.fechaEgreso = valorDate;
                estadoLiquidacion.antiguedad = calcularAntiguedadExacta(estadoLiquidacion.fechaIngreso, valorDate);
                estadoLiquidacion.añosParaCalculo = estadoLiquidacion.antiguedad.añosCalculo;
                ocultarCalendario();
                pasoActual++;
                preguntarSueldo();
            }
            break;

        case 'sueldo_bruto':
            const sueldo = parseFloat(valorSueldo);
            if (sueldo > 0) {
                estadoLiquidacion.mejorSueldo = sueldo;
                pasoActual++;
                preguntarPreaviso();
            }
            break;
    }
}

// 5. FUNCIONES DE INTERFAZ (DOM)
function preguntarFechaEgreso() {
    document.getElementById('input-date').value = ""; 
    document.getElementById('question-text').innerText = "¿Cuál es la Fecha de Egreso?";
}

function preguntarSueldo() {
    document.getElementById('question-text').innerText = "¿Mejor Remuneración Mensual (Bruta)?";
    document.getElementById('options-container').innerHTML = `
        <input type="number" id="input-sueldo" class="input-dark" style="height: 60px; width: 80%; font-size: 1.5rem;" placeholder="0.00">
        <button class="btn-opt" onclick="handleAnswer()" style="margin-top: 20px; width: 80%;">CONFIRMAR</button>
    `;
}

function preguntarPreaviso() {
    document.getElementById('question-text').innerText = "¿Le otorgaron el Preaviso?";
    document.getElementById('options-container').innerHTML = `
        <button class="btn-opt" onclick="setPreaviso(true)">SÍ, ME AVISARON</button>
        <button class="btn-opt" onclick="setPreaviso(false)" style="margin-top:10px;">NO, FUE SORPRESA</button>
    `;
}

function setPreaviso(valor) {
    estadoLiquidacion.huboPreaviso = valor;
    calcularResultados();
}

function ocultarCalendario() {
    document.getElementById('options-date').style.display = 'none';
}

function mostrarInformeLaboral() {
    const r = estadoLiquidacion.res;
    const totalFinal = Object.values(r).reduce((acc, val) => acc + val, 0);

    document.getElementById('question-card').innerHTML = `
        <div class="mejora-discapacidad-container">
            <h3 style="color:var(--accent); text-align:center;">LIQUIDACIÓN FINAL</h3>
            <div style="display:flex; justify-content: space-around; font-size:0.7rem; color:#aaa; margin-bottom:10px;">
                <span>Ingreso: ${estadoLiquidacion.fechaIngreso}</span>
                <span>Egreso: ${estadoLiquidacion.fechaEgreso}</span>
            </div>
            <table style="width:100%; font-size: 0.85rem; color: #eee;">
                <tr style="border-bottom: 1px solid #333;"><td style="padding:8px;">Art. 245 (Antigüedad)</td><td style="text-align:right;">$ ${r.indem245.toFixed(2)}</td></tr>
                <tr style="border-bottom: 1px solid #333;"><td style="padding:8px;">Preaviso + SAC</td><td style="text-align:right;">$ ${(r.sustitutivaPreaviso + r.sacPreaviso).toFixed(2)}</td></tr>
                <tr style="border-bottom: 1px solid #333;"><td style="padding:8px;">Mes de Despido + SAC</td><td style="text-align:right;">$ ${(r.diasTrabajados + r.integracionMes + r.sacIntegracion).toFixed(2)}</td></tr>
                <tr style="border-bottom: 1px solid #333;"><td style="padding:8px;">SAC Proporcional</td><td style="text-align:right;">$ ${r.sacProporcional.toFixed(2)}</td></tr>
                <tr style="border-bottom: 2px solid var(--accent);"><td style="padding:8px;">Vacaciones + SAC</td><td style="text-align:right;">$ ${(r.vacaciones + r.sacVacaciones).toFixed(2)}</td></tr>
                <tr><td style="padding:15px 0; font-weight:bold; color:var(--accent);">TOTAL NETO</td><td style="text-align:right; font-weight:bold; color:var(--accent); font-size:1.4rem;">$ ${totalFinal.toFixed(2)}</td></tr>
            </table>
            <button class="btn-opt" onclick="location.reload()" style="margin-top:15px; width:100%;">NUEVO CÁLCULO</button>
        </div>
    `;
}

// 6. INICIALIZACIÓN
window.onload = () => {
    // Vinculamos el botón de fecha al switch
    const btnDate = document.getElementById('btn-confirmar-date');
    if(btnDate) btnDate.onclick = handleAnswer;

    // Arrancamos la primera pregunta
    iniciarSimulador();
};

function iniciarSimulador() {
    // Limpiamos cualquier rastro del mensaje "Cargando..."
    document.getElementById('question-text').innerText = "¿Cuál es la Fecha de Ingreso?";
    document.getElementById('options-container').innerHTML = ""; 
    
    // Mostramos el selector de fecha
    const dateContainer = document.getElementById('options-date');
    if(dateContainer) dateContainer.style.display = 'flex';
}