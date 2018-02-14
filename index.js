var MongoClient = require('mongodb').MongoClient;
var proxy = require('express-http-proxy');
var express = require('express');
var graphqlHTTP = require('express-graphql');
var { buildSchema } = require('graphql');

var mongoUrl = 'mongodb://localhost:27017/htaccess';
var dbName = 'testDB';

MongoClient.connect(mongoUrl)
.then((client, err) => {
  return new Promise((resolve, reject) => {
    if (err) {
      console.log(err);
      reject(err);
    }

    resolve(client.db(dbName)
    .collection('jobs')
    .find({})
    .toArray());
  });
})
.then((docs, err) => console.log(docs));

var schema = buildSchema(`
  input JobInput {
    name: String
    isSpecialization: Boolean
    base: ID
  }

  input FeatureInput {
    name: String
    desc: String
  }

  type Feature {
    id: ID!
    name: String
    desc: String
  }

  type FeatureRef {
    feature: ID!
    level: Int
  }

  type Job {
    id: ID!
    name: String
    isSpecialization: Boolean
    base: ID
    features: [FeatureRef]
    specializations: [ID]
  }

  type RandomDie {
    numSides: Int!
    rollOnce: Int!
    roll(numRolls: Int!, drop: Int): [Int]
    rollSum(numRolls: Int!, drop: Int): Int
  }

  type Query {
    dice(numSides: Int): RandomDie
    jobs(id: ID, ids: [ID], base: Boolean): [Job]
    features: [Feature]
  }

  type Mutation {
    createJob(input: JobInput): Job
    updateJob(id: ID!, input: JobInput): Job
    createFeature(input: FeatureInput): Feature
  }
`);

class Job {
  constructor(
    id,
    { name,
    isSpecialization,
    base = null,
    specializations = [],
    features = []}
  ) {
    this.id = id;
    this.name = name;
    this.isSpecialization = isSpecialization;
    this.base = base;
    this.features = features;
    this.specializations = isSpecialization ? null : specializations;
  }
}

class Feature {
  constructor(id, {name, desc}) {
    this.id = id;
    this.name = name;
    this.desc = desc;
  }
}

class RandomDie {
  constructor(numSides) {
    this.numSides = numSides;
  }

  rollOnce() {
    return 1 + Math.floor(Math.random() * this.numSides);
  }

  roll({numRolls, drop = 0}) {
    var output = [];
    for (var i = 0; i < numRolls; i++) {
      output.push(this.rollOnce());
    }
    return output.sort((a,b) => a-b).slice(-(numRolls - drop));
  }

  rollSum(args) {
    return this.roll(args).reduce((a,b) => (a+b));
  }
}

var root = {
  dice: ({numSides}) => new RandomDie(numSides || 6),

  createJob: ({input: {name, isSpecialization, base}}) => {
    return new Promise((resolve, reject) => {
      MongoClient.connect(mongoUrl)
      .then((client, err) => {
        if (err) { reject(err); }

        const collection = client.db(dbName).collection('jobs');

        collection.find({ value: { 'name': name } })
        .toArray()
        .then((docs, err) => {
          if (err) { reject(err); }

          if (docs.length === 0) {
            collection.insertOne({ value: { name, isSpecialization, base } })
            .then((result, err) => {
              if (err) { reject(err); }

              let {_id:id, value} = result.ops[0];
              resolve(new Job(id, value));
            });
          } else {
            collection.updateOne({ value: { name } },
              { $set: { value: { desc } } })
            .then((result, err) => {
              if (err) { reject(err); }

              let {_id:id, value} = result.ops[0];
              resolve(new Job(id, value));
            });
          }
        });
      });
    });
  },

  updateJob: ({id, input}) => {
    if (!jobDB[id]) {
      throw new Error('No job with ID ', id);
    }
    jobDB[id] = input;
    return new Job(id, input);
  },

  jobs: ({base = false, id = null, ids = null}) => {
    return new Promise((resolve, reject) => {
      if (ids) {
        MongoClient.connect(mongoUrl)
        .then((client, err) => {
          return new Promise((resolve, reject) => {
            if (err) { console.log(err); reject(err); }

            resolve(client.db(dbName)
            .collection('jobs')
            .find({ _id: { $in: ids } })
            .toArray());
          });
        })
        .then((docs, err) => {
          if (err) { console.log(err); reject(err); }

          resolve(docs.map(({_id:id, value}) => new Job(id, value)));
        });
      } else if (id) {
        MongoClient.connect(mongoUrl)
        .then((client, err) => {
          return new Promise((resolve, reject) => {
            if (err) { console.log(err); reject(err); }

            resolve(client.db(dbName)
            .collection('jobs')
            .findOne({ _id: id }));
          });
        })
        .then((docs, err) => {
          if (err) { console.log(err); reject(err); }

          resolve(new Job(docs[0].id, docs[0].value));
        });
      } else {
        MongoClient.connect(mongoUrl)
        .then((client, err) => {
          return new Promise((resolve, reject) => {
            if (err) { console.log(err); reject(err); }

            resolve(client.db(dbName)
            .collection('jobs')
            .find({})
            .toArray());
          });
        })
        .then((docs, err) => {
          if (err) { console.log(err); reject(err); }

          resolve(docs.map(({_id:id, value}) => new Job(id, value)));
        });
      }
    });
  },

  createFeature: ({input: {name, desc}}) => {
    return new Promise((resolve, reject) => {
      MongoClient.connect(mongoUrl)
      .then((client, err) => {
        if (err) { reject(err); }

        const collection = client.db(dbName).collection('features');

        collection.find(({ value: {'name': name} }))
        .toArray()
        .then((docs, err) => {
          if (err) { reject(err); }

          if (docs.length === 0) {
            collection.insertOne({ value: { name, desc } })
            .then((result, err) => {
              if (err) { reject(err); }

              let {_id:id, value} = result.ops[0];
              resolve(new Feature(id, value));
            });
          } else {
            collection.updateOne({ value: { name } },
              { $set: { value: { desc } } })
            .then((result, err) => {
              if (err) { reject(err); }

              let {_id:id, value} = result.ops[0];
              resolve(new Feature(id, value));
            });
          }
        });
      });
    });
  },

  features: () => {
    return new Promise((resolve, reject) => {
      MongoClient.connect(mongoUrl)
      .then((client, err) => {
        return new Promise((resolve, reject) => {
          if (err) { console.log(err); reject(err); }

          resolve(client.db(dbName)
          .collection('features')
          .find({})
          .toArray());
        });
      })
      .then((docs, err) => {
        if (err) { console.log(err); reject(err); }

        resolve(docs.map(({_id:id, value, name, desc}) =>
          new Feature(id, value ? value : {name, desc})))
      });
    });
  }
};

var app = express();
app.use(express.static('dist'));
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true
}));
app.use('*', proxy('localhost:4000/'));
app.listen(4000);
console.log('Running a GraphQL API server at localhost:4000/graphql');
