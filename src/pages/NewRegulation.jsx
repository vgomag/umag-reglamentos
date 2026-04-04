import React, { useState } from 'react';

function NewRegulation({ onCreate, onCancel }) {
  const [formData, setFormData] = useState({
    numero: "",
    nombre: "",
    articulo: "",
    estado: "Pendiente",
    progreso: 0,
    prioridad: "media",
    responsable: "",
    decreto: "",
    articulo_estatuto: "",
    observaciones: "",
    enlace: ""
  });

  const sanitize = (str) => str.replace(/[<>]/g, '').trim();
  const isValidUrl = (url) => !url || /^https?:\/\/.+/.test(url);

  const handleCreate = () => {
    if (!formData.nombre || formData.nombre.trim().length < 3) {
      alert("El nombre del reglamento debe tener al menos 3 caracteres");
      return;
    }
    if (formData.enlace && !isValidUrl(formData.enlace)) {
      alert("El enlace debe ser una URL válida (https://...)");
      return;
    }
    if (formData.nombre.length > 300 || formData.observaciones.length > 5000) {
      alert("Texto demasiado largo. Nombre máx 300 caracteres, observaciones máx 5000.");
      return;
    }
    const sanitized = {
      ...formData,
      nombre: sanitize(formData.nombre),
      articulo: sanitize(formData.articulo),
      responsable: sanitize(formData.responsable),
      decreto: sanitize(formData.decreto),
      articulo_estatuto: sanitize(formData.articulo_estatuto),
      observaciones: sanitize(formData.observaciones),
      enlace: formData.enlace.trim(),
    };
    onCreate(sanitized);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>← Volver</button>
          <h2 style={{ margin: 0 }}>Crear Nuevo Reglamento</h2>
        </div>
      </div>
      <div className="section">
        <div className="form-group">
          <label>Número</label>
          <input type="text" value={formData.numero} onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))} placeholder="ej: 32" />
        </div>
        <div className="form-group">
          <label>Nombre</label>
          <input type="text" value={formData.nombre} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))} placeholder="Nombre del reglamento" />
        </div>
        <div className="form-group">
          <label>Artículo</label>
          <input type="text" value={formData.articulo} onChange={(e) => setFormData(prev => ({ ...prev, articulo: e.target.value }))} placeholder="ej: Art. 1-100" />
        </div>
        <div className="form-group">
          <label>Responsable</label>
          <input type="text" value={formData.responsable} onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Prioridad</label>
          <select value={formData.prioridad} onChange={(e) => setFormData(prev => ({ ...prev, prioridad: e.target.value }))}>
            <option>alta</option>
            <option>media</option>
            <option>baja</option>
          </select>
        </div>
        <div className="form-group">
          <label>Decreto / Resolución</label>
          <input type="text" value={formData.decreto} onChange={(e) => setFormData(prev => ({ ...prev, decreto: e.target.value }))} placeholder="ej: DEC N°001/SU/2025" />
        </div>
        <div className="form-group">
          <label>Artículo del Estatuto</label>
          <input type="text" value={formData.articulo_estatuto} onChange={(e) => setFormData(prev => ({ ...prev, articulo_estatuto: e.target.value }))} placeholder="ej: Art. 67" />
        </div>
        <div className="form-group">
          <label>Observaciones</label>
          <textarea value={formData.observaciones} onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))} placeholder="Notas, pendientes, acuerdos..."></textarea>
        </div>
        <div className="form-group">
          <label>Enlace al documento</label>
          <input type="text" value={formData.enlace} onChange={(e) => setFormData(prev => ({ ...prev, enlace: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={handleCreate}>Crear Reglamento</button>
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default NewRegulation;
