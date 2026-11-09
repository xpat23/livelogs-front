const dateFormatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });
const logFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function localDateTime(date = new Date()) {
  return `${localDate(date)}T${date.toTimeString().slice(0, 5)}`;
}

export function localDay(date) {
  return new Date(date + 'T00:00:00');
}

export function dateLabel(date) {
  return dateFormatter.format(localDay(date));
}

export function logLabel(date) {
  return logFormatter.format(new Date(date));
}

export function duration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} мин`;
  return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
}
