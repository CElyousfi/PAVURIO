/** A plain-text health summary the owner can hand to a vet or sitter. Only facts the owner entered. */
import type { Db } from '../data/db';
import type { Pet } from '../data/repo';
import { listAllSchedules, listMeasurements, upcomingAppointments } from '../data/careRepo';
import { listRecords, SOURCES } from '../data/recordsRepo';
import { describeDays, formatTime24to12 } from '../domain/schedule';
import { dayKeyOf } from '../domain/time';
import { formatDateLong } from '../ui/forms';
import { formatWeight } from './weight';

function ageText(birth: string | null): string | null {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1));
  if (now.getDate() < d) months -= 1;
  if (months < 0) return null;
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  return `${Math.floor(months / 12)} years`;
}

export async function buildCareSummary(db: Db, pet: Pet, unit: 'kg' | 'lb'): Promise<string> {
  const [records, weights, schedules, appts] = await Promise.all([
    listRecords(db, pet.id),
    listMeasurements(db, pet.id),
    listAllSchedules(db),
    upcomingAppointments(db, pet.id, Date.now(), 10),
  ]);
  const L: string[] = [];
  L.push(`${pet.name} — care summary`);
  L.push(`Prepared ${formatDateLong(dayKeyOf(new Date()))} with Pavurio. Entered by the owner; not a medical record.`);
  L.push('');
  L.push(`Species: ${pet.species === 'dog' ? 'Dog' : 'Cat'}`);
  if (pet.birthDate) L.push(`Born: ${formatDateLong(pet.birthDate)}${ageText(pet.birthDate) ? ` (${ageText(pet.birthDate)})` : ''}`);
  if (pet.adoptionDate) L.push(`Adopted: ${formatDateLong(pet.adoptionDate)}`);
  const lastW = weights[weights.length - 1];
  if (lastW) L.push(`Weight: ${formatWeight(lastW, unit)} on ${formatDateLong(dayKeyOf(new Date(lastW.at)))}`);

  const section = (title: string, kinds: string[]) => {
    const rs = records.filter((r) => kinds.includes(r.kind));
    if (!rs.length) return;
    L.push('');
    L.push(title.toUpperCase());
    for (const r of rs) {
      const src = SOURCES.find((s) => s.id === r.source)?.label;
      L.push(`• ${r.title} — ${formatDateLong(r.date)}${r.dueDate ? ` · next due ${formatDateLong(r.dueDate)}` : ''}${src ? ` · ${src}` : ''}`);
      if (r.notes) L.push(`  ${r.notes.replace(/\n+/g, ' ')}`);
      if (r.attachments.length) L.push(`  ${r.attachments.length} attachment${r.attachments.length === 1 ? '' : 's'} in the app`);
    }
  };
  section('Allergies', ['allergy']);
  section('Medication', ['medication']);
  section('Vaccines', ['vaccine']);
  section('Vet visits', ['vet_visit']);
  section('Other notes', ['other']);

  const mine = schedules.filter((s) => s.petId === pet.id && s.enabled);
  if (mine.length) {
    L.push('');
    L.push('DAILY ROUTINE');
    for (const s of mine) L.push(`• ${s.title}: ${describeDays(s.days)} at ${s.times.map(formatTime24to12).join(', ')}`);
  }
  if (appts.length) {
    L.push('');
    L.push('UPCOMING APPOINTMENTS');
    for (const a of appts) L.push(`• ${a.title} — ${formatDateLong(dayKeyOf(new Date(a.at)))}${a.location ? `, ${a.location}` : ''}`);
  }
  if (weights.length > 1) {
    L.push('');
    L.push('WEIGHT HISTORY');
    for (const w of weights.slice(-8)) L.push(`• ${formatDateLong(dayKeyOf(new Date(w.at)))}: ${formatWeight(w, unit)}`);
  }
  return L.join('\n') + '\n';
}
