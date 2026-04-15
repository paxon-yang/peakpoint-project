import { FormEvent, useEffect, useState } from "react";

interface ProjectDialogProps {
  t: (key: "createProject" | "projectName" | "projectDesc" | "projectNameRequired" | "cancel") => string;
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

export const ProjectDialog = ({ t, open, onClose, onSubmit }: ProjectDialogProps) => {
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
      setError(t("projectNameRequired"));
      return;
    }
    onSubmit(name.trim(), description.trim());
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer drawer-small" onClick={(event) => event.stopPropagation()}>
        <h3>{t("createProject")}</h3>
        <form className="drawer-form" onSubmit={handleSubmit}>
          <label>
            {t("projectName")}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {t("projectDesc")}
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t("cancel")}
            </button>
            <button type="submit" className="btn btn-primary">
              {t("createProject")}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
