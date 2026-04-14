import { FormEvent, useEffect, useState } from "react";

interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

export const ProjectDialog = ({ open, onClose, onSubmit }: ProjectDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("\u9879\u76ee\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002");
      return;
    }
    onSubmit(name.trim(), description.trim());
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer drawer-small" onClick={(event) => event.stopPropagation()}>
        <h3>{"\u65b0\u589e\u9879\u76ee"}</h3>
        <form className="drawer-form" onSubmit={handleSubmit}>
          <label>
            {"\u9879\u76ee\u540d\u79f0"}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {"\u9879\u76ee\u63cf\u8ff0"}
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {"\u53d6\u6d88"}
            </button>
            <button type="submit" className="btn btn-primary">
              {"\u521b\u5efa\u9879\u76ee"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
