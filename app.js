var fs = require('fs');
var datpix = require('./module.js');
var yuri = require('url');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var app = express();
var session = require('express-session');
var crypto = require('crypto');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

//./run.sh

const db = new sqlite3.Database('./config/plantcarebook.db');

// const db = require('./config/db');  Require the database connection

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } //CHANGE B4 PRODUCTION!!!
}));

const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next(); // User is authenticated, continue to next middleware
    } else {
        res.redirect('/login'); // User is not authenticated, redirect to login page
    }
}

const requireNoAuth = (req, res, next) => {
    if (req.session.userId) {
        res.redirect('/'); //User is authenticated, send to HOME page
    } else {
        next(); // User isn't authenticated, may use login
    }
}

app.get('/', requireAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'datatest.html'));
 });

app.get('/login', requireNoAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
 });

app.get('/register', requireNoAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
 });

app.post('/validate', (req, res) => {
    const { username } = req.body;
    const password = sha256(req.body.password);
    console.log(username, password);
    //console.log(datpix.foo());
    db.get('SELECT * FROM Users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err)  {
            console.error('internal server error after login:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Incorrect username or password');
            res.status(401).send('Incorrect username or password'); //401 unauthorized
            return;
        }
        const userId = row.user_id;
        req.session.userId = userId;
        console.log('User is validated!'); // Log successful login attempt
        res.redirect('/');
    });
});

app.post('/newuser', (req, res) => { //CHECK IF USERNAME EXISTS, +INCLUDE REPEAT-PASS, +CHECK SYMBOLS
    const { username, password, repeatPassword } = req.body;
    db.get('SELECT 1 FROM Users WHERE username = ?', [username], (err, row) => { //check if username already exists
      if (err) {
        console.error('internal server error querying username:', err);
        res.status(500).send('Internal Server Error'); //500 internal server error
        return;
      }
      if (row) { //check whether a row with such username already exists
        res.status(400).send('Username already exists')
        return;
      }
      if (isAlphaNumeric(username) == false) { //check whether username only includes allowed symbols
        res.status(400).send('Username includes unpermitted symbols. Please only use alphanumeric symbols(a-z, A-Z, 0-9)')
        return;
      } //Username OK, move on
      if (password !== repeatPassword) { //check whether password fields match
        res.status(400).send('Passwords do not match');
        return;
      }
      if (isAcceptable(password) == false) { //check whether password only includes allowed symbols
        res.status(400).send('Username includes unpermitted symbols. Please only use alphanumeric symbols(a-z, A-Z, 0-9) and common special symbols(#?!@$%^&-*)');
        return;
      } //Password OK, move on
      const hashedPassword = sha256(password); //hash before inserting
      console.log(username, hashedPassword);
      db.run('INSERT INTO Users(username, password) VALUES(?, ?)', [username, hashedPassword], function(err) { //create new row(user) in db
          if (err)  {
              console.error('internal server error after creating user:', err);
              res.status(500).send('Internal Server Error'); //500 internal server error
              return;
          }
          console.log('User is created!'); // Log successful account creation attempt
          res.redirect('/login');
      });
    });
});

app.post('/newlog', requireAuth, (req, res) => { 
    var timestamp = new Date().toISOString();
    const userId = req.session.userId;
    const { plantId, logType, logInput } = req.body;
      db.run('INSERT INTO Logs(plant_id, user_id, time, type, content) VALUES(?, ?, ?, ?, ?)', [plantId, userId, timestamp, logType, logInput], function(err) { //create new row(log) in db
          if (err)  {
              console.error('internal server error after creating log:', err);
              res.status(500).send('Internal Server Error'); //500 internal server error
              return;
          }
          console.log('Log is created!'); // Log successful log creation attempt
      });
    });

app.get('/user', requireAuth, function (req, res) { //for fetching user data. to be used during active session
    const userId = req.session.userId;
    db.get('SELECT * FROM Users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('User not Found');
            res.status(404).send('404 Not Found'); //404 not found
            return;
        }
        console.log('user: success!');
        res.setHeader('Content-Type', 'application/json');
        res.json(row);
    });
});

app.get('/plants/:id', requireAuth, (req,res) => { //dynamically render EJS template about plant when requested
    const plantId = req.params.id;
    db.get('SELECT * FROM Plants WHERE plant_id = ?', [plantId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Plant not Found');
            res.status(404).send('404 Not Found'); //404 not found
            return;
        }
        console.log('id: success!')
        res.render('plant.ejs', { plant: row });
    });
});

app.get('/data', requireAuth, (req, res) => { //for fetching the entire plant data.
    db.all('SELECT * FROM Plants', (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            // Send JSON response with fetched data
            res.setHeader('Content-Type', 'application/json');
            res.json(rows);
        }
    });
});

function isAlphaNumeric(input) {
  const regex = /^[a-zA-Z0-9]+$/;
  return regex.test(input);
}

function isAcceptable(input) {
  const regex = /^[a-z0-9#?!@$%^&\-*]+$/i; //a-z0-9#?!@$%^&-*
  return regex.test(input);
}

function sha256(hashable) {
  return crypto.createHash('sha256').update(hashable).digest('hex');
}

 app.use((req, res) => {
    res.status(404).send('404 Not Found');
 });

 app.listen(8080, () => {
    console.log(`Server listening`);
});
