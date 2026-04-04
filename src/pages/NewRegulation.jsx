import React, { useState } from 'react';

function NewRegulation({ onCreate, onCancel }) {
  const [formData, setFormData] = useState({
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

  const handleCreate = () => {
    if (!formData.nombre) {
      alert("Completa los campos requeridos");
      return;
    }
    onCreate(formData);
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
