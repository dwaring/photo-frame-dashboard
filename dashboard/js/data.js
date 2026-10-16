// Household display settings and sample data for channels not yet connected.
// Calendar events start empty and are populated by Google Calendar.
window.DATA = (function () {
  var ALL = ['darren', 'nadine', 'harvey', 'frankie'];

  var people = [
    { id: 'darren', name: 'Darren', color: '#2D5BFF', rgb: '45 91 255', ink: '#FFFFFF', home: false, status: 'Driving home', eta: 12 },
    { id: 'nadine', name: 'Nadine', color: '#E4007C', rgb: '228 0 124', ink: '#FFFFFF', home: false, status: 'At the office' },
    { id: 'frankie', name: 'Frankie', age: 7, color: '#FFB000', rgb: '255 176 0', ink: '#111111', home: true, status: 'Home' },
    { id: 'harvey', name: 'Harvey', age: 5, color: '#00A36C', rgb: '0 163 108', ink: '#FFFFFF', home: true, status: 'Home' }
  ];
  var family = { id: 'family', name: 'Family', color: '#111111', rgb: '17 17 17', ink: '#FFFFFF' };

  // Populated only by the connected Google Calendar integration.
  var events = [];

  // ---------------------------------------------------------------- chores
  var routines = [
    { id: 'morning', name: 'Morning', range: '6 – 11 AM', from: 0, to: 11 },
    { id: 'after', name: 'After school', range: '11 AM – 5 PM', from: 11, to: 17 },
    { id: 'evening', name: 'Evening', range: '5 – 10 PM', from: 17, to: 24 }
  ];
  var cid = 0;
  function chore(r, who, title, emoji, stars, done, extra) {
    return Object.assign({ id: 'c' + (++cid), r: r, who: who, title: title, emoji: emoji, stars: stars, done: !!done }, extra || {});
  }
  var chores = [
    chore('morning', 'harvey', 'Make bed', '🛏️', 1, true),
    chore('morning', 'harvey', 'Brush teeth', '🪥', 1, true),
    chore('morning', 'harvey', 'Pack backpack', '🎒', 1, true),
    chore('morning', 'frankie', 'Make bed', '🛏️', 1, true),
    chore('morning', 'frankie', 'Brush teeth', '🪥', 1, true),
    chore('morning', 'frankie', 'Get dressed', '👕', 1, false),
    chore('morning', 'darren', 'School drop-off', '🚗', 0, true),
    chore('morning', 'nadine', 'Pack lunches', '🥪', 0, true),
    chore('morning', 'any', 'Feed Biscuit', '🐶', 1, true),

    chore('after', 'harvey', 'Unpack lunchbox', '🥪', 1, true),
    chore('after', 'harvey', 'Homework', '📚', 2, false),
    chore('after', 'harvey', 'Pack soccer bag', '⚽', 1, false),
    chore('after', 'frankie', 'Unpack lunchbox', '🥪', 1, true),
    chore('after', 'frankie', 'Read for 20 min', '📖', 2, false),
    chore('after', 'frankie', 'Practice piano', '🎹', 2, false),
    chore('after', 'frankie', 'Tidy the Lego', '🧱', 1, false),
    chore('after', 'darren', 'Take out recycling', '♻️', 0, false, { overdue: true }),
    chore('after', 'darren', 'Call the plumber', '☎️', 0, true),
    chore('after', 'nadine', 'Fold laundry', '🧺', 0, false),
    chore('after', 'nadine', 'Order Zoe’s gift', '🎁', 0, true),
    chore('after', 'any', 'Water the plants', '🪴', 1, false),
    chore('after', 'any', 'Empty dishwasher', '🍽️', 2, false),
    chore('after', 'any', 'Walk Biscuit', '🐕', 2, true),

    chore('evening', 'harvey', 'Set the table', '🍴', 1, false),
    chore('evening', 'harvey', 'Lay out clothes', '👕', 1, false),
    chore('evening', 'harvey', 'Shower', '🚿', 1, false),
    chore('evening', 'frankie', 'Clear plates', '🍽️', 1, false),
    chore('evening', 'frankie', 'Bath', '🛁', 1, false),
    chore('evening', 'frankie', 'Lay out clothes', '👕', 1, false),
    chore('evening', 'darren', 'Lock up', '🔐', 0, false),
    chore('evening', 'nadine', 'Run dishwasher', '🫧', 0, false),
    chore('evening', 'any', 'Wipe counters', '🧽', 1, false),
    chore('evening', 'any', 'Garbage to curb', '🗑️', 2, false)
  ];
  var stars = { harvey: 42, frankie: 57 };
  // Mon..Sun, 1 = all chores done, 0 = missed, null = future
  var week = { harvey: [1, 1, 0, 1, 1, 0, 1], frankie: [1, 0, 1, 1, 1, 1, 0] };

  // ---------------------------------------------------------------- shopping
  var stores = [{ id: 'grocer', name: 'Woolworths' }, { id: 'amazon', name: 'Amazon' }];
  var catOrder = {
    all: ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Snacks', 'Household'],
    grocer: ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Snacks', 'Household'],
    amazon: ['Household', 'Pantry', 'Snacks', 'Dairy & Eggs', 'Meat & Fish', 'Frozen', 'Produce', 'Bakery']
  };
  var gid = 0;
  function g(name, cat, qty, store, done, note) {
    return { id: 'g' + (++gid), name: name, cat: cat, qty: qty, store: store, done: !!done, note: note || '' };
  }
  var groceries = [];
  var catalog = [
    ['Apples', 'Produce'], ['Avocados', 'Produce'], ['Bananas', 'Produce'], ['Baby spinach', 'Produce'], ['Blueberries', 'Produce'],
    ['Broccoli', 'Produce'], ['Carrots', 'Produce'], ['Cucumber', 'Produce'], ['Garlic', 'Produce'], ['Grapes', 'Produce'],
    ['Lemons', 'Produce'], ['Limes', 'Produce'], ['Onions', 'Produce'], ['Potatoes', 'Produce'], ['Strawberries', 'Produce'],
    ['Tomatoes', 'Produce'], ['Bread', 'Bakery'], ['Bagels', 'Bakery'], ['Croissants', 'Bakery'], ['Sourdough loaf', 'Bakery'],
    ['Tortillas', 'Bakery'], ['Hamburger buns', 'Bakery'], ['Bacon', 'Meat & Fish'], ['Chicken breasts', 'Meat & Fish'],
    ['Chicken thighs', 'Meat & Fish'], ['Ground beef', 'Meat & Fish'], ['Salmon fillets', 'Meat & Fish'], ['Shrimp', 'Meat & Fish'],
    ['Butter', 'Dairy & Eggs'], ['Cheddar', 'Dairy & Eggs'], ['Cream cheese', 'Dairy & Eggs'], ['Eggs', 'Dairy & Eggs'],
    ['Greek yogurt', 'Dairy & Eggs'], ['Milk 2%', 'Dairy & Eggs'], ['Oat milk', 'Dairy & Eggs'], ['Parmesan', 'Dairy & Eggs'],
    ['Black beans', 'Pantry'], ['Cereal', 'Pantry'], ['Coffee beans', 'Pantry'], ['Flour', 'Pantry'], ['Honey', 'Pantry'],
    ['Maple syrup', 'Pantry'], ['Olive oil', 'Pantry'], ['Pasta sauce', 'Pantry'], ['Peanut butter', 'Pantry'], ['Rice', 'Pantry'],
    ['Spaghetti', 'Pantry'], ['Sugar', 'Pantry'], ['Tea', 'Pantry'], ['Frozen peas', 'Frozen'],
    ['Frozen berries', 'Frozen'], ['Ice cream', 'Frozen'], ['Pizza', 'Frozen'], ['Waffles', 'Frozen'], ['Chips', 'Snacks'],
    ['Crackers', 'Snacks'], ['Dark chocolate', 'Snacks'], ['Goldfish crackers', 'Snacks'], ['Granola bars', 'Snacks'],
    ['Popcorn', 'Snacks'], ['Dish soap', 'Household'], ['Dishwasher pods', 'Household'], ['Garbage bags', 'Household'],
    ['Laundry detergent', 'Household'], ['Paper towels', 'Household'], ['Toilet paper', 'Household'], ['Toothpaste', 'Household']
  ];
  // Filled from the Todoist Shopping usuals project after sync.
  var usuals = [];

  // ---------------------------------------------------------------- home control
  var rooms = [
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'living', name: 'Living Room' },
    { id: 'entry', name: 'Entry + Garage' },
    { id: 'upstairs', name: 'Upstairs' },
    { id: 'yard', name: 'Backyard' }
  ];
  var devices = [
    { id: 'k-pend', room: 'kitchen', type: 'light', name: 'Pendants', on: true, level: 80 },
    { id: 'k-under', room: 'kitchen', type: 'light', name: 'Under Cabinet', on: true, level: 55 },
    { id: 'k-island', room: 'kitchen', type: 'light', name: 'Island', on: false, level: 100 },
    { id: 'k-speaker', room: 'kitchen', type: 'blind', name: 'Window Shade', pos: 100 },
    { id: 'l-lamp', room: 'living', type: 'light', name: 'Floor Lamp', on: true, level: 45 },
    { id: 'l-ceil', room: 'living', type: 'light', name: 'Ceiling', on: false, level: 100 },
    { id: 'l-blinds', room: 'living', type: 'blind', name: 'Blinds', pos: 60 },
    { id: 'l-fire', room: 'living', type: 'light', name: 'Mantel', on: false, level: 70 },
    { id: 'e-door', room: 'entry', type: 'lock', name: 'Front Door', locked: true },
    { id: 'e-porch', room: 'entry', type: 'light', name: 'Porch', on: true, level: 100 },
    { id: 'g-door', room: 'entry', type: 'garage', name: 'Garage', state: 'closed' },
    { id: 'g-side', room: 'entry', type: 'lock', name: 'Side Door', locked: true },
    { id: 'u-harvey', room: 'upstairs', type: 'light', name: "Buzzsaw's Lamp", on: true, level: 30 },
    { id: 'u-frankie', room: 'upstairs', type: 'light', name: "Skidmark's Nightlight", on: false, level: 15 },
    { id: 'u-hall', room: 'upstairs', type: 'light', name: 'Hallway', on: false, level: 60 },
    { id: 'u-bath', room: 'upstairs', type: 'light', name: 'Bathroom', on: false, level: 100 },
    { id: 'y-string', room: 'yard', type: 'light', name: 'String Lights', on: false, level: 100, flaky: true },
    { id: 'y-back', room: 'yard', type: 'lock', name: 'Back Door', locked: true },
    { id: 'y-flood', room: 'yard', type: 'light', name: 'Floodlight', on: false, level: 100 }
  ];
  var climate = { current: 20.5, set: 21.5, mode: 'heat', humidity: 42, outside: 14 };
  var media = { room: 'Kitchen', title: 'Harvest Moon', artist: 'Neil Young', playing: true, volume: 35, seed: 'harvest-vinyl' };
  var cameras = [
    { id: 'c-front', name: 'Front Porch', seed: 'porch-steps' },
    { id: 'c-drive', name: 'Driveway', seed: 'driveway-maple' },
    { id: 'c-yard', name: 'Backyard', seed: 'garden-yard' }
  ];
  var scenes = [
    { id: 'morning', name: 'Morning', icon: 'sunrise', set: { 'k-pend': 100, 'k-under': 80, 'l-blinds': 100, 'l-lamp': 0, 'u-hall': 60 } },
    { id: 'dinner', name: 'Dinner', icon: 'utensils', set: { 'k-pend': 55, 'k-under': 30, 'k-island': 70, 'l-lamp': 40, 'l-ceil': 0 } },
    { id: 'movie', name: 'Movie', icon: 'film', set: { 'k-pend': 0, 'k-under': 15, 'k-island': 0, 'l-lamp': 15, 'l-ceil': 0, 'l-blinds': 0, 'l-fire': 30 } },
    { id: 'away', name: 'Away', icon: 'away', set: { 'k-pend': 0, 'k-under': 0, 'k-island': 0, 'l-lamp': 0, 'l-ceil': 0, 'l-fire': 0, 'u-harvey': 0, 'u-hall': 0, 'e-porch': 100 } },
    { id: 'night', name: 'Goodnight', icon: 'moon', set: { 'k-pend': 0, 'k-under': 10, 'k-island': 0, 'l-lamp': 0, 'l-ceil': 0, 'l-fire': 0, 'u-hall': 10, 'u-frankie': 15, 'e-porch': 0 } }
  ];

  // Populated by the live Adelaide weather integration.
  var weather = { location: 'Adelaide, AU', status: 'loading', hourly: [] };

  // ---------------------------------------------------------------- photos
  var t = new Date();
  var mmdd = ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  var photos = [
    { seed: 'tofino-surf', o: 'l', date: '2021-' + mmdd, place: 'Tofino, BC', from: 'nadine', tag: 'tofino' },
    { seed: 'cottage-dock', o: 'l', date: '2023-08-12', place: 'Lake of Bays', from: 'darren', tag: 'cottage' },
    { seed: 'maya-kite', o: 'p', date: '2024-05-19', place: 'Humber Bay Park', from: 'nadine', tag: 'spring24' },
    { seed: 'otto-kite', o: 'p', date: '2024-05-19', place: 'Humber Bay Park', from: 'darren', tag: 'spring24' },
    { seed: 'autumn-walk', o: 'l', date: '2022-10-09', place: 'High Park', from: 'darren', tag: 'fall22' },
    { seed: 'birthday-cake', o: 'p', date: '2025-10-12', place: 'Home', from: 'nadine', tag: 'bday25' },
    { seed: 'candles-lit', o: 'p', date: '2025-10-12', place: 'Home', from: 'darren', tag: 'bday25' },
    { seed: 'mountain-lake', o: 'l', date: '2019-' + mmdd, place: 'Banff, AB', from: 'darren', tag: 'banff' },
    { seed: 'snow-day', o: 'l', date: '2024-01-21', place: 'Riverdale Hill', from: 'nadine', tag: 'winter24' },
    { seed: 'beach-dunes', o: 'l', date: '2023-07-02', place: 'Sandbanks', from: 'harvey', tag: 'sandbanks' },
    { seed: 'city-night', o: 'l', date: '2022-12-18', place: 'Nathan Phillips Sq.', from: 'nadine', tag: 'xmas22' },
    { seed: 'garden-bloom', o: 'p', date: '2025-06-08', place: 'Backyard', from: 'frankie', tag: 'garden' },
    { seed: 'tomato-haul', o: 'p', date: '2025-06-08', place: 'Backyard', from: 'harvey', tag: 'garden' },
    { seed: 'road-trip', o: 'l', date: '2024-08-04', place: 'Cabot Trail, NS', from: 'darren', tag: 'ns' },
    { seed: 'campfire', o: 'l', date: '2024-08-06', place: 'Cape Breton', from: 'nadine', tag: 'ns' },
    { seed: 'forest-path', o: 'l', date: '2020-09-26', place: 'Algonquin', from: 'darren', tag: 'algonquin' },
    { seed: 'pancakes', o: 'p', date: '2026-03-14', place: 'Home', from: 'harvey', tag: 'pancakes' },
    { seed: 'sugar-shack', o: 'p', date: '2026-03-14', place: 'Sugar Shack', from: 'nadine', tag: 'pancakes' },
    { seed: 'harbour-sail', o: 'l', date: '2025-07-19', place: 'Toronto Harbour', from: 'frankie', tag: 'sail' },
    { seed: 'pumpkins', o: 'l', date: '2025-10-25', place: "Chudleigh's", from: 'harvey', tag: 'fall25' }
  ];


  return {
    people: people, family: family, ALL: ALL,
    events: events,
    routines: routines, chores: chores, stars: stars, week: week,
    stores: stores, catOrder: catOrder, groceries: groceries, catalog: catalog, usuals: usuals,
    rooms: rooms, devices: devices, climate: climate, media: media, cameras: cameras, scenes: scenes,
    weather: weather, photos: photos,
    _gid: function () { return 'g' + (++gid); }
  };
})();
