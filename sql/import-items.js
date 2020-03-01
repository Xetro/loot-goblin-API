const { Pool } = require('pg');
const format = require('pg-format');
const fs = require('fs');
const path = require('path');

const readWikiData = () => {
  const wikiDataPath = path.resolve(__dirname, '../../tarkov-AH-scrapper/data/wiki');
  const fileNames = fs.readdirSync(wikiDataPath);
  let final = [];
  fileNames.forEach((filename) => {
    let data = fs.readFileSync(wikiDataPath + '/' + filename, 'utf-8');
    data = JSON.parse(data);
    final.push.apply(final, data);
  });
  return final;
}

const main = async () => {
  const wikiItems = await readWikiData();
  const pool = new Pool();

  let variables = wikiItems.map((item) => [
    item.name,
    item.category,
    item.image,
    parseInt(item.pageId),
    item.size.width * item.size.height,
    parseInt(item.size.height),
    parseInt(item.size.width),
    item.imagePath,
  ]);

  const query = format(`
    WITH insert ( item, "categoryName", "image_name", "wikipage_id", slots, "slots_height", "slots_width", "image_url" ) AS
    ( VALUES %L )  
    INSERT INTO items
      ( item, "category_id", "image_name", "wikipage_id", slots, "slots_height", "slots_width", "image_url" ) 
    SELECT 
        insert.item, categories.category_id, insert."image_name", insert."wikipage_id"::int, insert.slots::int, insert."slots_height"::int, insert."slots_width"::int, insert."image_url"
    FROM 
      categories JOIN insert
        ON insert."categoryName" = categories.category ;
  `, variables)

  try {
    const res = await pool.query(query);
    console.log(res);
  } catch (err) {
    console.log(err.stack);
  }
}


(async () => {
  main();
})();

