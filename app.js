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
            res.status(500).json({ error: 'Internal Server Error' }); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Incorrect username or password');
            res.status(401).json({ error: 'Incorrect username or password' }); //401 unauthorized
            return;
        }
        const userId = row.user_id;
        req.session.userId = userId;
        console.log('User is validated!'); // Log successful login attempt
        res.redirect('/');
    });
});

app.post('/newuser', (req, res) => { //CHECK IF USERNAME EXISTS, +INCLUDE REPEAT-PASS, +CHECK SYMBOLS
    const { username } = req.body;
    const password = sha256(req.body.password);
    console.log(username, password);
    db.run('INSERT INTO Users(username, password) VALUES(?, ?)', [username, password], function(err) {
        if (err)  {
            console.error('internal server error after creating user:', err);
            res.status(500).json({ error: 'Internal Server Error' }); //500 internal server error
            return;
        }
        console.log('User is created!'); // Log successful account creation attempt
        res.redirect('/login');
    });
});

app.get('/user', requireAuth, function (req, res) {
    const userId = req.session.userId;
    db.get('SELECT * FROM Users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).json({ error: 'Internal Server Error' }); //500 internal server error
            return;
        }
        if (!row) {
            console.log('User not Found');
            res.status(404).json({ error: '404 Not Found' }); //404 not found
            return;
        }
        console.log('user: success!');
        res.setHeader('Content-Type', 'application/json');
        res.json(row);
    });
});

app.get('/plants/:id', requireAuth, (req,res) => {
    const plantId = req.params.id;
    db.get('SELECT * FROM Plants WHERE plant_id = ?', [plantId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).json({ error: 'Internal Server Error' }); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Plant not Found');
            res.status(404).json({ error: '404 Not Found' }); //404 not found
            return;
        }
        console.log('id: success!')
        res.render('plant.ejs', { plant: row });
    });
});

app.get('/data', requireAuth, (req, res) => {
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

//app.get('/username', (req, res) => {
//    db.all('SELECT * FROM Users', (err, rows) => { //FINISH HERE WHERE username = ?
//        if (err) {
//            console.error(err.message);
//            res.status(500).send('Internal Server Error');
//        } else {
//            // Send JSON response with fetched data
//            res.setHeader('Content-Type', 'application/json');
//            res.json(rows);
//        }
//    });
//});

function sha256(hashable) {
  return crypto.createHash('sha256').update(hashable).digest('hex');
}

 app.use((req, res) => {
    res.status(404).send('404 Not Found');
 });

 app.listen(8080, () => {
    console.log(`Server listening`);
});
