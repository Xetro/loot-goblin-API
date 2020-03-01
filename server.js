const express = require('express');
const graphqlHTTP = require('express-graphql');
const graphql = require('graphql');
const joinMonster = require('join-monster');
const moment = require('moment');
const { Pool, Client } = require('pg');
const format = require('pg-format');
const pool = new Pool();

console.log(moment().subtract(3, 'days').format());

const Category = new graphql.GraphQLObjectType({
  name: 'Category',
  fields: () => ({
    id: { type: graphql.GraphQLString },
    name: { type: graphql.GraphQLString },
  }),
});

Category._typeConfig = {
  sqlTable: 'categories',
  uniqueKey: 'id',
};


const Item = new graphql.GraphQLObjectType({
  name: 'Item',
  fields: () => ({
    id: { type: graphql.GraphQLString },
    name: { type: graphql.GraphQLString },
    imageName: { type: graphql.GraphQLString },
    wikiPageId: { type: graphql.GraphQLString },
    slots: { type: graphql.GraphQLString },
    slotsHeight: { type: graphql.GraphQLString },
    slotsWidth: { type: graphql.GraphQLString },
    imageUrl: { type: graphql.GraphQLString },
    category: {
      type: Category,
      sqlJoin: (itemsTable, categoriesTable, args) => `${itemsTable}."categoryId" = ${categoriesTable}.id`
    },
    latestPrice: {
      type: graphql.GraphQLInt,
      sqlExpr: itemsTable => `(
        SELECT price FROM prices p
        INNER JOIN (
          SELECT "itemId", max(timestamp) as latest
          FROM prices
          WHERE "itemId" = ${itemsTable}.id
          GROUP BY "itemId"
        ) latest_price 
        ON p."itemId" = latest_price."itemId" AND p.timestamp = latest_price.latest
      )`,
    },
    timeSeries: {
      type: new graphql.GraphQLList(Price),
      args: { from: { type: graphql.GraphQLNonNull(graphql.GraphQLString) }, to: { type: graphql.GraphQLNonNull(graphql.GraphQLString) } },
      resolve: (parent, args, context, resolveInfo) => {
        console.log(context.allowTimeseries);
        if(context.allowTimeseries === true) {
          console.log('returning timeseries', parent);
          return parent.timeSeries;
        }

        return null;
      },
      sqlJoin: (itemsTable, pricesTable, args) => `${itemsTable}.id = ${pricesTable}."itemId" AND ${pricesTable}.timestamp >= timestamp '${args.from}' AND ${pricesTable}.timestamp <= timestamp '${args.to}'`
    }
  }),
});

Item._typeConfig = {
  sqlTable: 'items',
  uniqueKey: 'id',
};

const Price = new graphql.GraphQLObjectType({
  name: 'Price',
  fields: () => ({
    id: { type: graphql.GraphQLString },
    price: { type: graphql.GraphQLString },
    timestamp: { type: graphql.GraphQLString },
    item: {
      type: Item,
      sqlJoin: (pricesTable, itemsTable, args) => `${pricesTable}."itemId"  = ${itemsTable}.id`
    },
  }),
});

Price._typeConfig = {
  sqlTable: 'prices',
  uniqueKey: 'id',
};


const QueryRoot = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    items: {
      type: new graphql.GraphQLList(Item),
      args: { categoryIds: { type: graphql.GraphQLList(graphql.GraphQLInt) } },
      where: (itemsTable, args, context) => {
        if (Object.keys(args).length && args.categoryIds.length) {
          return format(`${itemsTable}."categoryId" IN %L`, [args.categoryIds]);
        }
      },
      resolve: (parent, args, context, resolveInfo) => {
        context.allowTimeseries = false;
        return joinMonster.default(resolveInfo, {}, (sql) => {
          console.log(sql);
          return pool.query(sql);
        });
      }
    },
    item: {
      type: Item,
      args: { id: { type: graphql.GraphQLNonNull(graphql.GraphQLInt) } },
      where: (itemsTable, args, context) => `${itemsTable}.id = ${args.id}`,
      resolve: (parent, args, context, resolveInfo) => {
        context.allowTimeseries = true;
        return joinMonster.default(resolveInfo, {}, (sql) => {
          console.log(sql);
          return pool.query(sql);
        });
      }
    },
  })
});

const schema = new graphql.GraphQLSchema({
  query: QueryRoot
});

const app = express();
app.use('/api', graphqlHTTP({
  schema: schema,
  graphiql: true,
}));

app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
