const { Pool } = require('pg');
const format = require('pg-format');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const categories = require("../../tarkov-AH-scrapper/wiki-categories.json");

const pool = new Pool();

const dataBackupPath = path.resolve(__dirname, '../../tarkov-AH-scrapper/data/backup');

const getItems = async () => {
  try {
    const { rows } = await pool.query('SELECT * FROM items');
    return rows;
  } catch (error) {
    console.log('getItems() ERROR: ', error);
    throw error;
  }
}

const readBackups = () => {
  const fileNames = fs.readdirSync(dataBackupPath);
  let final = [];
  fileNames.forEach((filename) => {
    let data = fs.readFileSync(dataBackupPath + '/' + filename, 'utf-8');
    data = JSON.parse(data);
    final.push(data);
  });
  return final;
}

const main = async () => {
  const itemsDb = await getItems();
  let itemsFinal = new Map();

  itemsDb.forEach(item => {
    itemsFinal.set(item.item, {
      id: item.item_id,
      prices: {}
    })
  });


  let backups = readBackups();

  backups.forEach((backup) => {
    for (let item of backup) {
      let name;
      switch (item.name) {
        case 'Gemech ONE 7.62x51 Sound Suppressor':
          name = 'Gemtech ONE 7.62x51 Sound Suppressor';
          break;
      
        case 'CAA AKTS AK-74 Buffer Tube for AK and compatable':
          name = 'CAA AKTS AK-74 Buffer Tube for AK and compatible';
          break;

        case 'Compact mount Mount for sights':
          name = 'Compact mount for sights';
          break;
    
        case 'Strike Industries Viper carabine length M-LOK foregrip for AR-15':
          name = 'Strike Industries Viper carbine length M-LOK foregrip for AR-15';
          break;

        case 'Muzzle brake Desert Tech 5.56x45':
          name = 'Desert Tech 5.56x45 FlashHider';
          break;

        case 'Matches':
          name = 'Classic matches';
          break;
       
        case 'B&T MP9 Vertical grip':
          name = 'B&T MP9-N Vertical grip';
          break;

        case 'DS Arms Quad Rail Full Lenght foregrip for SA-58':
          name = 'DS Arms Quad Rail Full Length foregrip for SA-58';
          break;

        case 'EMTI-019 Mount':
          name = 'ETMI-019 Mount';
          break;

        case 'VOMZ Pilad 4х32 riflescope':
          name = 'VOMZ Pilad 4x32 riflescope';
          break;
          
        case 'Metal magazine for VPO-215 and compatibles, .366 TKM 10-round capacity':
          name = 'Metal magazine for VPO-215 and compatibles, .366 TKM 4-round capacity';
          break;
  

        default:
          name = item.name;
          break;
      }

      if (!item.timestamp || !item.price_avg) {
        continue;
      }

      if (categories[item.category].variants && categories[item.category].variants[name])  {
        for (let [variantName, data] of Object.entries(categories[item.category].variants[name])) {
          if (!itemsFinal.has(variantName)) {
            console.log('Missing item: ', name);
            continue;
          }
          let foo = itemsFinal.get(variantName);
          if (!foo.prices[item.timestamp]) {
            if (item.price_avg > 100000000) {
              continue;
            }
            foo.prices[item.timestamp] = item.price_avg;
          }
        }
      } else if (itemsFinal.has(name)) {
        let foo = itemsFinal.get(name);
        if (!foo.prices[item.timestamp]) {
          if (item.price_avg > 100000000) {
            continue;
          }
          foo.prices[item.timestamp] = item.price_avg;
        }
      } else {
        console.log('Missing item: ', name);
      }

    }
  });

  variables = [];
  itemsFinal.forEach((item) => {
    variables = variables.concat(Object.entries(item.prices).map(v => {
      let time = moment(v[0], 'YYYYMMDDHHmmss').format();
      v.splice(0, 2, item.id, v[1], time);
      return v;
    }));
  });

  const query = format(`
    INSERT INTO prices(
      "item_id", price, "timestamped")
      VALUES %L;
  `, variables);

try {
  const res = await pool.query(query);
  // console.log(query);
} catch (err) {
  console.log(err.stack);
}
}

(async () => {
  main();
})();
