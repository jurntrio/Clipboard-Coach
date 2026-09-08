"use client";

type Props = {
  id: string;
  legend: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled: boolean;
};

export function NumberInputs({ id, legend, label, values, onChange, disabled }: Props) {
  const duplicates = values.some((value, index) => value !== "" && values.some((other, otherIndex) => otherIndex !== index && other !== "" && Number(other) === Number(value)));
  const outsideRange = values.some(value => value !== "" && (Number(value) < 1 || Number(value) > 45));
  return <fieldset className="number-inputs" disabled={disabled} aria-describedby={`${id}-help`}>
    <legend>{legend}</legend>
    <div className={`number-grid ${values.length === 6 ? "number-grid-six" : ""}`}>
      {values.map((value, index) => {
        const invalid = value !== "" && (Number(value) < 1 || Number(value) > 45 || values.some((other, otherIndex) => otherIndex !== index && other !== "" && Number(other) === Number(value)));
        return <input key={index} id={`${id}-${index + 1}`} type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} autoComplete="off" required
          aria-label={`${label} ${index + 1}`} aria-invalid={invalid || undefined} aria-describedby={`${id}-help`} placeholder="—" value={value}
          onChange={event => { const next = event.target.value; if (/^\d{0,2}$/.test(next)) onChange(values.map((current, at) => at === index ? next : current)); }} />;
      })}
    </div>
    <p className={`help ${duplicates || outsideRange ? "number-error" : ""}`} id={`${id}-help`} aria-live="polite">
      {outsideRange ? "Elk nummer moet tussen 1 en 45 liggen." : duplicates ? "Elk nummer mag maar één keer voorkomen." : "Eén nummer per vakje, van 1 t.e.m. 45. Elk nummer moet uniek zijn."}
    </p>
  </fieldset>;
}
