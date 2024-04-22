var fs = require('fs');
var datpix = require('./module.js');
var yuri = require('url');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var app = express();
var session = require('express-session')

app.use(express.urlencoded({ extended: true }));

//./run.sh
//NEED DB DEFINED
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

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
 });

 app.get('/datatest', requireAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'datatest.html'));
 });

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(username, password);
    console.log(datpix.foo());
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
        res.redirect('/datatest');
    });
});

app.get('/data', (req, res) => {
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

app.get('/username', (req, res) => {
    db.all('SELECT username FROM Users', (err, rows) => {
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

 app.use((req, res) => {
    res.status(404).send('404 Not Found')
 });

 app.listen(8080, () => {
    console.log(`Server listening`);
});
