// Local configuration contains display preferences only, never credentials.
import defaults from '../config/example.json';
const local = import.meta.glob('../config/local.json', { eager: true, import: 'default' });
const config = Object.values(local)[0] || defaults;
document.title = config.title || defaults.title;
window.DASHBOARD_CONFIG = config;
for (const person of window.DATA.people) {
  if (config.peopleNames?.[person.id]) person.name = config.peopleNames[person.id];
}
