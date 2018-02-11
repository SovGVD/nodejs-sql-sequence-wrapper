# Node.JS MySQL/MariaDB query sequence wrapper

Simple wrapper that will reduce callback-hell with multiple SQL queries.

## Features
 - Transactions with multiple queries
 - Hook to put ID's into next queries in transaction sequence
 - Access rights check during transaction (`APIprecheck` field in query)
 - Pagination data

## How to

### Connect
```js
var _sqldb = require("./sqldb.js");
var this.db = new _sqldb();
    this.db.init({host: 'production.server.example.co.nz', user: 'root', password: 'wowBestUserForThisDB', db: 'productiondb'});
```

### Simple transaction
Let's add new user, update users cache counter and return ID of new user as `UserID` and login we are use to create account:
```js
var transaction_data={out: { "UserID":"QueryOne", "_asis_-Login":"sovgvd" }, q:[]};
    transaction_data.q.push({qid:"QueryOne", q: "INSERT INTO `users` (login, password, is_admin) VALUES ('sovgvd', 'supersecret', 1);"});
    transaction_data.q.push({qid:"QueryTwo", q: "UPDATE `users_cache` SET value=value+1 WHERE `key`='users_counter';"});

    this.db.querySequence(transaction_data, 
        function (r) { 
            console.log("Result is:", r);
        },
        function (e) { 
            console.log("Something went wrong:", e);
        }
     );
```

### Using ID's
Now let's do the same, but update user status later and forget about login:
```js
var transaction_data={out: { "UserID":"QueryOne" }, q:[]};
    transaction_data.q.push({qid:"QueryOne", q: "INSERT INTO `users` (login, password) VALUES ('sovgvd', 'supersecret');"});
    transaction_data.q.push({qid:"QueryTwo", q: "UPDATE `users_cache` SET value=value+1 WHERE `key`='users_counter';"});
    transaction_data.q.push({qid:"QueryDoesNotMatter", q: "UPDATE `users` SET `is_admin`=1 WHERE `UserID`=_insertID.QueryOne;"});

    this.db.querySequence(transaction_data, 
        function (r) { 
            console.log("Result is:", r);
        },
        function (e) { 
            console.log("Something went wrong:", e);
        }
     );
```
Wow so magic...

### Check access right
And lets do the same, but lets first of all check, may be this `login` is in blacklist:
```js
var transaction_data={out: { "UserID":"QueryOne" }, q:[]};
    transaction_data.q.push({qid:"QueryZero", q: "SELECT if(count(`id`)>0,"y","n") APIprecheck FROM `blacklisted` WHERE `login`='badlogin'"});
    transaction_data.q.push({qid:"QueryOne", q: "INSERT INTO `users` (login, password) VALUES ('badlogin', 'qwerty');"});
    transaction_data.q.push({qid:"QueryTwo", q: "UPDATE `users_cache` SET value=value+1 WHERE `key`='users_counter';"});
    transaction_data.q.push({qid:"QueryDoesNotMatter", q: "UPDATE `users` SET `is_admin`=1 WHERE `UserID`=_insertID.QueryOne;"});

    this.db.querySequence(transaction_data, 
        function (r) { 
            console.log("Result is:", r);
        },
        function (e) { 
            console.log("Something went wrong:", e);
        }
     );
```
This transaction will stopped after `QueryZero`: `SELECT` has `APIprecheck` value that will be `n` in case of login `badlogin` present in table `blacklisted`. You could use another ways to make such kind of prechecks.

### Pagination data
Only for query requests and SQL DBs that support `SQL_CALC_FOUND_ROWS`
```js
this.db.query({q: "SELECT `login`, `is_admin` FROM `users` WHERE `is_active`=? ORDER BY `login` LIMIT 0,10", d: [ '1' ] }, function ( result, insertedID, extra ) {
   if (result === false) {
      // whoops, something wrong with query or DB
   } else {
     // `result` is an array with objects like { login: "sovgvd", is_admin: "1" } 
     // and `extra` is 
     //    {
     //       records: 199,
     //       limit: 10,
     //       offset: 0,
     //       order: ASC
     //    }
     // where `records` is a number of records in table `users`
   }
});
```

## Note
Please, user something like [Squel.js](https://hiddentao.com/squel/) to build SQL queries and think about possbile SQL-injections!
