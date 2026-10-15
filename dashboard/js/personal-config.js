// Local configuration contains display preferences only, never credentials.
import defaults from '../config/example.json';
const local = import.meta.glob('../config/local.json', { eager: true, import: 'default' });
const config = Object.values(local)[0] || defaults;
document.title = config.title || defaults.title;
window.DASHBOARD_CONFIG = config;
const renamedPeople = window.DATA.people
  .filter(person => config.peopleNames?.[person.id])
  .map(person => [person.name, config.peopleNames[person.id]]);
function personalizeLabel(label) {
  return renamedPeople.reduce((text, [original, replacement]) => text.split(original).join(replacement), label);
}
for (const event of window.DATA.events) event.title = personalizeLabel(event.title);
for (const device of window.DATA.devices) device.name = personalizeLabel(device.name);
for (const person of window.DATA.people) {
  if (config.peopleNames?.[person.id]) person.name = config.peopleNames[person.id];
}
