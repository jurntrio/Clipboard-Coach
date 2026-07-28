import { readSheet } from "read-excel-file/browser";

export type ImportedPlayerRow = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phoneNumbers: string;
};

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizedHeader(value: unknown) {
  return textValue(value).toLocaleLowerCase("nl-BE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = textValue(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

function phoneValue(value: unknown) {
  const raw = textValue(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits === "14" || digits.length < 8) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("32")) return `+${digits}`;
  return raw;
}

export async function parseRosterFile(file: File, messages: {
  noRows: string;
  missingColumns: string;
  noUsablePlayers: string;
}) {
  const rows = await readSheet(file);
  if (rows.length < 2) throw new Error(messages.noRows);
  const headers = rows[0].map(normalizedHeader);
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const lastNameIndex = column("naam", "achternaam", "familienaam");
  const firstNameIndex = column("voornaam", "firstname");
  const emailIndex = column("emailspeler", "email", "emailadres");
  const birthDateIndex = column("geboortedatum", "geboortedate", "birthdate");
  const phoneIndexes = [column("telefoonspeler", "gsmspeler", "gsm"), column("telefoon2", "gsm2"), column("telefoon3", "gsm3")].filter((index) => index >= 0);
  if (firstNameIndex < 0 || lastNameIndex < 0) throw new Error(messages.missingColumns);

  const imported = rows.slice(1).map((row) => {
    const phones = Array.from(new Set(phoneIndexes.map((index) => phoneValue(row[index])).filter(Boolean)));
    return {
      firstName: textValue(row[firstNameIndex]),
      lastName: textValue(row[lastNameIndex]),
      dateOfBirth: birthDateIndex >= 0 ? dateValue(row[birthDateIndex]) : "",
      email: emailIndex >= 0 ? textValue(row[emailIndex]) : "",
      phoneNumbers: phones.join(", ")
    };
  }).filter((row) => row.firstName || row.lastName);

  if (!imported.length) throw new Error(messages.noUsablePlayers);
  return imported;
}
