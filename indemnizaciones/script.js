// 1. ESTADO GLOBAL
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
const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// 2. FUNCIONES DE INTERFAZ (DEBEN ESTAR ANTES DEL HANDLER)
function actualizarDisplaysFecha(fecha) {
    document.getElementById('display-dia').innerText = fecha.getDate().toString().padStart(2, '0');
    document.getElementById('display-mes').setAttribute('data-mes', fecha.getMonth());
    document.getElementById('display-mes').innerText = nombresMeses[fecha.getMonth()];
    document.getElementById('display-anio').innerText = fecha.getFullYear();
}

function preguntarFechaEgreso() {
    actualizarDisplaysFecha(new Date()); // Sugerimos hoy para el egreso
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

// 3. HANDLER CORREGIDO
function handleAnswer() {
    const idPregunta = pasos[pasoActual];
    
    // Captura de valores desde los botones +/-
    const dia = document.getElementById('display-dia').innerText;
    const mesIdx = parseInt(document.getElementById('display-mes').getAttribute('data-mes')) + 1;
    const mes = mesIdx.toString().padStart(2, '0');
    const anio = document.getElementById('display-anio').innerText;
    
    const fechaConstruida = `${anio}-${mes}-${dia}`;
    const valorSueldo = document.getElementById('input-sueldo')?.value;

    switch (idPregunta) {
        case 'fecha_ingreso':
            estadoLiquidacion.fechaIngreso = fechaConstruida;
            pasoActual = 1;
            preguntarFechaEgreso();
            break;

        case 'fecha_egreso':
            estadoLiquidacion.fechaEgreso = fechaConstruida;
            // Cálculo de antigüedad según Ley 20.744
            estadoLiquidacion.antiguedad = calcularAntiguedadExacta(estadoLiquidacion.fechaIngreso, fechaConstruida);
            estadoLiquidacion.añosParaCalculo = estadoLiquidacion.antiguedad.añosCalculo;
            
            document.getElementById('options-date').style.display = 'none';
            pasoActual = 2;
            preguntarSueldo();
            break;

        case 'sueldo_bruto':
            const sueldo = parseFloat(valorSueldo);
            if (sueldo > 0) {
                estadoLiquidacion.mejorSueldo = sueldo;
                pasoActual = 3;
                preguntarPreaviso();
            }
            break;
    }
}

// 3.1 FUNCIÓN FALTANTE QUE ACTIVA LOS BOTONES
function setPreaviso(valor) {
    estadoLiquidacion.huboPreaviso = valor;
    // Forzamos el paso final para que el wizard sepa que terminamos
    pasoActual = 4; 
    calcularResultados();
}

// 4. MOTOR DE CÁLCULO (Se mantiene igual, es correcto)
function calcularAntiguedadExacta(inicio, fin) {
    let fechaInicio = new Date(inicio + "T00:00:00");
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
    let añosCalculo = (meses > 3 || (meses === 3 && dias > 0)) ? años + 1 : años;
    if (años === 0 && (meses > 3 || (meses === 3 && dias > 0))) añosCalculo = 1;
    return { años, meses, dias, añosCalculo };
}

//++++++++++

function formatearFechaLatino(fechaStr) {
    if (!fechaStr) return "";
    const [anio, mes, dia] = fechaStr.split('-');
    return `${dia}/${mes}/${anio}`;
}

function calcularResultados() {
    const s = estadoLiquidacion.mejorSueldo;
    const a = estadoLiquidacion.antiguedad;

    // Art. 245: Indemnización por antigüedad [cite: 63]
    let total245 = s * estadoLiquidacion.añosParaCalculo;

    // Art. 231 y 232: Indemnización sustitutiva de preaviso [cite: 11, 13, 14]
    let totalPreaviso = 0;
    if (!estadoLiquidacion.huboPreaviso) {
        let mesesPreaviso = (a.años >= 5) ? 2 : (a.años === 0 && a.meses < 3 ? 0.5 : 1);
        totalPreaviso = s * mesesPreaviso;
    }

    const rubrosMes = calcularRubrosMensuales(estadoLiquidacion.fechaEgreso, s, a);
    const prop = calcularProporcionales(estadoLiquidacion.fechaIngreso, estadoLiquidacion.fechaEgreso, s, a.años);

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

function calcularProporcionales(fechaIngreso, fechaEgreso, mejorSueldo, antiguedadAnios) {
    const fin = new Date(fechaEgreso + "T00:00:00");
    const inicioSemestre = fin.getMonth() < 6 ? new Date(fin.getFullYear(), 0, 1) : new Date(fin.getFullYear(), 6, 1);
    const diasSemestre = Math.floor((fin - inicioSemestre) / (1000 * 60 * 60 * 24)) + 1;
    const sacProporcional = (mejorSueldo / 2) * (diasSemestre / 182.5);

    let diasDerecho = 14;
    if (antiguedadAnios >= 5) diasDerecho = 21;
    if (antiguedadAnios >= 10) diasDerecho = 28;
    if (antiguedadAnios >= 20) diasDerecho = 35;

    const inicioAnio = new Date(fin.getFullYear(), 0, 1);
    const diasTrabajadosAnio = Math.floor((fin - inicioAnio) / (1000 * 60 * 60 * 24)) + 1;
    const valorVacaciones = (mejorSueldo / 25) * ((diasDerecho * diasTrabajadosAnio) / 365);

    return { sacProporcional, valorVacaciones, sacVacaciones: valorVacaciones / 12 };
}

function calcularRubrosMensuales(fechaEgreso, mejorSueldo, antiguedad) {
    const fecha = new Date(fechaEgreso + "T00:00:00");
    const diaDespido = fecha.getDate();
    const ultimoDiaMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();

    const valorDia = mejorSueldo / 30;
    const diasTrabajados = parseFloat((diaDespido * valorDia).toFixed(2));

    // Art. 233: La integración no procede en período de prueba 
    const esPeriodoPrueba = (antiguedad.años === 0 && antiguedad.meses < 3);

    let integracionMes = 0;
    let sacIntegracion = 0;

    // Art. 233: Integración por días faltantes hasta el último día del mes [cite: 17]
    if (diaDespido < ultimoDiaMes && !esPeriodoPrueba) {
        integracionMes = parseFloat((mejorSueldo - diasTrabajados).toFixed(2));
        sacIntegracion = parseFloat((integracionMes / 12).toFixed(2));
    }

    return { diasTrabajados, integracionMes, sacIntegracion };
}


// 5. INICIALIZACIÓN (ok)
window.onload = () => {
    // Vinculamos el botón de la fecha al nuevo handler
    const btnDate = document.getElementById('btn-confirmar-date');
    if (btnDate) btnDate.onclick = handleAnswer;
    iniciarSimulador();
};

function iniciarSimulador() {
    document.getElementById('question-text').innerText = "¿Cuál es la Fecha de Ingreso?";
    document.getElementById('options-container').innerHTML = ""; 
    
    // Seteamos una fecha de ingreso sugerida (hace 2 años)
    const inicioSugerido = new Date();
    inicioSugerido.setFullYear(inicioSugerido.getFullYear() - 2);
    actualizarDisplaysFecha(inicioSugerido);
    
    document.getElementById('options-date').style.display = 'flex';
}

//FECHA

function cambiarValor(tipo, delta) {
    if (tipo === 'dia') {
        let el = document.getElementById('display-dia');
        let val = parseInt(el.innerText) + delta;
        if (val < 1) val = 31;
        if (val > 31) val = 1;
        el.innerText = val.toString().padStart(2, '0');
    } else if (tipo === 'mes') {
        let el = document.getElementById('display-mes');
        let currentIdx = parseInt(el.getAttribute('data-mes'));
        let nextIdx = (currentIdx + delta + 12) % 12; // Ciclo infinito de meses
        el.setAttribute('data-mes', nextIdx);
        el.innerText = nombresMeses[nextIdx];
    } else if (tipo === 'anio') {
        let el = document.getElementById('display-anio');
        let val = parseInt(el.innerText) + delta;
        el.innerText = val;
    }
}

function mostrarInformeLaboral() {
    const r = estadoLiquidacion.res;
    const totalFinal = Object.values(r).reduce((acc, val) => acc + val, 0);

    let html = `
        <div class="informe-contenedor" style="max-width: 600px; margin: auto; padding: 20px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333;">
            <h2 style="color:var(--accent); text-align:center; border-bottom: 2px solid var(--accent); padding-bottom: 10px;">RESULTADO DE LIQUIDACIÓN</h2>
            <div style="margin-top:20px; font-size: 0.95rem; color: #ccc;">
                <p><strong>Ingreso:</strong> ${formatearFechaLatino(estadoLiquidacion.fechaIngreso)}</p>
                <p><strong>Egreso:</strong> ${formatearFechaLatino(estadoLiquidacion.fechaEgreso)}</p>
                <p><strong>Mejor Sueldo:</strong> $ ${estadoLiquidacion.mejorSueldo.toFixed(2)}</p>
                <p><strong>Antigüedad:</strong> ${estadoLiquidacion.antiguedad.años} años y ${estadoLiquidacion.antiguedad.meses} meses</p>
            </div>
            <table style="width:100%; margin-top:20px; border-collapse: collapse; color: #eee;">
                <tbody>
                    <tr><td style="padding:8px;">Indemnización Art. 245</td><td style="text-align:right;">$ ${r.indem245.toFixed(2)}</td></tr>
                    <tr><td style="padding:8px;">Preaviso + SAC</td><td style="text-align:right;">$ ${(r.sustitutivaPreaviso + r.sacPreaviso).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px;">Días Trab. e Integración + SAC</td><td style="text-align:right;">$ ${(r.diasTrabajados + r.integracionMes + r.sacIntegracion).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px;">SAC Proporcional</td><td style="text-align:right;">$ ${r.sacProporcional.toFixed(2)}</td></tr>
                    <tr style="border-bottom: 1px solid #444;"><td style="padding:8px;">Vacaciones + SAC</td><td style="text-align:right;">$ ${(r.vacaciones + r.sacVacaciones).toFixed(2)}</td></tr>
                    <tr style="font-weight:bold; color:var(--accent); font-size:1.3rem;">
                        <td style="padding:15px 8px;">TOTAL NETO</td>
                        <td style="text-align:right; padding:15px 8px;">$ ${totalFinal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-opt" onclick="prepararDescarga()" style="flex:1; background:#2b5797;">GENERAR WORD</button>
                <button class="btn-opt" onclick="location.reload()" style="flex:1;">NUEVA CONSULTA</button>
            </div>
        </div>
    `;
    document.getElementById('question-card').innerHTML = html;
}

// 7. EXPORTACIÓN A WORD (ASÍNCRONA)
async function descargarWord() {
    if (typeof docx === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/docx@7.1.0/build/index.js";
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error("No se pudo cargar la librería de Word."));
        });
    }

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = window.docx;
    const r = estadoLiquidacion.res;
    
    // Cálculo del total neto
    const total = (r.indem245 + r.sustitutivaPreaviso + r.sacPreaviso + r.diasTrabajados + r.integracionMes + r.sacIntegracion + r.sacProporcional + r.vacaciones + r.sacVacaciones).toFixed(2);

    // Texto dinámico para el preaviso
    const textoPreaviso = estadoLiquidacion.huboPreaviso ? "Con preaviso" : "Sin preaviso";

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "DETALLE DE LIQUIDACIÓN FINAL - LEY 20.744", bold: true, size: 28 })]
                }),
                new Paragraph({ text: "" }),
                
                // DATOS DE LAS PARTES (Variables para completar)
                new Paragraph({ children: [new TextRun({ text: "DATOS DE LA TRABAJADORA:", bold: true })] }),
                new Paragraph({ text: `Nombre: ____________________________________________________` }),
                new Paragraph({ text: `CUIL: ____________________________________________________` }),
                new Paragraph({ text: `Empleador: ____________________________________________________` }),
                new Paragraph({ text: "" }),
                
                // BASE DE CÁLCULO (Incluye Antigüedad y estado de Preaviso)
                new Paragraph({ children: [new TextRun({ text: "BASE DE CÁLCULO:", bold: true })] }),
                new Paragraph({ text: `Fecha de Ingreso: ${formatearFechaLatino(estadoLiquidacion.fechaIngreso)}` }),
                new Paragraph({ text: `Fecha de Egreso: ${formatearFechaLatino(estadoLiquidacion.fechaEgreso)}` }),
                new Paragraph({ text: `Mejor Remuneración Bruta: $${estadoLiquidacion.mejorSueldo.toFixed(2)}` }),
                new Paragraph({ text: `Antigüedad: ${estadoLiquidacion.antiguedad.años} años` }),
                new Paragraph({ text: `Preaviso: ${textoPreaviso}` }),
                new Paragraph({ text: "" }),
                
                // TABLA SEGÚN MODELO ADJUNTO
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Concepto", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Detalle", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Monto", bold: true })] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("Indemnización por antigüedad (Art. 245)")] }),
                                new TableCell({ children: [new Paragraph("1 mes por año trabajado")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.indem245.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("Sustitutiva de Preaviso")] }),
                                new TableCell({ children: [new Paragraph("Salario mensual por falta de preaviso")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.sustitutivaPreaviso.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("SAC Preaviso")] }),
                                new TableCell({ children: [new Paragraph("Proporcional sobre preaviso")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.sacPreaviso.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("Días trabajados del mes")] }),
                                new TableCell({ children: [new Paragraph("Proporcional al mes de despido")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.diasTrabajados.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("Integración mes de despido")] }),
                                new TableCell({ children: [new Paragraph("Complemento hasta salario mensual")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.integracionMes.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("SAC Integración mes de despido")] }),
                                new TableCell({ children: [new Paragraph("50% del mejor semestre proporcional")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.sacIntegracion.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("SAC proporcional")] }),
                                new TableCell({ children: [new Paragraph("Por meses trabajados en el semestre")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.sacProporcional.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("Vacaciones no gozadas")] }),
                                new TableCell({ children: [new Paragraph("Según Ley y antigüedad")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.vacaciones.toFixed(2)}`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("SAC Vacaciones no gozadas")] }),
                                new TableCell({ children: [new Paragraph("50% proporcional sobre vacaciones")] }),
                                new TableCell({ children: [new Paragraph(`$ ${r.sacVacaciones.toFixed(2)}`)] })
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: "" }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: `Total liquidación final: $ ${total}`, bold: true, size: 26 })]
                })
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const nombreArchivo = `Liquidacion_Final_${formatearFechaLatino(estadoLiquidacion.fechaEgreso).replace(/\//g, '-')}.docx`;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    });
}

function prepararDescarga() {
    if (typeof docx !== 'undefined') {
        descargarWord();
    } else {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/docx@7.1.0/build/index.js";
        script.crossOrigin = "anonymous";
        script.onload = () => descargarWord();
        script.onerror = () => alert("Error al cargar la librería de Word.");
        document.head.appendChild(script);
    }
}