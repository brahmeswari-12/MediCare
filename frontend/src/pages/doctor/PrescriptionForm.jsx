import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { prescriptionApi } from "../../services";
import { Alert, SubmitButton, TextAreaField } from "../../components/ui";
import { getErrorMessage } from "../../utils/errors";

const EMPTY_ITEM = { medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" };
const COLUMNS = [
  ["medicine_name", "Medicine", "e.g. Paracetamol"],
  ["dosage", "Dosage", "e.g. 500 mg"],
  ["frequency", "Frequency", "e.g. Twice daily"],
  ["duration", "Duration", "e.g. 5 days"],
  ["instructions", "Instructions", "Optional"],
];

export default function PrescriptionForm({ recordId, onSaved, onCancel }) {
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (i, key, value) => setItems((list) => list.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  async function submit(e) {
    e.preventDefault();
    const incomplete = items.some((it) => !it.medicine_name.trim() || !it.dosage.trim() || !it.frequency.trim() || !it.duration.trim());
    if (incomplete) {
      setError("Fill in medicine, dosage, frequency and duration for every row.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      onSaved(await prescriptionApi.create({ medical_record: recordId, notes, items }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-header"><h3>New prescription</h3></div>
      <div className="card-body stack">
        {error && <Alert type="danger">{error}</Alert>}
        {items.map((item, i) => (
          <fieldset key={i} className="card" style={{ padding: 16, margin: 0, border: "1px solid var(--gray-200)" }}>
            <legend className="small strong" style={{ padding: "0 6px" }}>Medicine {i + 1}</legend>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {COLUMNS.map(([key, label, placeholder]) => (
                <div className="field" key={key}>
                  <label className="label" htmlFor={`rx-${i}-${key}`}>{label}</label>
                  <input id={`rx-${i}-${key}`} className="input" value={item[key]} placeholder={placeholder}
                         maxLength={key === "instructions" ? 255 : 150} onChange={(e) => update(i, key, e.target.value)} />
                </div>
              ))}
            </div>
            {items.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm mt-2"
                      onClick={() => setItems((list) => list.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} /> Remove
              </button>
            )}
          </fieldset>
        ))}
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems((l) => [...l, { ...EMPTY_ITEM }])}>
            <Plus size={14} /> Add medicine
          </button>
        </div>
        <TextAreaField label="Notes for the patient" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <SubmitButton loading={saving}>Save prescription</SubmitButton>
        </div>
      </div>
    </form>
  );
}
