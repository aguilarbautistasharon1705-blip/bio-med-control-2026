import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";
import { supabase } from "./supabase";

function App() {
    const [pagina, setPagina] = useState("Panel principal");
    const [anioPAM, setAnioPAM] = useState(new Date().getFullYear());

const mesesPAM = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
    const [equipos, setEquipos] = useState([]);
const [equipoActual, setEquipoActual] = useState({
  nombre: "",
  marca: "",
  modelo: "",
  serie: "",
  inventario: "",
  fabricante: "",
  voltaje: "",
  potencia: "",
  frecuencia: "",
  area: "",
  ubicacion: "",
    descripcion: "",
  estado: "En funcionamiento"
});
const [indiceEdicion, setIndiceEdicion] = useState(null);
useEffect(() => {
  const cargarEquipos = async () => {
    const { data, error } = await supabase
      .from("equipos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar equipos:", error);
      alert("No se pudieron cargar los equipos desde la nube.");
      return;
    }

    setEquipos(data || []);
  };

  cargarEquipos();
}, []);
useEffect(() => {
  const canal = supabase
    .channel("cambios-equipos")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "equipos"
      },
      async () => {
        const { data, error } = await supabase
          .from("equipos")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error al sincronizar equipos:", error);
          return;
        }

        setEquipos(data || []);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}, []);
const [busquedaInventario, setBusquedaInventario] = useState("");
const [busquedaReporte, setBusquedaReporte] = useState("");
const [filtroTipoReporte, setFiltroTipoReporte] = useState("Todos");
const [filtroEstadoReporte, setFiltroEstadoReporte] = useState("Todos");

const [filtroEstadoInventario, setFiltroEstadoInventario] = useState("Todos");
const [mantenimientos, setMantenimientos] = useState([]);
useEffect(() => {
  const cargarMantenimientos = async () => {
    const { data, error } = await supabase
      .from("mantenimientos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar mantenimientos:", error);
      alert("No se pudieron cargar los mantenimientos desde la nube.");
      return;
    }

    const mantenimientosConEquipo = (data || []).map((mantenimiento) => {
      const equipoRelacionado = equipos.find(
        (equipo) => equipo.inventario === mantenimiento.inventario
      );

      return {
        ...mantenimiento,
        equipo: equipoRelacionado?.nombre || "Equipo no encontrado",
        numeroInventario: mantenimiento.inventario
      };
    });

    setMantenimientos(mantenimientosConEquipo);
  };

  cargarMantenimientos();
}, [equipos]);
useEffect(() => {
  const canal = supabase
    .channel("cambios-mantenimientos")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "mantenimientos"
      },
      async () => {
        const { data, error } = await supabase
          .from("mantenimientos")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error al sincronizar mantenimientos:", error);
          return;
        }

        const mantenimientosConEquipo = (data || []).map((mantenimiento) => {
          const equipoRelacionado = equipos.find(
            (equipo) => equipo.inventario === mantenimiento.inventario
          );

          return {
            ...mantenimiento,
            equipo: equipoRelacionado?.nombre || "Equipo no encontrado",
            numeroInventario: mantenimiento.inventario
          };
        });

        setMantenimientos(mantenimientosConEquipo);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}, [equipos]);
const [mantenimientoActual, setMantenimientoActual] = useState({
  inventario: "",
  tipo: "Preventivo",
  fecha: "",
  responsable: "",
  estado: "Programado",
  observaciones: ""
});
const equiposFuncionando = equipos.filter(
  (equipo) => equipo.estado === "En funcionamiento"
).length;

const equiposFueraServicio = equipos.filter(
  (equipo) => equipo.estado === "Fuera de servicio"
).length;

const equiposFiltrados = equipos.filter((equipo) => {
  const texto = busquedaInventario.toLowerCase();

  const coincideBusqueda =
    (equipo.nombre || "").toLowerCase().includes(texto) ||
    (equipo.marca || "").toLowerCase().includes(texto) ||
    (equipo.modelo || "").toLowerCase().includes(texto) ||
    String(equipo.inventario || "").toLowerCase().includes(texto);

  const coincideEstado =
    filtroEstadoInventario === "Todos" ||
    equipo.estado === filtroEstadoInventario;

  return coincideBusqueda && coincideEstado;
}).sort((a, b) =>
  (a.nombre || "").localeCompare(b.nombre || "", "es", {
    sensitivity: "base"
  })
);

const mantenimientosFiltradosReporte = mantenimientos.filter((m) => {
  const texto = busquedaReporte.toLowerCase();

  const coincideBusqueda =
    (m.equipo || "").toLowerCase().includes(texto) ||
    String(m.numeroInventario || m.inventario || "")
  .toLowerCase().includes(texto);

  const coincideTipo =
    filtroTipoReporte === "Todos" ||
    m.tipo === filtroTipoReporte;

  const coincideEstado =
    filtroEstadoReporte === "Todos" ||
    m.estado === filtroEstadoReporte;

  return coincideBusqueda && coincideTipo && coincideEstado;
});


const mantenimientosProximos = mantenimientos.filter(
  (mantenimiento) =>
    mantenimiento.estado === "Programado" &&
    mantenimiento.fecha >= new Date().toISOString().split("T")[0]
).length;

// CONTADORES PARA LA GRAFICA DE MANTENIMIENTOS
const mantenimientosProgramados = mantenimientos.filter(
  (m) => m.estado === "Programado"
).length;

const mantenimientosEnProceso = mantenimientos.filter(
  (m) => m.estado === "En proceso"
).length;

const mantenimientosCompletados = mantenimientos.filter(
  (m) => m.estado === "Completado"
).length;

const fechaHoy = new Date();
fechaHoy.setHours(0, 0, 0, 0);

const mantenimientosVencidos = mantenimientos.filter((m) => {
  if (m.estado === "Completado" || !m.fecha) return false;

  const fecha = new Date(m.fecha + "T00:00:00");
  return fecha < fechaHoy;
}).length;

const mantenimientosProximos7Dias = mantenimientos.filter((m) => {
  if (m.estado !== "Programado" || !m.fecha) return false;

  const fecha = new Date(m.fecha + "T00:00:00");
  const diferencia = (fecha - fechaHoy) / (1000 * 60 * 60 * 24);

  return diferencia >= 0 && diferencia <= 7;
}).length;
useEffect(() => {
  localStorage.setItem("equipos", JSON.stringify(equipos));
}, [equipos]);
useEffect(() => {
  localStorage.setItem(
    "mantenimientos",
    JSON.stringify(mantenimientos)
  );
}, [mantenimientos]);

const actualizarCampo = (e) => {
  const { name, value } = e.target;

  setEquipoActual({
    ...equipoActual,
    [name]: value
  });
};
const actualizarMantenimiento = (e) => {
  const { name, value } = e.target;

  setMantenimientoActual({
    ...mantenimientoActual,
    [name]: value
  });
};

const cambiarEstadoMantenimiento = async (id, nuevoEstado) => {
  try {
    const { error } = await supabase
      .from("mantenimientos")
      .update({ estado: nuevoEstado })
      .eq("id", id);

    if (error) throw error;

    setMantenimientos((anteriores) =>
      anteriores.map((mantenimiento) =>
        mantenimiento.id === id
          ? { ...mantenimiento, estado: nuevoEstado }
          : mantenimiento
      )
    );

  } catch (error) {
    console.error("Error al actualizar mantenimiento:", error);
    alert("No se pudo actualizar el estado en la nube.");
  }
};
const guardarMantenimiento = async () => {
  if (
    !mantenimientoActual.inventario ||
    !mantenimientoActual.fecha ||
    !mantenimientoActual.responsable.trim()
  ) {
    alert("Completa el equipo, la fecha y el responsable.");
    return;
  }

  const equipoSeleccionado = equipos.find(
    (equipo) =>
      equipo.inventario === mantenimientoActual.inventario
  );

  if (!equipoSeleccionado) {
    alert("No se encontró el equipo seleccionado.");
    return;
  }

  try {
    const nuevoRegistro = {
      inventario: mantenimientoActual.inventario,
      tipo: mantenimientoActual.tipo,
      fecha: mantenimientoActual.fecha,
      responsable: mantenimientoActual.responsable.trim(),
      estado: mantenimientoActual.estado,
      observaciones: mantenimientoActual.observaciones
    };

    const { data, error } = await supabase
      .from("mantenimientos")
      .insert([nuevoRegistro])
      .select()
      .single();

    if (error) throw error;

    const nuevoMantenimiento = {
      ...data,
      equipo: equipoSeleccionado.nombre,
      numeroInventario: data.inventario
    };

    setMantenimientos((anteriores) => [
      nuevoMantenimiento,
      ...anteriores.filter((m) => m.id !== nuevoMantenimiento.id)
    ]);

    setMantenimientoActual({
      inventario: "",
      tipo: "Preventivo",
      fecha: "",
      responsable: "",
      estado: "Programado",
      observaciones: ""
    });

    alert("Mantenimiento registrado correctamente en la nube.");

  } catch (error) {
    console.error("Error al guardar mantenimiento:", error);
    alert("No se pudo guardar el mantenimiento en la nube.");
  }
};


const guardarEquipo = async () => {
  if (!equipoActual.nombre.trim() || !equipoActual.inventario.trim()) {
    alert("Ingresa al menos el nombre y el número de inventario.");
    return;
  }

  const numeroInventario = equipoActual.inventario.trim().toLowerCase();

  try {
    const { data: registros, error: errorConsulta } = await supabase
      .from("equipos")
      .select("id, inventario");

    if (errorConsulta) throw errorConsulta;

    const inventarioDuplicado = registros.some((equipo) => {
      const mismoInventario = String(equipo.inventario)
        .trim()
        .toLowerCase() === numeroInventario;

      const equipoActualEnEdicion =
        indiceEdicion !== null &&
        equipos[indiceEdicion]?.id === equipo.id;

      return mismoInventario && !equipoActualEnEdicion;
    });

    if (inventarioDuplicado) {
      alert("Este número de inventario ya está registrado.");
      return;
    }

    const equipoLimpio = {
      ...equipoActual,
      nombre: equipoActual.nombre.trim(),
      inventario: equipoActual.inventario.trim()
    };

    if (indiceEdicion !== null) {
      const equipoExistente = equipos[indiceEdicion];

      if (!equipoExistente?.id) {
        alert("Este equipo todavía no está sincronizado con la nube.");
        return;
      }

      const { data, error } = await supabase
        .from("equipos")
        .update(equipoLimpio)
        .eq("id", equipoExistente.id)
        .select()
        .single();

      if (error) throw error;

      const equiposActualizados = [...equipos];
      equiposActualizados[indiceEdicion] = data;

      setEquipos(equiposActualizados);
      setIndiceEdicion(null);

      alert("Equipo actualizado correctamente en la nube.");
    } else {
      const { data, error } = await supabase
        .from("equipos")
        .insert([equipoLimpio])
        .select()
        .single();

      if (error) throw error;

      setEquipos([...equipos, data]);

      alert("Equipo registrado correctamente en la nube.");
    }

    setEquipoActual({
      nombre: "",
      marca: "",
      modelo: "",
      serie: "",
      inventario: "",
      fabricante: "",
      voltaje: "",
      potencia: "",
      frecuencia: "",
      area: "",
      ubicacion: "",
      descripcion: "",
      estado: "En funcionamiento"
    });

  } catch (error) {
    console.error("Error al guardar equipo:", error);
    alert("No se pudo guardar el equipo. Revisa la conexión con Supabase.");
  }
};



const eliminarEquipo = async (indice) => {
  const confirmar = window.confirm(
    "¿Estás segura de eliminar este equipo?"
  );

  if (!confirmar) return;

  const equipo = equipos[indice];

  if (!equipo?.id) {
    alert("No se encontró el identificador del equipo.");
    return;
  }

  try {
    const { error } = await supabase
      .from("equipos")
      .delete()
      .eq("id", equipo.id);

    if (error) throw error;

    setEquipos((anteriores) =>
      anteriores.filter((e) => e.id !== equipo.id)
    );

    alert("Equipo eliminado correctamente de la nube.");

  } catch (error) {
    console.error("Error al eliminar equipo:", error);
    alert("No se pudo eliminar el equipo.");
  }
};

const editarEquipo = (indice) => {
  setEquipoActual({ ...equipos[indice] });
  setIndiceEdicion(indice);
  setPagina("Hoja de datos");
};



const exportarExcel = async () => {
  try {
    const libro = new ExcelJS.Workbook();

    libro.creator = "BIO-MED CONTROL";
    libro.subject = "Reporte de inventario y mantenimientos";
    libro.title = "Reporte BIO-MED CONTROL";

    const azulMarino = "17365D";
    const azulClaro = "DDEBF7";
    const blanco = "FFFFFF";
    const gris = "D9E2F3";

    // FORMATO GENERAL DE LAS HOJAS
    const darFormato = (hoja, numeroColumnas, filaEncabezado = 1) => {
      hoja.views = [{ state: "frozen", ySplit: filaEncabezado }];

      const ultimaColumna = hoja.getColumn(numeroColumnas).letter;

      hoja.autoFilter = {
        from: `A${filaEncabezado}`,
        to: `${ultimaColumna}${Math.max(filaEncabezado, hoja.rowCount)}`
      };

      const encabezado = hoja.getRow(filaEncabezado);
      encabezado.height = 30;

      encabezado.eachCell((celda) => {
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: azulMarino }
        };
        celda.font = {
          bold: true,
          color: { argb: blanco },
          size: 11
        };
        celda.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true
        };
      });

      for (let fila = filaEncabezado + 1; fila <= hoja.rowCount; fila++) {
        const row = hoja.getRow(fila);

        row.eachCell((celda) => {
          celda.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fila % 2 === 0 ? blanco : azulClaro }
          };

          celda.font = {
            name: "Arial",
            size: 10,
            color: { argb: "243447" }
          };

          celda.alignment = {
            vertical: "middle",
            wrapText: true
          };

          celda.border = {
            bottom: {
              style: "thin",
              color: { argb: gris }
            }
          };
        });

        row.height = 25;
      }
    };

    // COLORES AUTOMÁTICOS PARA LOS ESTADOS
    const colorearEstado = (celda, estado) => {
      const colores = {
        "En funcionamiento": ["E2F0D9", "008000"],
        "Fuera de servicio": ["FCE4D6", "C00000"],
        "En mantenimiento": ["FFF2CC", "BF9000"],
        "Completado": ["E2F0D9", "008000"],
        "Programado": ["DDEBF7", "0070C0"],
        "En proceso": ["FFF2CC", "BF9000"],
        "Vencido": ["F4CCCC", "C00000"]
      };

      const coloresEstado = colores[estado];

      if (!coloresEstado) return;

      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: coloresEstado[0] }
      };

      celda.font = {
        bold: true,
        color: { argb: coloresEstado[1] },
        size: 10
      };

      celda.alignment = {
        horizontal: "center",
        vertical: "middle"
      };
    };

    // HOJA 1: RESUMEN
    const hojaResumen = libro.addWorksheet("Resumen");

    hojaResumen.columns = [
      { key: "indicador", width: 38 },
      { key: "cantidad", width: 18 }
    ];

    hojaResumen.mergeCells("A1:B1");
    hojaResumen.getCell("A1").value = "BIO-MED CONTROL";
    hojaResumen.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: azulMarino }
    };
    hojaResumen.getCell("A1").font = {
      bold: true,
      size: 20,
      color: { argb: blanco }
    };
    hojaResumen.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    hojaResumen.getRow(1).height = 42;

    hojaResumen.mergeCells("A2:B2");
    hojaResumen.getCell("A2").value =
      "SISTEMA DE GESTIÓN DE EQUIPO MÉDICO";
    hojaResumen.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: azulMarino }
    };
    hojaResumen.getCell("A2").alignment = {
      horizontal: "center"
    };

    hojaResumen.mergeCells("A3:B3");
    hojaResumen.getCell("A3").value =
      "Fecha de generación: " + new Date().toLocaleDateString("es-MX");
    hojaResumen.getCell("A3").font = {
      italic: true,
      size: 10,
      color: { argb: "666666" }
    };

    hojaResumen.getRow(5).values = ["Indicador", "Cantidad"];

    hojaResumen.addRows([
      { indicador: "Total de equipos", cantidad: equipos.length },
      { indicador: "Equipos en funcionamiento", cantidad: equiposFuncionando },
      { indicador: "Equipos en mantenimiento", cantidad: equipos.filter(e => e.estado === "En mantenimiento").length },
      { indicador: "Equipos fuera de servicio", cantidad: equiposFueraServicio },
      { indicador: "Total de mantenimientos", cantidad: mantenimientos.length },
      { indicador: "Mantenimientos programados", cantidad: mantenimientosProgramados },
      { indicador: "Mantenimientos en proceso", cantidad: mantenimientosEnProceso },
      { indicador: "Mantenimientos completados", cantidad: mantenimientosCompletados },
      { indicador: "Mantenimientos vencidos", cantidad: mantenimientosVencidos }
    ]);

    darFormato(hojaResumen, 2, 5);

    // HOJA 2: INVENTARIO
    const hojaEquipos = libro.addWorksheet("Inventario");

    hojaEquipos.columns = [
      { header: "Equipo", key: "Equipo", width: 25 },
      { header: "Marca", key: "Marca", width: 18 },
      { header: "Modelo", key: "Modelo", width: 18 },
      { header: "Serie", key: "Serie", width: 18 },
      { header: "Inventario", key: "Inventario", width: 18 },
      { header: "Fabricante", key: "Fabricante", width: 22 },
      { header: "Voltaje", key: "Voltaje", width: 12 },
      { header: "Potencia", key: "Potencia", width: 12 },
      { header: "Frecuencia", key: "Frecuencia", width: 14 },
      { header: "Área", key: "Area", width: 18 },
      { header: "Ubicación", key: "Ubicacion", width: 22 },
      { header: "Estado", key: "Estado", width: 22 },
      { header: "Descripción", key: "Descripcion", width: 35 }
    ];

    hojaEquipos.addRows(
      equipos.map((equipo) => ({
        Equipo: equipo.nombre || "",
        Marca: equipo.marca || "",
        Modelo: equipo.modelo || "",
        Serie: equipo.serie || "",
        Inventario: equipo.inventario || "",
        Fabricante: equipo.fabricante || "",
        Voltaje: equipo.voltaje || "",
        Potencia: equipo.potencia || "",
        Frecuencia: equipo.frecuencia || "",
        Area: equipo.area || "",
        Ubicacion: equipo.ubicacion || "",
        Estado: equipo.estado || "",
        Descripcion: equipo.descripcion || ""
      }))
    );

    darFormato(hojaEquipos, 13);

    hojaEquipos.eachRow((fila, numero) => {
      if (numero > 1) {
        colorearEstado(fila.getCell(12), fila.getCell(12).value);
      }
    });

    // HOJA 3: MANTENIMIENTOS
    const hojaMantenimientos = libro.addWorksheet("Mantenimientos");

    hojaMantenimientos.columns = [
      { header: "Equipo", key: "Equipo", width: 25 },
      { header: "Inventario", key: "Inventario", width: 18 },
      { header: "Tipo", key: "Tipo", width: 18 },
      { header: "Fecha", key: "Fecha", width: 16 },
      { header: "Responsable", key: "Responsable", width: 22 },
      { header: "Estado", key: "Estado", width: 18 },
      { header: "Observaciones", key: "Observaciones", width: 35 }
    ];

    hojaMantenimientos.addRows(
      mantenimientos.map((m) => ({
        Equipo: m.equipo || "",
        Inventario: m.numeroInventario || m.inventario || "",
        Tipo: m.tipo || "",
        Fecha: m.fecha || "",
        Responsable: m.responsable || "",
        Estado: m.estado || "",
        Observaciones: m.observaciones || ""
      }))
    );

    darFormato(hojaMantenimientos, 7);

    hojaMantenimientos.eachRow((fila, numero) => {
      if (numero > 1) {
        colorearEstado(fila.getCell(6), fila.getCell(6).value);
      }
    });

    // DESCARGAR EXCEL
    const buffer = await libro.xlsx.writeBuffer();

    const archivo = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = window.URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "Reporte_BIO-MED_CONTROL.xlsx";

    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Error al exportar Excel:", error);
    alert("No se pudo generar el Excel. Revisa la consola para conocer el error.");
  }
};



const exportarPDF = () => {
  const documento = new jsPDF();


  documento.setFillColor(20, 32, 51);
  documento.rect(0, 0, 210, 35, "F");

  documento.setTextColor(255, 255, 255);
  documento.setFont("helvetica", "bold");
  documento.setFontSize(20);
  documento.text("BIO-MED CONTROL", 14, 16);

  documento.setFont("helvetica", "normal");
  documento.setFontSize(11);
  documento.text("SISTEMA DE GESTIÓN DE EQUIPO MÉDICO", 14, 25);

  documento.setTextColor(60, 70, 85);
  documento.setFontSize(10);
  documento.text(
    "Fecha de generación: " + new Date().toLocaleDateString("es-MX"),
    14,
    43
  );

  documento.setFontSize(14);
  documento.setFont("helvetica", "bold");
  documento.text("Inventario de equipos", 14, 55);



  autoTable(documento, {
  startY: 60,
    head: [[
      "Equipo",
      "Marca",
      "Modelo",
      "Inventario",
      "Área",
      "Estado"
    ]],
    body: equipos.length > 0
      ? equipos.map((equipo) => [
          equipo.nombre || "",
          equipo.marca || "",
          equipo.modelo || "",
          equipo.inventario || "",
          equipo.area || "",
          equipo.estado || ""
        ])
      : [["Sin equipos registrados", "", "", "", "", ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95] }
  });

  const posicion = documento.lastAutoTable.finalY + 15;

  documento.setFontSize(14);
  documento.text("Registro de mantenimientos", 14, posicion);

  autoTable(documento, {
    startY: posicion + 5,
    head: [[
      "Equipo",
      "Inventario",
      "Tipo",
      "Fecha",
      "Responsable",
      "Estado"
    ]],
    body: mantenimientos.length > 0
      ? mantenimientos.map((m) => [
          m.equipo || "",
          m.numeroInventario || m.inventario || "",
          m.tipo || "",
          m.fecha || "",
          m.responsable || "",
          m.estado || ""
        ])
      : [["Sin mantenimientos registrados", "", "", "", "", ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95] }
  });

  const totalPaginas = documento.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    documento.setPage(pagina);

    documento.setDrawColor(180, 190, 205);
    documento.line(14, 285, 196, 285);

    documento.setFont("helvetica", "normal");
    documento.setFontSize(9);
    documento.setTextColor(100, 110, 125);

    documento.text(
      "BIO-MED CONTROL | Reporte administrativo",
      14,
      291
    );

    documento.text(
      `Página ${pagina} de ${totalPaginas}`,
      196,
      291,
      { align: "right" }
    );
  }

  documento.save("Reporte_BIO-MED_CONTROL.pdf");
};


  return (
    <div className="app">
      <aside className="sidebar">
        <h2>BIO-MED</h2>
        <p className="subtitle">CONTROL BIOMÉDICO</p>

        <nav>
          <a
            className={pagina === "Panel principal" ? "active" : ""}
            onClick={() => setPagina("Panel principal")}
          >
            ▦ Panel principal
          </a>

          <a
            className={pagina === "Hoja de datos" ? "active" : ""}
            onClick={() => setPagina("Hoja de datos")}
          >
            ▤ Hoja de datos
          </a>

          <a
            className={pagina === "Inventario" ? "active" : ""}
            onClick={() => setPagina("Inventario")}
          >
            ▣ Inventario
          </a>

          <a
            className={pagina === "PAM" ? "active" : ""}
            onClick={() => setPagina("PAM")}
          >
            ▦ PAM
          </a>

          <a
            className={pagina === "Mantenimientos" ? "active" : ""}
            onClick={() => setPagina("Mantenimientos")}
          >
            ⚙ Mantenimientos
          </a>

          <a
            className={pagina === "Historial" ? "active" : ""}
            onClick={() => setPagina("Historial")}
          >
            ◷ Historial
          </a>

          <a
            className={pagina === "Reportes" ? "active" : ""}
            onClick={() => setPagina("Reportes")}
          >
            ▧ Reportes
          </a>
        </nav>


        <div className="sidebar-footer">
          INGENIERÍA BIOMÉDICA
          <br />
          Sistema v1.0
        </div>
      </aside>

      <main className="main">
        <header>
          <div>
            <h1>{pagina}</h1>
            <p>Administración de equipo médico</p>
          </div>
          <span className="user">Administrador</span>
        </header>

  {pagina === "Panel principal" && (
  <>
    <section className="welcome">
      <h2>Bienvenido a BIO-MED CONTROL</h2>
      <p>Sistema integral de gestión de equipo médico hospitalario.</p>
    </section>

    <section className="stats">
      <div className="card">
        <span>Equipos registrados</span>
        <h2>{equipos.length}</h2>
        <p>Inventario general</p>
      </div>
      <div className="card">
        <span>En funcionamiento</span>
       <h2>{equiposFuncionando}</h2>
        <p>Equipos disponibles</p>
      </div>
      <div className="card">
        <span>Fuera de servicio</span>
        <h2>{equiposFueraServicio}</h2>
        <p>Requieren atención</p>
      </div>
      <div className="card">
        <span>Mantenimientos próximos</span>
        <h2>{mantenimientosProximos}</h2>
        <p>Consultar PAM</p>
      </div>
      <div className="card alert-card vencidos">
  <span>Mantenimientos vencidos</span>
  <h2>{mantenimientosVencidos}</h2>
  <p>Requieren atención</p>
</div>

<div className="card alert-card proximos">
  <span>Próximos 7 días</span>
  <h2>{mantenimientosProximos7Dias}</h2>
  <p>Mantenimientos programados</p>
</div>
    </section>
<section className="chart-section">
  <h2>Estadísticas de mantenimiento</h2>
  <p>Resumen del estado actual de los mantenimientos.</p>

  <div className="chart-bars">
    <div className="chart-item">
      <span>Programados</span>
      <div className="chart-track">
        <div
          className="chart-fill programados"
          style={{
            width: `${
              mantenimientos.length
                ? (mantenimientosProgramados / mantenimientos.length) * 100
                : 0
            }%`
          }}
        ></div>
      </div>
      <strong>{mantenimientosProgramados}</strong>
    </div>

    <div className="chart-item">
      <span>En proceso</span>
      <div className="chart-track">
        <div
          className="chart-fill en-proceso"
          style={{
            width: `${
              mantenimientos.length
                ? (mantenimientosEnProceso / mantenimientos.length) * 100
                : 0
            }%`
          }}
        ></div>
      </div>
      <strong>{mantenimientosEnProceso}</strong>
    </div>

    <div className="chart-item">
      <span>Completados</span>
      <div className="chart-track">
        <div
          className="chart-fill completados"
          style={{
            width: `${
              mantenimientos.length
                ? (mantenimientosCompletados / mantenimientos.length) * 100
                : 0
            }%`
          }}
        ></div>
      </div>
      <strong>{mantenimientosCompletados}</strong>
    </div>
  </div>
</section>
    <section className="modules">
      <h2>Módulos principales</h2>
      <div className="module-grid">
        <div className="module">
          <h3>Hoja de datos</h3>
          <p>Consultar fichas técnicas de los equipos.</p>
        </div>
        <div className="module">
          <h3>Inventario</h3>
          <p>Registrar y administrar equipos médicos.</p>
        </div>
        <div className="module">
          <h3>PAM</h3>
          <p>Organizar el programa anual de mantenimiento.</p>
        </div>
      </div>
    </section>
  </>
)}

{pagina === "Hoja de datos" && (
  <section className="modules">
    <h2>Hoja de datos de equipo médico</h2>
    <p>Registro de información técnica de los equipos.</p>

    <div className="module">
      <h3>Información general</h3>

  <div className="form-grid">
  <input name="nombre" value={equipoActual.nombre} onChange={actualizarCampo} placeholder="Nombre del equipo" />
  <input name="marca" value={equipoActual.marca} onChange={actualizarCampo} placeholder="Marca" />
  <input name="modelo" value={equipoActual.modelo} onChange={actualizarCampo} placeholder="Modelo" />
  <input name="serie" value={equipoActual.serie} onChange={actualizarCampo} placeholder="Número de serie" />
  <input name="inventario" value={equipoActual.inventario} onChange={actualizarCampo} placeholder="Número de inventario" />
  <input name="fabricante" value={equipoActual.fabricante} onChange={actualizarCampo} placeholder="Fabricante" />
  <input name="voltaje" value={equipoActual.voltaje} onChange={actualizarCampo} placeholder="Voltaje de alimentación" />
  <input name="potencia" value={equipoActual.potencia} onChange={actualizarCampo} placeholder="Potencia eléctrica" />
  <input name="frecuencia" value={equipoActual.frecuencia} onChange={actualizarCampo} placeholder="Frecuencia" />
  <input name="area" value={equipoActual.area} onChange={actualizarCampo} placeholder="Área o servicio" />
  <input name="ubicacion" value={equipoActual.ubicacion} onChange={actualizarCampo} placeholder="Ubicación" />
  <textarea name="descripcion" value={equipoActual.descripcion} onChange={actualizarCampo} placeholder="Descripción y función del equipo" />
  <select
  name="estado"
  value={equipoActual.estado}
  onChange={actualizarCampo}
>
  <option value="En funcionamiento">En funcionamiento</option>
  <option value="En mantenimiento">En mantenimiento</option>
  <option value="Fuera de servicio">Fuera de servicio</option>
</select>
</div>

  <button className="save-button" onClick={guardarEquipo}>
  {indiceEdicion !== null ? "Guardar cambios" : "Guardar equipo"}
</button>
    </div>
  </section>
)}

{pagina === "Inventario" && (
  <section className="modules">
    <h2>Inventario de equipo médico</h2>
    <p>Administración y control de los equipos registrados.</p>

  <div className="module">
  <h3>Registro de equipos</h3>
  <div className="inventory-filters">

  <input
    type="text"
    placeholder="Buscar por equipo, marca, modelo o inventario..."
    value={busquedaInventario}
    onChange={(e) => setBusquedaInventario(e.target.value)}
  />

  <select
    value={filtroEstadoInventario}
    onChange={(e) => setFiltroEstadoInventario(e.target.value)}
  >
    <option value="Todos">Todos los estados</option>
    <option value="En funcionamiento">En funcionamiento</option>
    <option value="En mantenimiento">En mantenimiento</option>
    <option value="Fuera de servicio">Fuera de servicio</option>
  </select>

</div>

  {equipos.length === 0 ? (
    <p>Aún no hay equipos registrados.</p>
  ) : (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Número de inventario</th>
            <th>Área</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {equiposFiltrados.map((equipo) => {
  const indice = equipos.findIndex(
    (e) => e.inventario === equipo.inventario
  );

  return (
            <tr key={indice}>
              <td>{equipo.nombre}</td>
              <td>{equipo.marca}</td>
              <td>{equipo.modelo}</td>
              <td>{equipo.inventario}</td>
              <td>{equipo.area}</td>
              <td>{equipo.estado || "Sin estado"}</td>
              
<td>
  <button
    className="edit-button"
    onClick={() => editarEquipo(indice)}
  >
    Editar
  </button>

  <button
    className="delete-button"
    onClick={() => eliminarEquipo(indice)}
  >
    Eliminar
  </button>
</td>

            </tr>
            );
})}
        </tbody>
      </table>
    </div>
  )}
</div>
  </section>
)}

{pagina === "PAM" && (
  <section className="modules">
    <h2>Programa Anual de Mantenimiento (PAM)</h2>
    <p>Planeación y seguimiento del mantenimiento de los equipos.</p>

    <div className="module">
      <h3>Registrar mantenimiento</h3>

      {equipos.length === 0 ? (
        <p>Primero debes registrar equipos en el inventario.</p>
      ) : (
        <div className="form-grid">

          <select
            name="inventario"
            value={mantenimientoActual.inventario}
            onChange={actualizarMantenimiento}
          >
            <option value="">Selecciona un equipo</option>

            {equipos.map((equipo, indice) => (
              <option key={indice} value={equipo.inventario}>
                {equipo.nombre} - {equipo.inventario}
              </option>
            ))}
          </select>

          <select
            name="tipo"
            value={mantenimientoActual.tipo}
            onChange={actualizarMantenimiento}
          >
            <option value="Preventivo">Preventivo</option>
            <option value="Correctivo">Correctivo</option>
          </select>

          <input
            type="date"
            name="fecha"
            value={mantenimientoActual.fecha}
            onChange={actualizarMantenimiento}
          />

          <input
            type="text"
            name="responsable"
            value={mantenimientoActual.responsable}
            onChange={actualizarMantenimiento}
            placeholder="Responsable del mantenimiento"
          />

          <select
            name="estado"
            value={mantenimientoActual.estado}
            onChange={actualizarMantenimiento}
          >
            <option value="Programado">Programado</option>
            <option value="En proceso">En proceso</option>
            <option value="Completado">Completado</option>
          </select>

          <textarea
            name="observaciones"
            value={mantenimientoActual.observaciones}
            onChange={actualizarMantenimiento}
            placeholder="Observaciones del mantenimiento"
          />

        </div>
      )}

      {equipos.length > 0 && (
        <button
          className="save-button"
          onClick={guardarMantenimiento}
        >
          Guardar mantenimiento
        </button>
      )}
    </div>

<div className="module">
  <h3>Programa anual de mantenimiento</h3>

  <div className="year-selector">
    <label>Año del programa:</label>
    <select
      value={anioPAM}
      onChange={(e) => setAnioPAM(Number(e.target.value))}
    >
      {[anioPAM - 1, anioPAM, anioPAM + 1].map((anio) => (
        <option key={anio} value={anio}>
          {anio}
        </option>
      ))}
    </select>
  </div>

  <div className="table-container">
    <table className="gantt-table">
      <thead>
        <tr>
          <th>Equipo</th>
          {mesesPAM.map((mes) => (
            <th key={mes}>{mes.slice(0, 3)}</th>
          ))}
        </tr>
      </thead>

      <tbody>
  {equipos.map((equipo) => (
    <tr key={equipo.inventario}>
      <td>{equipo.nombre}</td>

      {mesesPAM.map((mes, indice) => {
        const mantenimientosDelMes = mantenimientos.filter(
          (mantenimiento) =>
            mantenimiento.numeroInventario === equipo.inventario &&
            mantenimiento.fecha &&
            Number(mantenimiento.fecha.slice(0, 4)) === anioPAM &&
            Number(mantenimiento.fecha.slice(5, 7)) === indice + 1
        );

        const estadosMes = [
          ...new Set(mantenimientosDelMes.map((m) => m.estado))
        ];

        return (
          <td key={mes}>
            {estadosMes.length > 0 ? (
              estadosMes.map((estado) => (
                <span
                  key={estado}
                  className={`gantt-mark ${
                    estado === "Programado"
                      ? "gantt-programado"
                      : estado === "En proceso"
                      ? "gantt-proceso"
                      : estado === "Completado"
                      ? "gantt-completado"
                      : ""
                  }`}
                  title={estado}
                >
                  ●
                </span>
              ))
            ) : (
              "—"
            )}
          </td>
        );
      })}
    </tr>
  ))}
</tbody>
    </table>
  </div>

 
<div className="gantt-legend">
  <span className="gantt-programado">● Programado</span>
  <span className="gantt-proceso">● En proceso</span>
  <span className="gantt-completado">● Completado</span>
</div>

</div>

        <div className="module">
      <h3>Mantenimientos registrados</h3>

      {mantenimientos.length === 0 ? (
        <p>Aún no hay mantenimientos registrados.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Inventario</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Observaciones</th>
              </tr>
            </thead>

            <tbody>
              {mantenimientos.map((mantenimiento) => (
                <tr key={mantenimiento.id}>
                  <td>{mantenimiento.equipo}</td>
                  <td>{mantenimiento.numeroInventario}</td>
                  <td>{mantenimiento.tipo}</td>
                  <td>{mantenimiento.fecha}</td>
                  <td>{mantenimiento.responsable}</td>

<td>
  <select
    value={mantenimiento.estado}
    onChange={(e) =>
      cambiarEstadoMantenimiento(
        mantenimiento.id,
        e.target.value
      )
    }
  >
    <option value="Programado">Programado</option>
    <option value="En proceso">En proceso</option>
    <option value="Completado">Completado</option>
  </select>
</td>
                  <td>{mantenimiento.observaciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)}

{pagina === "Mantenimientos" && (
  <section className="modules">
    <h2>Gestión de mantenimientos</h2>
    <p>Consulta y seguimiento de los mantenimientos de equipo médico.</p>

    <div className="module">
      <h3>Resumen de mantenimientos</h3>

      <div className="stats">
        <div className="card">
          <span>Total registrados</span>
          <h2>{mantenimientos.length}</h2>
        </div>

        <div className="card">
          <span>Programados</span>
          <h2>
            {mantenimientos.filter(
              (m) => m.estado === "Programado"
            ).length}
          </h2>
        </div>

        <div className="card">
          <span>En proceso</span>
          <h2>
            {mantenimientos.filter(
              (m) => m.estado === "En proceso"
            ).length}
          </h2>
        </div>

        <div className="card">
          <span>Completados</span>
          <h2>
            {mantenimientos.filter(
              (m) => m.estado === "Completado"
            ).length}
          </h2>
        </div>
      </div>
    </div>

    <div className="module">
      <h3>Listado general</h3>

      {mantenimientos.length === 0 ? (
        <p>Aún no hay mantenimientos registrados.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Inventario</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {mantenimientos.map((mantenimiento) => (
                <tr key={mantenimiento.id}>
                  <td>{mantenimiento.equipo}</td>
                  <td>{mantenimiento.numeroInventario}</td>
                  <td>{mantenimiento.tipo}</td>
                  <td>{mantenimiento.fecha}</td>
                  <td>{mantenimiento.responsable}</td>
                  <td>{mantenimiento.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)}

{pagina === "Reportes" && (
  <section className="modules">
    <h2>Reportes del sistema</h2>

    <div className="stats">
      <div className="card">
        <span>Total de equipos</span>
        <h2>{equipos.length}</h2>
        <p>Equipos registrados</p>
      </div>

      <div className="card">
        <span>Equipos funcionando</span>
        <h2>{equiposFuncionando}</h2>
        <p>En funcionamiento</p>
      </div>

      <div className="card">
        <span>Fuera de servicio</span>
        <h2>{equiposFueraServicio}</h2>
        <p>Equipos no disponibles</p>
      </div>

      <div className="card">
        <span>Mantenimientos preventivos</span>
        <h2>
          {mantenimientos.filter(
            (m) => m.tipo === "Preventivo"
          ).length}
        </h2>
        <p>Registros preventivos</p>
      </div>

      <div className="card">
        <span>Mantenimientos correctivos</span>
        <h2>
          {mantenimientos.filter(
            (m) => m.tipo === "Correctivo"
          ).length}
        </h2>
        <p>Registros correctivos</p>
      </div>

      <div className="card">
        <span>Mantenimientos completados</span>
        <h2>
          {mantenimientos.filter(
            (m) => m.estado === "Completado"
          ).length}
        </h2>
        <p>Trabajos finalizados</p>
      </div>

    <div className="export-actions">
      <button className="save-button" onClick={exportarExcel}>
        📊 Descargar reporte en Excel
      </button>

<button className="save-button" onClick={exportarPDF}>
  📄 Descargar reporte en PDF
</button>

    </div>

    </div>
<div className="module">
  <h3>Buscar y filtrar mantenimientos</h3>

  <input
    type="text"
    placeholder="Buscar por equipo o número de inventario..."
    value={busquedaReporte}
    onChange={(e) => setBusquedaReporte(e.target.value)}
  />

  <div className="report-filters">
    <select
      value={filtroTipoReporte}
      onChange={(e) => setFiltroTipoReporte(e.target.value)}
    >
      <option value="Todos">Todos los tipos</option>
      <option value="Preventivo">Preventivo</option>
      <option value="Correctivo">Correctivo</option>
    </select>

    <select
      value={filtroEstadoReporte}
      onChange={(e) => setFiltroEstadoReporte(e.target.value)}
    >
      <option value="Todos">Todos los estados</option>
      <option value="Programado">Programado</option>
      <option value="En proceso">En proceso</option>
      <option value="Completado">Completado</option>
    </select>
  </div>

  <p>
    Resultados encontrados: {mantenimientosFiltradosReporte.length}
  </p>
  {mantenimientosFiltradosReporte.length === 0 ? (
  <p>No hay mantenimientos que coincidan con la búsqueda.</p>
) : (
  <div className="table-container">
    <table>
      <thead>
        <tr>
          <th>Equipo</th>
          <th>Inventario</th>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Responsable</th>
          <th>Estado</th>
        </tr>
      </thead>

      <tbody>
        {mantenimientosFiltradosReporte.map((m) => (
          <tr key={m.id}>
            <td>{m.equipo}</td>
            <td>{m.numeroInventario || m.inventario}</td>
            <td>{m.tipo}</td>
            <td>{m.fecha}</td>
            <td>{m.responsable}</td>
            <td>{m.estado}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
</div>
    <div className="module">
      <h3>Avance de mantenimiento</h3>

      <h2>
        {mantenimientos.length > 0
          ? Math.round(
              (mantenimientos.filter(
                (m) => m.estado === "Completado"
              ).length / mantenimientos.length) * 100
            )
          : 0}%
      </h2>

      <p>
        Porcentaje de mantenimientos completados
      </p>
    </div>
  </section>
)}

{pagina === "Historial" && (
  <section className="modules">
    <h2>Historial de mantenimiento</h2>
    <p>Consulta los mantenimientos que ya fueron completados.</p>

    <div className="module">
      <h3>Mantenimientos realizados</h3>

      {mantenimientos.filter(
        (mantenimiento) => mantenimiento.estado === "Completado"
      ).length === 0 ? (
        <p>Aún no hay mantenimientos completados.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Inventario</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Observaciones</th>
              </tr>
            </thead>

            <tbody>
              {mantenimientos
                .filter(
                  (mantenimiento) =>
                    mantenimiento.estado === "Completado"
                )
                .map((mantenimiento) => (
                  <tr key={mantenimiento.id}>
                    <td>{mantenimiento.equipo}</td>
                    <td>{mantenimiento.numeroInventario}</td>
                    <td>{mantenimiento.tipo}</td>
                    <td>{mantenimiento.fecha}</td>
                    <td>{mantenimiento.responsable}</td>
                    <td>{mantenimiento.observaciones || "Sin observaciones"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)}

{pagina !== "Panel principal" &&
 pagina !== "Hoja de datos" &&
 pagina !== "Inventario" &&
 pagina !== "PAM" &&
 pagina !== "Mantenimientos" &&
 pagina !== "Reportes" &&
 pagina !== "Historial" && (
  <section className="modules">
    <h2>{pagina}</h2>
    <div className="module">
      <p>Este módulo estará disponible próximamente.</p>
    </div>
  </section>
)}

      </main>
    </div>
  );
}

export default App;
