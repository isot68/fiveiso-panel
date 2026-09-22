import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import lua from 'luaparse';

// Parse data only: never execute resource Lua or its callbacks.
export function parseData(source) {
  const ast = lua.parse(source.replace(/`([^`\r\n]*)`/g, (_, hash) => JSON.stringify(hash)), { luaVersion: '5.3' });
  function literal(node) {
    if (!node) return undefined;
    if (node.type === 'StringLiteral') return node.raw.slice(1, -1).replace(/\\([\\'"nrt])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] || c));
    if (node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') return node.value;
    if (node.type !== 'TableConstructorExpression') return undefined;
    const result = Object.create(null);
    for (const field of node.fields) {
      const key = field.type === 'TableKeyString' ? field.key.name : field.type === 'TableKey' ? literal(field.key) : undefined;
      if (key !== undefined) result[key] = literal(field.value);
    }
    return result;
  }
  return literal(ast.body.findLast((node) => node.type === 'ReturnStatement')?.arguments[0]) || {};
}

export function itemGroup(name, item, category = 'Items') {
  const code = name.toLowerCase();
  const label = String(item.label || '').toLocaleLowerCase('tr');
  const status = item.client?.status || {};
  if (category !== 'Items' || /^weapon_/i.test(name) || /(?:^ammo[-_]|sarjor|magazine|^zirhbox)/i.test(code)) return 'weapons';
  if (/(?:bandage|firstaid|ifak|medkit|painkiller|armor|armour|healing|healthkit)/i.test(code)
    || /(?:bandaj|ilk yardım|ağrı kesici|zırh)/i.test(label)) return 'health';
  if (status.thirst && !status.hunger) return 'drinks';
  if (status.hunger) return 'food';
  if (/(?:seed|fertilizer|_leaf$)/i.test(code)) return 'other';
  if (/(?:coffee|latte|espresso|mocha|cappuccino|tea$|juice|smoothie|milkshake|bubbletea|water|soda|ecola|sprunk|lemonade|cocktail|martini|mojito|margarita|whisky|whiskey|vodka|tequila|champagne|wine|^ale$|^gin$|^raki$|^tonic$|^milk$|^bellini$|^mimosa$|^pilsner$|^stout$|^ryes$|^blonde$|^larger$|^bordeaux$|^cabernet$|^chardonnay$|^burgundy$|^white$|^zifandel$|^midori$|^sake$|^caiprinha$|^cosmopolitan$|^cuba_libre$|^mai_tai$|^old_fashioned$|^pina_colada$|^sex_on_the_beach$|^moscow_mule$|^tom_collins$|^grey_hound$|^blue_lagoon$|^bloody_mary$|^harvey_wallbanger$|^mint_julep$)/i.test(code)
    || /(?:içecek|kahve|çay|suyu|şarap|bira|kokteyl|limonata)/i.test(label)) return 'drinks';
  if (/(?:burger|pizza|sandwich|taco|kebab|ramen|soup|sushi|salad|donut|muffin|macaroon|icecream|cake|cheesecake|brownies|bagel|mochi|hotdog|fries|noodles|spagetti|smoothie|fruit|strawberry|apple|banana|avokado|orange|peach|pineapple|watermelon|cherry|berry|grape|kiwi|pear|plum|lemon|lime|coconut|carrot|tomato|potato|lettuce|onion|pepper|beef|chicken|meat|sausage|bacon|egg|cheese|milk|bread|dough|flour|rice|sugar|chocolate|vanilla|mint|pickle|ketchup|mustard|mayonnaise|sauce|wasabi|nori|tofu|crab|lobster|octopus|salmon|tuna|perch|trout|carp|bass|mullet|turtle|mushroom|quesadilla|tiramisu|bento|miso|tortilla|nugget|spice|candy|cereal|packet(?:burger|pizza|icecream|beanmachine|koi|uwu|dinner|hornys|pondcafe|suncafe|noircafe|irishpub|lumipier|lespoir|pearls|saltlab|tequila|atom|triads|vanillaunicorn|bahama))/i.test(code)
    || /(?:yemek|meyve|çorba|pasta|tatlı|dondurma|ekmek|peynir|etli|tavuklu)/i.test(label)) return 'food';
  return 'other';
}

export function readItemCatalog(directory) {
  const items = parseData(readFileSync(resolve(directory, 'items.lua'), 'utf8'));
  const weapons = parseData(readFileSync(resolve(directory, 'weapons.lua'), 'utf8'));
  const result = new Map();
  for (const [category, definitions] of Object.entries({ ...weapons, Items: items })) {
    for (const [name, item] of Object.entries(definitions || {})) {
      if (!item || typeof item !== 'object') continue;
      result.set(name, { name, label: item.label || name, weight: item.weight ?? 0,
        description: item.description || '', image: item.client?.image || name + '.png',
        stack: item.stack ?? (category !== 'Weapons'), category,
        group: itemGroup(name, item, category) });
    }
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}
